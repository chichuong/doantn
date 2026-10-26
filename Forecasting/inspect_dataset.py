
from pathlib import Path
import hashlib
import json
import pandas as pd

BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "data/raw/online_retail_II.xlsx"
REPORT_DIR = BASE_DIR / "reports"
REPORT_DIR.mkdir(parents=True, exist_ok=True)

if not DATA_PATH.exists():
    raise FileNotFoundError(f"Không tìm thấy: {DATA_PATH}")

# SHA-256 để bảo đảm khả năng tái lập
sha256 = hashlib.sha256()
with DATA_PATH.open("rb") as f:
    for chunk in iter(lambda: f.read(1024 * 1024), b""):
        sha256.update(chunk)

print("SHA-256:", sha256.hexdigest())

# Đọc tất cả sheet
sheets = pd.read_excel(DATA_PATH, sheet_name=None)

frames = []
for sheet_name, df in sheets.items():
    print(f"\nSheet: {sheet_name}")
    print("Số dòng:", len(df))
    print("Các cột:", list(df.columns))
    frames.append(df)

data = pd.concat(frames, ignore_index=True)

# Chuẩn hóa tên cột giữa các sheet
data = data.rename(columns={
    "Invoice": "InvoiceNo",
    "Price": "UnitPrice",
    "Customer ID": "CustomerID"
})

required = [
    "InvoiceNo", "StockCode", "Description",
    "Quantity", "InvoiceDate", "UnitPrice",
    "CustomerID", "Country"
]

missing_columns = [c for c in required if c not in data.columns]
if missing_columns:
    raise ValueError(f"Thiếu cột: {missing_columns}")

data["InvoiceDate"] = pd.to_datetime(
    data["InvoiceDate"], errors="coerce"
)

invoice = data["InvoiceNo"].astype("string").str.strip()
quantity = pd.to_numeric(data["Quantity"], errors="coerce")
price = pd.to_numeric(data["UnitPrice"], errors="coerce")

report = {
    "source": "UCI Online Retail II",
    "dataset_id": 502,
    "sha256": sha256.hexdigest(),
    "total_rows": int(len(data)),
    "columns": list(data.columns),
    "missing_values": {
        k: int(v) for k, v in data.isna().sum().items()
    },
    "duplicate_rows": int(data.duplicated().sum()),
    "cancelled_rows": int(
        invoice.str.upper().str.startswith("C", na=False).sum()
    ),
    "negative_quantity_rows": int((quantity < 0).sum()),
    "nonpositive_price_rows": int((price <= 0).sum()),
    "unique_products": int(data["StockCode"].nunique()),
    "date_min": str(data["InvoiceDate"].min()),
    "date_max": str(data["InvoiceDate"].max())
}

print(json.dumps(report, indent=2, ensure_ascii=False))

output = REPORT_DIR / "dataset_audit.json"
output.write_text(
    json.dumps(report, indent=2, ensure_ascii=False),
    encoding="utf-8"
)

print("\nĐã lưu báo cáo:", output)
