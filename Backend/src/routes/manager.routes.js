import { Router } from 'express';
import * as managerController from '../controllers/manager.controller.js';
import * as categoryController from '../controllers/category.controller.js';
import { asyncHandler } from '../middlewares/async-handler.js';
import { authenticate, requirePermission, requireRole } from '../middlewares/auth.middleware.js';

const router = Router();
router.use(authenticate, requireRole('admin', 'manager'));

router.get('/dashboard', requirePermission('manager.dashboard.read'), asyncHandler(managerController.dashboard));
router.get('/categories', requirePermission('manager.categories.read'), asyncHandler(categoryController.list));
router.post('/categories', requirePermission('manager.categories.manage'), asyncHandler(categoryController.create));
router.patch('/categories/:categoryId', requirePermission('manager.categories.manage'), asyncHandler(categoryController.update));
router.get('/products', requirePermission('manager.products.read'), asyncHandler(managerController.listProducts));
router.post('/products', requirePermission('manager.products.manage'), asyncHandler(managerController.createProduct));
router.patch('/products/:productId', requirePermission('manager.products.manage'), asyncHandler(managerController.updateProduct));
router.get('/warehouses', requirePermission('manager.warehouses.read'), asyncHandler(managerController.listWarehouses));
router.post('/warehouses', requirePermission('manager.warehouses.manage'), asyncHandler(managerController.createWarehouse));
router.patch('/warehouses/:warehouseId', requirePermission('manager.warehouses.manage'), asyncHandler(managerController.updateWarehouse));
router.get('/inventory', requirePermission('manager.inventory.read'), asyncHandler(managerController.listInventory));
router.get('/inventory/discrepancies', requirePermission('manager.inventory.read'), asyncHandler(managerController.listInventoryDiscrepancies));
router.get('/inventory/transactions', requirePermission('manager.inventory.read'), asyncHandler(managerController.listInventoryTransactions));
router.get('/inventory/:warehouseId/:productId/reservations', requirePermission('manager.inventory.read'), asyncHandler(managerController.listInventoryReservations));
router.post('/inventory/adjustments', requirePermission('manager.inventory.adjust'), asyncHandler(managerController.adjustInventory));
router.get('/orders', requirePermission('manager.orders.read'), asyncHandler(managerController.listOrders));
router.post('/orders/:orderId/cancel', requirePermission('manager.orders.cancel'), asyncHandler(managerController.cancelOrder));
router.get('/reports/sales', requirePermission('manager.reports.read'), asyncHandler(managerController.salesReport));

export default router;
