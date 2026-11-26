# Đặc tả Chi tiết Use Case — Nhóm Nhập Xuất Kho, Đối soát QR/IoT & Tồn kho

---

## 5. UC_WH_01 & UC_WH_02 — Lập phiếu yêu cầu nhập kho / xuất kho

| Mục đặc tả | Nội dung chi tiết |
|---|---|
| **Mã Use Case** | `UC_WH_01` (Nhập kho), `UC_WH_02` (Xuất kho) |
| **Tên Use Case** | Lập phiếu yêu cầu nhập kho / Lập phiếu yêu cầu xuất kho |
| **Mục tiêu** | Tạo chứng từ yêu cầu nhập thêm hàng vào kho (`type = 'receipt'`) hoặc xuất kho nội bộ (`type = 'issue'`) ở trạng thái chờ Quản lý phê duyệt (`pending`). |
| **Actor chính** | Nhân viên kho (`warehouse`), Quản lý (`manager` — đối với lập phiếu nhập từ dự báo AI), Quản trị viên (`admin`) |
| **Actor phụ** | Không có |
| **Mô tả** | Nhân viên kho trên ứng dụng Flutter (`warehouse_documents_screen.dart`) hoặc Quản lý trên Web (`ForecastingPage.jsx`) chọn loại phiếu, ghi chú/nhà cung cấp và danh sách sản phẩm kèm số lượng yêu cầu để khởi tạo chứng từ kho. |
| **Sự kiện kích hoạt** | Nhân viên kho nhấn nút **Tạo yêu cầu** tại màn hình **Phiếu kho** trên Mobile App (hoặc Quản lý nhấn **Lập phiếu nhập kho AI** trên Web). |
| **Tiền điều kiện** | 1. Người dùng đã đăng nhập và có quyền làm việc tại kho trung tâm (`WH-HCM-01`).<br>2. Các sản phẩm trong phiếu tồn tại trong bảng `products`. |
| **Hậu điều kiện thành công** | 1. Bản ghi mới được tạo trong `warehouse_documents` với trạng thái mặc định `status = 'pending'`, mã phiếu tự sinh dạng `NK-...` (nhập) hoặc `XK-...` (xuất).<br>2. Các dòng hàng chi tiết được lưu vào `warehouse_document_items`.<br>3. Tồn kho **chưa** bị cộng/trừ cho đến khi phiếu được duyệt, quét QR và xác nhận hoàn tất. |
| **Hậu điều kiện thất bại** | Transaction rollback, không sinh chứng từ kho. |
| **Luồng chính** | 1. Actor chọn loại chứng từ: **Nhập kho** (`receipt`) hoặc **Xuất kho** (`issue`).<br>2. Actor nhập thông tin bổ sung tùy chọn (`supplierName`, `referenceCode`, `note`) và thêm danh sách mặt hàng (`productId`, `quantity >= 1`, `unitCost >= 0`).<br>3. Actor gửi yêu cầu tạo phiếu.<br>4. Hệ thống tự động sinh `documentNumber` (tiền tố `NK-` hoặc `XK-` nếu không truyền vào), xác định kho trung tâm `WH-HCM-01`, kiểm tra không trùng lặp `productId` trong cùng một phiếu.<br>5. Hệ thống mở transaction ghi `warehouse_documents` (`status = 'pending'`) và `warehouse_document_items`, sau đó trả về chi tiết chứng từ vừa tạo. |
| **Luồng thay thế** | Không có. |
| **Luồng ngoại lệ** | - **4a. Danh sách mặt hàng rỗng hoặc có 2 dòng trùng `productId`:** Hệ thống trả lỗi HTTP `400` (*"items phải là mảng không rỗng"* / *"Không được lặp productId trong cùng chứng từ"*).<br>- **4b. Số lượng `quantity <= 0` hoặc `unitCost < 0`:** Hệ thống trả lỗi HTTP `400`.<br>- **5a. Trùng mã chứng từ (`23505`):** Hệ thống trả lỗi HTTP `409`. |
| **Quy tắc nghiệp vụ** | - Mọi phiếu mới khởi tạo đều ở trạng thái `pending` và mặc định `require_scan = TRUE` (theo migration `015` và `018`).<br>- Chưa làm thay đổi số lượng tồn kho tại thời điểm tạo phiếu. |
| **Quyền truy cập** | `warehouse.documents.create` (`POST /api/v1/warehouse/documents`) hoặc `manager.documents.read` (`POST /api/v1/manager/documents`). |
| **Use Case liên quan** | Tiền đề cho `UC_WH_04` (Phê duyệt phiếu và sinh mã QR đối soát) và `UC_WH_05` (Từ chối yêu cầu nhập xuất kho). |
| **Source code chứng minh** | - `Backend/src/routes/warehouse.routes.js` (dòng 21), `manager.routes.js` (dòng 30)<br>- `Backend/src/services/warehouse.service.js` (`createWarehouseDocument` dòng 71–92)<br>- `Backend/src/models/warehouse.model.js` (`createDocument` dòng 117–143)<br>- `Frontend_Mobile/karat_app/lib/features/warehouse/screens/warehouse_documents_screen.dart` |
| **Trạng thái xác minh** | Đã xác minh đầy đủ. |

