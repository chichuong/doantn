import { AppError } from '../utils/app-error.js';
import {
  createShipment,
  findOrderForShipment,
  findShipper,
  findShipmentByTracking,
  getShipment,
  listShipments,
  updateShipmentStatus
} from '../models/shipping.model.js';

const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
const pageParams = (query) => {
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
  const page = Math.max(Number(query.page) || 1, 1);
  return { limit, page, offset: (page - 1) * limit };
};

export const scan = async (identifier, actor) => {
  if (typeof identifier !== 'string' || !/^[A-Za-z0-9_-]{4,60}$/.test(identifier)) throw new AppError(400, 'Mã vận đơn không hợp lệ');
  const id = await findShipmentByTracking(identifier, actor.id, actor.role_code);
  if (!id) throw new AppError(404, 'Không tìm thấy vận đơn được phép truy cập');
  return detail(id, actor);
};

export const create = async (input, actor) => {
  if (!isUuid(input.orderId) || !isUuid(input.assignedTo)) throw new AppError(400, 'orderId và assignedTo phải là UUID');
  if (!/^[A-Za-z0-9_-]{4,60}$/.test(String(input.trackingNumber || ''))) throw new AppError(400, 'trackingNumber không hợp lệ');
  const shipper = await findShipper(input.assignedTo);
  if (!shipper || shipper.status !== 'active') throw new AppError(400, 'assignedTo phải là shipper đang hoạt động');
  const order = await findOrderForShipment(input.orderId);
  if (!order) throw new AppError(404, 'Không tìm thấy đơn hàng');
  try {
    return await createShipment({ ...input, createdBy: actor.id });
  } catch (error) {
    if (error.code === 'ORDER_NOT_FOUND') throw new AppError(404, 'Không tìm thấy đơn hàng');
    if (error.code === 'ORDER_NOT_PACKED') throw new AppError(409, 'Đơn hàng phải ở trạng thái packed trước khi tạo vận đơn');
    if (error.code === '23505') throw new AppError(409, 'Đơn hàng hoặc trackingNumber đã có vận đơn');
    throw error;
  }
};

export const list = async (query, actor) => {
  if (query.status && !['assigned', 'picked_up', 'in_transit', 'delivered', 'failed', 'returned'].includes(query.status)) throw new AppError(400, 'status không hợp lệ');
  const { limit, page, offset } = pageParams(query);
  const result = await listShipments({ userId: actor.id, role: actor.role_code, status: query.status, limit, offset });
  return { data: result.rows, pagination: { page, limit, total: result.total, totalPages: Math.ceil(result.total / limit) } };
};

export const detail = async (shipmentId, actor) => {
  if (!isUuid(shipmentId)) throw new AppError(400, 'shipmentId không hợp lệ');
  const shipment = await getShipment(shipmentId);
  if (!shipment) throw new AppError(404, 'Không tìm thấy vận đơn');
  if (actor.role_code === 'shipper' && shipment.assigned_to !== actor.id) throw new AppError(403, 'Vận đơn không được phân công cho bạn');
  return shipment;
};

export const updateStatus = async (shipmentId, input, actor) => {
  if (!isUuid(shipmentId)) throw new AppError(400, 'shipmentId không hợp lệ');
  if (!['picked_up', 'in_transit', 'delivered', 'failed', 'returned'].includes(input.status)) throw new AppError(400, 'status cập nhật không hợp lệ');
  try {
    return await updateShipmentStatus({ shipmentId, status: input.status, note: input.note, userId: actor.id, role: actor.role_code });
  } catch (error) {
    if (error.code === 'SHIPMENT_NOT_FOUND') throw new AppError(404, 'Không tìm thấy vận đơn');
    if (error.code === 'SHIPPER_NOT_ASSIGNED') throw new AppError(403, 'Vận đơn không được phân công cho bạn');
    if (error.code === 'INVALID_TRANSITION') throw new AppError(409, 'Chuyển trạng thái vận đơn không hợp lệ');
    throw error;
  }
};
