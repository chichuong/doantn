# Manager API

## 1. Khoi tao

Trong pgAdmin Query Tool, chay file `database/migrations/002_manager_operations.sql` tren database co ten trong `.env`, sau khi da chay migration Admin/Auth.

Tai khoan test:

```text
Email: manager@example.com
Password: Manager@123
```

Base URL: `http://localhost:3000/api/v1`

Dang nhap `POST /auth/login`, copy `data.accessToken` vao Bearer Token cua Postman.

## 2. Dashboard va bao cao

### Dashboard

`GET /manager/dashboard?from=2026-01-01&to=2026-12-31`

### Bao cao doanh thu

`GET /manager/reports/sales?from=2026-01-01&to=2026-12-31`

## 3. San pham

### Danh sach san pham

`GET /manager/products?search=ca&isActive=true&page=1&limit=20`

### Tao san pham

`POST /manager/products`

```json
{
  "sku": "SP-004",
  "barcode": "8930000000042",
  "name": "Tui vai tai su dung",
  "description": "Tui vai than thien moi truong",
  "categoryId": "CATEGORY_UUID",
  "costPrice": 25000,
  "salePrice": 49000,
  "reorderLevel": 15
}
```

`categoryId` co the lay tu database bang:

```sql
SELECT id, name FROM categories WHERE is_active = TRUE ORDER BY name;
```

### Cap nhat san pham

`PATCH /manager/products/PRODUCT_UUID`

```json
{
  "salePrice": 52000,
  "reorderLevel": 20,
  "isActive": true
}
```

## 4. Kho va ton kho

### Danh sach kho

`GET /manager/warehouses`

### Tao kho

`POST /manager/warehouses`

```json
{
  "code": "WH-HCM-03",
  "name": "Kho cua hang quan 1",
  "address": "Quan 1, TP Ho Chi Minh"
}
```

### Cap nhat kho

`PATCH /manager/warehouses/WAREHOUSE_UUID`

```json
{
  "name": "Kho cua hang quan 1 - cap nhat",
  "address": "Quan 1, TP Ho Chi Minh",
  "isActive": true
}
```

### Tra cuu ton kho

`GET /manager/inventory?warehouseId=WAREHOUSE_UUID&lowStock=true&page=1&limit=20`

### Dieu chinh ton kho

`POST /manager/inventory/adjustments`

```json
{
  "warehouseId": "WAREHOUSE_UUID",
  "productId": "PRODUCT_UUID",
  "type": "receipt",
  "quantity": 25,
  "referenceCode": "PO-2026-0001",
  "note": "Nhap bo sung theo ke hoach ton kho"
}
```

`type` hop le: `receipt` cong ton, `issue` tru ton, `adjustment` cong ton dieu chinh. Moi lan dieu chinh tao mot dong trong `inventory_transactions` va cap nhat ton trong cung transaction.

## 5. Don hang

`GET /manager/orders?from=2026-01-01&to=2026-12-31&status=delivered&channel=web&page=1&limit=20`

`status` gom: `pending`, `confirmed`, `ready_to_pack`, `packed`, `handover`, `shipping`, `delivered`, `cancelled`, `returned`.

`channel` gom: `pos`, `web`, `mobile`.

## 6. Quyen truy cap

Manager chi truy cap duoc route khi JWT co role `manager` hoac `admin` va role duoc gan permission tuong ung. Migration da gan 9 permission `manager.*` cho role `manager`.