---

## 6. UC_WH_04 & UC_WH_05 — Phê duyệt phiếu và sinh mã QR đối soát / Từ chối yêu cầu kho

| Mục đặc tả | Nội dung chi tiết |
|---|---|
| **Mã Use Case** | `UC_WH_04`, `UC_WH_05` |
| **Tên Use Case** | Phê duyệt phiếu và sinh mã QR đối soát / Từ chối yêu cầu nhập xuất kho |
| **Mục tiêu** | Kiểm soát nội bộ các yêu cầu nhập/xuất kho: Quản lý xét duyệt hợp lệ và sinh mã định danh QR (`DOC:<document_number>`) để kho đối soát thực địa, hoặc từ chối kèm lý do rõ ràng. |
| **Actor chính** | Quản lý (`manager`), Quản trị viên (`admin`) |
| **Actor phụ** | Không có |
| **Mô tả** | Trên trang `WarehouseApprovalsPage.jsx`, Quản lý xem danh sách các phiếu `pending`, kiểm tra chi tiết mặt hàng và chọn **Duyệt** (hệ thống tự sinh mã QR phiếu) hoặc **Từ chối** (bắt buộc nhập lý do). |
| **Sự kiện kích hoạt** | Quản lý mở trang **Duyệt nhập / xuất kho** (`/warehouse-approvals`) và nhấn **Duyệt** hoặc **Từ chối**. |
| **Tiền điều kiện** | Chứng từ kho tồn tại và đang ở trạng thái `pending` (hoặc `draft`). |
| **Hậu điều kiện thành công** | - **Khi Duyệt (`UC_WH_04`):** `status = 'approved'`, ghi nhận `approved_by`, `approved_at = NOW()` và sinh chuỗi `qr_code = 'DOC:' + document_number` (duy nhất trên toàn hệ thống).<br>- **Khi Từ chối (`UC_WH_05`):** `status = 'rejected'`, ghi nhận `rejected_by`, `rejected_at = NOW()` và `rejection_reason`. |
| **Hậu điều kiện thất bại** | Trạng thái chứng từ giữ nguyên `pending`. |
| **Luồng chính** | 1. Quản lý lọc danh sách chứng từ trạng thái **Chờ duyệt** (`pending`) và mở xem chi tiết các mặt hàng, số lượng yêu cầu.<br>2. Quản lý nhấn nút **Duyệt** và xác nhận hộp thoại.<br>3. Hệ thống khóa dòng chứng từ (`FOR UPDATE`), kiểm tra quy tắc phân tách nhiệm vụ (người tạo không được tự duyệt trừ vai trò `admin`).<br>4. Hệ thống sinh mã `qr_code = DOC:<document_number>`, cập nhật `status = 'approved'` và trả về chứng từ đã duyệt.<br>5. Giao diện Web hiển thị mã ảnh QR của phiếu để in hoặc trình chiếu cho thiết bị quét tại kho. |
| **Luồng thay thế** | - **2a. Quản lý quyết định Từ chối yêu cầu (`UC_WH_05`):**<br>  1) Quản lý nhấn **Từ chối**, nhập `reason` vào hộp thoại và xác nhận.<br>  2) Hệ thống kiểm tra `reason` không rỗng, cập nhật `status = 'rejected'`, lưu `rejection_reason` và hiển thị thông báo từ chối cho Nhân viên kho trên App Mobile. |
| **Luồng ngoại lệ** | - **3a. Người duyệt chính là người tạo phiếu (`doc.created_by === userId && userRole !== 'admin'`):** Hệ thống trả lỗi HTTP `403` (*"Nhân viên không thể tự phê duyệt yêu cầu do chính mình tạo"*).<br>- **3b. Chứng từ đã ở trạng thái `completed`, `rejected` hoặc `cancelled`:** Hệ thống trả lỗi HTTP `409`.<br>- **2a.1. Từ chối nhưng không nhập lý do:** Hệ thống trả lỗi HTTP `400` (*"Lý do từ chối là bắt buộc"*). |
| **Quy tắc nghiệp vụ** | - Đảm bảo nguyên tắc bất kiêm nhiệm (Segregation of Duties): người lập phiếu không thể tự phê duyệt phiếu của mình (ngoại trừ `admin` hệ thống).<br>- Mỗi phiếu sau khi duyệt có một mã `qr_code` duy nhất theo ràng buộc `uq_warehouse_documents_qr`. |
| **Quyền truy cập** | `requireRole('admin', 'manager')` + `warehouse.documents.approve` (`POST /api/v1/manager/documents/:documentId/approve` và `/reject`). |
| **Use Case liên quan** | Tiền điều kiện bắt buộc cho `UC_WH_06` và `UC_WH_08`. |
| **Source code chứng minh** | - `Backend/src/routes/manager.routes.js` (dòng 34–35)<br>- `Backend/src/models/warehouse.model.js` (`approveDocument`, `rejectDocument` dòng 145–222)<br>- `Frontend_Web/src/pages/WarehouseApprovalsPage.jsx` (dòng 95–138, 758–800) |
| **Trạng thái xác minh** | Đã xác minh đầy đủ. |

