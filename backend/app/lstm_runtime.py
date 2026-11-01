"""Pure-NumPy inference for the AeroGuard LSTM (2 x LSTM + Dense head, sliding window of past cycles).

The weights come from a trained Keras model (see tools/keras_to_npz.py) and are stored in a single .npz file, so the
server needs neither TensorFlow nor h5py. The maths mirrors Keras: gate order i, f, c, o; sigmoid recurrent
activation; tanh activation; dropout is inactive at inference.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

_PARAMS = ("k1", "r1", "b1", "k2", "r2", "b2", "d1w", "d1b", "d2w", "d2b")


def _sigmoid(x: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-x))


def _lstm_layer(x: np.ndarray, kernel: np.ndarray, recurrent: np.ndarray, bias: np.ndarray, return_sequences: bool) -> np.ndarray:
    n, steps, _ = x.shape
    units = recurrent.shape[0]
    h = np.zeros((n, units), np.float32)
    c = np.zeros((n, units), np.float32)
    # input projection for every step at once (one big matmul instead of `steps` small ones)
    xz = x @ kernel + bias
    outs = []
    for t in range(steps):
        z = xz[:, t] + h @ recurrent
        i, f, g, o = z[:, :units], z[:, units:2 * units], z[:, 2 * units:3 * units], z[:, 3 * units:]
        c = _sigmoid(f) * c + _sigmoid(i) * np.tanh(g)
        h = _sigmoid(o) * np.tanh(c)
        if return_sequences:
            outs.append(h)
    return np.stack(outs, axis=1) if return_sequences else h


class LSTMRegressor:
    """Scores each (engine, cycle) row using that engine's most recent `window` cycles.

    Cycles before an engine has `window` readings are padded by repeating its first reading (same rule the model
    was evaluated with), so early-cycle predictions are less reliable than later ones.
    """

    def __init__(self, params: dict[str, np.ndarray], mean: np.ndarray, scale: np.ndarray, window: int, features: list[str]):
        self.p = {k: np.asarray(params[k], np.float32) for k in _PARAMS}
        self.mean = np.asarray(mean, np.float32)
        self.scale = np.asarray(scale, np.float32)
        self.window = int(window)
        self.features = list(features)
        self.n_features_in_ = len(self.features)
        self._check()

    def _check(self) -> None:
        p, n = self.p, self.n_features_in_
        if self.mean.shape != (n,) or self.scale.shape != (n,):
            raise ValueError("scaler statistics do not match the feature list")
        if p["k1"].shape[0] != n or p["k1"].shape[1] != 4 * p["r1"].shape[0]:
            raise ValueError("first LSTM layer weights have unexpected shapes")
        if p["k2"].shape[0] != p["r1"].shape[0] or p["k2"].shape[1] != 4 * p["r2"].shape[0]:
            raise ValueError("second LSTM layer weights have unexpected shapes")
        if p["d1w"].shape[0] != p["r2"].shape[0] or p["d2w"].shape != (p["d1w"].shape[1], 1):
            raise ValueError("dense head weights have unexpected shapes")
        if self.window < 1 or (self.scale == 0).any():
            raise ValueError("invalid window or zero scale in the scaler statistics")

    @classmethod
    def from_npz(cls, path: Path) -> "LSTMRegressor":
        with np.load(path, allow_pickle=False) as z:
            missing = [k for k in (*_PARAMS, "mean", "scale", "window", "features") if k not in z.files]
            if missing:
                raise ValueError(f"{Path(path).name} is missing arrays: {', '.join(missing)}")
            return cls({k: z[k] for k in _PARAMS}, z["mean"], z["scale"], int(z["window"]), [str(f) for f in z["features"]])

    def save_npz(self, path: Path) -> None:
        np.savez_compressed(path, **self.p, mean=self.mean, scale=self.scale, window=np.array(self.window), features=np.array(self.features))

    def summary(self) -> dict[str, Any]:
        return {"lstm_units": [int(self.p["r1"].shape[0]), int(self.p["r2"].shape[0])], "window": self.window}

    # ---- inference ---------------------------------------------------------------------------
    def _forward(self, x: np.ndarray) -> np.ndarray:
        p = self.p
        h = _lstm_layer(x, p["k1"], p["r1"], p["b1"], True)
        h = _lstm_layer(h, p["k2"], p["r2"], p["b2"], False)
        h = np.maximum(h @ p["d1w"] + p["d1b"], 0.0)
        return (h @ p["d2w"] + p["d2b"]).reshape(-1)

    def predict_frame(self, df: pd.DataFrame, chunk: int = 1024) -> np.ndarray:
        """`df` must be sorted by (unit, cycle) and hold `unit` plus the feature columns. Returns one value per row."""
        x = ((df[self.features].to_numpy(np.float32) - self.mean) / self.scale).astype(np.float32)
        n, w = len(x), self.window
        units = df["unit"].to_numpy()
        starts = np.zeros(n, dtype=np.int64)  # index of each row's engine's first row
        if n:
            new_engine = np.r_[True, units[1:] != units[:-1]]
            starts = np.maximum.accumulate(np.where(new_engine, np.arange(n), 0))
        offsets = np.arange(-(w - 1), 1)
        out = np.empty(n, np.float32)
        for a in range(0, n, chunk):
            rows = np.arange(a, min(a + chunk, n))
            idx = np.maximum(rows[:, None] + offsets[None, :], starts[rows][:, None])  # clamp -> repeat first reading
            out[rows] = self._forward(x[idx])
        return out
