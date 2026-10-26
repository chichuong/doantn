# Customer API

## 1. Khoi tao

Chay migration theo thu tu:

1. `database/migrations/001_admin_auth.sql`
2. `database/migrations/002_manager_operations.sql`
3. `database/migrations/003_warehouse_operations.sql`
4. `database/migrations/004_pos_operations.sql`
5. `database/migrations/005_customer_operations.sql`

Tai khoan test:

```text
Email: customer@example.com
Password: Customer@123
```

Base URL: `http://localhost:3000/api/v1`

Dang nhap `POST /auth/login`, copy `data.accessToken` vao Bearer Token trong Postman.

## 2. Catalog

`GET /customer/catalog?search=ca&page=1&limit=20`

`GET /customer/catalog?categoryId=CATEGORY_UUID&page=1&limit=20`

API chi tra san pham dang hoat dong, kem gia ban va tong ton kha dung.

## 3. Dia chi giao hang

### Danh sach dia chi

`GET /customer/addresses`

### Tao dia chi

`POST /customer/addresses`

```json
{
  "recipientName": "Nguyen Van A",
  "phone": "0901234567",
  "addressLine": "123 Duong Nguyen Hue",
  "ward": "Ben Nghe",
  "district": "Quan 1",
  "province": "TP Ho Chi Minh",
  "isDefault": true
}
```

## 4. Gio hang

### Xem gio hang

`GET /customer/cart`

### Them/cap nhat san pham

`PUT /customer/cart/items`

```json
{
  "productId": "PRODUCT_UUID",
  "quantity": 2
}
```

### Xoa san pham

`DELETE /customer/cart/items/PRODUCT_UUID`

Gio hang chua tru ton. Ton duoc kiem tra va giu khi checkout.

## 5. Checkout

`POST /customer/checkout`

```json
{
  "warehouseId": "WAREHOUSE_UUID",
  "addressId": "ADDRESS_UUID",
  "channel": "web",
  "customerName": "Nguyen Van A",
  "customerPhone": "0901234567",
  "note": "Giao trong gio hanh chinh"
}
```

`channel` hop le: `web` hoac `mobile`.

Khi checkout thanh cong:

- Tao order voi trang thai `pending` va payment `unpaid`.
- Tao chi tiet don tu gia trong database.
- Tang `reserved_quantity` tai warehouse da chon.
- Xoa cac item trong gio.
- Tao dong dau tien trong `order_status_history`.

## 6. Quan ly don hang

### Danh sach don cua toi

`GET /customer/orders?status=pending&page=1&limit=20`

### Chi tiet va timeline

`GET /customer/orders/ORDER_UUID`

### Huy don

`POST /customer/orders/ORDER_UUID/cancel`

```json
{
  "note": "Toi muon thay doi dia chi giao hang"
}
```

Chi don `pending` hoac `confirmed` moi duoc huy. Khi huy, he thong giam `reserved_quantity` tai dung warehouse cua don va ghi trang thai `cancelled` trong transaction.

## 7. Ma loi chinh

- `400`: payload, UUID, dia chi, channel hoac gio hang khong hop le.
- `401`: JWT thieu/sai/het han.
- `403`: sai role hoac thieu permission Customer.
- `404`: khong tim thay san pham, dia chi, gio hang hoac don hang.
- `409`: ton kha dung khong du, don khong con duoc phep huy.
