import axiosClient from './axiosClient';

/**
 * API client cho chức năng nhập / xuất dữ liệu Excel‑CSV (data-exchange)
 * Khớp với backend: POST /api/v1/data-exchange/import/:dataType
 *                   GET  /api/v1/data-exchange/export/:dataType
 *                   GET  /api/v1/data-exchange/jobs
 */

/**
 * Nhập file (import) – gửi multipart/form-data
 * @param {string} dataType  'products' | 'categories' | 'inventory'
 * @param {File}   file      File Excel / CSV được người dùng chọn
 * @param {string} [warehouseId]  Bắt buộc khi dataType === 'inventory'
 */
export const importFile = async (dataType, file, warehouseId) => {
  const formData = new FormData();
  formData.append('file', file);
  if (warehouseId) formData.append('warehouseId', warehouseId);

  // axiosClient có interceptor tự gắn token; Content-Type sẽ tự thành multipart/form-data khi truyền FormData
  const response = await axiosClient.post(`/data-exchange/import/${dataType}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000, // file lớn cần timeout dài hơn
  });
  return response; // { job, errors, errorDetails }
};

/**
 * Xuất file (export) – trả về Blob để trình duyệt tải xuống
 * @param {string} dataType  'products' | 'categories' | 'inventory' | 'orders' | 'sales'
 * @param {object} params    Query params: format, warehouseId, categoryId, isActive, from, to, status
 */
export const exportFile = async (dataType, params = {}) => {
  const response = await axiosClient.get(`/data-exchange/export/${dataType}`, {
    params: { format: 'xlsx', ...params },
    responseType: 'blob',
    timeout: 60000,
  });
  return response; // Blob
};

/**
 * Lấy danh sách jobs import/export
 * @param {object} params  { page, limit }
 */
export const listJobs = async (params = {}) => {
  const response = await axiosClient.get('/data-exchange/jobs', { params });
  return response; // { data, pagination }
};
