# Tiến độ triển khai theo priority — 12/10/2026

Tài liệu này mô tả phiên bản code mới. Những tài liệu API cũ vẫn hữu ích để tra payload, nhưng quy tắc đóng gói, quét mã, phân công kho và thanh toán dưới đây thay thế hướng dẫn cũ.

Theo yêu cầu hiện tại: triển khai code trước, kiểm thử sau. Chưa áp dụng migration vào database thật, chưa chạy API/Integration test, chưa huấn luyện mô hình. Không coi việc kiểm tra cú pháp là bằng chứng nghiệp vụ đã đúng.

Kiểm tra tĩnh được chạy lại sau mỗi gói code; đã sinh OpenAPI và mẫu Excel/CSV. Chưa chạy Python hoặc thực thi SQL trên PostgreSQL.

## Trạng thái theo ưu tiên

| Priority | Phần việc | Trạng thái code |
|---|---|---|
| P0 | Reservation theo dòng đơn; giữ/giải phóng/tiêu thụ cùng transaction | Đã triển khai |
| P0 | Pack giảm quantity và reserved_quantity, bắt buộc đúng kho, ghi history | Đã triển khai |
| P0 | POS lưu warehouse_id/pos_session_id; hoàn đúng kho; doanh số theo ca | Đã triển khai |
| P0 | Idempotency-Key cho checkout/POS; chống trừ/hoàn lại; khóa giỏ khi cập nhật | Đã triển khai |
| P0 | Khóa dòng tồn mới trước tính số dư; lịch sử có delta/before/after | Đã triển khai |
| P0 | Import tồn 0, ghi chênh lệch kiểm kê, rollback cả file, lỗi theo dòng | Đã triển khai |
| P0 | Đối soát dữ liệu cũ, dừng migration khi reservation không khớp | Đã triển khai |
| P0 | Hủy online bởi Manager trước xuất; hủy task; giữ payment_status đến khi hoàn tiền thật | Đã triển khai |
| P0 | Hết hạn giữ hàng pending/unpaid | Có code CLI; mặc định tắt, chưa chạy/lập lịch |
| P0 | State Machine đơn hàng tập trung; khóa chuyển trạng thái và tự ghi lịch sử | Đã triển khai qua migrations 016–017 |
| P1 | CRUD Category bằng tạo/sửa/ngừng sử dụng; tên duy nhất sau chuẩn hóa | Đã triển khai |
| P1 | Import Category; export Category và thống kê doanh số; lịch sử export | Đã triển khai |
| P1 | Quét kiểm tra đơn/chứng từ theo SKU/barcode, số lượng, requestId và người quét | Đã triển khai |
| P1 | Nhận hàng hoàn; chỉ tăng tồn cho số lượng đủ điều kiện bán | Đã triển khai, hiện chỉ hoàn toàn bộ đơn |
| P1 | QR chuyển khoản riêng, thông báo giao dịch, nhân viên đối soát và xác nhận hoàn tiền | Đã triển khai; chờ cấu hình thông tin ngân hàng/ảnh QR |
| P1 | Phân quyền kho cho Warehouse/POS/Order Processor | Đã triển khai; Admin phải phân công sau migration |
| P1 | Đăng ký Customer, catalog công khai, sửa/xóa địa chỉ, timeline vận chuyển cho Customer | Đã triển khai |
| P1 | OpenAPI JSON + trang tra cứu /docs; CORS theo danh sách; giới hạn đăng nhập | Đã triển khai |
| P1 | API Manager đối soát reservation, xem chủ sở hữu lượng giữ và lịch sử biến động tồn | Đã triển khai |
| P2 | Python train/evaluate, baseline + Ridge + Random Forest, phục vụ qua FastAPI | Đã triển khai code; chưa cài Python/chọn dataset/chạy thực nghiệm |
| P2 | Node gọi Python, lưu metadata, MAE/RMSE tổng hợp và cảnh báo đúng phạm vi kho | Đã triển khai code; chưa kiểm thử tích hợp |
| Sau | Unit/Integration/concurrency/E2E tests | Để sau theo yêu cầu |
| Sau | Cổng thanh toán online | Chưa chọn, để sau theo yêu cầu |
| Sau | Tích hợp Web/Flutter/thiết bị thật và đánh giá mô hình trên dữ liệu công khai | Cần thực hiện ở giai đoạn tích hợp/thực nghiệm |

## Áp dụng database khi bắt đầu kiểm thử

