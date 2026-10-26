import { Router } from 'express';
import * as warehouseController from '../controllers/warehouse.controller.js';
import * as workflowController from '../controllers/warehouse-workflow.controller.js';
import * as documentScanController from '../controllers/document-scan.controller.js';
import { asyncHandler } from '../middlewares/async-handler.js';
import { authenticate, requirePermission, requireRole } from '../middlewares/auth.middleware.js';
import { requireWarehouseAccess } from '../middlewares/warehouse-access.middleware.js';

const router = Router();
router.use(authenticate, requireRole('admin', 'warehouse'));

router.get('/scan', requirePermission('warehouse.inventory.read'), requireWarehouseAccess('query'), asyncHandler(warehouseController.scan));
router.get('/documents', requirePermission('warehouse.documents.read'), requireWarehouseAccess('query'), asyncHandler(warehouseController.listDocuments));
router.get('/documents/:documentId', requirePermission('warehouse.documents.read'), requireWarehouseAccess('document'), asyncHandler(warehouseController.getDocument));
router.post('/documents', requirePermission('warehouse.documents.create'), requireWarehouseAccess('body'), asyncHandler(warehouseController.createDocument));
router.post('/documents/:documentId/complete', requirePermission('warehouse.documents.complete'), requireWarehouseAccess('document'), asyncHandler(warehouseController.completeDocument));
router.get('/documents/:documentId/check', requirePermission('warehouse.documents.read'), requireWarehouseAccess('document'), asyncHandler(documentScanController.check));
router.post('/documents/:documentId/scan', requirePermission('warehouse.documents.complete'), requireWarehouseAccess('document'), asyncHandler(documentScanController.scan));
router.get('/orders', requirePermission('warehouse.orders.read'), requireWarehouseAccess('query'), asyncHandler(warehouseController.listOrders));
router.post('/orders/:orderId/pack', requirePermission('warehouse.orders.pack'), requireWarehouseAccess('order'), asyncHandler(warehouseController.packOrder));
router.get('/orders/:orderId/check', requirePermission('warehouse.orders.read'), requireWarehouseAccess('order'), asyncHandler(workflowController.check));
router.post('/orders/:orderId/scan', requirePermission('warehouse.orders.scan'), requireWarehouseAccess('order'), asyncHandler(workflowController.scan));
router.get('/orders/:orderId/return-receipt', requirePermission('warehouse.orders.returns'), requireWarehouseAccess('order'), asyncHandler(workflowController.receipt));
router.post('/orders/:orderId/return-receipt', requirePermission('warehouse.orders.returns'), requireWarehouseAccess('order'), asyncHandler(workflowController.receiveReturn));

export default router;
