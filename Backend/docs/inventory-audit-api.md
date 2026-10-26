# API giám sát và đối soát tồn kho

Các API trong tài liệu này dành cho `admin` và `manager` có quyền `manager.inventory.read`. Chúng chỉ đọc dữ liệu; mọi thay đổi tồn vẫn đi qua điều chỉnh tồn, chứng từ kho, đóng gói đơn, POS hoặc tiếp nhận hàng hoàn để giữ đầy đủ dấu vết nghiệp vụ.

## 1. Danh sách chênh lệch reservation

```http
GET /api/v1/manager/inventory/discrepancies?page=1&limit=20&warehouseId={uuid}&productId={uuid}
Authorization: Bearer {token}
```

Chỉ trả những dòng mà `inventory.reserved_quantity` khác tổng reservation đang `active`.

```json
{
  "data": [
    {
      "warehouse_id": "uuid",
      "warehouse_code": "WH-HCM-01",
      "product_id": "uuid",
      "sku": "SP-001",
      "quantity": 20,
      "reserved_quantity": 7,
      "expected_reserved_quantity": "5",
      "difference": "2"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

`difference = reserved_quantity - expected_reserved_quantity`. Số dương nghĩa là counter đang giữ nhiều hơn tổng reservation; số âm nghĩa là reservation đang giữ nhiều hơn counter.

## 2. Lịch sử biến động tồn

```http
GET /api/v1/manager/inventory/transactions?page=1&limit=20&type=issue&warehouseId={uuid}&productId={uuid}&from=2026-10-01&to=2026-10-31&referenceCode=ONL-
Authorization: Bearer {token}
```

Bộ lọc đều tùy chọn. Kết quả cho biết delta, số dư trước/sau, kho, sản phẩm, người thao tác và chứng từ nguồn khi có.

Các giao dịch lịch sử tạo trước migration `010` có thể có `quantity_delta`, `quantity_before` và `quantity_after` bằng `null`. API giữ nguyên sự thật dữ liệu cũ thay vì suy đoán số dư.

## 3. Truy vết reservation của một dòng tồn

```http
GET /api/v1/manager/inventory/{warehouseId}/{productId}/reservations?page=1&limit=20&status=active
Authorization: Bearer {token}
```

Response gồm hai phần:

- `data`: số tồn hiện tại, lượng giữ theo counter, lượng giữ tính lại từ reservation và chênh lệch.
- `reservations`: từng reservation cùng mã đơn, trạng thái đơn, số lượng và thời điểm đóng.

Khi API chênh lệch báo một dòng, dùng API này để xác định chính xác đơn nào đang sở hữu lượng giữ trước khi đối soát dữ liệu.

## Quy tắc sử dụng

1. Kiểm tra `/discrepancies` trước và sau mỗi đợt xử lý dữ liệu cũ.
2. Mở `/reservations` cho từng dòng chênh lệch để đối chiếu đơn đang mở.
3. Dùng `/transactions` để tìm chứng từ nhập/xuất và số dư đã ghi nhận.
4. Chỉ sửa dữ liệu dựa trên đơn hàng, chứng từ kho và bằng chứng thực tế. Không cập nhật trực tiếp counter để làm mất cảnh báo.