---

## 7. UC_WH_06 & UC_WH_08 — Quét mã QR phiếu kho đối soát & Xác nhận hoàn tất nhập xuất kho

| Mục đặc tả | Nội dung chi tiết |
|---|---|
| **Mã Use Case** | `UC_WH_08` (bao gồm `<<include>>` `UC_WH_06`, mở rộng `<<extend>>` `UC_WH_07`) |
| **Tên Use Case** | Xác nhận hoàn tất nhập xuất và cập nhật tồn (kèm Quét mã QR phiếu kho đối soát) |
| **Mục tiêu** | Xác thực chứng từ kho đã phê duyệt bằng mã QR (qua trạm Camera IoT ESP32-S3, Webcam hoặc Camera App Mobile), ghi nhận số lượng thực nhận/thực xuất và cập nhật tồn kho an toàn trong transaction. |
| **Actor chính** | Nhân viên kho (`warehouse`), Quản trị viên (`admin`) |
| **Actor phụ** | Camera IoT ESP32-S3 (`<<Thiết bị>>`), Quản lý (`manager` — khi quét đối soát trên trạm Web Camera) |
| **Mô tả** | Phiếu kho ở trạng thái `approved` bắt buộc phải được quét mã QR để hệ thống đóng dấu `qr_scanned_at` và nguồn quét (`esp32_s3_camera`, `web_camera_scanner` hoặc `mobile_app`). Sau đó Nhân viên kho kiểm đếm số lượng thực tế và bấm xác nhận hoàn tất để cộng/trừ bảng `inventory` và sinh `inventory_transactions`. |
| **Sự kiện kích hoạt** | Nhân viên kho/Camera IoT đưa mã QR phiếu kho vào khung ngắm quét và nhấn **Xác nhận thực nhận hàng / thực xuất hàng**. |
| **Tiền điều kiện** | 1. Chứng từ kho đang ở trạng thái `status = 'approved'`.<br>2. Nếu quét bằng mạch ESP32-S3, thiết bị đã kết nối Wi-Fi và cấu hình đúng `X-Device-Token`. |
| **Hậu điều kiện thành công** | 1. Khi quét QR (`UC_WH_06`): cập nhật `qr_scanned_at = NOW()`, `qr_scanned_by`, `qr_scanned_source` trên `warehouse_documents` và ghi nhận `audit_logs` (`warehouse.document.qr_lookup`).<br>2. Khi hoàn tất (`UC_WH_08`): cập nhật `actual_quantity` cho từng dòng phiếu, cộng/trừ `inventory.quantity`, tạo bản ghi `inventory_transactions` (có `quantity_before`, `quantity_after`, `operation_key` chống trùng), và chuyển phiếu sang `status = 'completed'`. |
| **Hậu điều kiện thất bại** | Transaction rollback toàn bộ; tồn kho không bị thay đổi một phần. |
| **Luồng chính** | 1. **Thực hiện `UC_WH_06` (Quét mã QR phiếu kho đối soát — `<<include>>`):**<br>   - Camera IoT ESP32-S3 (giải mã bằng thư viện `quirc` trên Core 1) hoặc Camera trên App Kho (`WarehouseScanScreen`) đọc chuỗi mã QR `DOC:NK-...` / `DOC:XK-...` và gọi `GET /warehouse/documents/lookup`.<br>   - Hệ thống tìm chứng từ theo `qr_code` hoặc `document_number`; vì chứng từ đang `approved`, hệ thống ghi nhận `qr_scanned_at`, `qr_scanned_source` và ghi `audit_logs`.<br>2. Nhân viên kho xem thông tin phiếu đã mở khóa xác thực QR trên ứng dụng Mobile, kiểm đếm hàng hóa thực tế và nhập `actualQuantity` cho từng sản phẩm.<br>3. Nhân viên kho nhấn **Xác nhận & Cập nhật tồn kho** (`POST /warehouse/documents/:documentId/complete`).<br>4. Hệ thống khóa chứng từ (`FOR UPDATE`), kiểm tra `status === 'approved'` và kiểm tra bắt buộc `qr_scanned_at IS NOT NULL`.<br>5. Với từng mặt hàng trong phiếu, hệ thống kiểm tra quy tắc số lượng thực tế, lưu `actual_quantity`, gọi `changeStock` cập nhật tồn kho và tạo giao dịch kho `receipt` (+SL) hoặc `issue` (-SL).<br>6. Hệ thống cập nhật chứng từ sang `status = 'completed'`, lưu `completed_by`, `completed_at` và commit transaction. |
| **Luồng thay thế** | - **2a. Quét kiểm đếm từng mã SKU sản phẩm trong phiếu (`UC_WH_07` — `<<extend>>`):** Nếu Nhân viên kho không gửi mảng `actualItems` nhập tay mà thực hiện quét từng mã SKU sản phẩm qua `POST /warehouse/documents/:documentId/scan`, hệ thống lưu vào bảng `warehouse_document_scan_events` và đối chiếu tổng `scanned_qty === quantity` cho toàn bộ dòng hàng trước khi hoàn tất tại bước 5. |
| **Luồng ngoại lệ** | - **4a. Chưa quét mã QR đối soát (`!header.qr_scanned_at`):** Hệ thống chặn hoàn tất và trả lỗi HTTP `409` (*"Chứng từ chưa được quét mã QR đối soát qua thiết bị IoT ESP32-S3 hoặc App kho. Vui lòng quét mã QR trước khi xác nhận hoàn tất"*).<br>- **4b. Chứng từ chưa duyệt (`pending`) hoặc đã bị từ chối (`rejected`):** Hệ thống trả lỗi HTTP `409`.<br>- **5a. Phiếu xuất kho (`issue`) có `confirmedQty > item.quantity` (xuất vượt số lượng được duyệt):** Hệ thống trả lỗi HTTP `409`.<br>- **5b. Tồn kho khả dụng không đủ để xuất (`INSUFFICIENT_STOCK`):** Hệ thống rollback và trả lỗi HTTP `409` (*"Tồn kho khả dụng không đủ để xuất kho"*). |
| **Quy tắc nghiệp vụ** | - Bắt buộc xác thực QR vật lý trước khi cho phép biến động tồn kho.<br>- Chống ghi trùng giao dịch kho bằng khóa duy nhất `operation_key = warehouse-document:<documentId>:<productId>`. |
| **Quyền truy cập** | - Quét QR: `warehouse.documents.read` / `manager.documents.read` / Header `X-Device-Token`.<br>- Hoàn tất phiếu: `warehouse.documents.complete`. |
| **Use Case liên quan** | Bao gồm (`<<include>>`): `UC_WH_06`. Mở rộng (`<<extend>>`): `UC_WH_07`. |
| **Source code chứng minh** | - `Hardware_IoT/ESP32_S3_Camera_QR/ESP32_S3_Camera_QR.ino` (`processQRCode`, `queryBackendDocument` dòng 1496–1600)<br>- `Backend/src/controllers/warehouse.controller.js` (`lookupByQr` dòng 98–144)<br>- `Backend/src/models/warehouse.model.js` (`completeDocument` dòng 224–346)<br>- `Backend/src/models/document-scan.model.js` (`scanDocumentItem`)<br>- `Frontend_Mobile/karat_app/lib/features/warehouse/screens/warehouse_documents_screen.dart` (dòng 647–800)<br>- `Frontend_Web/src/components/inventory/IotCameraScannerModal.jsx` |
| **Trạng thái xác minh** | Đã xác minh đầy đủ từ firmware C++ ESP32-S3, Web, Mobile đến Backend & DB. |

