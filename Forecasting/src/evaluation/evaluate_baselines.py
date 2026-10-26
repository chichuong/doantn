
from pathlib import Path
import json
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
INPUT = ROOT / "data/processed/model_daily_dataset.csv"
REPORTS = ROOT / "reports"
REPORTS.mkdir(exist_ok=True)

df = pd.read_csv(
    INPUT,
    dtype={"StockCode": "string"},
    parse_dates=["date"]
)

ORIGIN = pd.Timestamp("2011-05-31")
HORIZON = 7

history = df[
    (df["date"] <= ORIGIN) &
    (df["date"] > ORIGIN - pd.Timedelta(days=28))
].copy()

actual = df[
    (df["date"] > ORIGIN) &
    (df["date"] <= ORIGIN + pd.Timedelta(days=HORIZON))
].copy()

# Mỗi sản phẩm phải có đủ 28 ngày lịch sử
history_counts = history.groupby("StockCode").size()
valid_skus = history_counts[
    history_counts == 28
].index

history = history[
    history["StockCode"].isin(valid_skus)
]

actual = actual[
    actual["StockCode"].isin(valid_skus)
]

# Dự báo dựa trên 7 ngày gần nhất
last_7 = history[
    history["date"] > ORIGIN - pd.Timedelta(days=7)
]

naive = last_7.groupby("StockCode")[
    "quantity_sold"
].sum()

# Dự báo dựa trên trung bình 28 ngày
ma28 = (
    history.groupby("StockCode")["quantity_sold"]
    .mean() * HORIZON
)

truth = actual.groupby("StockCode")[
    "quantity_sold"
].sum()

results = pd.DataFrame({
    "actual": truth,
    "naive_7": naive,
    "moving_average_28": ma28
}).dropna()

if len(results) != len(valid_skus):
    raise AssertionError(
        "Thiếu dữ liệu thực tế hoặc dự báo"
    )

def metrics(y_true, y_pred):
    y_true = np.asarray(y_true, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)

    error = y_true - y_pred

    return {
        "MAE": round(float(np.mean(np.abs(error))), 4),
        "RMSE": round(
            float(np.sqrt(np.mean(error ** 2))), 4
        ),
        "WAPE_percent": (
            round(
                float(
                    np.sum(np.abs(error)) /
                    np.sum(np.abs(y_true)) * 100
                ),
                4
            )
            if np.sum(np.abs(y_true)) > 0
            else None
        )
    }

report = {
    "forecast_origin": str(ORIGIN.date()),
    "horizon_days": HORIZON,
    "evaluated_products": int(len(results)),
    "actual_total_quantity": float(
        results["actual"].sum()
    ),
    "models": {
        "naive_7": metrics(
            results["actual"],
            results["naive_7"]
        ),
        "moving_average_28": metrics(
            results["actual"],
            results["moving_average_28"]
        )
    },
    "note": (
        "Single validation origin. "
        "Not a final model comparison."
    )
}

results.reset_index().to_csv(
    REPORTS / "baseline_predictions.csv",
    index=False,
    encoding="utf-8-sig"
)

(REPORTS / "baseline_evaluation.json").write_text(
    json.dumps(
        report,
        indent=2,
        ensure_ascii=False
    ),
    encoding="utf-8"
)

print(json.dumps(
    report,
    indent=2,
    ensure_ascii=False
))

print("\nĐã tạo:")
print("- reports/baseline_predictions.csv")
print("- reports/baseline_evaluation.json")
