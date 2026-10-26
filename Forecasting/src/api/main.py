
from contextlib import asynccontextmanager
from pathlib import Path
import hashlib
import json

import joblib
from fastapi import FastAPI, HTTPException

ROOT = Path(__file__).resolve().parents[2]
PACKAGE_DIR = ROOT / "artifacts" / "demand_forecast_v1"

MODEL_PATH = PACKAGE_DIR / "model.joblib"
METADATA_PATH = PACKAGE_DIR / "metadata.json"

state = {
    "model": None,
    "metadata": None,
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()

    with path.open("rb") as file:
        for chunk in iter(
            lambda: file.read(1024 * 1024), b""
        ):
            digest.update(chunk)

    return digest.hexdigest()


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not MODEL_PATH.exists():
        raise RuntimeError(f"Missing model: {MODEL_PATH}")

    if not METADATA_PATH.exists():
        raise RuntimeError(f"Missing metadata: {METADATA_PATH}")

    metadata = json.loads(
        METADATA_PATH.read_text(encoding="utf-8")
    )

    actual_hash = sha256(MODEL_PATH)

    if actual_hash != metadata["model_sha256"]:
        raise RuntimeError("Model checksum mismatch")

    model = joblib.load(MODEL_PATH)

    expected_features = metadata["feature_names"]

    if model.n_features_in_ != len(expected_features):
        raise RuntimeError("Feature count mismatch")

    if hasattr(model, "feature_name_"):
        if list(model.feature_name_) != expected_features:
            raise RuntimeError("Feature order mismatch")

    state["model"] = model
    state["metadata"] = metadata

    print("KARAT FORECAST API READY")
    print("Model:", metadata["model_id"])
    print("Version:", metadata["version"])

    yield

    state["model"] = None
    state["metadata"] = None


app = FastAPI(
    title="KARAT Retail Forecasting API",
    description="7-day product sales forecasting service",
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/")
def root():
    return {
        "service": "KARAT Retail Forecasting API",
        "status": "running",
    }


@app.get("/health")
def health():
    metadata = state["metadata"]

    if state["model"] is None or metadata is None:
        raise HTTPException(
            status_code=503,
            detail="Model not loaded",
        )

    return {
        "status": "healthy",
        "model_loaded": True,
        "model_id": metadata["model_id"],
        "version": metadata["version"],
        "horizon_days": metadata["horizon_days"],
        "feature_count": metadata["feature_count"],
    }


@app.get("/model/info")
def model_info():
    metadata = state["metadata"]

    if metadata is None:
        raise HTTPException(
            status_code=503,
            detail="Model not loaded",
        )

    return {
        "model_id": metadata["model_id"],
        "version": metadata["version"],
        "horizon_days": metadata["horizon_days"],
        "minimum_history_days": metadata["minimum_history_days"],
        "features": metadata["feature_names"],
        "test_metrics": metadata["test_metrics"],
        "limitations": metadata["limitations"],
    }

import hmac
import math
import os

import pandas as pd
from datetime import date, timedelta
from fastapi import Header
from pydantic import BaseModel, ConfigDict, Field

from src.api.feature_extractor import (
    FEATURES,
    extract_features,
)


class SalesSeries(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sku: str = Field(min_length=1, max_length=60)
    warehouse_code: str | None = Field(
        default=None,
        max_length=30,
    )
    start_date: date
    quantities: list[float] = Field(
        min_length=29,
        max_length=365,
    )


class ForecastRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    cutoff_date: date
    horizon_days: int = Field(ge=7, le=7)
    series: list[SalesSeries] = Field(
        min_length=1,
        max_length=100,
    )


def authorize_service(token):
    expected = os.getenv("FORECAST_SERVICE_TOKEN", "")

    if not expected:
        raise HTTPException(
            status_code=503,
            detail="FORECAST_SERVICE_TOKEN is not configured",
        )

    if not token or not hmac.compare_digest(token, expected):
        raise HTTPException(
            status_code=401,
            detail="Invalid service token",
        )


@app.post("/forecast")
def forecast(
    request: ForecastRequest,
    x_service_token: str | None = Header(default=None),
):
    authorize_service(x_service_token)

    model = state["model"]
    metadata = state["metadata"]

    if model is None or metadata is None:
        raise HTTPException(
            status_code=503,
            detail="Model not loaded",
        )

    if metadata["horizon_days"] != request.horizon_days:
        raise HTTPException(
            status_code=422,
            detail="Unsupported forecast horizon",
        )

    results = []
    seen = set()

    for item in request.series:
        key = (item.warehouse_code, item.sku)

        if key in seen:
            raise HTTPException(
                status_code=422,
                detail="Duplicate SKU and warehouse",
            )

        seen.add(key)

        last_date = item.start_date + timedelta(
            days=len(item.quantities) - 1
        )

        if last_date != request.cutoff_date:
            raise HTTPException(
                status_code=422,
                detail="History must end on cutoff_date",
            )

        if not all(
            math.isfinite(value) and value >= 0
            for value in item.quantities
        ):
            raise HTTPException(
                status_code=422,
                detail="Invalid sales quantities",
            )

        feature_values = extract_features(
            item.quantities,
            request.cutoff_date,
        )

        feature_frame = pd.DataFrame(
            [[feature_values[name] for name in FEATURES]],
            columns=FEATURES,
        )

        total_7d = float(model.predict(feature_frame)[0])

        if not math.isfinite(total_7d):
            raise HTTPException(
                status_code=503,
                detail="Model returned invalid prediction",
            )

        total_7d = max(0.0, total_7d)

        # Phân bổ tổng dự báo thành 7 ngày.
        # Đây không phải 7 dự báo ngày độc lập.
        daily = total_7d / 7
        quantities = [daily] * 7

        results.append({
            "sku": item.sku,
            "warehouse_code": item.warehouse_code,
            "model_name": "lightgbm_l1",
            "trained_through": metadata["training_end"],
            "quantities": quantities,
            "predicted_total_7d": total_7d,
        })

    return {
        "results": results,
        "metadata": {
            "model_id": metadata["model_id"],
            "model_version": metadata["version"],
            "feature_version": "lightgbm_15_features_v1",
            "prediction_target": metadata["prediction_target"],
            "daily_allocation": "uniform",
            "metric_source": "external_uci_test",
            "test_metrics": metadata["test_metrics"],
            "bounds_method": "point_only",
            "limitations": metadata["limitations"],
        },
    }
