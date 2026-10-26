import * as model from '../models/payment.model.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/app-error.js';
import { assertUuid, assertText, paging } from '../utils/validation.js';

const note = (value) => value === undefined ? undefined : assertText(value, 'note', 255);
export const instructions = async (id, userId) => {
  const state = await model.getCustomerPayment(assertUuid(id, 'orderId'), userId);
  const configured = Boolean(env.bankName && env.bankAccountNumber && env.bankAccountName);
  return { ...state, transfer: { configured, bankName: env.bankName || null,
    accountNumber: env.bankAccountNumber || null, accountName: env.bankAccountName || null,
    qrImageUrl: env.bankQrImageUrl || null, amount: state.order.total_amount,
    transferContent: state.order.order_number, confirmationMode: 'manual_review' } };
};
export const submit = async (id, input, userId) => {
  if (!env.bankName || !env.bankAccountNumber || !env.bankAccountName) throw new AppError(503, 'Chưa cấu hình tài khoản nhận chuyển khoản');
  return model.submitTransfer({ orderId: assertUuid(id, 'orderId'), userId,
    bankReference: assertText(input.bankReference, 'bankReference', 100), note: note(input.note) });
};
export const list = async (input) => {
  const { page, limit, offset } = paging(input);
  if (input.status && !['pending','confirmed','rejected'].includes(input.status)) throw new AppError(400, 'status không hợp lệ');
  const result = await model.listTransfers({ status: input.status, limit, offset });
  return { data: result.rows, pagination: { page, limit, total: result.total, totalPages: Math.ceil(result.total / limit) } };
};
export const review = async (id, input, userId) => {
  if (!['confirmed','rejected'].includes(input.decision)) throw new AppError(400, 'decision phải là confirmed hoặc rejected');
  const bankReference = input.decision === 'confirmed' ? assertText(input.bankReference, 'bankReference', 100) : null;
  const receivedAmount = input.decision === 'confirmed' ? String(input.receivedAmount ?? '') : null;
  if (receivedAmount !== null && (!/^\d+(\.\d{1,2})?$/.test(receivedAmount) || Number(receivedAmount) <= 0 || Number(receivedAmount) >= 1e12)) {
    throw new AppError(400, 'receivedAmount phải là số tiền thực nhận, lớn hơn 0 và tối đa 2 chữ số thập phân');
  }
  if (input.decision === 'rejected' && !input.reviewNote) throw new AppError(400, 'reviewNote là bắt buộc khi từ chối');
  return model.reviewTransfer({ requestId: assertUuid(id, 'requestId'), decision: input.decision,
    bankReference, receivedAmount, reviewNote: note(input.reviewNote), userId });
};
export const refund = (id, input, userId) => model.confirmRefund({ orderId: assertUuid(id, 'orderId'), userId,
  bankReference: assertText(input.bankReference, 'bankReference', 100), note: note(input.note) });
