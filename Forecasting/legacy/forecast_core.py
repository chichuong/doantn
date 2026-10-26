"""Daily SKU demand models. Features only use observations strictly before prediction day."""
from datetime import date, timedelta
import math

import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import Ridge
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

FEATURE_VERSION = "lags_1_7_14_28_rolling_7_28_calendar_v1"
MIN_HISTORY = 28
MODEL_NAMES = ("seasonal_naive_7d", "moving_average_7d", "ridge", "random_forest")


def features(history, day):
    if len(history) < MIN_HISTORY:
        raise ValueError("At least 28 daily observations are required")
    weekday = day.weekday()
    return [history[-1], history[-7], history[-14], history[-28],
            float(np.mean(history[-7:])), float(np.mean(history[-28:])),
            math.sin(2 * math.pi * weekday / 7), math.cos(2 * math.pi * weekday / 7),
            math.sin(2 * math.pi * day.month / 12), math.cos(2 * math.pi * day.month / 12)]


def fit_model(name, values, start):
    if name not in MODEL_NAMES:
        raise ValueError("Unsupported model")
    if name in MODEL_NAMES[:2]:
        return None
    x = [features(values[:i], start + timedelta(days=i)) for i in range(MIN_HISTORY, len(values))]
    y = values[MIN_HISTORY:]
    if len(y) < 28:
        raise ValueError("Insufficient training observations after feature warmup")
    model = make_pipeline(StandardScaler(), Ridge(alpha=10.0)) if name == "ridge" else RandomForestRegressor(
        n_estimators=150, max_depth=12, min_samples_leaf=3, random_state=42, n_jobs=1)
    model.fit(x, y)
    return model


def predict(name, model, history, next_day, horizon):
    values = [float(value) for value in history]
    if len(values) < MIN_HISTORY or not all(math.isfinite(v) and v >= 0 for v in values):
        raise ValueError("History must contain at least 28 finite, nonnegative daily quantities")
    predictions = []
    for step in range(horizon):
        day = next_day + timedelta(days=step)
        if name == "seasonal_naive_7d":
            quantity = values[-7]
        elif name == "moving_average_7d":
            quantity = float(np.mean(values[-7:]))
        else:
            quantity = float(model.predict([features(values, day)])[0])
        if not math.isfinite(quantity):
            raise ValueError("Model generated a nonfinite prediction")
        quantity = max(0.0, quantity)
        predictions.append(quantity)
        values.append(quantity)
    return predictions


def metrics(actual, predicted):
    error = np.asarray(actual, dtype=float) - np.asarray(predicted, dtype=float)
    return {"mae": float(np.mean(np.abs(error))), "rmse": float(np.sqrt(np.mean(error ** 2))),
            "n": int(len(error)), "sum_absolute_error": float(np.sum(np.abs(error))),
            "sum_squared_error": float(np.sum(error ** 2))}


def artifact_key(sku, warehouse_code):
    # Scope is explicit; a global model is never used as a warehouse model implicitly.
    return f"{warehouse_code or '*'}::{sku}"
