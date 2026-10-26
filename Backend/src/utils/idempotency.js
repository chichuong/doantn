import { createHash } from 'node:crypto';
import { AppError } from './app-error.js';

export const validateIdempotencyKey = (key) => {
  if (key === undefined) return null;
  if (typeof key !== 'string' || !/^[A-Za-z0-9._:-]{1,120}$/.test(key)) {
    throw new AppError(400, 'Idempotency-Key phải dài 1–120 ký tự chữ, số hoặc . _ : -');
  }
  return key;
};

// Insert and result are part of the business transaction; a failed transaction leaves no key.
export const startIdempotency = async (client, { userId, operation, key, payload }) => {
  if (!key) return null;
  const hash = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  await client.query(`INSERT INTO api_idempotency_keys (user_id, operation, key, request_hash)
    VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`, [userId, operation, key, hash]);
  const result = await client.query(`SELECT request_hash, order_id FROM api_idempotency_keys
    WHERE user_id = $1 AND operation = $2 AND key = $3 FOR UPDATE`, [userId, operation, key]);
  if (result.rows[0].request_hash !== hash) throw new AppError(409, 'Idempotency-Key đã được dùng với nội dung khác');
  return result.rows[0].order_id;
};

export const finishIdempotency = async (client, { userId, operation, key, orderId }) => {
  if (key) await client.query(`UPDATE api_idempotency_keys SET order_id = $4
    WHERE user_id = $1 AND operation = $2 AND key = $3`, [userId, operation, key, orderId]);
};
