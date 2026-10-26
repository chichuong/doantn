# Data Exchange API

## Thu vien va gioi han

- `exceljs`: doc/ghi `.xlsx` va `.csv`.
- `multer`: nhan file bang memory storage.
- Gioi han upload: 10 MB, toi da 1 file, chi `.xlsx`/`.csv`.
- Import quet het file truoc khi ghi. Neu co loi validation, khong thay doi database. Neu loi trong transaction, toan bo import rollback.

Template co san:

- `templates/products.csv`
- `templates/products.xlsx`
- `templates/inventory.csv`
- `templates/inventory.xlsx`

Tao lai file Excel bang:

```powershell
node scripts/create-import-templates.js
```

## Import

Dang nhap Manager, Postman chon `Body -> form-data`:

- key `file`: type `File`, chon `.xlsx` hoac `.csv`.
- key `warehouseId`: type `Text`, bat buoc voi import inventory.

### Import products

`POST /api/v1/data-exchange/import/products`

Header:

```text
Authorization: Bearer ACCESS_TOKEN
```

Header bat buoc:

```text
sku, barcode, name, category, cost_price, sale_price, reorder_level
```

Header tuy chon: `description`, `is_active`.

### Import inventory

`POST /api/v1/data-exchange/import/inventory`

Header bat buoc: `sku, quantity`.

`quantity` phai la so nguyen >= 0. He thong cap nhat ton theo warehouseId va tao inventory transaction.

Response import loi tra status `422`:

```json
{
  "job": {
    "status": "failed",
    "total_rows": 8,
    "success_rows": 0,
    "error_rows": 2
  },
  "errors": [
    "Dòng 5: SKU SP001 đã tồn tại",
    "Dòng 8: Giá bán không hợp lệ"
  ]
}
```

## Export

Tat ca export yeu cau `Authorization: Bearer ACCESS_TOKEN` va tra file attachment.

### Products

`GET /api/v1/data-exchange/export/products?format=xlsx&categoryId=CATEGORY_UUID&isActive=true`

### Inventory

`GET /api/v1/data-exchange/export/inventory?format=csv&warehouseId=WAREHOUSE_UUID`

### Orders

`GET /api/v1/data-exchange/export/orders?format=xlsx&from=2026-01-01&to=2026-12-31&status=delivered`

Response co `Content-Type`, `Content-Disposition: attachment` va `X-Export-Row-Count`.

## Lich su job

`GET /api/v1/data-exchange/jobs?page=1&limit=20`

## Test cases

1. File dung header va du lieu hop le: status `201`, database thay doi.
2. Trung SKU/Barcode trong file: status `422`, khong row nao duoc insert.
3. SKU/Barcode da ton tai trong database: status `422`, khong thay doi du lieu.
4. Category khong ton tai: status `422`, khong thay doi du lieu.
5. Gia am/sai format, quantity am/thap phan: status `422`, loi co row index.
6. Header thieu/du: status `422`, loi chi ro cot.
7. File khong phai `.xlsx`/`.csv` hoac >10 MB: status `400`/`413`.
8. Loi FK/constraint trong transaction: job `failed`, toan bo transaction rollback.
