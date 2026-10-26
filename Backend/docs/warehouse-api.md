# Warehouse API

## 1. Khoi tao

Chay lan luot cac migration:

1. `database/migrations/001_admin_auth.sql`
2. `database/migrations/002_manager_operations.sql`
3. `database/migrations/003_warehouse_operations.sql`

Tai khoan test:

```text
Email: warehouse@example.com
Password: Warehouse@123
```

Base URL: `http://localhost:3000/api/v1`

Dang nhap qua `POST /auth/login`, sau do gan `data.accessToken` vao Bearer Token trong Postman.

## 2. Quet ma san pham

`GET /warehouse/scan?identifier=SP-001`

Hoac quet barcode:

`GET /warehouse/scan?identifier=8930000000011&warehouseId=WAREHOUSE_UUID`

API chap nhan `sku` hoac `barcode`, tra ve thong tin san pham, so luong ton, so luong da giu va so luong kha dung.

## 3. Chung tu nhap/xuat kho

### Tao phieu nhap

`POST /warehouse/documents`

```json
{
  "documentNumber": "GRN-2026-0001",
  "warehouseId": "WAREHOUSE_UUID",
  "type": "receipt",
  "supplierName": "Nha cung cap ABC",
  "referenceCode": "PO-2026-0001",
  "note": "Nhap hang dot 1",
  "items": [
    {
      "productId": "PRODUCT_UUID",
      "quantity": 20,
      "unitCost": 90000
    }
  ]
}
```

### Tao phieu xuat

`POST /warehouse/documents`

```json
{
  "documentNumber": "GIN-2026-0001",
  "warehouseId": "WAREHOUSE_UUID",
  "type": "issue",
  "referenceCode": "TRANSFER-2026-0001",
  "note": "Xuat hang bo sung cho cua hang",
  "items": [
    {
      "productId": "PRODUCT_UUID",
      "quantity": 5,
      "unitCost": 90000
    }
  ]
}
```

### Danh sach chung tu

`GET /warehouse/documents?warehouseId=WAREHOUSE_UUID&type=receipt&status=draft&page=1&limit=20`

### Xem chi tiet chung tu

`GET /warehouse/documents/DOCUMENT_UUID`

### Hoan tat chung tu

`POST /warehouse/documents/DOCUMENT_UUID/complete`

Khi hoan tat, he thong khoa chung tu, cap nhat `inventory` va ghi `inventory_transactions` trong cung mot transaction. Chung tu da hoan tat khong the hoan tat lai.

## 4. Xu ly don hang

### Danh sach don cho lay hang/dong goi

`GET /warehouse/orders?status=pending&page=1&limit=20`

Danh sach dong goi dung status `ready_to_pack`.

### Dong goi don hang

`POST /warehouse/orders/ORDER_UUID/pack`

```json
{
  "warehouseId": "WAREHOUSE_UUID"
}
```

API khoa don hang va tung dong ton kho, kiem tra ton kha dung, tru ton va ghi giao dich `issue`. Neu ton khong du hoac don khong o trang thai co the xu ly, API tra loi `409` va rollback toan bo transaction.

## 5. Ma loi chinh

- `400`: du lieu request khong hop le.
- `401`: thieu hoac sai JWT.
- `403`: sai role hoac khong co permission Warehouse.
- `404`: khong tim thay san pham, chung tu hoac don hang.
- `409`: trung so chung tu, chung tu da hoan tat, ton kho khong du.
