import { AppError } from '../utils/app-error.js';
import { assertDate, assertUuid } from '../utils/validation.js';
import { importCategories, findCategoryNames, exportCategories, exportSales } from '../models/data-exchange-extra.model.js';
import { assertHeaders, parseSpreadsheet, rowsToSheet } from '../utils/spreadsheet.js';
import {
  createJob,
  exportInventory,
  exportOrders,
  exportProducts,
  findCategoriesByNames,
  findExistingProductKeys,
  findProductsForInventory,
  failJob,
  getJob,
  importInventory,
  importProducts,
  listJobs
} from '../models/data-exchange.model.js';

const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
const money = (value) => /^\d+(\.\d{1,2})?$/.test(String(value)) && Number(value) < 1e12;
const integer = (value) => /^\d+$/.test(String(value)) && Number(value) <= 2147483647;
const bool = (value) => ['', 'true', 'false', '1', '0', 'yes', 'no'].includes(String(value).toLowerCase());
const errorsFor = (rows) => rows.map((error) => `Dòng ${error.rowNumber}: ${error.message}`);

const validateProductRows = async (rows) => {
  const errors = [];
  const skuSet = new Set();
  const barcodeSet = new Set();
  for (const row of rows) {
    if (!row.sku) errors.push({ rowNumber: row.rowNumber, message: 'SKU không được để trống' });
    if (row.sku && !/^[A-Za-z0-9_-]{2,60}$/.test(row.sku)) errors.push({ rowNumber: row.rowNumber, message: 'SKU phải dài 2–60 ký tự chữ/số/_/-' });
    if (!row.name) errors.push({ rowNumber: row.rowNumber, message: 'Tên sản phẩm không được để trống' });
    if (row.name?.length > 180 || row.barcode?.length > 100) errors.push({ rowNumber: row.rowNumber, message: 'Tên tối đa 180 ký tự, barcode tối đa 100 ký tự' });
    if (row.sku && skuSet.has(row.sku)) errors.push({ rowNumber: row.rowNumber, message: `SKU ${row.sku} bị trùng trong file` });
    if (row.barcode && barcodeSet.has(row.barcode)) errors.push({ rowNumber: row.rowNumber, message: `Barcode ${row.barcode} bị trùng trong file` });
    if (row.sku) skuSet.add(row.sku);
    if (row.barcode) barcodeSet.add(row.barcode);
    if (!row.category) errors.push({ rowNumber: row.rowNumber, message: 'Category không được để trống' });
    if (!money(row.cost_price)) errors.push({ rowNumber: row.rowNumber, message: 'Giá vốn không hợp lệ' });
    if (!money(row.sale_price)) errors.push({ rowNumber: row.rowNumber, message: 'Giá bán không hợp lệ' });
    if (!integer(row.reorder_level)) errors.push({ rowNumber: row.rowNumber, message: 'reorder_level phải là số nguyên không âm' });
    if (row.is_active !== undefined && !bool(row.is_active)) errors.push({ rowNumber: row.rowNumber, message: 'is_active phải là true/false hoặc 1/0' });
  }
  const existing = await findExistingProductKeys([...skuSet], [...barcodeSet]);
  const existingSku = new Set(existing.map((row) => row.sku));
  const existingBarcode = new Set(existing.filter((row) => row.barcode).map((row) => row.barcode));
  rows.forEach((row) => {
    if (existingSku.has(row.sku)) errors.push({ rowNumber: row.rowNumber, message: `SKU ${row.sku} đã tồn tại` });
    if (row.barcode && existingBarcode.has(row.barcode)) errors.push({ rowNumber: row.rowNumber, message: `Barcode ${row.barcode} đã tồn tại` });
  });
  const categories = await findCategoriesByNames([...new Set(rows.map((row) => String(row.category || '').toLowerCase()))]);
  const categoryNames = new Set(categories.map((row) => row.name.toLowerCase()));
  rows.forEach((row) => {
    if (row.category && !categoryNames.has(row.category.toLowerCase())) errors.push({ rowNumber: row.rowNumber, message: `Category ${row.category} không tồn tại` });
  });
  return errors;
};