1. Database cần có migration 001–009. Nếu đã chạy, không chạy lại seed cũ vì chúng có thể cập nhật tài khoản/role/trạng thái.
2. Dừng API cũ trong thời gian chuyển đổi, sao lưu database.
3. Chạy `database/010_inventory_preflight.sql` trong pgAdmin, hoặc `npm run db:preflight`. Đây là đọc dữ liệu, không sửa số dư.
4. Kiểm tra các báo cáo: đơn online mở thiếu kho, reservation lệch tổng đơn, bằng chứng kho của POS cũ, danh mục trùng tên sau chuẩn hóa.
5. Xử lý chênh lệch dựa trên chứng từ và dữ liệu thực tế. Không đặt toàn bộ reserved_quantity về 0 hoặc tự tăng quantity để làm báo cáo hết lỗi.
6. Chạy lần lượt `010_inventory_consistency.sql`, `011_catalog_and_warehouse_workflows.sql`, `012_manual_transfer_payments.sql`, `013_forecasting_metadata.sql`, `014_staff_warehouse_access.sql`, `015_document_scan_verification.sql`, `016_core_inventory_and_state_machine.sql`.
7. Mỗi migration mới có BEGIN/COMMIT và chỉ chạy một lần. Nếu lỗi và transaction vẫn aborted, chạy ROLLBACK trong Query Tool trước khi xử lý nguyên nhân và chạy lại file lỗi.
8. Sau 010, kiểm tra `SELECT * FROM inventory_reservation_discrepancies;`. Kết quả mong đợi là không có dòng.
9. Kiểm tra POS cũ: `SELECT id, order_number FROM orders WHERE channel='pos' AND (warehouse_id IS NULL OR pos_session_id IS NULL);`. Những đơn chưa đủ bằng chứng không được tự đoán ca/kho. API hủy sẽ trả 409 cho đến khi đối soát.
10. Khởi động phiên bản API mới sau khi đã có đủ migration 010–016. Code mới tham chiếu tất cả các bảng/cột mới; không dùng nó với schema chỉ có 001–009.

Migration 010 chỉ nhận các reservation cũ khi tổng giữ của đơn online pending/confirmed/processing khớp các counter hiện tại. Nó không tự sửa lượng giữ còn sót ở đơn đã packed. POS chỉ backfill nếu lịch sử issue khớp đầy đủ dòng đơn, xác định một kho, và có đúng một ca của nhân viên phù hợp thời điểm/kho.

Các constraint orders mới dùng NOT VALID để giữ những dòng lịch sử chưa đối soát. Chúng vẫn kiểm tra INSERT/UPDATE mới. Sau khi xử lý hết dữ liệu lịch sử, có thể VALIDATE CONSTRAINT trong một bước quản trị riêng.

## Phân công kho

Admin/Manager quản lý toàn hệ thống. Warehouse, sales và order_processor chỉ thao tác tại kho đã được phân công.

Admin gọi `PUT /api/v1/auth/users/{userId}/warehouses`:

```json
{"warehouseIds":["UUID_CUA_KHO"]}
```

`GET /api/v1/auth/users/{userId}/warehouses` xem phân công; `GET /api/v1/auth/me` trả `warehouse_ids`. Nhân viên chưa được phân công sẽ nhận 403. Các danh sách của Warehouse/Order Processor cần query `warehouseId`; không được bỏ filter để đọc tất cả kho.

## Quy tắc tồn kho

Một đơn online dùng một kho, xuất toàn bộ ở bước packed. Thời điểm tạo vận đơn/giao thành công không trừ tồn thêm.

| Sự kiện | quantity | reserved_quantity |
|---|---:|---:|
| Checkout q | Giữ nguyên | +q |
| Hủy trước xuất | Giữ nguyên | −q |
| Pack/xuất | −q | −q |
| POS | −q | Giữ nguyên |
| Nhận hoàn đủ điều kiện bán q | +q | Giữ nguyên |

`inventory_reservations` lưu chủ sở hữu lượng giữ theo order_item. `inventory_transactions` lưu biến động vật lý; việc giữ/giải phóng không được giả làm một lần nhập/xuất hàng. Giao dịch mới có quantity_delta và số dư trước/sau; dữ liệu giao dịch cũ giữ nguyên và có thể không đủ để dựng lại mọi số dư.

`Idempotency-Key` là header tùy chọn của checkout/POS để tương thích client cũ. Client mới nên luôn gửi UUID hoặc mã duy nhất cho một hành động và giữ nguyên khi retry. Một hành động mới phải dùng key mới. Cùng key nhưng payload khác trả 409. Khi key đã tạo đơn, retry trả đơn đó dù giỏ hàng hiện tại đã thay đổi; muốn mua giỏ mới phải đổi key. Key không tự hết hạn trong phiên bản này.

