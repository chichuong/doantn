import { AppError } from '../utils/app-error.js';
import { randomUUID } from 'node:crypto';
import { validateIdempotencyKey } from '../utils/idempotency.js';
import { assertInteger, assertText, paging, assertDate } from '../utils/validation.js';
import {
  closeSession,
  createSale,
  findSaleProduct,
  getCurrentSession,
  getSale,
  listSales,
  openSession,
  voidSale
} from '../models/pos.model.js';

const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
const pageParams = paging;
const datePeriod = (from, to) => {
  const today = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const start = from === undefined ? today : assertDate(from, 'from');
  const end = to === undefined ? today : assertDate(to, 'to');
  if (start > end) throw new AppError(400, 'from không được lớn hơn to');
  return { from: start, to: end };
};

export const currentSession = (userId) => getCurrentSession(userId);

export const open = async (input, userId) => {
  if (!isUuid(input.warehouseId)) throw new AppError(400, 'warehouseId không hợp lệ');
  const openingCash = Number(input.openingCash ?? 0);
  if (!Number.isFinite(openingCash) || openingCash < 0) throw new AppError(400, 'openingCash phải là số không âm');
  try { return await openSession({ warehouseId: input.warehouseId, userId, openingCash }); }
  catch (error) {
    if (error.code === '23505') throw new AppError(409, 'Nhân viên đang có một ca POS mở');
    if (error.code === '23503') throw new AppError(400, 'warehouseId không tồn tại');
    throw error;
  }
};

export const close = async (sessionId, input, userId) => {
  if (!isUuid(sessionId)) throw new AppError(400, 'sessionId không hợp lệ');
  const closingCash = Number(input.closingCash);
  if (!Number.isFinite(closingCash) || closingCash < 0) throw new AppError(400, 'closingCash phải là số không âm');
  try { return await closeSession({ sessionId, userId, closingCash }); }
  catch (error) {
    if (error.code === 'SESSION_NOT_FOUND') throw new AppError(404, 'Không tìm thấy ca POS');
    if (error.code === 'SESSION_OWNER_REQUIRED') throw new AppError(403, 'Chỉ người mở ca mới được đóng ca');
    if (error.code === 'SESSION_NOT_OPEN') throw new AppError(409, 'Ca POS đã đóng');
    throw error;
  }
};

export const lookupProduct = async (identifier, warehouseId) => {
  if (!isUuid(warehouseId)) throw new AppError(400, 'warehouseId không hợp lệ');
  if (!String(identifier || '').trim()) throw new AppError(400, 'identifier là bắt buộc');
  const product = await findSaleProduct(identifier.trim(), warehouseId);
  if (!product) throw new AppError(404, 'Không tìm thấy sản phẩm hoặc sản phẩm không có tồn tại kho');
  return product;
};

const validateItems = (items) => {
  if (!Array.isArray(items) || items.length === 0) throw new AppError(400, 'items phải là mảng không rỗng');
  const ids = new Set();
  return items.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new AppError(400, 'Mỗi item phải là object');
    if (!isUuid(item.productId)) throw new AppError(400, 'productId không hợp lệ');
    const productId = item.productId.toLowerCase();
    if (ids.has(productId)) throw new AppError(400, 'Không được lặp productId trong đơn');
    ids.add(productId);
    return { productId, quantity: assertInteger(item.quantity, 'quantity', 1) };
  });
};

export const create = async (input, userId, key) => {
  if (!isUuid(input.sessionId)) throw new AppError(400, 'sessionId không hợp lệ');
  if (!['cash', 'card', 'transfer'].includes(input.paymentMethod)) throw new AppError(400, 'paymentMethod không hợp lệ');
  for (const [field, max] of [['customerName',150],['customerPhone',30],['transactionReference',100]]) {
    if (input[field] !== undefined) assertText(input[field], field, max);
  }
  const items = validateItems(input.items);
  const orderNumber = `POS-${randomUUID()}`;
  try {
    const id = await createSale({ ...input, items, orderNumber, userId, idempotencyKey: validateIdempotencyKey(key) });
    return await getSale(id, userId);
  } catch (error) {
    if (error.code === 'SESSION_NOT_FOUND') throw new AppError(404, 'Không tìm thấy ca POS của nhân viên');
    if (error.code === 'SESSION_NOT_OPEN') throw new AppError(409, 'Ca POS chưa mở hoặc đã đóng');
    if (error.code === 'PRODUCT_NOT_AVAILABLE') throw new AppError(409, 'Sản phẩm không hoạt động hoặc không có tồn kho');
    if (error.code === 'INSUFFICIENT_STOCK') throw new AppError(409, 'Tồn kho khả dụng không đủ');
    throw error;
  }
};

export const sales = async (query, userId) => {
  const { from, to } = datePeriod(query.from, query.to);
  if (query.status && !['delivered', 'returned'].includes(query.status)) throw new AppError(400, 'status không hợp lệ');
  const { limit, page, offset } = pageParams(query);
  const result = await listSales({ userId, status: query.status, from, to, limit, offset });
  return { data: result.rows, pagination: { page, limit, total: result.total, totalPages: Math.ceil(result.total / limit) } };
};

export const saleDetail = async (saleId, userId) => {
  if (!isUuid(saleId)) throw new AppError(400, 'saleId không hợp lệ');
  const sale = await getSale(saleId, userId);
  if (!sale) throw new AppError(404, 'Không tìm thấy giao dịch POS');
  return sale;
};

export const voidSaleById = async (saleId, input, userId) => {
  if (!isUuid(saleId)) throw new AppError(400, 'saleId không hợp lệ');
  const reason = assertText(input.reason, 'reason', 255);
  const refundReference = input.refundReference === undefined ? undefined : assertText(input.refundReference, 'refundReference', 100);
  if (input.refundConfirmed !== undefined && typeof input.refundConfirmed !== 'boolean') throw new AppError(400, 'refundConfirmed phải là boolean');
  try { return await voidSale({ saleId, userId, reason, refundReference, refundConfirmed: input.refundConfirmed }); }
  catch (error) {
    if (error.code === 'SALE_NOT_FOUND') throw new AppError(404, 'Không tìm thấy giao dịch POS');
    if (error.code === 'SALE_NOT_COMPLETED') throw new AppError(409, 'Chỉ giao dịch POS đã hoàn tất mới được hoàn');
    if (error.code === 'SESSION_NOT_FOUND') throw new AppError(409, 'Không tìm thấy kho của nhân viên POS');
    throw error;
  }
};
