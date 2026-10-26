import { AppError } from '../utils/app-error.js';
import { cancelOnlineOrder } from '../models/order-cancellation.model.js';
import { assertUuid, assertText, assertDate, paging } from '../utils/validation.js';
import {
  adjustInventory,
  createProduct,
  createWarehouse,
  findCategory,
  getDashboardSummary,
  getInventoryReservations,
  getSalesReport,
  listInventory,
  listInventoryDiscrepancies,
  listInventoryTransactions,
  listOrders,
  listProducts,
  listWarehouses,
  updateProduct,
  updateWarehouse
} from '../models/manager.model.js';

const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
const today = () => new Date().toISOString().slice(0, 10);
const defaultPeriod = (from, to) => ({ from: validDate(from) ? from : `${new Date().getFullYear()}-01-01`, to: validDate(to) ? to : today() });
const pageParams = (params) => {
  const limit = Math.min(Math.max(Number(params.limit) || 20, 1), 100);
  const page = Math.max(Number(params.page) || 1, 1);
  return { limit, page, offset: (page - 1) * limit };
};
const resultWithPagination = (result, page, limit) => ({ data: result.rows, pagination: { page, limit, total: result.total, totalPages: Math.ceil(result.total / limit) } });

export const dashboard = async (query) => {
  const period = defaultPeriod(query.from, query.to);
  if (period.from > period.to) throw new AppError(400, 'from không được lớn hơn to');
  return getDashboardSummary(period);
};

export const products = async (query) => {
  const { limit, page, offset } = pageParams(query);
  const result = await listProducts({
    search: query.search?.trim(), categoryId: query.categoryId,
    isActive: query.isActive === undefined ? undefined : query.isActive === 'true', limit, offset
  });
  return resultWithPagination(result, page, limit);
};

const price = (value, field) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new AppError(400, `${field} phải là số không âm`);
  return number;
};

export const addProduct = async (input) => {
  if (!/^[A-Za-z0-9_-]{2,60}$/.test(String(input.sku || ''))) throw new AppError(400, 'sku không hợp lệ');
  if (!String(input.name || '').trim()) throw new AppError(400, 'name là bắt buộc');
  if (input.categoryId && (!isUuid(input.categoryId) || !(await findCategory(input.categoryId)))) throw new AppError(400, 'categoryId không tồn tại');
  const reorderLevel = Number(input.reorderLevel ?? 0);
  if (!Number.isInteger(reorderLevel) || reorderLevel < 0) throw new AppError(400, 'reorderLevel phải là số nguyên không âm');
  try {
    return await createProduct({ sku: input.sku, barcode: input.barcode?.trim(), name: input.name.trim(), description: input.description?.trim(), categoryId: input.categoryId, costPrice: price(input.costPrice ?? 0, 'costPrice'), salePrice: price(input.salePrice ?? 0, 'salePrice'), reorderLevel });
  } catch (error) {
    if (error.code === '23505') throw new AppError(409, 'sku hoặc barcode đã tồn tại');
    throw error;
  }
};

export const editProduct = async (productId, input) => {
  if (!isUuid(productId)) throw new AppError(400, 'productId không hợp lệ');
  if (input.categoryId && (!isUuid(input.categoryId) || !(await findCategory(input.categoryId)))) throw new AppError(400, 'categoryId không tồn tại');
  if (input.costPrice !== undefined) price(input.costPrice, 'costPrice');
  if (input.salePrice !== undefined) price(input.salePrice, 'salePrice');
  if (input.reorderLevel !== undefined && (!Number.isInteger(Number(input.reorderLevel)) || Number(input.reorderLevel) < 0)) throw new AppError(400, 'reorderLevel không hợp lệ');
  const product = await updateProduct(productId, { ...input, costPrice: input.costPrice === undefined ? undefined : price(input.costPrice, 'costPrice'), salePrice: input.salePrice === undefined ? undefined : price(input.salePrice, 'salePrice'), reorderLevel: input.reorderLevel === undefined ? undefined : Number(input.reorderLevel) });
  if (!product) throw new AppError(404, 'Không tìm thấy sản phẩm');
  return product;
};

export const warehouses = () => listWarehouses();
export const cancelOrder = (id, input, userId) => cancelOnlineOrder({ orderId: assertUuid(id, 'orderId'),
  userId, customerOnly: false, note: assertText(input.note, 'note', 255) });

export const addWarehouse = async (input) => {
  if (!/^[A-Za-z0-9_-]{2,30}$/.test(String(input.code || ''))) throw new AppError(400, 'code kho không hợp lệ');
  if (!String(input.name || '').trim()) throw new AppError(400, 'name là bắt buộc');
  try { return await createWarehouse({ code: input.code, name: input.name.trim(), address: input.address?.trim() }); }
  catch (error) { if (error.code === '23505') throw new AppError(409, 'code kho đã tồn tại'); throw error; }
};