Manager điều chỉnh tồn với `type=adjustment` dùng quantity có dấu: +5 là tăng 5, −5 là giảm 5; không nhận 0. Import inventory dùng số tồn tuyệt đối sau kiểm kê; nhận 0, không nhận số nhỏ hơn lượng giữ, chỉ ghi giao dịch khi có chênh lệch. Nhập hàng cộng tồn dùng chứng từ receipt.

Hủy POS cần reason và refundConfirmed=true nếu có thanh toán; thẻ/chuyển khoản còn cần refundReference của giao dịch hoàn thực tế. Backend chỉ ghi nhận xác nhận của nhân viên, không tự trả tiền. Sau đó mới hoàn tồn vào kho đã lưu trên đơn và đánh dấu refunded. Retry đơn đã hủy không tăng tồn thêm.

## Luồng online và quét kiểm tra

1. Customer checkout → pending, tạo reservation.
2. Order Processor/Manager confirm → confirmed.
3. Manager assign nhân viên đã có quyền kho; order giữ `confirmed`, task=`assigned`.
4. Nhân viên được phân công chuyển task → picking.
5. Warehouse gọi `POST /api/v1/warehouse/orders/{orderId}/scan` cho từng lần quét. Body gồm identifier, quantity (mặc định 1), requestId là UUID.
6. `GET /api/v1/warehouse/orders/{orderId}/check` trả quantity/scanned_quantity và all_checked.
7. Chỉ chuyển task và order → `ready_to_pack` khi quét đủ SKU và số lượng.
8. Warehouse pack → packed, tiêu thụ reservation và xuất kho. Body có thể bỏ warehouseId; nếu gửi thì phải trùng kho trên đơn.
9. Manager tạo vận đơn; Shipper dùng `/api/v1/shipping/scan?identifier=MA_VAN_DON` để tra vận đơn được phân công và cập nhật trạng thái.
10. Customer xem shipment/timeline trong chi tiết đơn của chính mình.

Quét sai sản phẩm, quét quá số lượng hoặc dùng requestId của lần quét khác trả 409. Gửi lại cùng requestId và nội dung chỉ trả sự kiện cũ. API tiếp nhận giá trị mã; QR sản phẩm có thể chứa SKU/barcode, QR vận đơn chứa tracking_number. Việc đọc ảnh bằng camera/thiết bị là phần của Web/Flutter và cần kiểm thử thiết bị thật sau.

Chứng từ kho mới có require_scan=true: tạo draft → quét `/warehouse/documents/{documentId}/scan` → xem `/check` → complete. Chứng từ cũ trước 015 có require_scan=false để không khóa dữ liệu draft lịch sử. Không có API cho nhân viên tùy ý tắt kiểm tra của chứng từ mới.

Customer hủy ở `pending/confirmed`. Manager dùng `POST /manager/orders/{orderId}/cancel` với note bắt buộc, được hủy cả `ready_to_pack` nhưng không hủy đơn đã xuất kho. Hủy giải phóng reservation, hủy task và đóng thông báo chuyển khoản đang chờ. Nếu đã nhận tiền thì payment_status vẫn paid; hoàn tiền là bước đối soát riêng.

## Nhận hàng hoàn

Shipper báo returned chưa có nghĩa là tồn bán được đã tăng. Warehouse tiếp nhận bằng `POST /warehouse/orders/{orderId}/return-receipt`:

```json
{
  "note":"Đã kiểm tra hàng hoàn",
  "items":[{"orderItemId":"UUID_DONG_DON","receivedQuantity":3,"restockQuantity":2}]
}
```

Phiên bản này yêu cầu toàn bộ dòng đơn và receivedQuantity bằng lượng đã xuất. Trong ví dụ, 2 sản phẩm được nhập lại tồn bán được; 1 sản phẩm hỏng được ghi nhận trong phiếu nhưng không tăng tồn. Chỉ có một phiếu nhận hoàn cho một đơn; retry với số lượng khác trả 409. Đây chưa phải module kiểm kê kho hàng hỏng/hoàn một phần.

## Thanh toán QR chuyển khoản thủ công

Chỉ cập nhật `.env` của bạn khi có thông tin thật:

```dotenv
BANK_NAME=
BANK_ACCOUNT_NUMBER=
BANK_ACCOUNT_NAME=
BANK_QR_IMAGE_URL=
```

Ảnh QR cần là URL công khai bạn kiểm soát hoặc đường dẫn ảnh được Web phục vụ. Backend không sinh QR giả, không gọi cổng thanh toán, không đọc tài khoản ngân hàng. QR cố định không tự chứa tổng tiền của mỗi đơn; frontend hiển thị số tiền và nội dung chuyển khoản riêng.

