
from pathlib import Path
import json
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
INPUT = ROOT / "data/processed/model_daily_dataset.csv"
OUTPUT = ROOT / "data/processed/ml_features_7d.csv"
REPORT = ROOT / "reports/features_report.json"

df = pd.read_csv(
    INPUT,
    dtype={"StockCode": "string"},
    parse_dates=["date"]
).sort_values(["StockCode", "date"])

HORIZON = 7

g = df.groupby("StockCode", sort=False)
sales = df["quantity_sold"].astype(float)

# Lag features
for lag in [1, 7, 14, 28]:
    df[f"lag_{lag}"] = g["quantity_sold"].shift(lag)

# Rolling features: lịch sử kết thúc ở ngày hiện tại
for window in [7, 14, 28]:
    df[f"rolling_sum_{window}"] = (
        g["quantity_sold"]
        .transform(
            lambda x: x.rolling(
                window, min_periods=window
            ).sum()
        )
    )

    df[f"rolling_mean_{window}"] = (
        df[f"rolling_sum_{window}"] / window
    )

# Số ngày có phát sinh bán
df["sale_occurred"] = (
    df["quantity_sold"] > 0
).astype("int8")

for window in [7, 28]:
    df[f"active_days_{window}"] = (
        df.groupby("StockCode")["sale_occurred"]
        .transform(
            lambda x: x.rolling(
                window, min_periods=window
            ).sum()
        )
    )

# Xu hướng 7 ngày gần nhất so với 7 ngày trước đó
previous_7 = (
    g["quantity_sold"]
    .transform(
        lambda x: x.shift(7).rolling(
            7, min_periods=7
        ).sum()
    )
)

df["trend_7"] = (
    df["rolling_sum_7"] - previous_7
)

# Đặc trưng lịch
df["month"] = df["date"].dt.month
df["day_of_week"] = df["date"].dt.dayofweek

# Tổng doanh số 7 ngày tiếp theo
# Tại ngày t: y(t+1) + ... + y(t+7)
df["target_7d"] = (
    g["quantity_sold"]
    .transform(
        lambda x: (
            x.shift(-1)
            .iloc[::-1]
            .rolling(HORIZON, min_periods=HORIZON)
            .sum()
            .iloc[::-1]
        )
    )
)

# Loại các hàng chưa đủ lịch sử hoặc chưa đủ nhãn
feature_columns = [
    "lag_1", "lag_7", "lag_14", "lag_28",
    "rolling_sum_7", "rolling_mean_7",
    "rolling_sum_14", "rolling_mean_14",
    "rolling_sum_28", "rolling_mean_28",
    "active_days_7", "active_days_28",
    "trend_7", "month", "day_of_week"
]

valid = df.dropna(
    subset=feature_columns + ["target_7d"]
).copy()

# Chia tập theo ngày gốc của dự báo
train_end = pd.Timestamp("2011-05-31")
val_end = pd.Timestamp("2011-08-31")
test_end = pd.Timestamp("2011-11-30")

# Để không đưa nhãn vượt qua ranh giới vào Train,
# chỉ nhận origin có đủ 7 ngày tương lai trong Train
train = valid[
    valid["date"] <= train_end - pd.Timedelta(days=7)
].copy()

validation = valid[
    (valid["date"] >= pd.Timestamp("2011-05-31")) &
    (valid["date"] <= val_end - pd.Timedelta(days=7))
].copy()

test = valid[
    (valid["date"] >= pd.Timestamp("2011-08-31")) &
    (valid["date"] <= test_end - pd.Timedelta(days=7))
].copy()

train["ml_split"] = "train"
validation["ml_split"] = "validation"
test["ml_split"] = "test"

# Cùng một origin có thể nằm ở ranh giới,
# nhưng nhãn của Train không vượt sang Validation
dataset = pd.concat(
    [train, validation, test],
    ignore_index=True
)

dataset = dataset[
    ["StockCode", "date", "ml_split"]
    + feature_columns + ["target_7d"]
]

dataset.to_csv(
    OUTPUT,
    index=False,
    encoding="utf-8"
)

report = {
    "horizon_days": HORIZON,
    "feature_count": len(feature_columns),
    "features": feature_columns,
    "total_rows": int(len(dataset)),
    "split_rows": {
        str(k): int(v)
        for k, v in dataset["ml_split"].value_counts().items()
    },
    "train_max_origin": str(
        train["date"].max().date()
    ),
    "validation_min_origin": str(
        validation["date"].min().date()
    ),
    "test_min_origin": str(
        test["date"].min().date()
    )
}

REPORT.write_text(
    json.dumps(report, indent=2, ensure_ascii=False),
    encoding="utf-8"
)

print(json.dumps(
    report, indent=2, ensure_ascii=False
))

print("\nĐã tạo:")
print("- data/processed/ml_features_7d.csv")
print("- reports/features_report.json")
