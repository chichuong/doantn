# Order Processing API

## 1. Khoi tao

Chay migration `008_order_processing_operations.sql` sau migration `007_forecasting_operations.sql`.

Tai khoan test:

```text
Processor:
Email: processor@example.com
Password: Processor@123

Manager:
Email: manager@example.com
Password: Manager@123
```

Base URL: `http://localhost:3000/api/v1`

## 2. Xem don can xu ly

`GET /order-processing/orders?status=pending&page=1&limit=20`

Status loc gom `pending`, `confirmed`, `ready_to_pack`.

`GET /order-processing/orders/ORDER_UUID`

## 3. Xac nhan don

Tai khoan Manager hoac Processor:

`POST /order-processing/orders/ORDER_UUID/confirm`

```json
{
  "note": "Da kiem tra thong tin don hang"
}
```

Chi don online dang `pending` moi duoc xac nhan. Order chuyen sang `confirmed`.

## 4. Phan cong processor

Tai khoan Manager:

`POST /order-processing/orders/ORDER_UUID/assign`

```json
{
  "assignedTo": "PROCESSOR_UUID",
  "note": "Phan cong xu ly don cho ca sang"
}
```

`assignedTo` phai la user role `order_processor` dang hoat dong. Order giu `confirmed`; tien do lay hang nam trong `order_processing_tasks`.

## 5. Cap nhat tac vu

Tai khoan Processor duoc phan cong:

`PATCH /order-processing/orders/ORDER_UUID/task`

Buoc 1:

```json
{
  "status": "picking",
  "note": "Dang lay hang theo don"
}
```

Buoc 2:

```json
{
  "status": "ready_to_pack",
  "note": "Da kiem tra va san sang ban giao kho"
}
```

Khi `ready_to_pack`, Warehouse co the tiep tuc quy trinh dong goi. Module nay khong tu tru ton kho.

## 6. Luong trang thai

```text
pending -> confirmed -> ready_to_pack -> packed -> handover -> shipping -> delivered
```

Moi thay doi duoc ghi vao `order_status_history`.

## 7. Ma loi chinh

- `400`: payload, UUID hoac status khong hop le.
- `401`: JWT thieu/sai/het han.
- `403`: sai role, khong co permission hoac khong dung processor duoc phan cong.
- `404`: khong tim thay order/task/processor.
- `409`: order khong o trang thai phu hop de xac nhan, phan cong hoac chuyen task.
