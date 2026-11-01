"""AeroGuard AI API.

Endpoints
  GET  /api/health   liveness + whether the model is ready
  GET  /api/model    what was loaded (only facts read from the file / model_meta.json)
  GET  /api/schema   accepted formats, required columns, limits, alert thresholds
  POST /api/predict  multipart upload -> per-engine remaining useful life
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .analysis import build_units
from .cmapss import CMAPSS_COLUMNS, DEFAULT_FEATURES, SENSORS
from .config import Settings, get_settings
from .model_service import ModelNotReady, ModelService
from .parsing import ACCEPTED_EXTENSIONS, ValidationFailure, read_upload, validate_frame

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
log = logging.getLogger("aeroguard.api")


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    model = ModelService(settings)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        model.load()
        if not model.ready:
            log.warning("Model not ready: %s", model.error)
        yield

    app = FastAPI(title="AeroGuard AI API", version="1.0.0", lifespan=lifespan)
    app.state.model = model
    app.state.settings = settings
    app.add_middleware(CORSMiddleware, allow_origins=list(settings.cors_origins), allow_methods=["GET", "POST"], allow_headers=["*"])

    def err(status: int, code: str, message: str, errors: list[str] | None = None) -> HTTPException:
        return HTTPException(status_code=status, detail={"code": code, "message": message, "errors": errors or []})

    @app.get("/api/health")
    def health() -> dict[str, Any]:
        return {"status": "ok", "model_ready": model.ready, "model_error": model.error}

    @app.get("/api/model")
    def model_info() -> dict[str, Any]:
        return model.info()

    @app.get("/api/schema")
    def schema() -> dict[str, Any]:
        features = model.features or DEFAULT_FEATURES
        return {
            "accepted_extensions": list(ACCEPTED_EXTENSIONS),
            "max_upload_mb": settings.max_upload_mb,
            "required_columns": features,
            "required_source": model.feature_source or "default C-MAPSS layout (model schema not available yet)",
            "identifier_columns": ["unit", "cycle"],
            "cmapss_layout": CMAPSS_COLUMNS,
            "sensors": SENSORS,
            "thresholds": {"critical": settings.rul_critical, "warning": settings.rul_warning,
                           "note": "AeroGuard defaults for alerting. They are not produced by the model or the NASA dataset."},
        }

    @app.post("/api/predict")
    async def predict(file: UploadFile = File(...)) -> dict[str, Any]:
        raw = await file.read(settings.max_upload_mb * 1024 * 1024 + 1)
        if len(raw) > settings.max_upload_mb * 1024 * 1024:
            raise err(413, "file_too_large", f"The file is larger than {settings.max_upload_mb} MB.")
        try:
            parsed = read_upload(raw, file.filename or "", settings.max_rows)
            df = validate_frame(parsed, model.features or DEFAULT_FEATURES, settings.max_units)
        except ValidationFailure as exc:
            raise err(422, "validation_failed", "The file needs changes before it can be analysed.", exc.errors) from exc

        # Validation runs first so users get useful feedback even before a model is installed.
        try:
            pred = model.predict(df)
        except ModelNotReady as exc:
            raise err(503, "model_not_ready", "The RUL model is not available on the server, so no prediction was made.", [str(exc)]) from exc
        except Exception as exc:
            log.exception("prediction failed")
            raise err(500, "prediction_failed", "The model could not score this file.", [f"{type(exc).__name__}: {exc}"]) from exc

        units = build_units(df, pred, settings)
        counts = {k: sum(1 for u in units if u["status"] == k) for k in ("critical", "warning", "healthy")}
        return {
            "filename": file.filename, "rows": int(len(df)), "engines": len(units),
            "warnings": parsed.warnings, "status_counts": counts,
            "thresholds": {"critical": settings.rul_critical, "warning": settings.rul_warning},
            "detail_limit": settings.max_detail_units,
            "model": {"estimator_class": type(model.estimator).__name__, "n_features": len(model.features or []), "feature_source": model.feature_source},
            "units": units,
        }

    # Optional: serve the built frontend from the same process (npm run build in /frontend first).
    dist = settings.frontend_dist
    if dist.exists() and (dist / "index.html").exists():
        app.mount("/assets", StaticFiles(directory=dist / "assets"), name="assets")

        @app.get("/{path:path}", include_in_schema=False)
        def spa(path: str):
            if path.startswith("api/"):
                raise HTTPException(404)
            candidate = (dist / path).resolve()
            if path and candidate.is_file() and dist.resolve() in candidate.parents:
                return FileResponse(candidate)
            return FileResponse(dist / "index.html")

    return app


app = create_app()
