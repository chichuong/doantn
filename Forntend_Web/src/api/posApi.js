import axiosClient from './axiosClient';

export const posApi = {
  // Lấy thông tin ca bán hàng đang mở của tài khoản
  getCurrentSession: () => {
    return axiosClient.get('/pos/sessions/current');
  },

  // Mở ca bán hàng mới (nhập số tiền đầu ca và chọn kho hàng)
  openSession: ({ warehouseId, openingCash }) => {
    return axiosClient.post('/pos/sessions/open', {
      warehouseId,
      openingCash: Number(openingCash),
    });
  },

  // Đóng ca bán hàng (nhập số tiền kết ca thực tế)
  closeSession: (sessionId, { closingCash, note }) => {
    return axiosClient.post(`/pos/sessions/${sessionId}/close`, {
      closingCash: Number(closingCash),
      note: note || undefined,
    });
  },

  // Tra cứu sản phẩm bằng SKU hoặc Barcode tại kho được chọn
  lookupProduct: ({ identifier, warehouseId }) => {
    return axiosClient.get('/pos/products/lookup', {
      params: { identifier, warehouseId },
    });
  },

  // Tạo giao dịch bán hàng POS (thanh toán đơn tại quầy)
  createSale: (salePayload) => {
    return axiosClient.post('/pos/sales', salePayload);
  },

  // Lấy danh sách giao dịch bán lẻ POS
  listSales: (params) => {
    return axiosClient.get('/pos/sales', { params });
  },

  // Xem chi tiết giao dịch POS
  getSaleDetail: (saleId) => {
    return axiosClient.get(`/pos/sales/${saleId}`);
  },

  // Hủy giao dịch POS và hoàn trả tồn kho
  voidSale: (saleId, { reason }) => {
    return axiosClient.post(`/pos/sales/${saleId}/void`, { reason });
  },
};
