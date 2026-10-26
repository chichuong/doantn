# Core Inventory và Order State Machine

## Migration

Repository đã có `010_inventory_consistency.sql`, vì vậy phần nâng cấp mới nằm tại `016_core_inventory_and_state_machine.sql`. Không đổi tên hoặc chạy lại migration 010 cũ.

Migration 016 thực hiện:

- bắt buộc mọi order có `warehouse_id` và mọi POS order có `pos_session_id`;
- thêm `orders.idempotency_key` và unique index theo actor, channel, key;
- thêm `expired`, `expires_at` cho reservation;
- thêm `pos_order_id`, `reference_id` và ràng buộc một nguồn tham chiếu cho giao dịch tồn;
- đổi trạng thái cũ `processing/completed` sang state machine mới;
- thêm `from_status` cho lịch sử;
- tạo trigger PostgreSQL chặn mọi chuyển trạng thái ngoài ma trận, kể cả câu SQL bỏ qua Node.js;
- tạo view `inventory_reservation_reconciliation`.

Migration chủ động dừng nếu dữ liệu lịch sử còn order thiếu kho hoặc POS order thiếu ca. Cần đối soát các bản ghi đó trước khi chạy lại.

## Ma trận trạng thái

| Từ | Được chuyển đến |
|---|---|
| `pending` | `confirmed`, `cancelled` |
| `confirmed` | `ready_to_pack`, `cancelled` |
| `ready_to_pack` | `packed`, `cancelled` |
| `packed` | `handover` |
| `handover` | `shipping`, `returned` |
| `shipping` | `delivered`, `returned` |
| `delivered` | `returned` |
| `cancelled` | trạng thái cuối |
| `returned` | trạng thái cuối |

Tiến độ `assigned/picking` thuộc `order_processing_tasks`. Nó không phải trạng thái order. POS tạo order tại trạng thái cuối `delivered` vì nhận hàng và thanh toán xảy ra tại quầy; hoàn giao dịch POS chuyển `delivered -> returned`.

Mọi thay đổi trạng thái gọi `transitionOrder(client, ...)`. Hàm khóa order bằng `FOR UPDATE`, kiểm tra ma trận, cập nhật có điều kiện theo trạng thái cũ và ghi `order_status_history` trong cùng transaction.

## Hợp đồng transaction tồn kho

Bốn hàm trong `src/services/inventory.service.js` nhận PostgreSQL transaction client từ caller:

- `reserveStock`: khóa toàn bộ dòng tồn, kiểm tra available, tăng reserved và tạo reservation.
- `consumeReservation`: giảm đồng thời quantity và reserved, đóng reservation thành consumed và ghi giao dịch xuất.
- `releaseReservation`: giảm reserved, giữ nguyên quantity và đóng reservation thành released hoặc expired.
- `directDeductStock`: kiểm tra available và trừ quantity cho POS, không thay đổi reserved.

Tất cả batch tồn được chuẩn hóa và khóa theo `(warehouse_id, product_id)` tăng dần bằng một câu `SELECT ... ORDER BY ... FOR UPDATE`. Caller phải mở `BEGIN`, khóa order trước khi gọi đối với nghiệp vụ online, rồi `COMMIT` hoặc `ROLLBACK` toàn bộ.

## Đối soát

```sql
SELECT warehouse_id, product_id, quantity, reserved_quantity,
       active_reserved_quantity, is_balanced
FROM inventory_reservation_reconciliation
WHERE NOT is_balanced;
```

Kết quả chuẩn là không có dòng. View so sánh chính xác:

```text
inventory.reserved_quantity = SUM(inventory_reservations.quantity WHERE status = 'active')
```
