import { Router } from 'express';
import * as shippingController from '../controllers/shipping.controller.js';
import * as shippingService from '../services/shipping.service.js';
import { asyncHandler } from '../middlewares/async-handler.js';
import { authenticate, requirePermission, requireRole } from '../middlewares/auth.middleware.js';

const router = Router();
router.use(authenticate);
router.get('/scan', requireRole('admin', 'manager', 'shipper'), requirePermission('shipping.shipments.read'),
  asyncHandler(async (request, response) => response.json({ data: await shippingService.scan(request.query.identifier, request.user) })));

router.post('/shipments', requireRole('admin', 'manager'), requirePermission('shipping.shipments.create', 'shipping.shipments.assign'), asyncHandler(shippingController.create));
router.get('/shipments', requireRole('admin', 'manager', 'shipper'), requirePermission('shipping.shipments.read'), asyncHandler(shippingController.list));
router.get('/shipments/:shipmentId', requireRole('admin', 'manager', 'shipper'), requirePermission('shipping.shipments.read'), asyncHandler(shippingController.detail));
router.patch('/shipments/:shipmentId/status', requireRole('admin', 'manager', 'shipper'), requirePermission('shipping.shipments.update'), asyncHandler(shippingController.updateStatus));

export default router;
