"""Private forecasting API. Use only locally trained, trusted model artifacts."""
import hmac
import math
import os
from datetime import date, timedelta
from functools import lru_cache
from pathlib import Path

import joblib
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from forecast_core import FEATURE_VERSION, artifact_key, predict

app = FastAPI(title="Retail forecasting service", version="1.0.0")


class Series(BaseModel):
    model_config = ConfigDict(extra="forbid")
    sku: str = Field(min_length=1, max_length=60)
    warehouse_code: str | None = Field(default=None, max_length=30)
    start_date: date
    quantities: list[float] = Field(min_length=28, max_length=365)


class ForecastRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    horizon_days: int = Field(ge=1, le=30)
    cutoff_date: date
    series: list[Series] = Field(min_length=1, max_length=100)


@lru_cache(maxsize=1)
def load_bundle():
    artifact = os.getenv("FORECAST_MODEL_PATH", "")
    if not artifact or not Path(artifact).is_file():
        raise HTTPException(503, "No trained model artifact configured")
    bundle = joblib.load(artifact)
    if bundle.get("feature_version") != FEATURE_VERSION:
        raise HTTPException(503, "Model feature version mismatch")
    return bundle


def authorize(value):
    secret = os.getenv("FORECAST_SERVICE_TOKEN", "")
    if not secret:
        raise HTTPException(503, "Service token is not configured")
    if not value or not hmac.compare_digest(value, secret):
        raise HTTPException(401, "Invalid service token")


@app.get("/health")
def health():
    return {"status": "ok", "model_configured": bool(os.getenv("FORECAST_MODEL_PATH"))}


@app.post("/forecast")
def forecast(request: ForecastRequest, x_service_token: str | None = Header(default=None)):
    authorize(x_service_token)
    bundle = load_bundle()
    results, seen = [], set()
    for series in request.series:
        key = artifact_key(series.sku, series.warehouse_code)
        if key in seen:
            raise HTTPException(422, "Duplicate SKU/scope")
        seen.add(key)
        if series.start_date + timedelta(days=len(series.quantities) - 1) != request.cutoff_date:
            raise HTTPException(422, "History must end exactly on cutoff_date")
        if not all(math.isfinite(v) and v >= 0 for v in series.quantities):
            raise HTTPException(422, "History contains invalid quantities")
        entry = bundle["models"].get(key)
        if not entry:
            raise HTTPException(409, f"No trained model for {key}; train or use the explicit Node baseline")
        if date.fromisoformat(entry["trained_through"]) > request.cutoff_date:
            raise HTTPException(409, "Model training includes dates after requested cutoff")
        quantities = predict(entry["model_name"], entry["model"], series.quantities,
                             request.cutoff_date + timedelta(days=1), request.horizon_days)
        results.append({"sku": series.sku, "warehouse_code": series.warehouse_code,
                        "model_name": entry["model_name"], "trained_through": entry["trained_through"],
                        "quantities": quantities, "evaluation": entry["evaluation"]})
    return {"results": results, "metadata": {"feature_version": FEATURE_VERSION,
            "dataset_sha256": bundle["report"]["dataset_sha256"], "source": bundle["report"]["source"],
            "metric_source": "offline_test_holdout", "bounds_method": "point_only"}}