export const editWarehouse = async (warehouseId, input) => {
  if (!isUuid(warehouseId)) throw new AppError(400, 'warehouseId không hợp lệ');
  const warehouse = await updateWarehouse(warehouseId, { name: input.name?.trim(), address: input.address?.trim(), isActive: input.isActive });
  if (!warehouse) throw new AppError(404, 'Không tìm thấy kho');
  return warehouse;
};

export const inventory = async (query) => {
  if (query.warehouseId && !isUuid(query.warehouseId)) throw new AppError(400, 'warehouseId không hợp lệ');
  if (query.productId && !isUuid(query.productId)) throw new AppError(400, 'productId không hợp lệ');
  const { limit, page, offset } = pageParams(query);
  const result = await listInventory({ warehouseId: query.warehouseId, productId: query.productId, lowStock: query.lowStock === 'true', limit, offset });
  return resultWithPagination(result, page, limit);
};

const optionalUuid = (value, field) => value === undefined ? undefined : assertUuid(value, field);
const optionalDate = (value, field) => value === undefined ? undefined : assertDate(value, field);

export const inventoryDiscrepancies = async (query) => {
  const { page, limit, offset } = paging(query);
  const result = await listInventoryDiscrepancies({
    warehouseId: optionalUuid(query.warehouseId, 'warehouseId'),
    productId: optionalUuid(query.productId, 'productId'),
    limit,
    offset
  });
  return resultWithPagination(result, page, limit);
};

export const inventoryTransactions = async (query) => {
  const from = optionalDate(query.from, 'from');
  const to = optionalDate(query.to, 'to');
  if (from && to && from > to) throw new AppError(400, 'from không được lớn hơn to');
  if (query.type !== undefined && !['receipt', 'issue', 'adjustment'].includes(query.type)) {
    throw new AppError(400, 'type phải là receipt, issue hoặc adjustment');
  }
  const { page, limit, offset } = paging(query);
  const result = await listInventoryTransactions({
    warehouseId: optionalUuid(query.warehouseId, 'warehouseId'),
    productId: optionalUuid(query.productId, 'productId'),
    type: query.type,
    from,
    to,
    referenceCode: query.referenceCode === undefined ? undefined : assertText(query.referenceCode, 'referenceCode', 80),
    limit,
    offset
  });
  return resultWithPagination(result, page, limit);
};

export const inventoryReservations = async (warehouseId, productId, query) => {
  const status = query.status;
  if (status !== undefined && !['active', 'consumed', 'released'].includes(status)) {
    throw new AppError(400, 'status reservation không hợp lệ');
  }
  const { page, limit, offset } = paging(query);
  const result = await getInventoryReservations({
    warehouseId: assertUuid(warehouseId, 'warehouseId'),
    productId: assertUuid(productId, 'productId'),
    status,
    limit,
    offset
  });
  if (!result) throw new AppError(404, 'Không tìm thấy tồn kho của sản phẩm tại kho');
  return {
    data: result.stock,
    reservations: result.reservations,
    pagination: { page, limit, total: result.total, totalPages: Math.ceil(result.total / limit) }
  };
};

export const adjustStock = async (input, userId) => {
  if (!isUuid(input.warehouseId) || !isUuid(input.productId)) throw new AppError(400, 'warehouseId và productId phải là UUID');
  if (!['receipt', 'issue', 'adjustment'].includes(input.type)) throw new AppError(400, 'type phải là receipt, issue hoặc adjustment');
  const quantity = Number(input.quantity);
  if (!Number.isInteger(quantity) || quantity === 0 || (input.type !== 'adjustment' && quantity < 0)
    || Math.abs(quantity) > 2147483647) {
    throw new AppError(400, 'quantity phải là số nguyên dương; adjustment cho phép số âm để giảm tồn');
  }
  try { return await adjustInventory({ ...input, quantity, userId }); }
  catch (error) { if (error.code === 'INVENTORY_INSUFFICIENT') throw new AppError(409, error.message); throw error; }
};

export const orders = async (query) => {
  const period = defaultPeriod(query.from, query.to);
  if (period.from > period.to) throw new AppError(400, 'from không được lớn hơn to');
  if (query.status && !['pending', 'confirmed', 'ready_to_pack', 'packed', 'handover', 'shipping', 'delivered', 'cancelled', 'returned'].includes(query.status)) throw new AppError(400, 'status không hợp lệ');
  if (query.channel && !['pos', 'web', 'mobile'].includes(query.channel)) throw new AppError(400, 'channel không hợp lệ');
  const { limit, page, offset } = pageParams(query);
  const result = await listOrders({ ...period, status: query.status, channel: query.channel, limit, offset });
  return resultWithPagination(result, page, limit);
};

export const salesReport = async (query) => {
  const period = defaultPeriod(query.from, query.to);
  if (period.from > period.to) throw new AppError(400, 'from không được lớn hơn to');
  return getSalesReport(period);
};
