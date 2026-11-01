# Model folder

The API loads **one** model from this folder, in this order:

1. `rul_model.joblib` (scikit-learn), if present
2. `rul_lstm.npz` (the LSTM that ships with the project), otherwise

If neither exists the API reports `model_ready: false` and refuses to predict.

## `rul_lstm.npz` (included)
A two-layer LSTM (128 and 64 units) with a dense head, trained on C-MAPSS FD001, plus the StandardScaler statistics and the
24 input column names. It reads each engine's last 30 cycles and runs in plain NumPy, so the server does not need TensorFlow.
Engines with fewer than 30 cycles are padded by repeating their first reading.

To replace it with a retrained model saved from the same notebook architecture:

```bash
python tools/keras_to_npz.py FD001_LSTM_Model.keras scaler.joblib      # writes backend/models/rul_lstm.npz
```

Then update `model_meta.json` with metrics **you measured**, and restart the API. The script refuses architectures it does
not recognise.

## `rul_model.joblib` (optional alternative)
* a scikit-learn estimator or Pipeline with `.predict(X)` that returns RUL in cycles, one value per row, or
* a dict such as `{"model": est, "scaler": sc, "features": [...]}`.

Each row is scored independently (one row = one engine at one cycle). If the model needs windows or rolling features, wrap
that preprocessing inside a Pipeline. Train and serve with the same scikit-learn version.

Feature names are found in this order: `features` in `model_meta.json`, a `features` entry in the joblib dict,
`estimator.feature_names_in_`, then (if the model expects exactly 24 inputs) `op1, op2, op3, s1 ... s21` (flagged as an assumption).

## `model_meta.json`
Everything in it is shown on the About page exactly as written. **Only add numbers you have measured yourself.**
```json
{
  "name": "RUL regressor",
  "version": "1.0",
  "trained_on": "FD001",
  "metrics": { "mae_test": null },
  "notes": "Anything users should know."
}
```
