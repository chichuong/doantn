# Forecasting API

## 1. Khoi tao

Chay migration `007_forecasting_operations.sql` sau migration `006_shipping_operations.sql`.

Module hien tai dung model `baseline_moving_average_7d`: lay trung binh nhu cau 7 ngay gan nhat, tao du bao theo ngay va tinh MAE/RMSE tren tap holdout 7 ngay neu du lieu co du.

Day la baseline Backend de kiem tra pipeline; mo hinh ML/time-series Python se co the thay the sau khi du lieu lich su du hon.

Tai khoan test:

```text
Email: manager@example.com
Password: Manager@123
```

Base URL: `http://localhost:3000/api/v1`

## 2. Chay du bao

`POST /forecasting/runs`

```json
{
  "fromDate": "2026-09-01",
  "toDate": "2026-10-11",
  "lookbackDays": 30,
  "horizonDays": 7
}
```

Du bao mot san pham:

```json
{
  "productId": "PRODUCT_UUID",
  "warehouseId": "WAREHOUSE_UUID",
  "lookbackDays": 30,
  "horizonDays": 14
}
```

Quy tac:

- `lookbackDays`: tu 7 den 365.
- `horizonDays`: tu 1 den 30.
- Chi order `delivered` moi duoc dung lam du lieu ban hang.
- Khong co du lieu thi du bao 0, khong tu dong tao lenh nhap hang.

## 3. Xem ket qua

### Danh sach cac run

`GET /forecasting/runs?page=1&limit=20`

### Chi tiet run va gia tri theo ngay

`GET /forecasting/runs/RUN_UUID`

Response gom `model_name`, `lookback_days`, `horizon_days`, `mae`, `rmse` va mang `values` theo san pham/ngay.

## 4. Canh bao thieu hang

`GET /forecasting/alerts?runId=RUN_UUID&warehouseId=WAREHOUSE_UUID`

API so sanh tong du bao trong horizon voi ton kha dung `quantity - reserved_quantity`, tra ve:

- `predicted_quantity`
- `available_quantity`
- `recommended_quantity`

Ket qua chi la thong tin ho tro Manager; module khong tu dong tao phieu nhap.

## 5. Ma loi chinh

- `400`: ngay, horizon, lookback, UUID hoac payload khong hop le.
- `401`: JWT thieu/sai/het han.
- `403`: khong phai Admin/Manager hoac thieu permission Forecasting.
- `404`: khong tim thay san pham/run.
