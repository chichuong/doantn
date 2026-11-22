import { AppError } from '../utils/app-error.js';
import { assertInteger, paging } from '../utils/validation.js';
import {
  approveDocument,
  completeDocument,
  createDocument,
  findProductByIdentifier,
  getDocument,
  getDocumentByQr,
  listDocuments,
  listFulfillableOrders,
  packOrder,
  recordDocumentQrScan,
  rejectDocument
} from '../models/warehouse.model.js';
import { listInventory } from '../models/manager.model.js';
import { getCentralWarehouseId } from './central-warehouse.service.js';

const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
const pageParams = paging;
const pagination = (result, page, limit) => ({ data: result.rows, pagination: { page, limit, total: result.total, totalPages: Math.ceil(result.total / limit) } });

export const inventory = async (query, userWarehouseIds = []) => {
  let warehouseId = query.warehouseId || (Array.isArray(userWarehouseIds) && userWarehouseIds.length ? userWarehouseIds[0] : null);
  if (!warehouseId || !isUuid(warehouseId)) {
    warehouseId = await getCentralWarehouseId();
  }
  if (warehouseId && !isUuid(warehouseId)) throw new AppError(400, 'warehouseId không hợp lệ');
  if (query.productId && !isUuid(query.productId)) throw new AppError(400, 'productId không hợp lệ');
  const { limit, page, offset } = pageParams(query);
  const result = await listInventory({
    warehouseId,
    productId: query.productId,
    search: query.search?.trim(),
    lowStock: query.lowStock === 'true',
    limit,
    offset
  });
  return pagination(result, page, limit);
};

export const scan = async (identifier, warehouseId) => {
  if (!String(identifier || '').trim()) throw new AppError(400, 'identifier là bắt buộc');
  let whId = warehouseId;
  if (!whId || !isUuid(whId)) {
    whId = await getCentralWarehouseId();
  }
  if (!isUuid(whId)) throw new AppError(400, 'warehouseId không hợp lệ');
  const product = await findProductByIdentifier(String(identifier).trim(), whId);
  if (!product) throw new AppError(404, 'Không tìm thấy sản phẩm theo SKU hoặc barcode');
  return product;
};

const validateItems = (items) => {
  if (!Array.isArray(items) || items.length === 0) throw new AppError(400, 'items phải là mảng không rỗng');
  const ids = new Set();
  return items.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new AppError(400, 'Mỗi item phải là object');
    if (!isUuid(item.productId)) throw new AppError(400, 'productId không hợp lệ');
    const productId = item.productId.toLowerCase();
    if (ids.has(productId)) throw new AppError(400, 'Không được lặp productId trong cùng chứng từ');
    ids.add(productId);
    const quantity = assertInteger(item.quantity, 'quantity', 1);
    const unitCost = Number(item.unitCost ?? 0);
    if (!Number.isInteger(quantity) || quantity <= 0) throw new AppError(400, 'quantity phải là số nguyên dương');
    if (!Number.isFinite(unitCost) || unitCost < 0) throw new AppError(400, 'unitCost phải là số không âm');
    return { productId, quantity, unitCost };
  });
};

