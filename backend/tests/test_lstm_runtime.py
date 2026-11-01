"""Tests for the NumPy LSTM runtime. Uses random weights: they check the plumbing (windowing, padding, engine
isolation, file loading), not model quality. Independent of the FastAPI fixtures."""
from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from app.cmapss import DEFAULT_FEATURES
from app.config import Settings
from app.lstm_runtime import LSTMRegressor
from app.model_service import ModelService

F, W = len(DEFAULT_FEATURES), 30


def make_model(seed: int = 0, window: int = W) -> LSTMRegressor:
    r = np.random.default_rng(seed)
    n = lambda *s: (r.normal(0, 0.3, s)).astype(np.float32)
    params = dict(k1=n(F, 4 * 8), r1=n(8, 4 * 8), b1=n(4 * 8), k2=n(8, 4 * 6), r2=n(6, 4 * 6), b2=n(4 * 6),
                  d1w=n(6, 5), d1b=n(5), d2w=n(5, 1), d2b=n(1))
    return LSTMRegressor(params, r.normal(0, 1, F), r.uniform(0.5, 2, F), window, DEFAULT_FEATURES)


def frame(lengths: list[int], seed: int = 1) -> pd.DataFrame:
    r = np.random.default_rng(seed)
    rows = [[u + 1, c + 1, *r.normal(0, 1, F)] for u, n in enumerate(lengths) for c in range(n)]
    return pd.DataFrame(rows, columns=["unit", "cycle", *DEFAULT_FEATURES])


def naive(model: LSTMRegressor, df: pd.DataFrame) -> np.ndarray:
    """Row-by-row reference: build each window explicitly (pad with the engine's first reading) and score it alone."""
    out = []
    for _, g in df.groupby("unit", sort=True):
        x = ((g[DEFAULT_FEATURES].to_numpy(np.float32) - model.mean) / model.scale).astype(np.float32)
        for i in range(len(x)):
            win = x[max(0, i - model.window + 1): i + 1]
            if len(win) < model.window:
                win = np.vstack([np.repeat(x[:1], model.window - len(win), axis=0), win])
            out.append(model._forward(win[None])[0])
    return np.array(out)


def test_matches_row_by_row_reference_including_padding():
    m, df = make_model(), frame([5, 40, 30, 31])  # shorter than, longer than, and exactly at the window size
    np.testing.assert_allclose(m.predict_frame(df), naive(m, df), rtol=1e-4, atol=1e-4)


def test_chunking_does_not_change_results():
    m, df = make_model(), frame([45, 37])
    np.testing.assert_allclose(m.predict_frame(df, chunk=7), m.predict_frame(df, chunk=4096), rtol=1e-5, atol=1e-5)


def test_engines_do_not_leak_into_each_other():
    m = make_model()
    a, b = frame([35], seed=2), frame([50], seed=3)
    b["unit"] = 2
    alone = m.predict_frame(a)
    together = m.predict_frame(pd.concat([a, b], ignore_index=True))[: len(a)]
    np.testing.assert_allclose(alone, together, rtol=1e-5, atol=1e-5)


def test_service_loads_npz_and_predicts(tmp_path):
    m = make_model()
    m.save_npz(tmp_path / "rul_lstm.npz")
    s = Settings(model_path=tmp_path / "missing.joblib", lstm_path=tmp_path / "rul_lstm.npz", model_meta_path=tmp_path / "none.json")
    svc = ModelService(s); svc.load()
    assert svc.ready and svc.features == DEFAULT_FEATURES
    info = svc.info()
    assert info["estimator_class"] == "LSTMRegressor" and info["window_size"] == W and info["has_scaler"] and info["declared"] == {}
    df = frame([20, 40])
    pred = svc.predict(df)
    assert pred.shape == (len(df),) and (pred >= 0).all() and np.isfinite(pred).all()


def test_service_reports_missing_files_without_predicting(tmp_path):
    s = Settings(model_path=tmp_path / "a.joblib", lstm_path=tmp_path / "b.npz", model_meta_path=tmp_path / "none.json")
    svc = ModelService(s); svc.load()
    assert not svc.ready and "not found" in svc.error


def test_corrupt_npz_is_reported_not_crashed(tmp_path):
    np.savez(tmp_path / "rul_lstm.npz", k1=np.zeros((2, 2)))
    s = Settings(model_path=tmp_path / "a.joblib", lstm_path=tmp_path / "rul_lstm.npz", model_meta_path=tmp_path / "none.json")
    svc = ModelService(s); svc.load()
    assert not svc.ready and "missing arrays" in svc.error


def test_inconsistent_shapes_are_rejected():
    m = make_model()
    with pytest.raises(ValueError):
        LSTMRegressor(m.p, m.mean[:-1], m.scale[:-1], W, DEFAULT_FEATURES)
