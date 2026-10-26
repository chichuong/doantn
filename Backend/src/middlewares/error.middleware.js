import { AppError } from '../utils/app-error.js';

export const notFoundHandler = (request, response) => {
  response.status(404).json({
    success: false,
    message: `Route not found: ${request.method} ${request.originalUrl}`
  });
};

export const errorHandler = (error, request, response, next) => {
  console.error(error);
  if (response.headersSent) return next(error);

  if (error instanceof SyntaxError && error.status === 400 && error.type === 'entity.parse.failed') {
    return response.status(400).json({ success: false, message: 'JSON request body không hợp lệ' });
  }

  const databaseErrors = { '23505': [409, 'Dữ liệu bị trùng'], '23503': [400, 'Tham chiếu dữ liệu không hợp lệ'],
    '23514': [400, 'Dữ liệu vi phạm ràng buộc nghiệp vụ'], '22003': [400, 'Giá trị vượt phạm vi cho phép'],
    '22P02': [400, 'Định dạng dữ liệu không hợp lệ'], '40P01': [409, 'Giao dịch xung đột; vui lòng thử lại'],
    '40001': [409, 'Giao dịch xung đột; vui lòng thử lại'] };
  const mapped = databaseErrors[error.code];
  const statusCode = error instanceof AppError ? error.statusCode : mapped?.[0] || error.statusCode || error.status || 500;
  const body = { success: false, message: statusCode >= 500 && !(error instanceof AppError) ? 'Internal server error' : mapped?.[1] || error.message,
    requestId: request.requestId };
  if (error instanceof AppError && error.details !== undefined) body.details = error.details;
  return response.status(statusCode).json(body);
};
