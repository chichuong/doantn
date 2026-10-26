import axios from 'axios';
import { generateUUID } from '../utils/idempotency';

/**
 * Cấu hình Axios Client tập trung cho toàn bộ ứng dụng
 * Tự động gắn Authorization Bearer Token
 * Tự động sinh Idempotency-Key (UUID v4) cho mọi request làm thay đổi dữ liệu (POST, PUT, PATCH)
 */
const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Request Interceptor
axiosClient.interceptors.request.use(
  (config) => {
    // 1. Gắn JWT Token nếu có trong localStorage
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // 2. Tự động sinh và gán Header Idempotency-Key (dạng UUID v4)
    // Áp dụng cho các phương thức POST, PUT, PATCH nhằm bảo vệ giao dịch chống lặp
    const method = (config.method || '').toLowerCase();
    const isMutation = ['post', 'put', 'patch'].includes(method);

    if (isMutation && !config.headers['Idempotency-Key']) {
      const customKey = config.idempotencyKey || generateUUID();
      config.headers['Idempotency-Key'] = customKey;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor
axiosClient.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    const status = error.response?.status;
    const errorData = error.response?.data;
    const isLoginRequest = error.config?.url?.includes('/auth/login');

    let errorMessage = errorData?.message || error.message || 'Có lỗi xảy ra, vui lòng thử lại';

    // Bắt lỗi 502/503: Backend server chưa chạy hoặc cổng 3000 không phản hồi
    if (status === 502 || status === 503) {
      errorMessage = 'Backend Server chưa sẵn sàng (502 Bad Gateway). Vui lòng đảm bảo server Node.js đang chạy trên port 3000 (npm run dev trong thư mục Backend).';
    }

    // Bắt mã lỗi 401: Token hết hạn hoặc không hợp lệ (không áp dụng khi đang gõ mật khẩu sai ở login)
    if (status === 401 && !isLoginRequest) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login?expired=true';
      }
    }

    // Bắt mã lỗi 403: Không đủ quyền hạn role/permission
    if (status === 403) {
      errorMessage = errorData?.message || 'Bạn không có quyền thực hiện chức năng này (403 Forbidden).';
    }

    const enhancedError = new Error(errorMessage);
    enhancedError.status = status;
    enhancedError.details = errorData;
    return Promise.reject(enhancedError);
  }
);

export default axiosClient;
