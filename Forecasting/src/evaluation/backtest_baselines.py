
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
).sort_values(["StockCode", "date"])

HORIZON = 7
VAL_START = pd.Timestamp("2011-06-01")
VAL_END = pd.Timestamp("2011-08-31")

origins = pd.date_range(
    VAL_START - pd.Timedelta(days=1),
    VAL_END - pd.Timedelta(days=HORIZON),
    freq="7D"
)

records = []

for origin in origins:
    history = df[
        (df["date"] <= origin) &
        (df["date"] > origin - pd.Timedelta(days=28))
    ]

    future = df[
        (df["date"] > origin) &
        (df["date"] <= origin + pd.Timedelta(days=HORIZON))
    ]

    # Bảo đảm đủ 28 ngày lịch sử
    valid = history.groupby("StockCode").size()
    valid = valid[valid == 28].index

    history = history[
        history["StockCode"].isin(valid)
    ]
    future = future[
        future["StockCode"].isin(valid)
    ]

    last7 = history[
        history["date"] >
        origin - pd.Timedelta(days=7)
    ]

    naive = last7.groupby("StockCode")[
        "quantity_sold"
    ].sum()

    ma28 = (
        history.groupby("StockCode")[
            "quantity_sold"
        ].mean() * HORIZON
    )

    actual = future.groupby("StockCode")[
        "quantity_sold"
    ].agg(["sum", "size"])

    actual = actual[actual["size"] == HORIZON]

    result = pd.DataFrame({
        "actual": actual["sum"],
        "naive_7": naive,
        "moving_average_28": ma28
    }).dropna()

    result["origin"] = origin
    result["StockCode"] = result.index

    records.append(
        result.reset_index(drop=True)
    )

predictions = pd.concat(
    records, ignore_index=True
)

def metrics(actual, predicted):
    a = np.asarray(actual, dtype=float)
    p = np.asarray(predicted, dtype=float)
    error = a - p

    return {
        "MAE": round(float(np.mean(np.abs(error))), 4),
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
            if np.sum(np.abs(a)) > 0
            else None
        )
    }

report = {
    "horizon_days": HORIZON,
    "validation_origins": int(len(origins)),
    "evaluated_rows": int(len(predictions)),
    "unique_products": int(
        predictions["StockCode"].nunique()
    ),
    "models": {
        "naive_7": metrics(
            predictions["actual"],
            predictions["naive_7"]
        ),
        "moving_average_28": metrics(
            predictions["actual"],
            predictions["moving_average_28"]
        )
    },
    "note": (
        "Rolling-origin validation. "
        "Each forecast uses historical sales only."
    )
}

predictions.to_csv(
    REPORTS / "baseline_backtest_predictions.csv",
    index=False,
    encoding="utf-8-sig"
)

(REPORTS / "baseline_backtest.json").write_text(
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
print("- reports/baseline_backtest_predictions.csv")
print("- reports/baseline_backtest.json")
