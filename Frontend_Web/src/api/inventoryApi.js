import axiosClient from './axiosClient';

export const inventoryApi = {
  // Lấy danh sách kho hàng
  getWarehouses: () => {
    return axiosClient.get('/manager/warehouses');
  },

  // Lấy danh sách tồn kho theo kho hoặc lọc tồn thấp
  getInventory: (params = {}) => {
    return axiosClient.get('/manager/inventory', { params });
  },

  // Điều chỉnh tồn kho (receipt: nhập kho, issue: xuất kho, adjustment: điều chỉnh số lượng)
  adjustInventory: ({ warehouseId, productId, type, quantity, referenceCode, note }) => {
    return axiosClient.post('/manager/inventory/adjustments', {
      warehouseId,
      productId,
      type,
      quantity: Number(quantity),
      referenceCode,
      note,
    });
  },

  // Lịch sử biến động tồn kho (Thẻ kho / Ledger)
  getInventoryTransactions: (params = {}) => {
    return axiosClient.get('/manager/inventory/transactions', { params });
  },

  // Danh sách dòng hàng đang được giữ chỗ (Active Reservations) của một sản phẩm tại kho
  getReservations: (warehouseId, productId) => {
    return axiosClient.get(`/manager/inventory/${warehouseId}/${productId}/reservations`);
  },

  // Báo cáo đối soát sai lệch tồn kho (Reconciliation Audit)
  getDiscrepancies: () => {
    return axiosClient.get('/manager/inventory/discrepancies');
  },

  // Danh sách chứng từ nhập / xuất kho cần duyệt
  getDocuments: (params = {}) => {
    return axiosClient.get('/manager/documents', { params });
  },

  // Tạo chứng từ nhập / xuất kho mới (từ gợi ý AI hoặc quản lý tạo trực tiếp)
  createDocument: (payload) => {
    return axiosClient.post('/manager/documents', payload);
  },

  // Chi tiết chứng từ
  getDocumentDetail: (documentId) => {
    return axiosClient.get(`/manager/documents/${documentId}`);
  },

  // Tra cứu & xác thực đối soát phiếu kho qua mã QR (từ Camera IoT hoặc Camera Web)
  lookupDocumentByQr: (identifier, source = 'esp32_s3_camera') => {
    return axiosClient.get('/manager/documents/lookup', {
      params: { identifier, source },
    });
  },

  // Tự động nhận diện trạng thái & địa chỉ IP LAN của thiết bị Camera IoT ESP32-S3
  getIotStatus: () => {
    return axiosClient.get('/manager/iot/status');
  },

  // Tự động lấy Wi-Fi đang kết nối trên Máy tính Windows và đồng bộ xuống ESP32-S3
  syncPcWifiToIot: () => {
    return axiosClient.post('/manager/iot/sync-pc-wifi');
  },

  // Phê duyệt chứng từ (sinh mã phiếu & QR)
  approveDocument: (documentId) => {
    return axiosClient.post(`/manager/documents/${documentId}/approve`);
  },

  // Từ chối chứng từ kèm lý do
  rejectDocument: (documentId, reason) => {
    return axiosClient.post(`/manager/documents/${documentId}/reject`, { reason });
  },
};

