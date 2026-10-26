
from datetime import date
import math

FEATURES = [
    "lag_1", "lag_7", "lag_14", "lag_28",
    "rolling_sum_7", "rolling_mean_7",
    "rolling_sum_14", "rolling_mean_14",
    "rolling_sum_28", "rolling_mean_28",
    "active_days_7", "active_days_28",
    "trend_7", "month", "day_of_week",
]


def extract_features(quantities, cutoff_date):
    if len(quantities) < 29:
        raise ValueError(
            "LightGBM requires at least 29 days "
            "of history for lag_28"
        )

    values = [float(value) for value in quantities]

    if not all(
        math.isfinite(value) and value >= 0
        for value in values
    ):
        raise ValueError("Invalid sales history")

    if isinstance(cutoff_date, str):
        cutoff_date = date.fromisoformat(cutoff_date)

    recent_7 = values[-7:]
    recent_14 = values[-14:]
    recent_28 = values[-28:]
    previous_7 = values[-14:-7]

    sum_7 = sum(recent_7)
    sum_14 = sum(recent_14)
    sum_28 = sum(recent_28)

    return {
        "lag_1": values[-2],
        "lag_7": values[-8],
        "lag_14": values[-15],
        "lag_28": values[-29],
        "rolling_sum_7": sum_7,
        "rolling_mean_7": sum_7 / 7,
        "rolling_sum_14": sum_14,
        "rolling_mean_14": sum_14 / 14,
        "rolling_sum_28": sum_28,
        "rolling_mean_28": sum_28 / 28,
        "active_days_7": sum(v > 0 for v in recent_7),
        "active_days_28": sum(v > 0 for v in recent_28),
        "trend_7": sum_7 - sum(previous_7),
        "month": cutoff_date.month,
        "day_of_week": cutoff_date.weekday(),
    }
