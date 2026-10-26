import * as model from '../models/category.model.js';
import { AppError } from '../utils/app-error.js';
import { assertUuid, assertText, paging } from '../utils/validation.js';

const parseInput = (input, create) => {
  const result = {};
  if (create || input.name !== undefined) result.name = assertText(input.name, 'name', 120);
  if (Object.hasOwn(input, 'description')) {
    if (input.description !== null && (typeof input.description !== 'string' || input.description.length > 255)) {
      throw new AppError(400, 'description phải là chuỗi tối đa 255 ký tự hoặc null');
    }
    result.description = input.description?.trim() ?? null;
  }
  if (input.isActive !== undefined) {
    if (typeof input.isActive !== 'boolean') throw new AppError(400, 'isActive phải là boolean');
    result.isActive = input.isActive;
  }
  if (!create && !Object.keys(result).length) throw new AppError(400, 'Không có trường danh mục cần cập nhật');
  return result;
};
export const list = async (input) => {
  const { page, limit, offset } = paging(input);
  if (input.isActive !== undefined && !['true', 'false'].includes(input.isActive)) throw new AppError(400, 'isActive phải là true hoặc false');
  const result = await model.listCategories({ search: input.search, isActive: input.isActive === undefined ? undefined : input.isActive === 'true', limit, offset });
  return { data: result.rows, pagination: { page, limit, total: result.total, totalPages: Math.ceil(result.total / limit) } };
};
export const create = async (input) => {
  try { return await model.createCategory(parseInput(input, true)); }
  catch (error) { if (error.code === '23505') throw new AppError(409, 'Tên danh mục đã tồn tại'); throw error; }
};
export const update = async (id, input) => {
  assertUuid(id, 'categoryId');
  try {
    const category = await model.updateCategory(id, parseInput(input, false));
    if (!category) throw new AppError(404, 'Không tìm thấy danh mục');
    return category;
  } catch (error) { if (error.code === '23505') throw new AppError(409, 'Tên danh mục đã tồn tại'); throw error; }
};
