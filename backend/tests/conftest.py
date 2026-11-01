"""Test fixtures.

IMPORTANT: the model built here is a throwaway scikit-learn regressor trained on synthetic data so the
API plumbing can be tested. It is NOT the AeroGuard model, is written to a temp dir, and its numbers mean nothing.
"""
from __future__ import annotations

import io

import joblib
import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient
from sklearn.linear_model import LinearRegression

from app.cmapss import CMAPSS_COLUMNS, DEFAULT_FEATURES
from app.config import Settings
from app.main import create_app


def synthetic_fleet(n_units: int = 3, seed: int = 0) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    rows = []
    for u in range(1, n_units + 1):
        n = int(rng.integers(40, 90))
        for c in range(1, n + 1):
            wear = c / n
            r = [u, c, *rng.normal(0, 0.01, 3)]
            r += [100 + 20 * wear * (i % 3) + rng.normal(0, 0.5) for i in range(21)]
            rows.append(r)
    return pd.DataFrame(rows, columns=CMAPSS_COLUMNS)


@pytest.fixture()
def fleet() -> pd.DataFrame:
    return synthetic_fleet()


@pytest.fixture()
def fixture_model_path(tmp_path, fleet):
    y = fleet.groupby("unit")["cycle"].transform("max") - fleet["cycle"]
    est = LinearRegression().fit(fleet[DEFAULT_FEATURES], y)  # fitted on a DataFrame -> feature_names_in_ is stored
    p = tmp_path / "rul_model.joblib"
    joblib.dump(est, p)
    return p


def _client(tmp_path, model_path, lstm_path=None) -> TestClient:
    # lstm_path defaults to a missing file so the real backend/models/rul_lstm.npz is never picked up by tests
    s = Settings(model_path=model_path, lstm_path=lstm_path or tmp_path / "none.npz",
                 model_meta_path=tmp_path / "none.json", frontend_dist=tmp_path / "no-dist")
    return TestClient(create_app(s))


@pytest.fixture()
def client_no_model(tmp_path):
    with _client(tmp_path, tmp_path / "missing.joblib") as c:
        yield c


@pytest.fixture()
def client(tmp_path, fixture_model_path):
    with _client(tmp_path, fixture_model_path) as c:
        yield c


@pytest.fixture()
def client_lstm(tmp_path):
    from .test_lstm_runtime import make_model  # random-weight LSTM: plumbing only, numbers mean nothing
    make_model().save_npz(tmp_path / "rul_lstm.npz")
    with _client(tmp_path, tmp_path / "missing.joblib", tmp_path / "rul_lstm.npz") as c:
        yield c


def csv_bytes(df: pd.DataFrame, header: bool = True, sep: str = ",") -> bytes:
    buf = io.StringIO()
    df.to_csv(buf, index=False, header=header, sep=sep)
    return buf.getvalue().encode()
