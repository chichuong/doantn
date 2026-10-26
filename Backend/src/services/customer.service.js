import { AppError } from '../utils/app-error.js';
import { randomUUID } from 'node:crypto';
import { validateIdempotencyKey } from '../utils/idempotency.js';
import { assertInteger, assertText, assertUuid, paging } from '../utils/validation.js';
import {
  cancelOrder,
  checkout,
  createAddress,
  updateAddress,
  deleteAddress,
  getCart,
  getOrder,
  listAddresses,
  listCatalog,
  listOrders,
  removeCartItem,
  upsertCartItem
} from '../models/customer.model.js';

const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
const pageParams = paging;
const pagination = (result, page, limit) => ({ data: result.rows, pagination: { page, limit, total: result.total, totalPages: Math.ceil(result.total / limit) } });

export const catalog = async (query) => {
  if (query.categoryId && !isUuid(query.categoryId)) throw new AppError(400, 'categoryId không hợp lệ');
  if (query.search !== undefined && typeof query.search !== 'string') throw new AppError(400, 'search phải là chuỗi');
  const { limit, page, offset } = pageParams(query);
  const result = await listCatalog({ search: query.search?.trim(), categoryId: query.categoryId, limit, offset });
  return pagination(result, page, limit);
};

export const cart = (userId) => getCart(userId);

export const addCartItem = async (userId, input) => {
  if (!isUuid(input.productId)) throw new AppError(400, 'productId không hợp lệ');
  const quantity = assertInteger(input.quantity, 'quantity', 1);
  try { return await upsertCartItem(userId, input.productId, quantity); }
  catch (error) { if (error.code === 'PRODUCT_NOT_FOUND') throw new AppError(404, 'Không tìm thấy sản phẩm hoạt động'); throw error; }
};

export const deleteCartItem = async (userId, productId) => {
  if (!isUuid(productId)) throw new AppError(400, 'productId không hợp lệ');
  const removed = await removeCartItem(userId, productId);
  if (!removed) throw new AppError(404, 'Sản phẩm không có trong giỏ hàng');
  return { productId, removed: true };
};

const validateAddress = (input, partial = false) => {
  const result = {};
  for (const [field, max] of [['recipientName',150], ['phone',30], ['addressLine',255], ['province',100]]) {
    if (!partial || input[field] !== undefined) result[field] = assertText(input[field], field, max);
  }
  for (const field of ['ward','district']) {
    if (input[field] !== undefined) result[field] = input[field] === null ? null : assertText(input[field], field, 100);
  }
  if (input.isDefault !== undefined) {
    if (typeof input.isDefault !== 'boolean') throw new AppError(400, 'isDefault phải là boolean');
    result.isDefault = input.isDefault;
  }
  if (partial && !Object.keys(result).length) throw new AppError(400, 'Không có trường địa chỉ cần cập nhật');
  return result;
};

export const addresses = (userId) => listAddresses(userId);
export const addAddress = async (userId, input) => createAddress(userId, { ...validateAddress(input), isDefault: input.isDefault === true });
export const editAddress = async (userId, id, input) => {
  const address = await updateAddress(userId, assertUuid(id, 'addressId'), validateAddress(input, true));
  if (!address) throw new AppError(404, 'Không tìm thấy địa chỉ của bạn');
  return address;
};
export const removeAddress = async (userId, id) => {
  const addressId = assertUuid(id, 'addressId');
  if (!(await deleteAddress(userId, addressId))) throw new AppError(404, 'Không tìm thấy địa chỉ của bạn');
  return { addressId, removed: true };
};

export const createOrder = async (userId, input, key) => {
  if (!isUuid(input.warehouseId)) throw new AppError(400, 'warehouseId không hợp lệ');
  if (input.addressId && !isUuid(input.addressId)) throw new AppError(400, 'addressId không hợp lệ');
  if (input.channel && !['web', 'mobile'].includes(input.channel)) throw new AppError(400, 'channel phải là web hoặc mobile');
  for (const [field, max] of [['customerName',150],['customerPhone',30],['note',255]]) {
    if (input[field] !== undefined) assertText(input[field], field, max);
  }
  try {
    const id = await checkout({ ...input, channel: input.channel || 'web', orderNumber: `ONL-${randomUUID()}`,
      userId, idempotencyKey: validateIdempotencyKey(key) });
    return getOrder(userId, id);
  } catch (error) {
    if (error.code === 'CART_EMPTY') throw new AppError(400, 'Giỏ hàng đang rỗng');
    if (error.code === 'WAREHOUSE_NOT_ACTIVE') throw new AppError(400, 'Kho không tồn tại hoặc đã ngừng hoạt động');
    if (error.code === 'PRODUCT_NOT_ACTIVE') throw new AppError(409, 'Giỏ hàng có sản phẩm đã ngừng bán');
    if (error.code === 'INSUFFICIENT_STOCK') throw new AppError(409, `Tồn kho không đủ cho sản phẩm ${error.productName || ''}`.trim());
    if (error.code === 'ADDRESS_NOT_FOUND') throw new AppError(400, 'addressId không thuộc tài khoản khách hàng');
    if (error.code === '23503') throw new AppError(400, 'warehouseId không tồn tại');
    throw error;
  }
};

export const orders = async (userId, query) => {
  if (query.status && !['pending', 'confirmed', 'ready_to_pack', 'packed', 'handover', 'shipping', 'delivered', 'cancelled', 'returned'].includes(query.status)) throw new AppError(400, 'status không hợp lệ');
  const { limit, page, offset } = pageParams(query);
  return pagination(await listOrders(userId, { status: query.status, limit, offset }), page, limit);
};

export const orderDetail = async (userId, orderId) => {
  if (!isUuid(orderId)) throw new AppError(400, 'orderId không hợp lệ');
  const order = await getOrder(userId, orderId);
  if (!order) throw new AppError(404, 'Không tìm thấy đơn hàng của khách hàng');
  return order;
};

export const cancel = async (userId, orderId, note) => {
  if (!isUuid(orderId)) throw new AppError(400, 'orderId không hợp lệ');
  if (note !== undefined) assertText(note, 'note', 255);
  try { await cancelOrder(userId, orderId, note); return await getOrder(userId, orderId); }
  catch (error) {
    if (error.code === 'ORDER_NOT_FOUND') throw new AppError(404, 'Không tìm thấy đơn hàng của khách hàng');
    if (error.code === 'ORDER_NOT_CANCELLABLE') throw new AppError(409, 'Đơn hàng không còn ở trạng thái có thể hủy');
    if (error.code === 'RESERVATION_NOT_FOUND') throw new AppError(409, 'Không tìm thấy lượng tồn đã giữ cho đơn hàng');
    throw error;
  }
};
