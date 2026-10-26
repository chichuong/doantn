import { query } from '../config/database.js';
import { assertUuid } from '../utils/validation.js';
import { AppError } from '../utils/app-error.js';

const lookups = {
  order: ['SELECT warehouse_id FROM orders WHERE id = $1', 'orderId'],
  document: ['SELECT warehouse_id FROM warehouse_documents WHERE id = $1', 'documentId'],
  session: ['SELECT warehouse_id FROM pos_sessions WHERE id = $1', 'sessionId'],
  sale: ['SELECT warehouse_id FROM orders WHERE id = $1', 'saleId']
};

export const requireWarehouseAccess = (source) => async (request, response, next) => {
  try {
    if (['admin', 'manager'].includes(request.user?.role_code)) return next();
    let warehouseId;
    if (source === 'body' || source === 'query') {
      warehouseId = assertUuid(request[source]?.warehouseId, 'warehouseId');
    } else {
      const [sql, field] = lookups[source];
      const id = assertUuid(request.params[field] || request.body?.[field], field);
      const result = await query(sql, [id]);
      if (!result.rowCount) throw new AppError(404, 'Không tìm thấy dữ liệu nghiệp vụ');
      warehouseId = result.rows[0].warehouse_id;
      if (!warehouseId) throw new AppError(409, 'Dữ liệu cũ chưa xác định được kho');
    }
    if (!request.user.warehouse_ids?.includes(warehouseId)) throw new AppError(403, 'Bạn chưa được phân công làm việc tại kho này');
    next();
  } catch (error) { next(error); }
};
