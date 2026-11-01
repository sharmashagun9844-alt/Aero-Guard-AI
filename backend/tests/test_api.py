from __future__ import annotations

import numpy as np

from .conftest import csv_bytes


def post(client, content: bytes, name="data.csv"):
    return client.post("/api/predict", files={"file": (name, content, "text/csv")})


def test_health_reports_missing_model(client_no_model):
    j = client_no_model.get("/api/health").json()
    assert j["status"] == "ok" and j["model_ready"] is False and "not found" in j["model_error"]


def test_valid_file_without_model_gets_503_not_fake_numbers(client_no_model, fleet):
    r = post(client_no_model, csv_bytes(fleet))
    assert r.status_code == 503
    assert r.json()["detail"]["code"] == "model_not_ready"
    assert "units" not in r.json()


def test_invalid_file_is_validated_even_without_model(client_no_model, fleet):
    r = post(client_no_model, csv_bytes(fleet.drop(columns=["s7"])))
    assert r.status_code == 422
    assert any("s7" in e for e in r.json()["detail"]["errors"])


def test_schema_endpoint(client_no_model):
    j = client_no_model.get("/api/schema").json()
    assert "unit" in j["identifier_columns"] and len(j["required_columns"]) == 24


def test_model_info_when_loaded(client):
    j = client.get("/api/model").json()
    assert j["ready"] and j["estimator_class"] == "LinearRegression" and j["n_features"] == 24
    assert j["declared"] == {}  # nothing declared -> no invented metrics


def test_predict_matches_direct_model_call(client, fleet, fixture_model_path):
    import joblib
    from app.cmapss import DEFAULT_FEATURES
    r = post(client, csv_bytes(fleet))
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["engines"] == 3 and j["rows"] == len(fleet)
    est = joblib.load(fixture_model_path)
    for u in j["units"]:
        last = fleet[fleet.unit == u["unit"]].iloc[[-1]]
        expected = max(float(est.predict(last[DEFAULT_FEATURES])[0]), 0.0)
        assert abs(u["predicted_rul"] - expected) < 0.01
    ruls = [u["predicted_rul"] for u in j["units"]]
    assert ruls == sorted(ruls)  # most urgent first
    first = j["units"][0]
    assert first["detail"]["rul_series"][-1]["cycle"] == first["last_cycle"]  # series always ends at the latest cycle
    assert sum(j["status_counts"].values()) == 3


def test_headerless_cmapss_txt_is_accepted(client, fleet):
    raw = ("\n".join(" ".join(f"{v:g}" for v in row) + "  " for row in fleet.to_numpy())).encode()
    r = post(client, raw, "train_FD001.txt")
    assert r.status_code == 200, r.text
    assert any("No header" in w for w in r.json()["warnings"])


def test_alternative_header_names_are_normalised(client, fleet):
    renamed = fleet.rename(columns={"unit": "unit_number", "cycle": "time_in_cycles", "op1": "setting_1", "s2": "sensor_2", "s10": "s_10"})
    assert post(client, csv_bytes(renamed)).status_code == 200


def test_rejects_unsupported_extension(client, fleet):
    r = post(client, csv_bytes(fleet), "data.xlsx")
    assert r.status_code == 422 and "Unsupported" in r.json()["detail"]["errors"][0]


def test_rejects_empty_file(client):
    assert post(client, b"   \n").status_code == 422


def test_rejects_non_numeric_and_reports_column(client, fleet):
    df = fleet.astype(object).copy()
    df.loc[3, "s5"] = "abc"
    r = post(client, csv_bytes(df))
    assert r.status_code == 422 and any("s5" in e for e in r.json()["detail"]["errors"])


def test_rejects_duplicate_unit_cycle(client, fleet):
    import pandas as pd
    r = post(client, csv_bytes(pd.concat([fleet, fleet.iloc[[0]]])))
    assert r.status_code == 422 and "more than once" in r.json()["detail"]["errors"][0]


def test_headerless_wrong_column_count(client):
    r = post(client, b"1 2 3\n1 2 3\n", "x.txt")
    assert r.status_code == 422 and "26 columns" in r.json()["detail"]["errors"][0]


def test_detail_is_limited_and_downsampled(client, tmp_path):
    from .conftest import synthetic_fleet
    big = synthetic_fleet(n_units=20, seed=3)
    j = post(client, csv_bytes(big)).json()
    with_detail = [u for u in j["units"] if u["detail"]]
    assert len(with_detail) == j["detail_limit"] == 12
    assert all(len(u["detail"]["rul_series"]) <= 120 for u in with_detail)
    assert np.isfinite([u["predicted_rul"] for u in j["units"]]).all()


def test_lstm_model_end_to_end(client_lstm, fleet):
    info = client_lstm.get("/api/model").json()
    assert info["ready"] and info["estimator_class"] == "LSTMRegressor" and info["window_size"] == 30
    r = post(client_lstm, csv_bytes(fleet))
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["engines"] == 3 and np.isfinite([u["predicted_rul"] for u in j["units"]]).all()
    first = j["units"][0]
    assert first["detail"]["rul_series"][-1]["cycle"] == first["last_cycle"]
