import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { findUserAuthorization, findUserByEmail } from '../models/auth.model.js';
import { AppError } from '../utils/app-error.js';

export const authenticate = async (request, response, next) => {
  try {
    const deviceToken = request.headers['x-device-token'];
    if (deviceToken) {
      if (!env.iotDeviceToken || deviceToken !== env.iotDeviceToken) {
        throw new AppError(401, 'Device token không hợp lệ');
      }
      const defaultWhUser = await findUserByEmail('warehouse@example.com');
      if (defaultWhUser) {
        const authUser = await findUserAuthorization(defaultWhUser.id);
        if (authUser && authUser.status === 'active') {
          request.user = authUser;
          request.isIotDevice = true;
          return next();
        }
      }
      throw new AppError(500, 'Tài khoản kho mặc định cho IoT chưa được kích hoạt');
    }

    if (!env.jwtSecret) {
      throw new AppError(500, 'JWT_SECRET chưa được cấu hình trong file .env');
    }

    const header = request.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new AppError(401, 'Yêu cầu gửi Authorization Bearer token hoặc X-Device-Token');
    }

    const token = header.slice(7).trim();
    if (!token) {
      throw new AppError(401, 'Access token không hợp lệ');
    }

    const payload = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });
    const user = await findUserAuthorization(payload.sub);
    if (!user || user.status !== 'active') {
      throw new AppError(401, 'Tài khoản không tồn tại hoặc đã bị vô hiệu hóa');
    }

    request.user = user;
    next();
  } catch (error) {
    if (['TokenExpiredError', 'JsonWebTokenError', 'NotBeforeError'].includes(error.name)) {
      return next(new AppError(401, 'Access token không hợp lệ hoặc đã hết hạn'));
    }
    next(error);
  }
};

export const requirePermission = (...requiredPermissions) => (request, response, next) => {
  const granted = request.user?.permissions || [];
  const allowed = requiredPermissions.every((permission) => granted.includes(permission));
  if (!allowed) {
    return next(new AppError(403, 'Tài khoản không có quyền thực hiện thao tác này'));
  }
  next();
};

export const requireRole = (...roles) => (request, response, next) => {
  if (!roles.includes(request.user?.role_code)) {
    return next(new AppError(403, 'Tài khoản không có role phù hợp'));
  }
  next();
};
