# Đặc tả Chi tiết Use Case — Nhóm Tài khoản, Xác thực, Sản phẩm & Kho

---

## 1. UC_AUTH_01 — Đăng ký tài khoản khách hàng

| Mục đặc tả | Nội dung chi tiết |
|---|---|
| **Mã Use Case** | `UC_AUTH_01` |
| **Tên Use Case** | Đăng ký tài khoản khách hàng |
| **Mục tiêu** | Cho phép người mua mới tự đăng ký tài khoản vai trò Khách hàng (`customer`) có xác thực địa chỉ email bằng mã OTP 6 chữ số. |
| **Actor chính** | Khách hàng |
| **Actor phụ** | Dịch vụ Email OTP (`<<Hệ thống ngoài>>` — Resend API / SMTP) |
| **Mô tả** | Khách hàng nhập họ tên, email, mật khẩu (và số điện thoại tùy chọn) trên Web hoặc ứng dụng di động, nhận mã OTP hiệu lực 5 phút qua email và xác nhận OTP để tạo tài khoản `customer` ở trạng thái `active`. |
| **Sự kiện kích hoạt** | Khách hàng chọn chức năng **Đăng ký ngay** trên màn hình Đăng nhập (`LoginPage.jsx` hoặc `register_screen.dart`). |
| **Tiền điều kiện** | 1. Địa chỉ email chưa được đăng ký trong bảng `users`.<br>2. Vai trò hệ thống `customer` đã được khởi tạo trong bảng `roles`. |
| **Hậu điều kiện thành công** | 1. Bản ghi mới được tạo trong bảng `users` với `role_id` tương ứng `customer` và `status = 'active'`.<br>2. Mã OTP trong bộ nhớ đệm `otpStore` được xóa sau khi xác thực thành công.<br>3. Hệ thống tự động đăng nhập hoặc chuyển người dùng vào trang mua sắm. |
| **Hậu điều kiện thất bại** | Không có bản ghi nào được ghi vào bảng `users`; nếu nhập sai OTP đủ 5 lần thì mã OTP hiện tại bị hủy hiệu lực. |
| **Luồng chính** | 1. Khách hàng nhập họ tên (`fullName`), địa chỉ `email`, `password` (tối thiểu 8 ký tự) và `phone` (tùy chọn), nhấn **Tiếp tục & Nhận mã OTP**.<br>2. Hệ thống kiểm tra định dạng email, kiểm tra email chưa tồn tại trong bảng `users`.<br>3. Hệ thống thực hiện Use Case bao gồm `UC_AUTH_02` (**Xác thực mã OTP qua Email**): sinh mã OTP ngẫu nhiên 6 chữ số (TTL 5 phút) và gửi tới email qua Dịch vụ Email OTP.<br>4. Hệ thống hiển thị bước nhập mã OTP 6 chữ số.<br>5. Khách hàng nhập mã OTP nhận được và nhấn **Xác nhận OTP & Hoàn tất đăng ký**.<br>6. Hệ thống đối chiếu mã OTP hợp lệ, băm mật khẩu bằng `bcrypt`, lưu tài khoản với vai trò `customer` vào bảng `users` và trả về thông tin tài khoản. |
| **Luồng thay thế** | - **4a. Khách hàng chưa nhận được mã hoặc muốn gửi lại OTP:** Tại bước 4, Khách hàng nhấn **Gửi lại mã OTP** -> Hệ thống quay lại bước 3 tạo mã OTP mới và ghi đè thời hạn 5 phút.<br>- **4b. Khách hàng phát hiện nhập sai email:** Nhấn **Quay lại sửa thông tin** -> Quay về bước 1. |
| **Luồng ngoại lệ** | - **2a. Email không đúng định dạng hoặc đã được đăng ký:** Hệ thống từ chối yêu cầu (HTTP `400` hoặc `409` *"Email này đã được đăng ký tài khoản"*), dừng Use Case.<br>- **2b. Cố tình truyền tham số `roleId`, `role` hoặc `status` trong payload:** Hệ thống trả lỗi HTTP `400` (*"Đăng ký chỉ tạo tài khoản khách hàng; không được chỉ định vai trò/trạng thái"*).<br>- **6a. Mã OTP không chính xác:** Hệ thống tăng bộ đếm `attempts` và báo số lần thử còn lại; nếu sai đủ 5 lần (`OTP_MAX_ATTEMPTS = 5`), hệ thống xóa OTP và yêu cầu gửi lại mã mới.<br>- **6b. Mã OTP quá hạn 5 phút:** Hệ thống xóa OTP và trả lỗi HTTP `400` yêu cầu gửi lại mã mới. |
| **Quy tắc nghiệp vụ** | - Mật khẩu dài từ 8 ký tự đến tối đa 72 byte UTF-8.<br>- Mã OTP có thời gian sống `OTP_TTL_MS = 300000` ms (5 phút), tối đa 5 lần thử sai.<br>- Đăng ký công khai chỉ gán duy nhất vai trò `customer`. |
| **Quyền truy cập** | Endpoint công khai có giới hạn tần suất `loginRateLimit()` (`POST /api/v1/auth/register/send-otp`, `POST /api/v1/auth/register`). |
| **Use Case liên quan** | Bao gồm (`<<include>>`): `UC_AUTH_02` (Xác thực mã OTP qua Email). |
| **Source code chứng minh** | - `Backend/src/routes/auth.routes.js` (dòng 12–13)<br>- `Backend/src/services/auth.service.js` (`sendRegisterOtp`, `register`, `verifySavedOtp` dòng 48–157)<br>- `Backend/src/utils/email.js` (`sendOtpEmail`)<br>- `Frontend_Web/src/pages/LoginPage.jsx` (dòng 75–129)<br>- `Frontend_Mobile/karat_app/lib/features/auth/register_screen.dart` |
| **Trạng thái xác minh** | Đã xác minh đầy đủ từ Frontend Web, Mobile App đến Backend & Email utility. |

