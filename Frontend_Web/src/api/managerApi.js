import axiosClient from './axiosClient';

export const managerApi = {
  getDashboard: (params) => axiosClient.get('/manager/dashboard', { params }),
  getSalesReport: (params) => axiosClient.get('/manager/reports/sales', { params }),

  getCategories: (params) => axiosClient.get('/manager/categories', { params }),
  createCategory: (data) => axiosClient.post('/manager/categories', data),
  updateCategory: (categoryId, data) => axiosClient.patch(`/manager/categories/${categoryId}`, data),

  getProducts: (params) => axiosClient.get('/manager/products', { params }),
  createProduct: (data) => axiosClient.post('/manager/products', data),
  updateProduct: (productId, data) => axiosClient.patch(`/manager/products/${productId}`, data),
};

