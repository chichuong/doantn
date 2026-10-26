"""Train from a normalized public/local retail CSV and persist reproducible evaluation artifacts."""
import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import sklearn

from forecast_core import MODEL_NAMES, FEATURE_VERSION, artifact_key, fit_model, predict, metrics


def load_series(path, missing_days):
    frame = pd.read_csv(path, dtype={"sku": str, "warehouse_code": str})
    if not {"date", "sku", "quantity"}.issubset(frame.columns):
        raise ValueError("CSV requires date,sku,quantity; optional warehouse_code")
    frame["sku"] = frame["sku"].str.strip()
    if frame["sku"].isna().any() or (frame["sku"] == "").any():
        raise ValueError("Every row needs a SKU")
    frame["date"] = pd.to_datetime(frame["date"], format="%Y-%m-%d", errors="raise")
    if frame["date"].isna().any():
        raise ValueError("Every row needs a valid date")
    frame["quantity"] = pd.to_numeric(frame["quantity"], errors="raise")
    if not np.isfinite(frame["quantity"]).all() or (frame["quantity"] < 0).any():
        raise ValueError("Quantity must be finite and nonnegative; normalize returns separately")
    if "warehouse_code" not in frame:
        frame["warehouse_code"] = "*"
    else:
        if frame["warehouse_code"].isna().any():
            raise ValueError("warehouse_code must be present in every row when column is supplied")
        frame["warehouse_code"] = frame["warehouse_code"].str.strip()
        if (frame["warehouse_code"] == "").any():
            raise ValueError("Empty warehouse_code")
    if frame.empty:
        raise ValueError("CSV is empty")
    result = []
    for (warehouse, sku), group in frame.groupby(["warehouse_code", "sku"], sort=True):
        daily = group.groupby("date")["quantity"].sum().sort_index()
        calendar = pd.date_range(daily.index.min(), daily.index.max(), freq="D")
        missing = int(len(calendar.difference(daily.index)))
        if missing and missing_days == "reject":
            raise ValueError(f"{warehouse}/{sku}: {missing} missing dates; explicitly use --missing-days zero only if they mean zero sales")
        daily = daily.reindex(calendar, fill_value=0)
        result.append((None if warehouse == "*" else warehouse, sku, daily, missing))
    return result


def train(args):
    data_path = Path(args.csv).resolve()
    output = Path(args.output).resolve()
    output.mkdir(parents=True, exist_ok=True)
    digest = hashlib.sha256(data_path.read_bytes()).hexdigest()
    bundle = {"feature_version": FEATURE_VERSION, "models": {}}
    report = {"source": args.source, "dataset_sha256": digest,
              "generated_at": datetime.now(timezone.utc).isoformat(), "sklearn_version": sklearn.__version__,
              "missing_days_policy": args.missing_days, "selection": "minimum validation RMSE; test is never used for selection",
              "evaluation": "fixed-origin recursive forecasts for each holdout window", "series": [], "skipped": []}
    for warehouse, sku, daily, missing in load_series(data_path, args.missing_days):
        values = daily.to_numpy(dtype=float).tolist()
        start = daily.index[0].date()
        h = args.holdout_days
        split_train, split_test = len(values) - 2 * h, len(values) - h
        if split_train < 56:
            report["skipped"].append({"sku": sku, "warehouse_code": warehouse, "reason": "Need >=56 train days plus two holdout windows"})
            continue
        comparisons = {}
        for name in MODEL_NAMES:
            candidate = fit_model(name, values[:split_train], start)
            validation = predict(name, candidate, values[:split_train], daily.index[split_train].date(), h)
            comparisons[name] = {"validation": metrics(values[split_train:split_test], validation)}
        selected = min(MODEL_NAMES, key=lambda name: comparisons[name]["validation"]["rmse"])
        # Evaluate all candidates on the same untouched test interval for reporting only.
        for name in MODEL_NAMES:
            candidate = fit_model(name, values[:split_test], start)
            test = predict(name, candidate, values[:split_test], daily.index[split_test].date(), h)
            comparisons[name]["test"] = metrics(values[split_test:], test)
        entry = {"sku": sku, "warehouse_code": warehouse, "selected_model": selected, "missing_days": missing,
                 "train_from": str(daily.index[0].date()), "train_to": str(daily.index[split_train - 1].date()),
                 "validation_from": str(daily.index[split_train].date()), "validation_to": str(daily.index[split_test - 1].date()),
                 "test_from": str(daily.index[split_test].date()), "test_to": str(daily.index[-1].date()),
                 "comparisons": comparisons}
        report["series"].append(entry)
        bundle["models"][artifact_key(sku, warehouse)] = {"model": fit_model(selected, values, start),
            "model_name": selected, "trained_through": str(daily.index[-1].date()), "evaluation": entry}
    if not bundle["models"]:
        raise ValueError("No series has sufficient history to train and evaluate")
    selected_metrics = [entry["comparisons"][entry["selected_model"]]["test"] for entry in report["series"]]
    n = sum(m["n"] for m in selected_metrics)
    report["aggregate_selected_test"] = {"n": n,
        "mae": sum(m["sum_absolute_error"] for m in selected_metrics) / n,
        "rmse": (sum(m["sum_squared_error"] for m in selected_metrics) / n) ** 0.5}
    bundle["report"] = report
    # Versioned by data and settings; no arbitrary user-supplied pickle is accepted by the API.
    version = hashlib.sha256(f"{digest}:{args.holdout_days}:{args.missing_days}:{FEATURE_VERSION}:{sklearn.__version__}".encode()).hexdigest()[:16]
    artifact = output / f"model-{version}.joblib"
    joblib.dump(bundle, artifact)
    report_path = output / f"evaluation-{version}.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False), encoding="utf-8")
    flat = []
    for entry in report["series"]:
        for name, comparison in entry["comparisons"].items():
            flat.append({"sku": entry["sku"], "warehouse_code": entry["warehouse_code"], "model": name,
                         "selected": name == entry["selected_model"],
                         "validation_mae": comparison["validation"]["mae"], "validation_rmse": comparison["validation"]["rmse"],
                         "test_mae": comparison["test"]["mae"], "test_rmse": comparison["test"]["rmse"]})
    pd.DataFrame(flat).to_csv(output / f"comparison-{version}.csv", index=False)
    print(json.dumps({"artifact": str(artifact), "report": str(report_path), "metrics": report["aggregate_selected_test"]}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", required=True)
    parser.add_argument("--source", required=True, help="Dataset URL/name and normalization notes")
    parser.add_argument("--output", default="artifacts")
    parser.add_argument("--holdout-days", type=int, default=28)
    parser.add_argument("--missing-days", choices=("reject", "zero"), default="reject")
    args = parser.parse_args()
    if not 7 <= args.holdout_days <= 90:
        parser.error("holdout-days must be 7..90")
    train(args)