---

## 2. UC_AUTH_03 — Đăng nhập hệ thống

| Mục đặc tả | Nội dung chi tiết |
|---|---|
| **Mã Use Case** | `UC_AUTH_03` |
| **Tên Use Case** | Đăng nhập hệ thống |
| **Mục tiêu** | Xác thực danh tính người dùng bằng email và mật khẩu, cấp JWT Access Token kèm danh sách quyền hạn (`permissions`) và danh sách kho được phân công (`warehouse_ids`). |
| **Actor chính** | Người dùng hệ thống (Khách hàng, Nhân viên bán hàng, Nhân viên kho, Nhân viên xử lý đơn, Nhân viên giao hàng, Quản lý, Quản trị viên) |
| **Actor phụ** | Không có |
| **Mô tả** | Người dùng cung cấp email và mật khẩu để nhận chuỗi JWT HS256 và tự động điều hướng về phân hệ phù hợp với vai trò/quyền hạn trên Web hoặc Mobile. |
| **Sự kiện kích hoạt** | Người dùng gửi biểu mẫu **Đăng nhập** trên Web (`LoginPage.jsx`) hoặc Mobile (`login_screen.dart`). |
| **Tiền điều kiện** | Tài khoản đã tồn tại trong bảng `users` và biến môi trường `JWT_SECRET` (tối thiểu 32 ký tự) đã cấu hình. |
| **Hậu điều kiện thành công** | 1. Trường `last_login_at` của tài khoản được cập nhật thời điểm hiện tại.<br>2. Hệ thống cấp `accessToken` (Bearer JWT) chứa `sub`, `email`, `role` và trả về thông tin người dùng kèm mảng `permissions`, `warehouse_ids`. |
| **Hậu điều kiện thất bại** | Không sinh token; phiên đăng nhập không được thiết lập. |
| **Luồng chính** | 1. Người dùng nhập `email` và `password`, nhấn **Đăng nhập**.<br>2. Hệ thống chuẩn hóa email (chữ thường, cắt khoảng trắng) và tìm tài khoản trong bảng `users`.<br>3. Hệ thống đối chiếu mật khẩu băm bằng `bcrypt.compare` và kiểm tra trạng thái `user.status === 'active'`.<br>4. Hệ thống cập nhật `last_login_at`, truy vấn vai trò, danh sách mã quyền (`role_permissions`) và danh sách kho (`user_warehouses`).<br>5. Hệ thống ký JWT HS256 và trả về cho client.<br>6. Ứng dụng Web/Mobile lưu token và điều hướng người dùng tới màn hình trang chủ theo quyền (`getHomePath` trên Web hoặc `roleHome` trên Mobile). |
| **Luồng thay thế** | - **1a. Người dùng quên mật khẩu:** Nhấn **Quên mật khẩu?** để chuyển sang thực hiện `UC_AUTH_04`. |
| **Luồng ngoại lệ** | - **2a/3a. Email không tồn tại hoặc mật khẩu không khớp:** Hệ thống trả lỗi HTTP `401` (*"Email hoặc mật khẩu không đúng"*).<br>- **3b. Tài khoản có trạng thái `inactive` hoặc `locked`:** Hệ thống trả lỗi HTTP `403` (*"Tài khoản không ở trạng thái hoạt động"*).<br>- **6a. Đăng nhập Mobile bằng vai trò chỉ dành cho Web (như `admin`, `manager`, `sales`):** Router Mobile không khớp shell di động và giữ tại màn hình xác thực. |
| **Quy tắc nghiệp vụ** | - Mọi request nghiệp vụ sau đăng nhập phải đính kèm header `Authorization: Bearer <token>` và được `authenticate` kiểm tra lại `user.status === 'active'` từ CSDL.<br>- Giới hạn tốc độ đăng nhập qua middleware `loginRateLimit()`. |
| **Quyền truy cập** | Công khai (`POST /api/v1/auth/login`). |
| **Use Case liên quan** | Tiền điều kiện cho các Use Case có yêu cầu xác thực JWT. |
| **Source code chứng minh** | - `Backend/src/routes/auth.routes.js` (dòng 11)<br>- `Backend/src/services/auth.service.js` (`login` dòng 87–111)<br>- `Backend/src/middlewares/auth.middleware.js` (`authenticate` dòng 6–53)<br>- `Frontend_Web/src/App.jsx` (`getHomePath` dòng 22–36)<br>- `Frontend_Mobile/karat_app/lib/router.dart` (`roleHome` dòng 13–18) |
| **Trạng thái xác minh** | Đã xác minh đầy đủ. |