export const createWarehouseDocument = async (input, userId, userWarehouseIds = []) => {
  let docNumber = input.documentNumber ? String(input.documentNumber).trim() : null;
  if (!docNumber) {
    const prefix = input.type === 'receipt' ? 'NK' : 'XK';
    docNumber = `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
  }
  if (!/^[A-Za-z0-9_-]{3,50}$/.test(docNumber)) throw new AppError(400, 'documentNumber không hợp lệ (3-50 ký tự A-Z, 0-9, _, -)');
  let warehouseId = input.warehouseId || (Array.isArray(userWarehouseIds) && userWarehouseIds.length ? userWarehouseIds[0] : null);
  if (!warehouseId || !isUuid(warehouseId)) {
    warehouseId = await getCentralWarehouseId();
  }
  if (!isUuid(warehouseId)) throw new AppError(400, 'Không xác định được kho trung tâm');
  if (!['receipt', 'issue'].includes(input.type)) throw new AppError(400, 'type phải là receipt hoặc issue');
  const items = validateItems(input.items);
  try {
    return await createDocument({ ...input, warehouseId, documentNumber: docNumber, items, createdBy: userId });
  } catch (error) {
    if (error.code === '23505') throw new AppError(409, 'documentNumber hoặc productId trong chứng từ đã tồn tại');
    if (error.code === '23503') throw new AppError(400, 'warehouseId hoặc productId không tồn tại');
    throw error;
  }
};

export const documents = async (query) => {
  if (query.warehouseId && !isUuid(query.warehouseId)) throw new AppError(400, 'warehouseId không hợp lệ');
  if (query.type && !['receipt', 'issue'].includes(query.type)) throw new AppError(400, 'type không hợp lệ');
  if (query.status && !['draft', 'pending', 'approved', 'rejected', 'completed', 'cancelled'].includes(query.status)) {
    throw new AppError(400, 'status không hợp lệ');
  }
  const { limit, page, offset } = pageParams(query);
  const result = await listDocuments({
    warehouseId: query.warehouseId,
    type: query.type,
    status: query.status,
    search: query.search,
    limit,
    offset
  });
  return pagination(result, page, limit);
};

export const documentDetail = async (documentId) => {
  if (!isUuid(documentId)) throw new AppError(400, 'documentId không hợp lệ');
  const document = await getDocument(documentId);
  if (!document) throw new AppError(404, 'Không tìm thấy chứng từ kho');
  return document;
};

export const approve = async (documentId, userId, userRole) => {
  if (!isUuid(documentId)) throw new AppError(400, 'documentId không hợp lệ');
  return await approveDocument(documentId, userId, userRole);
};

export const reject = async (documentId, userId, reason) => {
  if (!isUuid(documentId)) throw new AppError(400, 'documentId không hợp lệ');
  return await rejectDocument(documentId, userId, reason);
};

export const lookupByQr = async (identifier) => {
  return await getDocumentByQr(identifier);
};

export const recordQrScan = async (documentId, userId, source) => {
  return await recordDocumentQrScan(documentId, userId, source);
};

export const complete = async (documentId, userId, body = {}) => {
  if (!isUuid(documentId)) throw new AppError(400, 'documentId không hợp lệ');
  const actualItems = body?.items || body?.actualItems || null;
  try {
    return await completeDocument(documentId, userId, actualItems);
  } catch (error) {
    if (error.code === 'DOCUMENT_NOT_FOUND') throw new AppError(404, 'Không tìm thấy chứng từ kho');
    if (error.code === 'DOCUMENT_NOT_DRAFT') throw new AppError(409, 'Chỉ chứng từ đã phê duyệt mới được hoàn tất');
    if (error.code === 'DOCUMENT_EMPTY') throw new AppError(400, 'Chứng từ không có sản phẩm');
    if (error.code === 'INSUFFICIENT_STOCK') throw new AppError(409, 'Tồn kho khả dụng không đủ để xuất kho');
    throw error;
  }
};

export const orders = async (query) => {
  let warehouseId = query.warehouseId;
  if (!warehouseId || !isUuid(warehouseId)) {
    warehouseId = await getCentralWarehouseId();
  }
  if (warehouseId && !isUuid(warehouseId)) throw new AppError(400, 'warehouseId không hợp lệ');
  if (query.status && query.status !== 'ready_to_pack') throw new AppError(400, 'status phải là ready_to_pack');
  const { limit, page, offset } = pageParams(query);
  const result = await listFulfillableOrders({ status: query.status, warehouseId, limit, offset });
  return pagination(result, page, limit);
};

export const pack = async (orderId, warehouseId, userId, role) => {
  let whId = warehouseId;
  if (!whId || !isUuid(whId)) {
    whId = await getCentralWarehouseId();
  }
  if (!isUuid(orderId) || !isUuid(whId)) throw new AppError(400, 'orderId và warehouseId phải là UUID');
  try {
    return await packOrder({ orderId, warehouseId: whId.toLowerCase(), userId, role });
  } catch (error) {
    if (error.code === 'ORDER_NOT_FOUND') throw new AppError(404, 'Không tìm thấy đơn hàng');
    if (error.code === 'ORDER_NOT_FULFILLABLE') throw new AppError(409, 'Đơn hàng không ở trạng thái có thể đóng gói');
    if (error.code === 'INSUFFICIENT_STOCK') throw new AppError(409, 'Tồn kho khả dụng không đủ để đóng gói đơn hàng');
    throw error;
  }
};
