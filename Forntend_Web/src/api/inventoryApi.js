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
};
