import axiosClient from './axiosClient';

export const authApi = {
  login: (credentials) => axiosClient.post('/auth/login', credentials),
  sendRegisterOtp: (data) => axiosClient.post('/auth/register/send-otp', data),
  register: (data) => axiosClient.post('/auth/register', data),
  forgotPassword: (data) => axiosClient.post('/auth/forgot-password', data),
  resetPassword: (data) => axiosClient.post('/auth/reset-password', data),
  getMe: () => axiosClient.get('/auth/me'),

  getUsers: (params) => axiosClient.get('/auth/users', { params }),
  createUser: (data) => axiosClient.post('/auth/users', data),
  updateUser: (userId, data) => axiosClient.patch(`/auth/users/${userId}`, data),
  getUserWarehouses: (userId) => axiosClient.get(`/auth/users/${userId}/warehouses`),
  updateUserWarehouses: (userId, warehouseIds) =>
    axiosClient.put(`/auth/users/${userId}/warehouses`, { warehouseIds }),

  getRoles: () => axiosClient.get('/auth/roles'),
  createRole: (data) => axiosClient.post('/auth/roles', data),
  updateRole: (roleId, data) => axiosClient.patch(`/auth/roles/${roleId}`, data),
  replaceRolePermissions: (roleId, permissionIds) =>
    axiosClient.put(`/auth/roles/${roleId}/permissions`, { permissionIds }),

  getPermissions: () => axiosClient.get('/auth/permissions'),
};