---

## 3. UC_AUTH_06 & UC_AUTH_09 — Quản lý tài khoản người dùng & Thiết lập quyền hạn cho vai trò

| Mục đặc tả | Nội dung chi tiết |
|---|---|
| **Mã Use Case** | `UC_AUTH_06`, `UC_AUTH_09` |
| **Tên Use Case** | Quản lý tài khoản người dùng & Thiết lập quyền hạn cho vai trò |
| **Mục tiêu** | Cho phép Quản trị viên tạo mới, chỉnh sửa thông tin, gán vai trò, khóa/mở khóa tài khoản nhân sự và cấu hình ma trận quyền hạn (`role_permissions`) cho từng vai trò. |
| **Actor chính** | Quản trị viên (`admin`) |
| **Actor phụ** | Không có |
| **Mô tả** | Trên trang `UsersPage.jsx`, Quản trị viên quản lý danh sách người dùng ở tab **Tài khoản** và bật/tắt từng quyền nghiệp vụ theo module cho mỗi vai trò ở tab **Vai trò & Quyền**, đồng thời hệ thống tự động ghi nhận `audit_logs`. |
| **Sự kiện kích hoạt** | Quản trị viên mở menu **Người dùng & Quyền** (`/users`). |
| **Tiền điều kiện** | Người dùng đã đăng nhập với tài khoản có các quyền `auth.users.*`, `auth.roles.*`, `auth.permissions.read`. |
| **Hậu điều kiện thành công** | 1. Dữ liệu bảng `users` hoặc `role_permissions` được cập nhật nhất quán.<br>2. Bản ghi nhật ký kiểm toán (`audit_logs`) được tạo với hành động `create`, `update` hoặc `replace_permissions`. |
| **Hậu điều kiện thất bại** | Dữ liệu tài khoản/phân quyền giữ nguyên trạng thái trước thao tác. |
| **Luồng chính** | **Nhánh A — Quản lý tài khoản (`UC_AUTH_06`):**<br>1. Quản trị viên xem/tìm kiếm danh sách tài khoản theo từ khóa và trạng thái (`active`, `inactive`, `locked`).<br>2. Quản trị viên nhấn **Thêm tài khoản** (nhập email, mật khẩu >= 8 ký tự, họ tên, SĐT, vai trò) hoặc nhấn **Chỉnh sửa** trên một tài khoản hiện có (sửa họ tên, SĐT, đổi vai trò, đổi trạng thái).<br>3. Hệ thống kiểm tra hợp lệ dữ liệu, lưu vào bảng `users` và ghi `audit_logs`.<br><br>**Nhánh B — Thiết lập quyền hạn cho vai trò (`UC_AUTH_09`):**<br>1. Quản trị viên chuyển sang tab **Vai trò & Quyền**, chọn một vai trò trong danh sách.<br>2. Hệ thống hiển thị toàn bộ 58 quyền hạn được nhóm theo 10 phân hệ nghiệp vụ.<br>3. Quản trị viên tích chọn/bỏ chọn các quyền và nhấn lưu.<br>4. Hệ thống kiểm tra toàn bộ `permissionIds` tồn tại trong CSDL, thay thế danh sách trong bảng `role_permissions` và ghi `audit_logs`. |
| **Luồng thay thế** | - **Phân công kho làm việc (`UC_AUTH_07`):** Quản trị viên gọi cập nhật danh sách kho được phép tác nghiệp của nhân sự (`PUT /api/v1/auth/users/:userId/warehouses`), hệ thống cập nhật bảng `user_warehouses`. |
| **Luồng ngoại lệ** | - **A.2a. Quản trị viên tự khóa/vô hiệu hóa chính tài khoản đang đăng nhập (`userId === actor.id && status !== 'active'`):** Hệ thống chặn và trả lỗi HTTP `400` (*"Không thể tự vô hiệu hóa tài khoản đang đăng nhập"*).<br>- **A.3a. Email tạo mới bị trùng:** Hệ thống trả lỗi HTTP `409` (*"Email đã tồn tại"*).<br>- **B.4a. Danh sách `permissionIds` chứa UUID không tồn tại:** Hệ thống trả lỗi HTTP `400`. |
| **Quy tắc nghiệp vụ** | - Không cho phép người dùng tự khóa tài khoản đang đăng nhập của chính mình.<br>- Mọi thay đổi tài khoản và phân quyền đều bắt buộc ghi vết vào bảng `audit_logs`. |
| **Quyền truy cập** | `auth.users.read`, `auth.users.create`, `auth.users.update`, `auth.roles.read`, `auth.roles.update`, `auth.permissions.read` (cấp mặc định cho `admin`). |
| **Use Case liên quan** | `UC_AUTH_07` (Phân công kho làm việc cho nhân sự), `UC_AUTH_08` (Quản lý vai trò hệ thống), `UC_AUTH_10` (Tra cứu danh mục quyền hạn). |
| **Source code chứng minh** | - `Backend/src/routes/auth.routes.js` (dòng 19–30)<br>- `Backend/src/services/auth.service.js` (`addUser`, `editUser`, `setRolePermissions` dòng 228–301)<br>- `Frontend_Web/src/pages/UsersPage.jsx` (dòng 321–1051) |
| **Trạng thái xác minh** | Đã xác minh đầy đủ. |

