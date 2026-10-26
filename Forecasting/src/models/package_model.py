
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import shutil

import joblib
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]

ARTIFACTS = ROOT / "artifacts"
REPORTS = ROOT / "reports"
PROCESSED = ROOT / "data" / "processed"

SOURCE_MODEL = ARTIFACTS / "lightgbm_l1_7d.joblib"
TEST_REPORT = REPORTS / "test_evaluation_7d.json"
FEATURE_REPORT = REPORTS / "features_report.json"

PACKAGE_DIR = ARTIFACTS / "demand_forecast_v1"
PACKAGE_DIR.mkdir(parents=True, exist_ok=True)

FEATURES = [
    "lag_1", "lag_7", "lag_14", "lag_28",
    "rolling_sum_7", "rolling_mean_7",
    "rolling_sum_14", "rolling_mean_14",
    "rolling_sum_28", "rolling_mean_28",
    "active_days_7", "active_days_28",
    "trend_7", "month", "day_of_week"
]

def sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as file:
        for chunk in iter(
            lambda: file.read(1024 * 1024), b""
        ):
            digest.update(chunk)
    return digest.hexdigest()

for path in [SOURCE_MODEL, TEST_REPORT]:
    if not path.exists():
        raise FileNotFoundError(path)

model = joblib.load(SOURCE_MODEL)

if model.n_features_in_ != len(FEATURES):
    raise ValueError(
        "Số features không khớp mô hình"
    )

if hasattr(model, "feature_name_"):
    if list(model.feature_name_) != FEATURES:
        raise ValueError(
            "Thứ tự features không khớp mô hình"
        )

with open(TEST_REPORT, encoding="utf-8") as file:
    test_results = json.load(file)

if test_results.get("evaluation") != "held_out_test":
    raise ValueError("Không đúng báo cáo Test")

model_file = PACKAGE_DIR / "model.joblib"
shutil.copy2(SOURCE_MODEL, model_file)

metadata = {
    "model_id": "karat-demand-forecast-v1",
    "model_type": "LightGBMRegressor",
    "objective": "regression_l1",
    "version": "1.0.0",
    "created_at_utc": datetime.now(
        timezone.utc
    ).isoformat(),
    "training_dataset": "UCI Online Retail II",
    "prediction_target": "7-day gross positive sales",
    "horizon_days": 7,
    "minimum_history_days": 28,
    "feature_names": FEATURES,
    "feature_count": len(FEATURES),
    "training_end": "2011-05-31",
    "validation_period": [
        "2011-06-01", "2011-08-31"
    ],
    "test_period": [
        "2011-09-01", "2011-11-30"
    ],
    "test_metrics": test_results["scores"][
        "lightgbm_l1"
    ],
    "baseline_test_metrics": test_results[
        "scores"
    ]["moving_average_28"],
    "model_sha256": sha256(model_file),
    "best_iteration": int(
        model.best_iteration_
    ),
    "limitations": [
        "Predicts sales, not latent demand",
        "Trained on UCI Online Retail II",
        "Not validated on KARAT operational data",
        "Requires a complete daily sales history",
        "No stockout or inventory availability data"
    ]
}

metadata_file = PACKAGE_DIR / "metadata.json"
metadata_file.write_text(
    json.dumps(
        metadata,
        ensure_ascii=False,
        indent=2
    ),
    encoding="utf-8"
)

# Kiểm tra đọc lại mô hình và metadata
loaded_model = joblib.load(model_file)

with open(metadata_file, encoding="utf-8") as file:
    loaded_metadata = json.load(file)

assert loaded_model.n_features_in_ == len(
    loaded_metadata["feature_names"]
)

assert sha256(model_file) == loaded_metadata[
    "model_sha256"
]

print("MODEL PACKAGING PASSED")
print("Model:", model_file)
print("Metadata:", metadata_file)
print("Version:", metadata["version"])
print("Best iteration:", metadata["best_iteration"])
print("Test metrics:", metadata["test_metrics"])