---

## 8. UC_INV_04 — Điều chỉnh tăng giảm tồn kho

| Mục đặc tả | Nội dung chi tiết |
|---|---|
| **Mã Use Case** | `UC_INV_04` |
| **Tên Use Case** | Điều chỉnh tăng giảm tồn kho |
| **Mục tiêu** | Cho phép Quản lý trực tiếp cân bằng, tăng hoặc giảm số lượng tồn kho khi kiểm kê phát hiện chênh lệch, có lưu vết lịch sử giao dịch trước/sau. |
| **Actor chính** | Quản lý (`manager`), Quản trị viên (`admin`) |
| **Actor phụ** | Không có |
| **Mô tả** | Trên trang `InventoryPage.jsx`, Quản lý mở hộp thoại **Điều chỉnh tồn kho** (`AdjustStockModal.jsx`), chọn kho, sản phẩm, loại giao dịch (`receipt`, `issue`, `adjustment`), số lượng điều chỉnh và lý do/mã tham chiếu. |
| **Sự kiện kích hoạt** | Quản lý nhấn nút **Điều chỉnh tồn kho** trên trang Quản lý tồn kho (`/inventory`). |
| **Tiền điều kiện** | Người dùng đăng nhập vai trò `manager` hoặc `admin` và có quyền `manager.inventory.adjust`. |
| **Hậu điều kiện thành công** | 1. Số lượng `inventory.quantity` được cập nhật tương ứng với độ lệch `delta`.<br>2. Một dòng lịch sử mới được ghi vào `inventory_transactions` lưu đầy đủ `quantity_before`, `quantity_delta`, `quantity_after`, `note`, `created_by`. |
| **Hậu điều kiện thất bại** | Không thay đổi số lượng tồn kho. |
| **Luồng chính** | 1. Quản lý xem bảng tồn kho hiện tại (`quantity`, `reserved_quantity`, `available_quantity`) và nhấn **Điều chỉnh tồn kho**.<br>2. Quản lý chọn kho hàng, sản phẩm, loại điều chỉnh (`receipt` tăng, `issue` giảm, hoặc `adjustment` tăng/giảm), nhập số lượng nguyên khác 0 và ghi chú lý do.<br>3. Hệ thống kiểm tra đầu vào hợp lệ và mở transaction cập nhật tồn kho qua hàm `changeStock`.<br>4. Hệ thống kiểm tra tồn sau điều chỉnh không âm và không nhỏ hơn lượng đang giữ chỗ (`reserved_quantity`), ghi bản ghi `inventory_transactions` và commit. |
| **Luồng thay thế** | Không có. |
| **Luồng ngoại lệ** | - **2a. Số lượng bằng 0 hoặc nhập số âm cho loại `receipt`/`issue`:** Hệ thống trả lỗi HTTP `400`.<br>- **4a. Giảm tồn vượt quá lượng tồn khả dụng (`quantity_after < reserved_quantity` — mã `INVENTORY_INSUFFICIENT`):** Hệ thống rollback và trả lỗi HTTP `409`. |
| **Quy tắc nghiệp vụ** | Ràng buộc toàn vẹn CSDL đảm bảo mọi thời điểm `quantity >= 0` và `reserved_quantity <= quantity` (`002_manager_operations.sql` dòng 45–46). |
| **Quyền truy cập** | `requireRole('admin', 'manager')` + `manager.inventory.adjust` (`POST /api/v1/manager/inventory/adjustments`). |
| **Use Case liên quan** | `UC_INV_01` (Tra cứu tồn kho), `UC_INV_05` (Xem lịch sử giao dịch biến động tồn kho). |
| **Source code chứng minh** | - `Backend/src/routes/manager.routes.js` (dòng 26)<br>- `Backend/src/services/manager.service.js` (`adjustStock` dòng 172–182)<br>- `Backend/src/models/manager.model.js` (`adjustInventory` dòng 258–272)<br>- `Frontend_Web/src/pages/InventoryPage.jsx`, `AdjustStockModal.jsx` |
| **Trạng thái xác minh** | Đã xác minh đầy đủ. |
