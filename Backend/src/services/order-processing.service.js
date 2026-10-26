import { AppError } from '../utils/app-error.js';
import { assignOrder, confirmOrder, findProcessor, getOrder, listOrders, updateTask } from '../models/order-processing.model.js';

const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
const paging = (query) => {
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
  const page = Math.max(Number(query.page) || 1, 1);
  return { limit, page, offset: (page - 1) * limit };
};

export const orders = async (query) => {
  if (query.warehouseId && !isUuid(query.warehouseId)) throw new AppError(400, 'warehouseId không hợp lệ');
  if (query.status && !['pending', 'confirmed', 'ready_to_pack'].includes(query.status)) throw new AppError(400, 'status không hợp lệ');
  const { limit, page, offset } = paging(query);
  const result = await listOrders({ status: query.status, warehouseId: query.warehouseId, limit, offset });
  return { data: result.rows, pagination: { page, limit, total: result.total, totalPages: Math.ceil(result.total / limit) } };
};

export const detail = async (orderId) => {
  if (!isUuid(orderId)) throw new AppError(400, 'orderId không hợp lệ');
  const result = await getOrder(orderId);
  if (!result) throw new AppError(404, 'Không tìm thấy tác vụ xử lý cho đơn hàng');
  return result;
};

export const confirm = async (orderId, input, userId) => {
  if (!isUuid(orderId)) throw new AppError(400, 'orderId không hợp lệ');
  try { return await confirmOrder({ orderId, userId, note: input.note }); }
  catch (error) {
    if (error.code === 'ORDER_NOT_FOUND') throw new AppError(404, 'Không tìm thấy đơn hàng online');
    if (error.code === 'ORDER_NOT_PENDING') throw new AppError(409, 'Đơn hàng không còn ở trạng thái pending');
    throw error;
  }
};

export const assign = async (orderId, input, actor) => {
  if (!isUuid(orderId) || !isUuid(input.assignedTo)) throw new AppError(400, 'orderId và assignedTo phải là UUID');
  const processor = await findProcessor(input.assignedTo);
  if (!processor || processor.status !== 'active') throw new AppError(400, 'assignedTo phải là processor đang hoạt động');
  try { return await assignOrder({ orderId, assignedTo: input.assignedTo, userId: actor.id, note: input.note }); }
  catch (error) {
    if (error.code === 'ORDER_NOT_FOUND') throw new AppError(404, 'Không tìm thấy đơn hàng online');
    if (error.code === 'ORDER_NOT_ASSIGNABLE') throw new AppError(409, 'Đơn hàng chưa xác nhận hoặc không thể phân công');
    throw error;
  }
};

export const update = async (orderId, input, actor) => {
  if (!isUuid(orderId)) throw new AppError(400, 'orderId không hợp lệ');
  if (!['picking', 'ready_to_pack'].includes(input.status)) throw new AppError(400, 'status phải là picking hoặc ready_to_pack');
  try { return await updateTask({ orderId, status: input.status, userId: actor.id, role: actor.role_code, note: input.note }); }
  catch (error) {
    if (error.code === 'TASK_NOT_FOUND') throw new AppError(404, 'Chưa có tác vụ xử lý cho đơn hàng');
    if (error.code === 'PROCESSOR_NOT_ASSIGNED') throw new AppError(403, 'Đơn hàng không được phân công cho bạn');
    if (error.code === 'INVALID_TRANSITION') throw new AppError(409, 'Chuyển trạng thái tác vụ không hợp lệ');
    throw error;
  }
};
