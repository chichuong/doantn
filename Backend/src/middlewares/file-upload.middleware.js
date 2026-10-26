import multer from 'multer';
import path from 'node:path';
import { AppError } from '../utils/app-error.js';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const allowedExtensions = new Set(['.xlsx', '.csv']);
const allowedMimeTypes = new Set([
  'text/csv',
  'application/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream'
]);

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter: (request, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (!allowedExtensions.has(extension) || !allowedMimeTypes.has(file.mimetype)) {
      return callback(new AppError(400, 'Chỉ chấp nhận file .xlsx hoặc .csv hợp lệ'));
    }
    callback(null, true);
  }
});

export const uploadSingleFile = (fieldName = 'file') => (request, response, next) => {
  upload.single(fieldName)(request, response, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return next(new AppError(413, 'File vượt quá giới hạn 10 MB'));
    }
    if (error instanceof AppError) return next(error);
    next(new AppError(400, error.message || 'File upload không hợp lệ'));
  });
};
