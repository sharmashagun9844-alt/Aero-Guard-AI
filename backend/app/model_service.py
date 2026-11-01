"""Loads rul_model.joblib and runs predictions. Never fabricates output: if the model is missing or its
feature schema cannot be determined, `ready` is False and callers must report that to the user."""
from __future__ import annotations

import json
import logging
import warnings
from datetime import datetime, timezone
from typing import Any

import joblib
import numpy as np
import pandas as pd

from .cmapss import DEFAULT_FEATURES
from .config import Settings
from .lstm_runtime import LSTMRegressor

log = logging.getLogger("aeroguard.model")


class ModelNotReady(RuntimeError):
    pass


class ModelService:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.estimator: Any | None = None
        self.scaler: Any | None = None
        self.features: list[str] | None = None
        self.feature_source: str | None = None
        self.meta: dict[str, Any] = {}
        self.error: str | None = None
        self.load_warnings: list[str] = []
        self.loaded_at: str | None = None
        self.file_size: int | None = None
        self.model_file: Any | None = None  # the file actually in use (joblib or npz)
        self.runtime: str | None = None

    # ---- state -------------------------------------------------------------------------------
    @property
    def ready(self) -> bool:
        return self.estimator is not None and self.features is not None and self.error is None

    # ---- loading -----------------------------------------------------------------------------
    def load(self) -> None:
        s = self.settings
        self.estimator = self.scaler = self.features = self.feature_source = None
        self.model_file = self.runtime = self.file_size = self.loaded_at = None
        self.error, self.load_warnings, self.meta = None, [], {}

        if s.model_meta_path.exists():
            try:
                self.meta = json.loads(s.model_meta_path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError) as exc:
                self.load_warnings.append(f"Could not read {s.model_meta_path.name}: {exc}")

        if not s.model_path.exists():
            if s.lstm_path.exists():
                self._load_lstm()
                return
            self.error = f"Model file not found at {s.model_path} (or {s.lstm_path.name}). Copy rul_model.joblib or rul_lstm.npz to the models folder and restart the API."
            return

        self.model_file, self.runtime = s.model_path, "scikit-learn / joblib"
        self.file_size = s.model_path.stat().st_size
        try:
            with warnings.catch_warnings(record=True) as caught:
                warnings.simplefilter("always")
                obj = joblib.load(s.model_path)
            self.load_warnings += [f"{w.category.__name__}: {w.message}" for w in caught]
        except Exception as exc:  # unpickling can fail for many reasons (missing module, version mismatch)
            self.error = f"The model file could not be loaded ({type(exc).__name__}: {exc}). It usually means the scikit-learn (or other library) version differs from the one used for training."
            log.exception("model load failed")
            return

        bundle_features = None
        if isinstance(obj, dict):
            est = next((obj[k] for k in ("model", "pipeline", "estimator", "regressor") if k in obj), None)
            self.scaler = obj.get("scaler")
            bundle_features = obj.get("features") or obj.get("feature_names") or obj.get("feature_columns")
            obj = est
        if obj is None or not hasattr(obj, "predict"):
            self.error = "The file loaded, but it does not contain an object with a .predict() method (expected a scikit-learn estimator/pipeline, or a dict with a 'model' key)."
            return
        self.estimator = obj

        n_expected = getattr(obj, "n_features_in_", None)
        if self.meta.get("features"):
            self.features, self.feature_source = list(self.meta["features"]), "model_meta.json"
        elif bundle_features:
            self.features, self.feature_source = list(bundle_features), "joblib bundle"
        elif hasattr(obj, "feature_names_in_"):
            self.features, self.feature_source = [str(c) for c in obj.feature_names_in_], "estimator.feature_names_in_"
        elif n_expected == len(DEFAULT_FEATURES):
            self.features, self.feature_source = list(DEFAULT_FEATURES), "assumed: op1-3 + s1-21 (model expects 24 features)"
            self.load_warnings.append("Feature names were not stored in the model; assuming the 24 standard C-MAPSS input columns in order. Add model_meta.json to make this explicit.")
        else:
            self.error = (
                f"The model expects {n_expected if n_expected is not None else 'an unknown number of'} input features but does not store their names. "
                "Create backend/models/model_meta.json with a \"features\" list (column names, in training order). See backend/models/README.md."
            )
            return

        if n_expected is not None and len(self.features) != n_expected:
            self.error = f"Feature list has {len(self.features)} names but the model expects {n_expected}. Fix the \"features\" list in model_meta.json."
            return

        self.loaded_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
        log.info("model ready: %s (%d features, source: %s)", type(obj).__name__, len(self.features), self.feature_source)

    def _load_lstm(self) -> None:
        path = self.settings.lstm_path
        self.model_file, self.runtime = path, "NumPy (no TensorFlow needed)"
        self.file_size = path.stat().st_size
        try:
            lstm = LSTMRegressor.from_npz(path)
        except Exception as exc:
            self.error = f"The LSTM weights file could not be loaded ({type(exc).__name__}: {exc})."
            log.exception("lstm load failed")
            return
        self.estimator, self.features, self.feature_source = lstm, lstm.features, path.name
        self.loaded_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
        log.info("model ready: LSTM (%d features, window %d)", len(lstm.features), lstm.window)

    # ---- inference ---------------------------------------------------------------------------
    def predict(self, df: pd.DataFrame) -> np.ndarray:
        if not self.ready or self.features is None:
            raise ModelNotReady(self.error or "Model is not loaded.")
        if isinstance(self.estimator, LSTMRegressor):
            # Sequence model: needs `unit` and rows sorted by (unit, cycle); validate_frame guarantees both.
            pred = self.estimator.predict_frame(df[["unit", *self.features]]).astype(float)
            if pred.shape[0] != len(df) or not np.isfinite(pred).all():
                raise RuntimeError("The model returned an unexpected or non-finite result for this input.")
            return np.clip(pred, 0, None)
        X: Any = df[self.features]
        if self.scaler is not None:
            X = self.scaler.transform(X)
        elif not hasattr(self.estimator, "feature_names_in_"):
            X = X.to_numpy(dtype=float)
        pred = np.asarray(self.estimator.predict(X), dtype=float).reshape(-1)  # type: ignore[union-attr]
        if pred.shape[0] != len(df) or not np.isfinite(pred).all():
            raise RuntimeError("The model returned an unexpected or non-finite result for this input.")
        return np.clip(pred, 0, None)

    # ---- reporting ---------------------------------------------------------------------------
    def info(self) -> dict[str, Any]:
        est = self.estimator
        return {
            "file_present": bool(self.model_file and self.model_file.exists()) or self.settings.model_path.exists(),
            "file_name": (self.model_file or self.settings.model_path).name,
            "runtime": self.runtime,
            "file_size_bytes": self.file_size,
            "ready": self.ready,
            "error": self.error,
            "estimator_class": type(est).__name__ if est is not None else None,
            "n_features": len(self.features) if self.features else None,
            "features": self.features,
            "feature_source": self.feature_source,
            "has_scaler": self.scaler is not None or isinstance(est, LSTMRegressor),
            "window_size": est.window if isinstance(est, LSTMRegressor) else None,
            "loaded_at": self.loaded_at,
            "warnings": self.load_warnings,
            # Only values the model owner wrote into model_meta.json. Nothing here is computed or assumed by AeroGuard.
            "declared": {k: self.meta[k] for k in ("name", "version", "description", "trained_on", "target", "metrics", "notes") if k in self.meta},
        }
