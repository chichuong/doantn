import { Router } from 'express';
import * as orderProcessingController from '../controllers/order-processing.controller.js';
import { asyncHandler } from '../middlewares/async-handler.js';
import { authenticate, requirePermission, requireRole } from '../middlewares/auth.middleware.js';
import { requireWarehouseAccess } from '../middlewares/warehouse-access.middleware.js';

const router = Router();
router.use(authenticate);

router.get('/orders', requireRole('admin', 'manager', 'order_processor'), requirePermission('order_processing.orders.read'), requireWarehouseAccess('query'), asyncHandler(orderProcessingController.listOrders));
router.get('/orders/:orderId', requireRole('admin', 'manager', 'order_processor'), requirePermission('order_processing.orders.read'), requireWarehouseAccess('order'), asyncHandler(orderProcessingController.getOrder));
router.post('/orders/:orderId/confirm', requireRole('admin', 'manager', 'order_processor'), requirePermission('order_processing.orders.confirm'), requireWarehouseAccess('order'), asyncHandler(orderProcessingController.confirmOrder));
router.post('/orders/:orderId/assign', requireRole('admin', 'manager'), requirePermission('order_processing.orders.assign'), asyncHandler(orderProcessingController.assignOrder));
router.patch('/orders/:orderId/task', requireRole('admin', 'manager', 'order_processor'), requirePermission('order_processing.tasks.update'), requireWarehouseAccess('order'), asyncHandler(orderProcessingController.updateTask));

export default router;
