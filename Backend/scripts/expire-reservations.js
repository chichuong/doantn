import { query, closeDatabase } from '../src/config/database.js';
import { withTransaction } from '../src/utils/transaction.js';
import { releaseReservation } from '../src/services/inventory.service.js';
import { ORDER_STATUS, transitionOrder } from '../src/domain/order-state-machine.js';

// Default is read-only. Scheduling this command is intentionally left until database/API testing.
try {
  if (!process.argv.includes('--apply')) {
    const result = await query(`SELECT id, order_number, reservation_expires_at FROM orders
      WHERE channel IN ('web','mobile') AND status = 'pending' AND payment_status = 'unpaid'
      AND reservation_expires_at <= NOW() ORDER BY reservation_expires_at LIMIT 100`);
    console.log(JSON.stringify({ mode: 'preview', orders: result.rows }, null, 2));
  } else {
    const cancelled = [];
    for (let count = 0; count < 100; count += 1) {
      const id = await withTransaction(async client => {
        const order = await client.query(`SELECT id, warehouse_id FROM orders
          WHERE channel IN ('web','mobile') AND status = 'pending' AND payment_status = 'unpaid'
            AND reservation_expires_at <= NOW() ORDER BY reservation_expires_at
          LIMIT 1 FOR UPDATE SKIP LOCKED`);
        if (!order.rowCount) return null;
        const header = order.rows[0];
        await releaseReservation(client, { orderId: header.id, userId: null, status: 'expired' });
        await client.query(`UPDATE bank_transfer_requests SET status = 'rejected', reviewed_at = NOW(),
          review_note = 'Đơn hết thời gian giữ hàng trước khi đối soát' WHERE order_id = $1 AND status = 'pending'`, [header.id]);
        await transitionOrder(client, { orderId: header.id, toStatus: ORDER_STATUS.CANCELLED,
          expectedFrom: ORDER_STATUS.PENDING,
          note: 'Hết thời gian giữ hàng; hệ thống giải phóng reservation', changedBy: null });
        return header.id;
      });
      if (!id) break;
      cancelled.push(id);
    }
    console.log(JSON.stringify({ mode: 'apply', cancelled }, null, 2));
  }
} catch (error) {
  console.error('Reservation expiry failed:', error.code || error.message);
  process.exitCode = 1;
} finally { await closeDatabase(); }
