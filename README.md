# AeroGuard AI

Predictive-maintenance web app for turbofan engines: a React + Three.js front end, a FastAPI back end, and a trained LSTM for Remaining Useful Life (RUL) predictions on NASA C-MAPSS-style sensor data
(trained on FD001).

## What you need to supply

| Item | Status | Where it goes |
|---|---|---|
| 3D engine (`engine_model.blend`) | **Included.** Converted to `frontend/public/models/engine.glb` | already in place |
| Trained LSTM (`rul_lstm.npz`) | **Included.** Converted from your Keras model; runs in plain NumPy, no TensorFlow needed | `backend/models/rul_lstm.npz` |
| `model_meta.json` | **Included.** Describes the model; FD001 test metrics measured on the official test set | `backend/models/model_meta.json` |
| `rul_model.joblib` (optional) | A scikit-learn model instead. If this file exists it is used in preference to the LSTM | `backend/models/rul_model.joblib` |

If no model file is found the API reports `model_ready: false`, uploads are still validated, and **no prediction is ever
produced or faked**. See `backend/models/README.md` for the accepted model formats. To swap in a retrained LSTM, convert it
with `python tools/keras_to_npz.py model.keras scaler.joblib`.

## Run it locally

Requirements: Node 20+ (built with 22) and Python 3.11+ (built with 3.13).

```bash
# 1. Backend  (terminal 1)
cd backend
python3 -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --port 8000

# 2. Frontend (terminal 2)
cd frontend
npm install
npm run dev                                             # http://localhost:5173  (proxies /api to :8000)
```

Single-process alternative: `npm run build` in `frontend/`, then run the backend. It serves `frontend/dist` itself at
http://localhost:8000.

Tests: `cd backend && pytest` (22 tests: API, validation and the LSTM runtime). Front end: `npm run build` (type-checks) and `npm run lint`.

## Pages

- `/` Landing: hero with the 3D engine, scroll-driven exploded view, workflow, features.
- `/explorer` 3D explorer: rotate, zoom, select parts, exploded slider, isolate, auto-rotate, reset. Works from the part
  list by keyboard. Falls back to a still image if WebGL is unavailable.
- `/analyze` Upload `.csv/.txt/.tsv` (headers, or the headerless 26-column NASA layout). Client and server validation,
  clear error states.
- `/dashboard` Fleet metrics, ranked engine table, RUL curve, alerts, sensor trends. Demonstration data is labelled.
- `/about` C-MAPSS background, how scoring works, **live** model facts from the API, limitations.

## Honesty notes

- Sensor/threshold values on the dashboard come from the API response. "Demo data" is synthetic, generated in the browser,
  and labelled as such everywhere it appears.
- Alert thresholds (default 30 and 75 cycles; env vars `AEROGUARD_RUL_CRITICAL`, `AEROGUARD_RUL_WARNING`) are product
  defaults, not model or NASA values.
- The headline RUL is the estimate at an engine's last cycle. The LSTM scores each cycle from that engine's previous 30
  cycles; an engine's first 29 cycles use a padded window (first reading repeated), so early-cycle values are less reliable.
  A scikit-learn `rul_model.joblib`, if used instead, scores each row independently.
- The LSTM was trained on FD001 with RUL capped at 125, so it never predicts much above 125 cycles and its accuracy on other
  engine types or operating conditions (FD002-FD004) is unknown.
- No accuracy figure appears anywhere unless it is in `model_meta.json`, where it is shown as "written by the model's
  owner". The figures there (FD001 test MAE 11.17, RMSE 15.4, NASA score 440.1) were measured on the official FD001 test set
  (100 engines, last cycle) and re-checked against the converted NumPy model.

## Layout

```
backend/   FastAPI app (app/), tests/, models/ (put rul_model.joblib here)
frontend/  Vite + React + Tailwind v4 + shadcn-style components + React Three Fiber + Recharts + Framer Motion
assets/source/engine_model.blend   original model
tools/     keras_to_npz.py (Keras LSTM -> NumPy weights); blend inspection / GLB export scripts (need Blender's bpy)
```

The GLB was exported from the `.blend` and optimised from about 10 MB to 1.5 MB. Re-exporting needs Blender or the `bpy`
Python package (`tools/export_glb.py`).
