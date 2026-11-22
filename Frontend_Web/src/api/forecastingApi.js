import axiosClient from './axiosClient';

/**
 * API client cho module Dự báo nhu cầu sản phẩm (Forecasting)
 * Kết nối trực tiếp tới Backend routes: /api/v1/forecasting/*
 */
export const forecastingApi = {
  // Lấy danh sách các lần chạy dự báo
  getRuns: (params = {}) => {
    return axiosClient.get('/forecasting/runs', { params });
  },

  // Lấy chi tiết một lần chạy dự báo (kèm chuỗi số liệu dự báo theo từng ngày và sản phẩm)
  getRunDetail: (runId) => {
    return axiosClient.get(`/forecasting/runs/${runId}`);
  },

  // Lấy danh sách đề xuất nhập hàng dựa trên dự báo và tồn kho khả dụng thực tế
  getAlerts: (params = {}) => {
    return axiosClient.get('/forecasting/alerts', { params });
  },

  // Kích hoạt một lượt chạy dự báo mới
  // model: 'baseline' (mặc định) | 'python'
  // horizonDays: 1..30 (ví dụ 7, 14, 30 ngày)
  // lookbackDays: 7..365
  // warehouseId: optional (UUID)
  // productId: optional (UUID)
  triggerRun: (payload = {}) => {
    return axiosClient.post('/forecasting/runs', payload);
  },
};