const validateCategoryRows = async (rows) => {
  const errors = [];
  const seen = new Set();
  const existing = new Set((await findCategoryNames(rows.map(row => row.name.toLowerCase()))).map(row => row.name.trim().toLowerCase()));
  for (const row of rows) {
    const key = row.name.toLowerCase();
    if (!row.name || row.name.length > 120) errors.push({ rowNumber: row.rowNumber, message: 'Tên danh mục phải dài 1–120 ký tự' });
    if (row.description?.length > 255) errors.push({ rowNumber: row.rowNumber, message: 'Mô tả tối đa 255 ký tự' });
    if (seen.has(key) || existing.has(key)) errors.push({ rowNumber: row.rowNumber, message: 'Tên danh mục trùng trong file hoặc đã tồn tại' });
    if (row.is_active !== undefined && !bool(row.is_active)) errors.push({ rowNumber: row.rowNumber, message: 'is_active không hợp lệ' });
    seen.add(key);
  }
  return errors;
};

const validateInventoryRows = async (rows, warehouseId) => {
  const errors = [];
  if (!isUuid(warehouseId)) errors.push({ rowNumber: 0, message: 'warehouseId không hợp lệ' });
  const skuSet = new Set();
  rows.forEach((row) => {
    if (!row.sku) errors.push({ rowNumber: row.rowNumber, message: 'SKU không được để trống' });
    if (!integer(row.quantity)) errors.push({ rowNumber: row.rowNumber, message: 'Số lượng phải là số nguyên >= 0' });
    if (skuSet.has(row.sku)) errors.push({ rowNumber: row.rowNumber, message: `SKU ${row.sku} bị trùng trong file` });
    skuSet.add(row.sku);
  });
  if (errors.length) return errors;
  const products = await findProductsForInventory([...skuSet]);
  const productMap = new Map(products.map((row) => [row.sku, row.id]));
  rows.forEach((row) => {
    if (!productMap.has(row.sku)) errors.push({ rowNumber: row.rowNumber, message: `SKU ${row.sku} không tồn tại hoặc không hoạt động` });
    else row.productId = productMap.get(row.sku);
  });
  return errors;
};

