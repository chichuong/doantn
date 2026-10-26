
from pathlib import Path
import json
import joblib
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]

DATA = ROOT / "data/processed/ml_features_7d.csv"
MODEL = ROOT / "artifacts/lightgbm_l1_7d.joblib"
REPORTS = ROOT / "reports"
REPORTS.mkdir(exist_ok=True)

FEATURES = [
    "lag_1", "lag_7", "lag_14", "lag_28",
    "rolling_sum_7", "rolling_mean_7",
    "rolling_sum_14", "rolling_mean_14",
    "rolling_sum_28", "rolling_mean_28",
    "active_days_7", "active_days_28",
    "trend_7", "month", "day_of_week"
]

df = pd.read_csv(
    DATA,
    dtype={"StockCode": "string"},
    parse_dates=["date"]
)

model = joblib.load(MODEL)

# Test bắt đầu ngày 01/09/2011
# Origin đầu tiên là 31/08/2011
origins = pd.date_range(
    "2011-08-31",
    "2011-11-23",
    freq="7D"
)

test = df[
    (df["ml_split"] == "test") &
    (df["date"].isin(origins))
].copy()

if test.empty:
    raise RuntimeError("Không có dữ liệu Test")

# Bảo đảm mỗi mốc có cùng 1.976 sản phẩm
counts = test.groupby("date")["StockCode"].nunique()

if not (counts == 1976).all():
    raise AssertionError(
        "Một số mốc Test không đủ 1.976 sản phẩm: "
        f"{counts.to_dict()}"
    )

test["naive_7"] = test["rolling_sum_7"]
test["moving_average_28"] = (
    test["rolling_mean_28"] * 7
)

test["lightgbm_l1"] = np.clip(
    model.predict(test[FEATURES].astype("float32")),
    0,
    None
)

def metrics(actual, predicted):
    a = np.asarray(actual, dtype=float)
    p = np.asarray(predicted, dtype=float)
    error = a - p

    return {
        "MAE": round(
            float(np.mean(np.abs(error))), 4
        ),
        "RMSE": round(
            float(np.sqrt(np.mean(error ** 2))), 4
        ),
        "WAPE_percent": (
            round(
                float(
                    np.sum(np.abs(error)) /
                    np.sum(np.abs(a)) * 100
                ),
                4
            )
            if np.sum(np.abs(a)) > 0 else None
        )
    }

results = test[
    ["StockCode", "date", "target_7d",
     "naive_7", "moving_average_28", "lightgbm_l1"]
].rename(
    columns={
        "date": "origin",
        "target_7d": "actual"
    }
)

scores = {
    name: metrics(results["actual"], results[name])
    for name in [
        "naive_7",
        "moving_average_28",
        "lightgbm_l1"
    ]
}

report = {
    "dataset": "UCI Online Retail II",
    "evaluation": "held_out_test",
    "horizon_days": 7,
    "test_origins": int(results["origin"].nunique()),
    "test_rows": int(len(results)),
    "unique_products": int(
        results["StockCode"].nunique()
    ),
    "scores": scores,
    "model_retrained_on_test": False
}

results.to_csv(
    REPORTS / "test_predictions_7d.csv",
    index=False,
    encoding="utf-8-sig"
)

(REPORTS / "test_evaluation_7d.json").write_text(
    json.dumps(
        report, indent=2, ensure_ascii=False
    ),
    encoding="utf-8"
)

print(json.dumps(
    report, indent=2, ensure_ascii=False
))

print("\nĐã lưu:")
print("- reports/test_predictions_7d.csv")
print("- reports/test_evaluation_7d.json")
