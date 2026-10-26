import * as model from '../models/warehouse-access.model.js';
import { assertUuid } from '../utils/validation.js';
import { AppError } from '../utils/app-error.js';
export const list = async (request, response) => response.json({ data: await model.getUserWarehouses(assertUuid(request.params.userId, 'userId')) });
export const replace = async (request, response) => {
  const userId = assertUuid(request.params.userId, 'userId');
  if (!Array.isArray(request.body.warehouseIds)) throw new AppError(400, 'warehouseIds phải là mảng UUID');
  const ids = request.body.warehouseIds.map(id => assertUuid(id, 'warehouseId'));
  if (new Set(ids).size !== ids.length) throw new AppError(400, 'warehouseIds bị trùng');
  await model.replaceUserWarehouses(userId, ids, request.user.id);
  response.json({ data: await model.getUserWarehouses(userId) });
};
