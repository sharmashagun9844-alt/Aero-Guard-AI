"""Convert a trained Keras LSTM (.keras) + its StandardScaler (.joblib) into backend/models/rul_lstm.npz.

    python tools/keras_to_npz.py FD001_LSTM_Model.keras scaler.joblib [--out backend/models/rul_lstm.npz]

Needs only numpy and joblib/scikit-learn (no TensorFlow, no h5py). Supports the architecture used in the training
notebook: Input(window, 24) -> LSTM -> Dropout -> LSTM -> Dropout -> Dense(relu) -> Dense(1).
The converted model is checked against the architecture in the file; the script refuses anything it does not recognise.
"""
from __future__ import annotations

import argparse
import io
import json
import sys
import zipfile
from pathlib import Path

import joblib
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))
from _mini_h5 import H5  # noqa: E402
from app.cmapss import DEFAULT_FEATURES  # noqa: E402
from app.lstm_runtime import LSTMRegressor  # noqa: E402


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("keras_file")
    ap.add_argument("scaler_file")
    ap.add_argument("--out", default=str(Path(__file__).resolve().parent.parent / "backend" / "models" / "rul_lstm.npz"))
    a = ap.parse_args()

    with zipfile.ZipFile(a.keras_file) as z:
        cfg = json.loads(z.read("config.json"))
        tmp = Path(a.out).with_suffix(".tmp.h5")
        tmp.write_bytes(z.read("model.weights.h5"))
    try:
        layers = cfg["config"]["layers"]
        kinds = [l["class_name"] for l in layers if l["class_name"] != "Dropout"]
        if kinds != ["InputLayer", "LSTM", "LSTM", "Dense", "Dense"]:
            sys.exit(f"Unsupported architecture: {kinds}. Expected InputLayer, LSTM, LSTM, Dense, Dense.")
        for l in layers:
            c = l["config"]
            if l["class_name"] == "LSTM" and (c["activation"], c["recurrent_activation"], c.get("go_backwards"), c.get("use_bias")) != ("tanh", "sigmoid", False, True):
                sys.exit("Unsupported LSTM settings (need tanh / sigmoid, forward, with bias).")
        dense = [l["config"]["activation"] for l in layers if l["class_name"] == "Dense"]
        if dense != ["relu", "linear"]:
            sys.exit(f"Unsupported dense activations: {dense}. Expected relu then linear.")
        window = int(layers[0]["config"]["batch_shape"][1])

        w = {k: v for k, v in H5(str(tmp)).walk() if isinstance(v, np.ndarray)}
        get = lambda name: w[f"/layers/{name}"]
        params = dict(
            k1=get("lstm/cell/vars/0"), r1=get("lstm/cell/vars/1"), b1=get("lstm/cell/vars/2"),
            k2=get("lstm_1/cell/vars/0"), r2=get("lstm_1/cell/vars/1"), b2=get("lstm_1/cell/vars/2"),
            d1w=get("dense/vars/0"), d1b=get("dense/vars/1"), d2w=get("dense_1/vars/0"), d2b=get("dense_1/vars/1"),
        )
    finally:
        tmp.unlink(missing_ok=True)

    sc = joblib.load(a.scaler_file)
    if getattr(sc, "n_features_in_", None) != len(DEFAULT_FEATURES):
        sys.exit(f"Scaler has {getattr(sc, 'n_features_in_', '?')} features; expected {len(DEFAULT_FEATURES)} (op1-3, s1-s21).")
    model = LSTMRegressor(params, sc.mean_, sc.scale_, window, DEFAULT_FEATURES)  # shape-checks everything
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    model.save_npz(Path(a.out))
    print(f"Wrote {a.out}  ({Path(a.out).stat().st_size/1024:.0f} KB)  window={window}  {model.summary()}")


if __name__ == "__main__":
    main()
