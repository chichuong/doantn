# Shipping API

## 1. Khoi tao

Chay migration theo thu tu:

1. `database/migrations/001_admin_auth.sql`
2. `database/migrations/002_manager_operations.sql`
3. `database/migrations/003_warehouse_operations.sql`
4. `database/migrations/004_pos_operations.sql`
5. `database/migrations/005_customer_operations.sql`
6. `database/migrations/006_shipping_operations.sql`

Tai khoan test:

```text
Shipper:
Email: shipper@example.com
Password: Shipper@123

Manager:
Email: manager@example.com
Password: Manager@123
```

Base URL: `http://localhost:3000/api/v1`

## 2. Tao va phan cong van don

Dang nhap Manager va goi:

`POST /shipping/shipments`

```json
{
  "orderId": "ORDER_UUID",
  "trackingNumber": "TRK-2026-0001",
  "carrier": "Internal Delivery",
  "assignedTo": "SHIPPER_UUID",
  "note": "Ban giao don cho nhan vien giao hang"
}
```

Chi don hang dang o trang thai `packed` moi duoc tao van don. `assignedTo` phai la user co role `shipper` dang hoat dong.

## 3. Shipper xem van don

Dang nhap tai khoan Shipper:

`GET /shipping/shipments?status=assigned&page=1&limit=20`

`GET /shipping/shipments/SHIPMENT_UUID`

Shipper chi xem duoc cac van don duoc phan cong cho minh.

## 4. Cap nhat trang thai

`PATCH /shipping/shipments/SHIPMENT_UUID/status`

```json
{
  "status": "picked_up",
  "note": "Da nhan don tu kho"
}
```

Cac request tiep theo:

```json
{
  "status": "in_transit",
  "note": "Dang giao den khach"
}
```

```json
{
  "status": "delivered",
  "note": "Khach da nhan hang"
}
```

Chuoi trang thai hop le:

```text
assigned -> picked_up -> in_transit -> delivered
                                      -> failed -> returned
```

Moi lan cap nhat dong thoi ghi `shipment_status_history` va `order_status_history`. Khi tao van don, order chuyen `handover`; shipper nhan hang thi chuyen `shipping`; giao thanh cong chuyen `delivered`; hoan ve chuyen `returned`.

## 5. Ma loi chinh

- `400`: payload, UUID, tracking number hoac status khong hop le.
- `401`: JWT thieu/sai/het han.
- `403`: shipper khong duoc phan cong van don hoac thieu permission.
- `404`: khong tim thay order, shipper hoac van don.
- `409`: order chua `packed`, tracking da ton tai hoac chuyen trang thai khong hop le.
