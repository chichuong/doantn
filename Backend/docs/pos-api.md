# POS API

## 1. Khoi tao

Chay migration theo thu tu:

1. `database/migrations/001_admin_auth.sql`
2. `database/migrations/002_manager_operations.sql`
3. `database/migrations/003_warehouse_operations.sql`
4. `database/migrations/004_pos_operations.sql`

Tai khoan test:

```text
Email: sales@example.com
Password: Sales@123
```

Base URL: `http://localhost:3000/api/v1`

Dang nhap `POST /auth/login`, copy `data.accessToken` vao Bearer Token trong Postman.

## 2. Ca ban hang

### Xem ca dang mo

`GET /pos/sessions/current`

### Mo ca

`POST /pos/sessions/open`

```json
{
  "warehouseId": "WAREHOUSE_UUID",
  "openingCash": 100000
}
```

Moi nhan vien chi duoc mo mot ca dang hoat dong.

### Dong ca

`POST /pos/sessions/SESSION_UUID/close`

```json
{
  "closingCash": 250000
}
```

Chi nguoi mo ca moi duoc dong ca.

## 3. Tra cuu san pham

`GET /pos/products/lookup?identifier=SP-001&warehouseId=WAREHOUSE_UUID`

`identifier` co the la SKU hoac barcode. API tra ve gia ban va ton kho kha dung tai kho da chon.

## 4. Ban hang va thanh toan

### Tao giao dich POS

`POST /pos/sales`

```json
{
  "sessionId": "SESSION_UUID",
  "paymentMethod": "cash",
  "transactionReference": "CASH-0001",
  "customerName": "Nguyen Van A",
  "customerPhone": "0901234567",
  "items": [
    {
      "productId": "PRODUCT_UUID",
      "quantity": 2
    },
    {
      "productId": "ANOTHER_PRODUCT_UUID",
      "quantity": 1
    }
  ]
}
```

`paymentMethod` hop le: `cash`, `card`, `transfer`.

He thong lay gia tu database, khong tin gia tu request; sau do tao order channel `pos`, payment `paid`, tru ton va ghi `inventory_transactions` trong cung transaction.

### Danh sach giao dich

`GET /pos/sales?from=2026-10-01&to=2026-10-12&status=delivered&page=1&limit=20`

### Xem chi tiet giao dich

`GET /pos/sales/SALE_UUID`

## 5. Huy giao dich

`POST /pos/sales/SALE_UUID/void`

```json
{
  "reason": "Khach hang doi y"
}
```

Giao dich bi chuyen sang `cancelled`, payment sang `refunded`, ton kho duoc hoan lai va tao giao dich `receipt`. Toan bo thao tac duoc rollback neu co loi.

## 6. Ma loi chinh

- `400`: payload, UUID, tien, phuong thuc thanh toan hoac items khong hop le.
- `401`: JWT thieu/sai/het han.
- `403`: khong phai role `sales`/`admin` hoac thieu permission POS.
- `404`: khong tim thay ca, san pham hoac giao dich.
- `409`: ca da mo, ca da dong, ton kho khong du, giao dich khong o trang thai co the huy.