| API | Quy tắc |
|---|---|
| GET /payments/orders/{id}/instructions | Customer xem QR/thông tin của đơn mình; configured=false nếu thiếu cấu hình |
| POST /payments/orders/{id}/transfers | Customer gửi bankReference và note; chỉ tạo pending |
| GET /payments/transfers | Manager/Admin xem danh sách đối soát |
| POST /payments/transfers/{requestId}/review | confirmed/rejected; confirmed cần bankReference thực tế và receivedAmount khớp tổng tiền; rejected cần reviewNote |
| POST /payments/orders/{id}/refund | Manager/Admin ghi nhận giao dịch hoàn tiền đã thực hiện; cần bankReference |

Chỉ confirmed sau khi nhân viên đối soát ngân hàng mới tạo payments và đổi payment_status=paid. Một mã giao dịch đã xác nhận không được dùng cho đơn khác. Không xác nhận đơn đã cancelled/returned. Khi hoàn tiền cho returned, kho phải có phiếu nhận hoàn. Endpoint refund chỉ ghi nhận, không thực hiện chuyển tiền. Phiên bản này xử lý thanh toán/hoàn tiền toàn bộ, chưa xử lý thanh toán thiếu/thừa hay nhiều đợt.

Nếu có tiền đến sau khi đơn đã hủy/hết hạn, đó là trường hợp đối soát ngoại lệ cần xử lý với ngân hàng và chứng từ thực tế; không được gọi API xác nhận để tự mở lại đơn đã hủy.

## Hết hạn giữ hàng

RESERVATION_TTL_MINUTES=0 mặc định không tự hết hạn. Nếu sau giai đoạn kiểm thử quyết định bật TTL, đơn checkout pending/unpaid nhận reservation_expires_at. Confirm hoặc xác nhận nhận tiền thành công xóa thời hạn.

`npm run db:expire-reservations` chỉ preview các đơn quá hạn. `npm run db:expire-reservations -- --apply` mới hủy từng đơn và giải phóng lượng giữ theo transaction, có SKIP LOCKED. CLI cần được lập lịch riêng; hiện không có job chạy ngầm. Bật TTL trước khi có lịch job và quy trình đối soát tiền đến muộn sẽ để lại các đơn quá hạn chờ xử lý.

## Excel/CSV và tài liệu API

Import hỗ trợ categories/products/inventory; export hỗ trợ categories/products/inventory/orders/sales. Import orders không thuộc đầu ra nhập liệu của đề cương và chưa được thêm: việc tạo đơn phải đi qua nghiệp vụ giữ tồn.

Import toàn bộ hoặc rollback toàn bộ, trả errors cho client cũ và errorDetails có rowNumber/code/message cho giao diện mới. Lỗi DB xảy ra khi commit một dòng vẫn mang vị trí dòng nếu xác định được. File tối đa 10 MB, 10.000 dòng dữ liệu, 30 cột; SKU/barcode nên để dạng text để giữ số 0 đầu. Không nhận công thức Excel. Export bảo vệ chuỗi có thể được spreadsheet hiểu là công thức.

`npm run templates:create` sinh mẫu .xlsx/.csv. `npm run docs:generate` sinh docs/openapi.json từ route và schema request. `/api/v1/openapi.json` có thể nhập vào Swagger Editor/Postman; `/docs` là trang tra cứu nội bộ, không phụ thuộc CDN. Đây là OpenAPI, chưa cài Swagger UI package. Response của nhiều endpoint cũ vẫn mô tả tổng quát data/pagination; có thể bổ sung schema response chi tiết khi ổn định kiểm thử.

## Những việc phải làm ở giai đoạn kiểm thử

Không chạy những kịch bản này trong lần triển khai code hiện tại. Khi bắt đầu test, ưu tiên: đặt hết tồn rồi pack; checkout/POS tranh sản phẩm cuối; pack/cancel đồng thời; retry checkout/POS/scan/pack/void; hoàn đúng kho sau đổi ca; import tồn 0 và tồn thấp hơn reserved; rollback nhiều dòng; quyền kho và IDOR; thanh toán/cancel chạy đồng thời; nhận hoàn và hoàn tiền; mất kết nối Python; ngày dự báo theo giờ Việt Nam.

Chỉ sau khi vượt qua kiểm thử mới chốt P0/P1 là hoàn thành về nghiệp vụ. Python còn cần chọn/chuẩn hóa dữ liệu công khai, cài môi trường, chạy huấn luyện và ghi kết quả thực nghiệm thật; hiện không có con số MAE/RMSE được tạo giả.
