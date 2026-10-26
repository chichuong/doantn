# KARAT RETAIL - FRONTEND WEB (REACTJS + VITE)
## Đề tài: Hệ thống Quản trị Bán hàng Đa kênh Thông minh & Dự báo Nhu cầu Sản phẩm

---

### 1. Giới thiệu tổng quan
Ứng dụng Frontend Web được xây dựng bằng **React 19 + Vite + Tailwind CSS v4**, đóng vai trò là giao diện điều hành tập trung cho các tác nhân:
- **Thu ngân (Cashier / POS)**: Bán lẻ nhanh tại quầy, quét mã vạch, quản lý ca bán hàng, thanh toán đa phương thức và in hóa đơn nhiệt K80.
- **Người quản lý (Manager)**: Giám sát toàn bộ đơn hàng đa kênh (POS, Web, Mobile), luân chuyển đơn theo ma trận **Order State Machine** 7 bước, giám sát và điều chỉnh tồn kho 3 cột.
- **Quản trị viên (Admin)**: Toàn quyền quản trị hệ thống và kiểm soát đối soát.

---

### 2. Công nghệ sử dụng
- **Core Framework**: React 19, Vite 8 (Hot Module Replacement tốc độ cao).
- **Styling**: Tailwind CSS v4, Lucide React (Bộ icon hiện đại, tối ưu).
- **Routing**: React Router DOM v7.
- **HTTP Client**: Axios với Interceptor tự động:
  + Gắn Bearer Token từ JWT.
  + Tự động sinh `Idempotency-Key` (dạng UUID v4) cho mọi request mutation (`POST`, `PUT`, `PATCH`) nhằm chống trùng lặp dữ liệu.
- **Font & UI**: Plus Jakarta Sans, Dark Mode cao cấp (Slate/Indigo/Emerald).

---

### 3. Cấu trúc thư mục mã nguồn chuẩn (`src/`)

```text
src/
├── api/                        # Tầng kết nối Backend RESTful API
│   ├── axiosClient.js          # Axios instance: tự động gắn Token & Idempotency-Key UUID
│   ├── authApi.js              # Đăng nhập, thông tin người dùng
│   ├── posApi.js               # Quản lý ca bán hàng, quét/lookup barcode, tạo đơn POS
│   ├── orderApi.js             # Quản lý đơn đa kênh, chuyển trạng thái State Machine
│   └── inventoryApi.js         # Tra cứu tồn kho 3 cột, điều chỉnh kho, đối soát
├── components/
│   ├── common/                 # Components dùng chung (Navbar, Sidebar, Modal, Badge)
│   ├── pos/                    # Phân hệ POS: Ca bán hàng, Giỏ hàng, Thanh toán, In hóa đơn
│   │   ├── OpenShiftModal.jsx  # Modal mở ca (chọn warehouse, nhập tiền đầu ca)
│   │   ├── CloseShiftModal.jsx # Modal đóng ca (kiểm đếm tiền két, ghi chú)
│   │   ├── ProductCard.jsx     # Thẻ sản phẩm với badge tồn khả dụng
│   │   ├── CartItem.jsx        # Dòng sản phẩm trong giỏ (chặn vượt tồn kho)
│   │   ├── PaymentModal.jsx    # Thanh toán: Tiền mặt, Thẻ, VietQR động
│   │   └── ReceiptModal.jsx    # Hóa đơn in nhiệt khổ K80 (window.print)
│   ├── orders/                 # Phân hệ Đơn hàng & State Machine
│   │   ├── OrderTimeline.jsx   # Stepper Timeline 7 bước trực quan
│   │   ├── StateActions.jsx    # Action Buttons thông minh theo ma trận trạng thái
│   │   └── OrderDetailModal.jsx# Xem chi tiết đơn hàng
│   └── inventory/              # Phân hệ Tồn kho
│       └── AdjustStockModal.jsx# Điều chỉnh tồn kho (nhập, xuất, cân kho)
├── context/
│   ├── AuthContext.jsx         # Quản lý phiên đăng nhập và phân quyền
│   └── PosContext.jsx          # Quản lý ca làm việc và giỏ hàng POS
├── hooks/
│   └── useBarcodeScanner.js    # Lắng nghe máy quét mã vạch Barcode/QR qua phím Enter
├── pages/
│   ├── LoginPage.jsx           # Trang đăng nhập kèm nút chọn nhanh tài khoản test
│   ├── PosPage.jsx             # Màn hình bán lẻ POS tại quầy
│   ├── OrdersPage.jsx          # Quản lý đơn hàng đa kênh & State Machine
│   ├── InventoryPage.jsx       # Quản lý tồn kho 3 cột & cảnh báo chạm ngưỡng
│   └── ForecastingPage.jsx     # Dự báo nhu cầu AI/ML kết hợp kế hoạch nhập hàng
└── utils/
    ├── formatters.js           # Định dạng tiền tệ VND, ngày giờ, metadata trạng thái
    ├── idempotency.js          # Hàm sinh UUID v4 chuẩn RFC-4122
    └── stateMachine.js         # Ma trận chuyển đổi Order State Machine
```

---

### 4. Hướng dẫn khởi chạy ứng dụng

#### Bước 1: Khởi động Backend
Mở một cửa sổ Terminal tại thư mục `Backend`:
```powershell
npm run dev
```
*(Backend sẽ lắng nghe tại `http://localhost:3000`)*.

#### Bước 2: Cài đặt và Chạy Frontend Web
Mở một cửa sổ Terminal tại thư mục `Forntend_Web`:
```powershell
npm install
npm run dev
```
*(Frontend sẽ khởi chạy tại `http://localhost:5173` và tự động proxy các request `/api/v1` sang Backend port 3000)*.

---

### 5. Tài khoản thử nghiệm (Đã tích hợp sẵn nút bấm nhanh trên giao diện)

| Vai trò | Email | Mật khẩu | Chức năng chính |
|---|---|---|---|
| **Thu ngân (Sales / POS)** | `sales@example.com` | `Sales@123` | Bán lẻ quầy, mở/đóng ca, quét mã vạch, in bill |
| **Quản lý (Manager)** | `manager@example.com` | `Manager@123` | Quản trị đơn hàng đa kênh, duyệt đơn, xem tồn kho 3 cột |
| **Quản trị viên (Admin)** | `admin@example.com` | `Admin@123` | Toàn quyền kiểm soát và điều hành |
