"""Runtime configuration. Every value can be overridden with an environment variable."""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent


def _int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except ValueError:
        return default


@dataclass(frozen=True)
class Settings:
    # Where the trained model lives. Put your file at backend/models/rul_model.joblib
    model_path: Path = Path(os.environ.get("AEROGUARD_MODEL_PATH", BACKEND_DIR / "models" / "rul_model.joblib"))
    # Alternative model format: pure-NumPy LSTM weights + scaler statistics (see tools/keras_to_npz.py).
    # Used only when no rul_model.joblib exists.
    lstm_path: Path = Path(os.environ.get("AEROGUARD_LSTM_PATH", BACKEND_DIR / "models" / "rul_lstm.npz"))
    # Optional sidecar file describing the model (feature list, name, verified metrics...).
    model_meta_path: Path = Path(os.environ.get("AEROGUARD_MODEL_META", BACKEND_DIR / "models" / "model_meta.json"))

    max_upload_mb: int = _int("AEROGUARD_MAX_UPLOAD_MB", 20)
    max_rows: int = _int("AEROGUARD_MAX_ROWS", 250_000)
    max_units: int = _int("AEROGUARD_MAX_UNITS", 1_000)

    # Alert thresholds in cycles. These are AeroGuard product defaults, NOT outputs of the
    # model and NOT part of the NASA dataset. Tune them to your maintenance policy.
    rul_critical: int = _int("AEROGUARD_RUL_CRITICAL", 30)
    rul_warning: int = _int("AEROGUARD_RUL_WARNING", 75)

    # How many engines get full time-series detail in a response (lowest RUL first).
    max_detail_units: int = _int("AEROGUARD_MAX_DETAIL_UNITS", 12)
    max_series_points: int = _int("AEROGUARD_MAX_SERIES_POINTS", 120)

    cors_origins: tuple[str, ...] = tuple(
        o.strip()
        for o in os.environ.get(
            "AEROGUARD_CORS_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173",
        ).split(",")
        if o.strip()
    )
    frontend_dist: Path = Path(os.environ.get("AEROGUARD_FRONTEND_DIST", BACKEND_DIR.parent / "frontend" / "dist"))


def get_settings() -> Settings:
    return Settings()
