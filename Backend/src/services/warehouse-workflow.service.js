import * as model from '../models/warehouse-workflow.model.js';
import { assertUuid, assertInteger, assertText } from '../utils/validation.js';
import { AppError } from '../utils/app-error.js';

export const check = (id) => model.getOrderCheck(assertUuid(id, 'orderId'));
export const scan = async (id, input, userId) => {
  const orderId = assertUuid(id, 'orderId');
  const event = await model.scanOrderItem({ orderId, identifier: assertText(input.identifier, 'identifier', 100),
    quantity: assertInteger(input.quantity ?? 1, 'quantity', 1), requestId: assertUuid(input.requestId, 'requestId'), userId });
  return { event, check: await model.getOrderCheck(orderId) };
};
export const receipt = async (id) => {
  const result = await model.getReturnReceipt(assertUuid(id, 'orderId'));
  if (!result) throw new AppError(404, 'Chưa có phiếu nhận hàng hoàn');
  return result;
};
export const receiveReturn = async (id, input, userId) => {
  const orderId = assertUuid(id, 'orderId');
  if (!Array.isArray(input.items) || !input.items.length) throw new AppError(400, 'items phải là mảng không rỗng');
  const ids = new Set();
  const items = input.items.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new AppError(400, 'Mỗi item phải là object');
    const orderItemId = assertUuid(item.orderItemId, 'orderItemId');
    if (ids.has(orderItemId)) throw new AppError(400, 'orderItemId bị trùng');
    ids.add(orderItemId);
    const receivedQuantity = assertInteger(item.receivedQuantity, 'receivedQuantity', 1);
    const restockQuantity = assertInteger(item.restockQuantity, 'restockQuantity');
    if (restockQuantity > receivedQuantity) throw new AppError(400, 'restockQuantity không được vượt receivedQuantity');
    return { orderItemId, receivedQuantity, restockQuantity };
  });
  if (input.note !== undefined && (typeof input.note !== 'string' || input.note.length > 255)) throw new AppError(400, 'note tối đa 255 ký tự');
  await model.receiveOrderReturn({ orderId, items, note: input.note, userId });
  return model.getReturnReceipt(orderId);
};
