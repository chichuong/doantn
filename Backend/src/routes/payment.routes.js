import { Router } from 'express';
import * as controller from '../controllers/payment.controller.js';
import { authenticate, requireRole, requirePermission } from '../middlewares/auth.middleware.js';
import { asyncHandler } from '../middlewares/async-handler.js';

const router = Router();
router.use(authenticate);
router.get('/orders/:orderId/instructions', requireRole('admin','customer'), requirePermission('payments.customer.manage'), asyncHandler(controller.instructions));
router.post('/orders/:orderId/transfers', requireRole('admin','customer'), requirePermission('payments.customer.manage'), asyncHandler(controller.submit));
router.get('/transfers', requireRole('admin','manager'), requirePermission('payments.transfers.read'), asyncHandler(controller.list));
router.post('/transfers/:requestId/review', requireRole('admin','manager'), requirePermission('payments.transfers.review'), asyncHandler(controller.review));
router.post('/orders/:orderId/refund', requireRole('admin','manager'), requirePermission('payments.refunds.confirm'), asyncHandler(controller.refund));
export default router;
