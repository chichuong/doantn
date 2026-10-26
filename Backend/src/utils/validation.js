import { AppError } from './app-error.js';

export const assertUuid = (value, field) => {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new AppError(400, `${field} phải là UUID hợp lệ`);
  }
  return value.toLowerCase();
};
export const assertInteger = (value, field, min = 0) => {
  if (value === null || value === '' || typeof value === 'boolean') throw new AppError(400, `${field} không hợp lệ`);
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > 2147483647) throw new AppError(400, `${field} phải là số nguyên từ ${min} đến 2147483647`);
  return number;
};
export const assertText = (value, field, max) => {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new AppError(400, `${field} phải dài 1–${max} ký tự`);
  return value.trim();
};
export const assertDate = (value, field) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)
    || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) {
    throw new AppError(400, `${field} phải là ngày hợp lệ dạng YYYY-MM-DD`);
  }
  return value;
};
export const paging = (input) => {
  const page = input.page === undefined ? 1 : assertInteger(input.page, 'page', 1);
  const limit = input.limit === undefined ? 20 : Math.min(assertInteger(input.limit, 'limit', 1), 100);
  return { page, limit, offset: (page - 1) * limit };
};