export const importFile = async ({ file, dataType, warehouseId, userId }) => {
  if (!file) throw new AppError(400, 'Vui lòng gửi file bằng form-data key file');
  if (!['categories', 'products', 'inventory'].includes(dataType)) throw new AppError(400, 'dataType phải là categories, products hoặc inventory');
  let parsed;
  try { parsed = await parseSpreadsheet(file); }
  catch (error) { throw new AppError(400, `Không đọc được file: ${error.message}`); }
  const required = dataType === 'products'
    ? ['sku', 'barcode', 'name', 'category', 'cost_price', 'sale_price', 'reorder_level']
    : dataType === 'categories' ? ['name'] : ['sku', 'quantity'];
  const headerErrors = assertHeaders(parsed.headers, required, dataType === 'inventory' ? [] : ['description', 'is_active']);
  const errors = headerErrors.map((message) => ({ rowNumber: 1, message }));
  if (!parsed.rows.length) errors.push({ rowNumber: 0, message: 'File không có dòng dữ liệu' });
  if (!headerErrors.length && parsed.rows.length) errors.push(...(dataType === 'products' ? await validateProductRows(parsed.rows)
    : dataType === 'categories' ? await validateCategoryRows(parsed.rows) : await validateInventoryRows(parsed.rows, warehouseId)));
  const job = await createJob({ operation: 'import', dataType, fileName: file.originalname, fileFormat: parsed.extension, userId,
    status: errors.length ? 'failed' : 'processing', totalRows: parsed.rows.length, successRows: 0,
    errorRows: new Set(errors.filter(e => e.rowNumber > 1).map(e => e.rowNumber)).size, errors: errorsFor(errors), errorDetails: errors });
  if (errors.length) return { job, errors: errorsFor(errors), errorDetails: errors };
  try {
    if (dataType === 'products') {
      await importProducts({ rows: parsed.rows.map((row) => ({ ...row, costPrice: row.cost_price, salePrice: row.sale_price, reorderLevel: Number(row.reorder_level), isActive: row.is_active === undefined || ['true', '1', 'yes', ''].includes(row.is_active.toLowerCase()) })), job });
    } else if (dataType === 'categories') {
      await importCategories({ rows: parsed.rows.map(row => ({ ...row,
        isActive: row.is_active === undefined || ['true', '1', 'yes', ''].includes(row.is_active.toLowerCase()) })), job });
    } else {
      await importInventory({ rows: parsed.rows.map((row) => ({ ...row, quantity: Number(row.quantity) })), warehouseId, job, userId });
    }
    return { job: await getJob(job.id), errors: [], errorDetails: [] };
  } catch (error) {
    const detail = { rowNumber: error.rowNumber || 0, code: error.code || 'IMPORT_FAILED',
      message: error.code === '23505' ? 'Dữ liệu bị trùng khi ghi vào DB' : error.message };
    const failed = await failJob(job.id, errorsFor([detail]), parsed.rows.length, [detail]);
    return { job: await getJob(failed.id), errors: failed.errors, errorDetails: [detail] };
  }
};

export const exportFile = async ({ dataType, format, query, userId }) => {
  if (!['categories', 'products', 'inventory', 'orders', 'sales'].includes(dataType)) throw new AppError(400, 'dataType không hợp lệ');
  if (!['xlsx', 'csv'].includes(format)) throw new AppError(400, 'format phải là xlsx hoặc csv');
  let rows;
  if (query.categoryId) assertUuid(query.categoryId, 'categoryId');
  if (query.isActive !== undefined && !['true', 'false'].includes(query.isActive)) throw new AppError(400, 'isActive không hợp lệ');
  if (dataType === 'categories') rows = await exportCategories();
  if (dataType === 'products') rows = await exportProducts({ categoryId: query.categoryId, isActive: query.isActive === undefined ? undefined : query.isActive === 'true' });
  if (dataType === 'inventory') {
    if (!isUuid(query.warehouseId)) throw new AppError(400, 'warehouseId là bắt buộc và phải là UUID');
    rows = await exportInventory(query.warehouseId);
  }
  if (['orders', 'sales'].includes(dataType)) {
    assertDate(query.from, 'from'); assertDate(query.to, 'to');
    if (query.from > query.to) throw new AppError(400, 'from không được lớn hơn to');
    if (query.status && !['pending','confirmed','ready_to_pack','packed','handover','shipping','delivered','cancelled','returned'].includes(query.status)) throw new AppError(400, 'status không hợp lệ');
    rows = dataType === 'sales' ? await exportSales({ from: query.from, to: query.to })
      : await exportOrders({ from: query.from, to: query.to, status: query.status });
  }
  const buffer = await rowsToSheet(rows, format);
  await createJob({ operation: 'export', dataType, fileName: `${dataType}.${format}`, fileFormat: format,
    userId, status: 'completed', totalRows: rows.length, successRows: rows.length });
  return { buffer, filename: `${dataType}-${new Date().toISOString().slice(0, 10)}.${format}`, count: rows.length };
};

export const jobs = async (query, userId) => {
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
  const page = Math.max(Number(query.page) || 1, 1);
  const result = await listJobs({ userId, limit, offset: (page - 1) * limit });
  return { data: result.rows, pagination: { page, limit, total: result.total, totalPages: Math.ceil(result.total / limit) } };
};
