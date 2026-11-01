"""Turns per-row predictions into per-engine results, status levels and alerts."""
from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd

from .cmapss import SENSORS
from .config import Settings


def status_for(rul: float, s: Settings) -> str:
    if rul <= s.rul_critical:
        return "critical"
    if rul <= s.rul_warning:
        return "warning"
    return "healthy"


def _downsample_idx(n: int, max_points: int) -> np.ndarray:
    if n <= max_points:
        return np.arange(n)
    idx = np.unique(np.linspace(0, n - 1, max_points).round().astype(int))
    return idx


def _r(x: float, nd: int = 4) -> float:
    return round(float(x), nd)


def _drift_alerts(g: pd.DataFrame, sensor_cols: list[str]) -> list[dict[str, Any]]:
    """Heuristic: compare the latest readings with the engine's own early baseline. Not a model output."""
    n = len(g)
    if n < 20:
        return []
    base_n, recent_n = max(5, n // 5), max(5, n // 10)
    scored = []
    for c in sensor_cols:
        base, recent = g[c].iloc[:base_n], g[c].iloc[-recent_n:]
        sd = float(base.std(ddof=0))
        if sd < 1e-9:
            continue
        z = (float(recent.mean()) - float(base.mean())) / sd
        scored.append((abs(z), z, c, float(base.mean()), float(recent.mean())))
    scored.sort(reverse=True)
    out = []
    for _, z, c, b, r in scored[:3]:
        if abs(z) >= 3:
            meta = SENSORS.get(c, {"symbol": c, "label": c})
            out.append({
                "level": "info", "source": "heuristic", "sensor": c,
                "title": f"{meta['symbol']} ({c}) has drifted from its early baseline",
                "detail": f"Recent mean {r:.3f} vs early mean {b:.3f} ({z:+.1f} standard deviations of the early readings). Rule-based check, not a model prediction.",
            })
    return out


def build_units(df: pd.DataFrame, pred: np.ndarray, s: Settings) -> list[dict[str, Any]]:
    df = df.assign(_rul=pred)
    sensor_cols = [c for c in SENSORS if c in df.columns]
    varying = [c for c in sensor_cols if df[c].std(ddof=0) > 1e-9]

    units: list[dict[str, Any]] = []
    for unit, g in df.groupby("unit", sort=True):
        g = g.sort_values("cycle")
        rul = float(g["_rul"].iloc[-1])
        units.append({
            "unit": int(unit), "cycles_observed": int(len(g)), "last_cycle": int(g["cycle"].iloc[-1]),
            "predicted_rul": _r(rul, 2), "status": status_for(rul, s), "_g": g,
        })

    units.sort(key=lambda u: u["predicted_rul"])  # most urgent first
    for rank, u in enumerate(units):
        g: pd.DataFrame = u.pop("_g")
        if rank >= s.max_detail_units:
            u["detail"] = None
            continue
        idx = _downsample_idx(len(g), s.max_series_points)
        sub = g.iloc[idx]
        alerts: list[dict[str, Any]] = []
        if u["status"] == "critical":
            alerts.append({"level": "critical", "source": "model", "title": "Remaining life is within the critical threshold",
                           "detail": f"Predicted RUL {u['predicted_rul']:.0f} cycles is at or below {s.rul_critical}. Threshold is an AeroGuard default, not a NASA or model value."})
        elif u["status"] == "warning":
            alerts.append({"level": "warning", "source": "model", "title": "Remaining life is within the warning threshold",
                           "detail": f"Predicted RUL {u['predicted_rul']:.0f} cycles is at or below {s.rul_warning}. Threshold is an AeroGuard default, not a NASA or model value."})
        alerts += _drift_alerts(g, varying)

        stats = []
        for c in varying:
            first, last = float(g[c].iloc[0]), float(g[c].iloc[-1])
            stats.append({"sensor": c, "symbol": SENSORS[c]["symbol"], "label": SENSORS[c]["label"],
                          "first": _r(first), "last": _r(last), "change_pct": _r((last - first) / abs(first) * 100, 3) if abs(first) > 1e-12 else None})
        u["detail"] = {
            "rul_series": [{"cycle": int(c), "rul": _r(v, 2)} for c, v in zip(sub["cycle"], sub["_rul"])],
            "sensor_series": {c: [_r(v) for v in sub[c]] for c in varying},
            "sensor_cycles": [int(c) for c in sub["cycle"]],
            "sensor_stats": stats,
            "alerts": alerts,
        }
    return units
