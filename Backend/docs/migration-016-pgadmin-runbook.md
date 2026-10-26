# Hướng dẫn áp dụng migration 016 bằng pgAdmin

## Xác định đúng điểm bắt đầu

Migration `016_core_inventory_and_state_machine.sql` là migration cộng dồn trên schema 015. Nếu database hiện mới ở migration 009, bắt buộc chạy 010, 011, 012, 013, 014 và 015 theo thứ tự. Không tự thêm riêng `orders.pos_session_id`, vì cột này thuộc migration 010 và migration 010 sẽ lỗi nếu cột đã được tạo thủ công.

Dừng Node.js API và các worker trước khi kiểm tra để không phát sinh đơn hoặc biến động tồn kho. Trong pgAdmin, chọn đúng database và tạo bản backup trước khi sửa dữ liệu.

## Trình tự cho database hiện ở migration 009

### Bước 1: chạy pre-check 016 ở chế độ nhận diện schema

Mở Query Tool, nạp `database/016_core_precheck.sql`, rồi chọn **Execute Script** để chạy toàn bộ file.

File này chạy được trên schema 009. Nó chỉ ghi vào các bảng tạm và kết thúc bằng
`ROLLBACK`, vì vậy không thay đổi dữ liệu thật. PostgreSQL vẫn cần transaction
read-write để cho phép tạo bảng tạm.

Ở schema 009, kết quả đúng tại thời điểm này là:

- grid `_m016_schema` có các dòng `ready = false` cho migration 010, 011 và 015;
- `schema_ready_for_016 = false`;
- `pos_check_mode = COLUMN_ABSENT_ALL_POS_ORDERS_NEED_MIGRATION_010`;
- các đơn POS được liệt kê để xem ứng viên ca bán;
- đối soát reservation hiện `SKIPPED_REQUIRES_MIGRATION_010`.

Các kết quả trên chỉ báo rằng schema chưa sẵn sàng cho 016, không phải lỗi dữ liệu.

### Bước 2: chuẩn bị migration 010

Mở và chạy toàn bộ `database/010_inventory_preflight.sql`. Hai grid đầu phải rỗng:

1. Không có đơn online đang mở bị thiếu `warehouse_id`.
2. `inventory.reserved_quantity` phải bằng tổng item của các đơn online đang giữ hàng.

Grid POS và category dùng để rà soát dữ liệu. Nếu hai grid đầu có dòng, xử lý theo chứng từ trước khi chạy 010; không đặt lại counter hoặc gán kho hàng loạt.

Nếu grid 1 rỗng nhưng grid 2 có chênh lệch `reserved_quantity`, chạy
`database/010_inventory_safe_reconciliation.sql`. Script này khóa các bảng liên quan,
chặn đơn thiếu item, thiếu dòng inventory hoặc tổng giữ vượt tồn vật lý, sau đó mới
đồng bộ counter theo các đơn online đang mở và ghi lại từng thay đổi trong `audit_logs`.
Grid cuối của script phải rỗng. Sau đó chạy lại `010_inventory_preflight.sql`; hai grid
đầu phải rỗng rồi mới chạy migration 010.

### Bước 3: chạy lần lượt migrations 010 đến 015

Trong cùng database, chạy trọn từng file và chờ báo thành công trước khi sang file tiếp theo:

1. `database/migrations/010_inventory_consistency.sql`
2. `database/migrations/011_catalog_and_warehouse_workflows.sql`
3. `database/migrations/012_manual_transfer_payments.sql`
4. `database/migrations/013_forecasting_metadata.sql`
5. `database/migrations/014_staff_warehouse_access.sql`
6. `database/migrations/015_document_scan_verification.sql`

Mỗi file đã tự có `BEGIN`/`COMMIT`, vì vậy không bọc thêm một transaction bên ngoài. Nếu Query Tool báo transaction bị aborted, chạy `ROLLBACK;`, sửa nguyên nhân và chạy lại đúng file.

### Bước 4: chạy lại pre-check 016

Chạy lại toàn bộ `database/016_core_precheck.sql`. Lúc này:

- mọi dòng ở grid đầu phải có `ready = true`;
- `schema_ready_for_016 = true`;
- các cột đếm trong grid cuối phải bằng `0`;
- các grid chi tiết phải không còn lỗi chặn migration.

Trạng thái `processing` và `completed` vẫn hợp lệ trước migration 016 vì chính 016 sẽ chuyển chúng sang vocabulary mới.

## Backfill an toàn trước migration 016

Mở `database/016_core_safe_backfill.sql` sau khi đã chạy đủ 010–015. File có khối kiểm tra prerequisite ở đầu. Nếu schema vẫn thiếu, nó chủ động rollback và báo rõ migration còn thiếu; nó không tự tạo cột.

### Section A: tự động theo bằng chứng

Chạy Section A. Script chỉ sửa khi bằng chứng dẫn đến đúng một kết quả:

- POS session khớp duy nhất theo nhân viên mở ca, thời gian bán và kho;
- warehouse khớp duy nhất từ POS session, active reservation hoặc inventory transaction.

Mỗi thay đổi được ghi vào `audit_logs` với action bắt đầu bằng `migration_016_`. Các result grid cuối Section A liệt kê dòng chưa thể suy ra an toàn.

### Section B: quyết định thủ công có kiểm soát

Chỉ dùng Section B sau khi kiểm tra hóa đơn, phiếu kho, báo cáo ca hoặc chứng từ ký nhận. Điền UUID thật vào bảng tạm, lý do tối thiểu 20 ký tự và UUID của admin/manager đang hoạt động. Script xác thực order, warehouse, session, nhân viên, thời gian và ghi audit log.

Sau backfill, chạy lại pre-check 016 cho đến khi grid cuối đạt yêu cầu.

## Chạy migration 016 và nghiệm thu

Nên thử toàn bộ quy trình trên database clone từ bản backup trước. Khi clone đạt yêu cầu, lặp lại đúng trình tự trên database thật trong thời gian dừng hệ thống.

Chạy toàn bộ `database/migrations/016_core_inventory_and_state_machine.sql`. Không chạy từng đoạn rời. Migration tự rollback nếu còn đơn thiếu kho, đơn POS thiếu ca, reservation sai liên kết hoặc counter tồn giữ bị lệch.

Sau khi migration thành công, chạy `database/016_core_acceptance.sql`. Các grid ghi lỗi phải rỗng và các cờ kiểm tra schema phải là `true`.

Câu đối soát chính là:

```sql
SELECT *
FROM inventory_reservation_reconciliation
WHERE NOT is_balanced;
```

Kết quả chuẩn là 0 dòng. `reserved_quantity > active_reserved_quantity` nghĩa là counter giữ dư. Chiều ngược lại nghĩa là các reservation active đang lớn hơn counter, khiến tồn khả dụng có thể bị báo cao. Giữ API dừng và truy nguyên order, transaction hoặc chứng từ trước khi điều chỉnh.

Khi nghiệm thu không còn lỗi, khởi động API, kiểm tra health endpoint và cập nhật frontend dùng các trạng thái `ready_to_pack`, `handover`, `delivered` thay cho `processing`, `completed`.
