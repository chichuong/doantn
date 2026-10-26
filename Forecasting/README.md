# KARAT RETAIL — Demand Forecasting Service

## 1. Giới thiệu

Module Forecasting cung cấp chức năng dự báo nhu cầu sản phẩm cho hệ thống KARAT RETAIL.

Hệ thống sử dụng mô hình **LightGBM L1** được huấn luyện trên bộ dữ liệu UCI Online Retail II để dự báo tổng lượng bán dự kiến trong 7 ngày tiếp theo.

Kết quả được cung cấp thông qua FastAPI để Backend Node.js xử lý và lưu vào PostgreSQL.

Luồng hoạt động:

`React → Node.js → PostgreSQL → Python FastAPI → LightGBM → PostgreSQL → React`

## 2. Công nghệ

- Python 3.11+
- FastAPI và Uvicorn
- LightGBM
- Pandas và NumPy
- Scikit-learn
- Joblib

## 3. Cấu trúc thư mục

```text
Forecasting/
├── artifacts/
│   └── demand_forecast_v1/
│       ├── model.joblib
│       └── metadata.json
├── data/
├── legacy/
│   ├── app.py
│   ├── forecast_core.py
│   └── train.py
├── notebooks/
├── reports/
├── src/
│   ├── api/
│   │   ├── main.py
│   │   └── feature_extractor.py
│   ├── data/
│   ├── evaluation/
│   ├── features/
│   └── models/
├── tests/
├── .venv/
├── requirements.txt
└── README.md
```

## 4. Cài đặt

Yêu cầu Python 3.11 trở lên.

Mở PowerShell tại thư mục Forecasting:

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Nếu môi trường `.venv` đã tồn tại và hoạt động bình thường thì không cần tạo lại.

## 5. Khởi động AI Service

Cấu hình token giống Backend:

```powershell
$env:FORECAST_SERVICE_TOKEN="TOKEN_CUA_BAN"

.\.venv\Scripts\python.exe -m uvicorn src.api.main:app --host 127.0.0.1 --port 8001
```

Không chạy `app:app` vì đó là API thuộc phiên bản cũ.

### Kiểm tra dịch vụ

Truy cập:

`http://127.0.0.1:8001/health`

Kết quả mong đợi:

```json
{
  "status": "healthy",
  "model_loaded": true,
  "model_id": "karat-demand-forecast-v1",
  "version": "1.0.0",
  "horizon_days": 7,
  "feature_count": 15
}
```

## 6. Kết nối Backend Node.js

Trong `Backend/.env` cấu hình:

```env
FORECAST_SERVICE_URL=http://127.0.0.1:8001
FORECAST_SERVICE_TOKEN=TOKEN_CUA_BAN
FORECAST_SERVICE_TIMEOUT_MS=30000
```

Token phải khớp giữa Backend và Python.

Backend gọi endpoint `/forecast` của Python để nhận kết quả dự báo.

Dữ liệu được lưu vào các bảng dự báo của PostgreSQL, sau đó hiển thị tại trang Dự báo bán hàng trên React.

## 7. Mô hình dự báo

Thông tin mô hình:

| Thuộc tính | Giá trị |
|---|---|
| Model ID | karat-demand-forecast-v1 |
| Phiên bản | 1.0.0 |
| Thuật toán | LightGBM L1 |
| Dữ liệu huấn luyện | UCI Online Retail II |
| Số đặc trưng | 15 |
| Lịch sử tối thiểu | 29 ngày |
| Thời gian dự báo | 7 ngày |

Các nhóm đặc trưng bao gồm:

- Doanh số các ngày trước: lag 1, 7, 14 và 28 ngày.
- Tổng và trung bình doanh số trong các cửa sổ 7, 14 và 28 ngày.
- Số ngày phát sinh bán hàng trong 7 và 28 ngày.
- Xu hướng bán hàng gần đây.
- Tháng và ngày trong tuần.

### Cách hiểu kết quả

Mô hình dự báo **tổng lượng bán trong 7 ngày**, không dự báo độc lập từng ngày.

API hiện phân bổ đều tổng lượng dự báo thành 7 giá trị theo ngày để phục vụ lưu trữ và hiển thị.

Các giá trị này không đại diện cho xu hướng tăng giảm thực tế của từng ngày.

## 8. Đánh giá mô hình

Kết quả kiểm thử trên bộ dữ liệu UCI:

| Chỉ số | Giá trị |
|---|---:|
| MAE | 29.2514 |
| RMSE | 101.3918 |
| WAPE | 59.0215% |

Đây là kết quả đánh giá trên dữ liệu nghiên cứu, **không phải độ chính xác đã được kiểm chứng trên dữ liệu KARAT**.

Hệ thống hiện chưa có kết quả MAE/RMSE hợp lệ từ việc so sánh dự báo với doanh số thực tế của KARAT.

Không sử dụng kết quả UCI để khẳng định mô hình có độ chính xác tương đương trên dữ liệu vận hành.

## 9. Pipeline nghiên cứu

Các script trong `src/` phục vụ:

- Làm sạch và chuẩn hóa dữ liệu.
- Phân tích chuỗi thời gian.
- Tạo đặc trưng.
- Huấn luyện LightGBM.
- Đánh giá mô hình.
- So sánh với các phương pháp baseline.
- Đóng gói model phục vụ suy luận.

Các file `legacy/` lưu phiên bản API và thuật toán cũ gồm Seasonal Naive, Moving Average, Ridge và Random Forest.

Nhóm file legacy chỉ phục vụ tham khảo hoặc tái lập thí nghiệm cũ; không phải API LightGBM hiện tại.

## 10. Giới hạn hiện tại

- Mô hình được huấn luyện bằng dữ liệu công khai, chưa huấn luyện lại bằng dữ liệu KARAT.
- Chưa có cơ chế cold-start chuyên biệt cho sản phẩm mới.
- Chưa sử dụng giá bán, khuyến mãi và các yếu tố mùa vụ đặc thù của cửa hàng.
- Dữ liệu bán hàng ít có thể tạo ra dự báo rất nhỏ.
- Chưa có khoảng tin cậy dự báo được hiệu chỉnh.
- Chưa đánh giá sai số thực tế trên dữ liệu vận hành KARAT.
- Gợi ý nhập hàng cần kết hợp tồn kho, ngưỡng an toàn và quy tắc nghiệp vụ; không thể chỉ dựa vào lượng bán dự báo.

## 11. Lưu ý bảo mật

- Chỉ tải artifact do dự án tạo và kiểm soát.
- Không nhận file model từ người dùng qua API.
- Không đưa service token vào Git.
- Không mở trực tiếp FastAPI ra Internet khi chưa có cơ chế bảo vệ phù hợp.
- Các endpoint dự báo cần được Backend kiểm soát quyền truy cập.

## 12. Hướng phát triển

- Đánh giá LightGBM trên dữ liệu bán hàng thực tế của KARAT.
- So sánh LightGBM với các baseline trên cùng tập kiểm thử.
- Bổ sung quy tắc đề xuất nhập hàng dựa trên tồn kho an toàn và thời gian nhập hàng.
- Nghiên cứu mô hình phù hợp với sản phẩm có ít lịch sử.
- Cải thiện dự báo theo nhóm sản phẩm và đặc điểm kinh doanh.