
from pathlib import Path
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]

MODEL_FILE = (
    ROOT / "data/processed/model_daily_dataset.csv"
)

FEATURE_FILE = (
    ROOT / "data/processed/ml_features_7d.csv"
)

model = pd.read_csv(
    MODEL_FILE,
    dtype={"StockCode": "string"},
    parse_dates=["date"]
)

features = pd.read_csv(
    FEATURE_FILE,
    dtype={"StockCode": "string"},
    parse_dates=["date"]
)

# Kiểm tra khóa
assert not features.duplicated(
    ["StockCode", "date"]
).any(), "Có khóa sản phẩm/ngày trùng"

# Kiểm tra ranh giới Train
train = features[
    features["ml_split"] == "train"
]

assert (
    train["date"].max() <= pd.Timestamp("2011-05-24")
), "Train có nhãn vượt ranh giới"

# Kiểm tra nhãn bằng cách tính độc lập
# trên một số sản phẩm và mốc thời gian
sample = features.sample(
    n=min(100, len(features)),
    random_state=42
)

model_index = model.set_index(
    ["StockCode", "date"]
)["quantity_sold"]

for row in sample.itertuples(index=False):
    dates = pd.date_range(
        row.date + pd.Timedelta(days=1),
        periods=7,
        freq="D"
    )

    keys = pd.MultiIndex.from_arrays([
        [row.StockCode] * 7,
        dates
    ])

    actual_values = model_index.reindex(keys)

    assert actual_values.notna().all(), (
        f"Thiếu dữ liệu tương lai: "
        f"{row.StockCode} - {row.date}"
    )

    expected = float(actual_values.sum())

    assert np.isclose(
        expected,
        row.target_7d,
        rtol=0,
        atol=1e-6
    ), (
        f"TARGET SAI: {row.StockCode}, "
        f"{row.date}, expected={expected}, "
        f"got={row.target_7d}"
    )

print("PASS: Không trùng khóa")
print("PASS: Train không vượt ranh giới thời gian")
print("PASS: 100 mẫu target_7d được kiểm tra độc lập")
print("FEATURE VALIDATION PASSED")