---

## 4. UC_CAT_02 & UC_CAT_03 — Thêm mới và Cập nhật Sản phẩm & Danh mục

| Mục đặc tả | Nội dung chi tiết |
|---|---|
| **Mã Use Case** | `UC_CAT_02`, `UC_CAT_03` (kết hợp `UC_CAT_01`) |
| **Tên Use Case** | Thêm mới sản phẩm và mã SKU / Cập nhật giá, ngưỡng tồn và trạng thái bán |
| **Mục tiêu** | Quản lý thông tin danh mục và hàng hóa kinh doanh (mã SKU, mã vạch barcode, danh mục, giá vốn, giá bán lẻ, ngưỡng cảnh báo tồn kho tối thiểu `reorder_level`, hình ảnh và trạng thái mở bán). |
| **Actor chính** | Quản lý (`manager`), Quản trị viên (`admin`) |
| **Actor phụ** | Không có |
| **Mô tả** | Quản lý thao tác trên trang `ProductsPage.jsx` để thêm mới hoặc chỉnh sửa sản phẩm và danh mục phục vụ đồng bộ cho cả kênh POS tại quầy, Web và Mobile. |
| **Sự kiện kích hoạt** | Quản lý chọn menu **Sản phẩm & Danh mục** (`/products`) và nhấn **Thêm sản phẩm** hoặc **Sửa**. |
| **Tiền điều kiện** | Người dùng đã đăng nhập với vai trò `manager` hoặc `admin` và có quyền `manager.products.manage` (hoặc `manager.categories.manage` đối với danh mục). |
| **Hậu điều kiện thành công** | Sản phẩm mới hoặc thông tin cập nhật được ghi vào bảng `products` (hoặc `categories`), hiển thị tức thời trên danh mục quản trị và kênh bán (nếu `is_active = true`). |
| **Hậu điều kiện thất bại** | Bảng `products` / `categories` không thay đổi. |
| **Luồng chính** | 1. Quản lý mở trang **Quản trị Sản phẩm & Danh mục**, hệ thống tải danh sách sản phẩm và danh mục.<br>2. Quản lý nhấn **Thêm sản phẩm** (hệ thống gợi ý mã `SP-xxxxxx`) hoặc nhấn **Sửa** trên một dòng sản phẩm.<br>3. Quản lý nhập/chỉnh sửa: `sku` (khi tạo mới), `name`, `categoryId`, `costPrice`, `salePrice`, `reorderLevel`, `imageUrl`, `description` và trạng thái `isActive`.<br>4. Quản lý nhấn **Lưu sản phẩm**.<br>5. Hệ thống kiểm tra định dạng mã SKU (`^[A-Za-z0-9_-]{2,60}$`), kiểm tra danh mục đang hoạt động, giá vốn/giá bán không âm, `reorderLevel` nguyên không âm, sau đó lưu vào bảng `products`. |
| **Luồng thay thế** | - **Quản lý danh mục (`UC_CAT_01`):** Quản lý chuyển sang tab **Danh mục**, thêm mới hoặc cập nhật tên, mô tả, trạng thái kích hoạt danh mục (`POST/PATCH /api/v1/manager/categories`). |
| **Luồng ngoại lệ** | - **5a. Trùng mã `sku` hoặc `barcode` (mã lỗi PostgreSQL/SQL `23505`):** Hệ thống trả lỗi HTTP `409` (*"sku hoặc barcode đã tồn tại"*).<br>- **5b. `categoryId` không tồn tại hoặc danh mục đã bị ẩn:** Hệ thống trả lỗi HTTP `400` (*"categoryId không tồn tại"*).<br>- **5c. Giá vốn, giá bán hoặc ngưỡng tồn âm:** Hệ thống trả lỗi HTTP `400`. |
| **Quy tắc nghiệp vụ** | - Tên danh mục được kiểm tra duy nhất không phân biệt hoa thường và khoảng trắng thừa (`uq_categories_normalized_name`).<br>- Khi `is_active = false`, sản phẩm ngừng hiển thị trên trang mua sắm trực tuyến và không thể thêm mới vào giỏ hàng/đơn POS. |
| **Quyền truy cập** | `requireRole('admin', 'manager')` + `manager.products.read`, `manager.products.manage`, `manager.categories.read`, `manager.categories.manage`. |
| **Use Case liên quan** | `UC_CAT_01` (Quản lý danh mục sản phẩm), `UC_CAT_04` (Tra cứu danh sách sản phẩm). |
| **Source code chứng minh** | - `Backend/src/routes/manager.routes.js` (dòng 13–18)<br>- `Backend/src/services/manager.service.js` (`addProduct`, `editProduct` dòng 54–78)<br>- `Backend/src/services/category.service.js`<br>- `Frontend_Web/src/pages/ProductsPage.jsx` |
| **Trạng thái xác minh** | Đã xác minh đầy đủ. |
