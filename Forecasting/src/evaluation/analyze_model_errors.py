
from pathlib import Path
import json
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
REPORTS = ROOT / "reports"

pred = pd.read_csv(
    REPORTS / "lightgbm_predictions.csv",
    dtype={"StockCode": "string"},
    parse_dates=["origin"]
)

profiles = pd.read_csv(
    REPORTS / "product_demand_profiles.csv",
    dtype={"StockCode": "string"}
)

# Phân nhóm theo tỷ lệ ngày có bán trong lịch sử
# Chỉ dùng phân nhóm để phân tích, không đưa vào model
possible_columns = [
    "activity_ratio",
    "active_ratio",
    "sale_day_ratio"
]

activity_col = next(
    (c for c in possible_columns if c in profiles.columns),
    None
)

if activity_col is None:
    raise ValueError(
        "Không tìm thấy cột tỷ lệ ngày bán. "
        f"Các cột hiện có: {profiles.columns.tolist()}"
    )

pred = pred.merge(
    profiles[["StockCode", activity_col]],
    on="StockCode",
    how="left",
    validate="many_to_one"
)

pred["demand_group"] = np.select(
    [
        pred[activity_col] > 0.5,
        pred[activity_col].between(
            0.1, 0.5, inclusive="both"
        ),
        pred[activity_col] < 0.1
    ],
    [
        "frequent",
        "intermittent",
        "very_intermittent"
    ],
    default="unknown"
)

def metrics(group, column):
    actual = group["actual"].to_numpy(float)
    predicted = group[column].to_numpy(float)
    error = actual - predicted

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
                    np.sum(np.abs(actual)) * 100
                ),
                4
            )
            if actual.sum() > 0 else None
        )
    }

report = {
    "overall_rows": int(len(pred)),
    "zero_actual_rows": int(
        (pred["actual"] == 0).sum()
    ),
    "groups": {}
}

for name, group in pred.groupby("demand_group"):
    report["groups"][name] = {
        "rows": int(len(group)),
        "products": int(
            group["StockCode"].nunique()
        ),
        "ma28": metrics(
            group, "moving_average_28"
        ),
        "lightgbm": metrics(
            group, "lightgbm"
        )
    }

pred["ma28_absolute_error"] = (
    pred["actual"] - pred["moving_average_28"]
).abs()

pred["lightgbm_absolute_error"] = (
    pred["actual"] - pred["lightgbm"]
).abs()

worst = pred.sort_values(
    "lightgbm_absolute_error",
    ascending=False
).head(100)

worst.to_csv(
    REPORTS / "lightgbm_worst_predictions.csv",
    index=False,
    encoding="utf-8-sig"
)

(REPORTS / "lightgbm_error_analysis.json").write_text(
    json.dumps(
        report, indent=2, ensure_ascii=False
    ),
    encoding="utf-8"
)

print(json.dumps(
    report, indent=2, ensure_ascii=False
))

print("\nĐã lưu:")
print("- reports/lightgbm_error_analysis.json")
print("- reports/lightgbm_worst_predictions.csv")
