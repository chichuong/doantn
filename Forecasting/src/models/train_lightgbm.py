
from pathlib import Path
import json
import joblib
import numpy as np
import pandas as pd
import lightgbm as lgb

ROOT = Path(__file__).resolve().parents[2]

DATA = ROOT / "data/processed/ml_features_7d.csv"
BASELINE = ROOT / "reports/baseline_backtest_predictions.csv"

ARTIFACTS = ROOT / "artifacts"
REPORTS = ROOT / "reports"

ARTIFACTS.mkdir(exist_ok=True)
REPORTS.mkdir(exist_ok=True)

FEATURES = [
    "lag_1", "lag_7", "lag_14", "lag_28",
    "rolling_sum_7", "rolling_mean_7",
    "rolling_sum_14", "rolling_mean_14",
    "rolling_sum_28", "rolling_mean_28",
    "active_days_7", "active_days_28",
    "trend_7", "month", "day_of_week"
]

TARGET = "target_7d"

print("Đang đọc dữ liệu...")

df = pd.read_csv(
    DATA,
    dtype={"StockCode": "string"},
    parse_dates=["date"]
)

train = df[df["ml_split"] == "train"].copy()

# Dùng chính xác các mốc và SKU của baseline
baseline = pd.read_csv(
    BASELINE,
    dtype={"StockCode": "string"},
    parse_dates=["origin"]
)

validation = df.merge(
    baseline[
        ["StockCode", "origin", "actual",
         "naive_7", "moving_average_28"]
    ],
    left_on=["StockCode", "date"],
    right_on=["StockCode", "origin"],
    how="inner",
    validate="one_to_one"
)

if len(validation) != len(baseline):
    raise AssertionError(
        "LightGBM và baseline không cùng số mẫu"
    )

if not np.allclose(
    validation[TARGET].to_numpy(),
    validation["actual"].to_numpy()
):
    raise AssertionError(
        "Nhãn ML khác kết quả thực tế baseline"
    )

X_train = train[FEATURES].astype("float32")
y_train = train[TARGET].astype("float32")

X_val = validation[FEATURES].astype("float32")
y_val = validation[TARGET].astype("float32")

print("Train:", len(X_train))
print("Validation:", len(X_val))

model = lgb.LGBMRegressor(
    objective="regression",
    n_estimators=500,
    learning_rate=0.05,
    num_leaves=31,
    max_depth=-1,
    min_child_samples=50,
    subsample=0.8,
    subsample_freq=1,
    colsample_bytree=0.9,
    reg_lambda=1.0,
    random_state=42,
    n_jobs=-1,
    verbosity=-1
)

print("Đang huấn luyện LightGBM...")

model.fit(
    X_train,
    y_train,
    eval_set=[(X_val, y_val)],
    eval_metric="l1",
    callbacks=[
        lgb.early_stopping(
            stopping_rounds=50,
            verbose=False
        ),
        lgb.log_evaluation(period=100)
    ]
)

prediction = model.predict(X_val)
prediction = np.clip(prediction, 0, None)

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
        "WAPE_percent": round(
            float(
                np.sum(np.abs(error)) /
                np.sum(np.abs(a)) * 100
            ), 4
        ) if np.sum(np.abs(a)) > 0 else None
    }

results = validation[
    ["StockCode", "date", "actual",
     "naive_7", "moving_average_28"]
].copy()

results = results.rename(
    columns={"date": "origin"}
)

results["lightgbm"] = prediction

scores = {
    "naive_7": metrics(
        results["actual"], results["naive_7"]
    ),
    "moving_average_28": metrics(
        results["actual"],
        results["moving_average_28"]
    ),
    "lightgbm": metrics(
        results["actual"], results["lightgbm"]
    )
}

report = {
    "model": "LightGBM",
    "horizon_days": 7,
    "train_rows": int(len(train)),
    "validation_rows": int(len(validation)),
    "validation_origins": int(
        validation["date"].nunique()
    ),
    "feature_count": len(FEATURES),
    "best_iteration": int(
        model.best_iteration_
    ),
    "scores": scores,
    "test_used": False,
    "note": (
        "Model selection uses validation only. "
        "Test remains untouched."
    )
}

model_path = ARTIFACTS / "lightgbm_7d.joblib"
joblib.dump(model, model_path)

results.to_csv(
    REPORTS / "lightgbm_predictions.csv",
    index=False,
    encoding="utf-8-sig"
)

(REPORTS / "lightgbm_evaluation.json").write_text(
    json.dumps(
        report,
        indent=2,
        ensure_ascii=False
    ),
    encoding="utf-8"
)

importance = pd.DataFrame({
    "feature": FEATURES,
    "importance": model.feature_importances_
}).sort_values(
    "importance", ascending=False
)

importance.to_csv(
    REPORTS / "lightgbm_feature_importance.csv",
    index=False,
    encoding="utf-8-sig"
)

print("\nKẾT QUẢ:")
print(json.dumps(
    report, indent=2, ensure_ascii=False
))

print("\nĐã lưu:")
print("- artifacts/lightgbm_7d.joblib")
print("- reports/lightgbm_predictions.csv")
print("- reports/lightgbm_evaluation.json")
print("- reports/lightgbm_feature_importance.csv")
