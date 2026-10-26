import { Router } from 'express';
import * as posController from '../controllers/pos.controller.js';
import { asyncHandler } from '../middlewares/async-handler.js';
import { authenticate, requirePermission, requireRole } from '../middlewares/auth.middleware.js';
import { requireWarehouseAccess } from '../middlewares/warehouse-access.middleware.js';

const router = Router();
router.use(authenticate, requireRole('admin', 'sales'));

router.get('/sessions/current', requirePermission('pos.sessions.manage'), asyncHandler(posController.currentSession));
router.post('/sessions/open', requirePermission('pos.sessions.manage'), requireWarehouseAccess('body'), asyncHandler(posController.openSession));
router.post('/sessions/:sessionId/close', requirePermission('pos.sessions.manage'), requireWarehouseAccess('session'), asyncHandler(posController.closeSession));
router.get('/products/lookup', requirePermission('pos.products.read'), requireWarehouseAccess('query'), asyncHandler(posController.lookupProduct));
router.post('/sales', requirePermission('pos.sales.create'), requireWarehouseAccess('session'), asyncHandler(posController.createSale));
router.get('/sales', requirePermission('pos.sales.read'), asyncHandler(posController.listSales));
router.get('/sales/:saleId', requirePermission('pos.sales.read'), asyncHandler(posController.getSale));
router.post('/sales/:saleId/void', requirePermission('pos.sales.void'), requireWarehouseAccess('sale'), asyncHandler(posController.voidSale));

export default router;
