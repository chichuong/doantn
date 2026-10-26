import { Router } from 'express';
import * as customerController from '../controllers/customer.controller.js';
import { asyncHandler } from '../middlewares/async-handler.js';
import { authenticate, requirePermission, requireRole } from '../middlewares/auth.middleware.js';

const router = Router();
router.use(authenticate, requireRole('admin', 'customer'));

router.get('/catalog', requirePermission('customer.catalog.read'), asyncHandler(customerController.catalog));
router.get('/cart', requirePermission('customer.cart.manage'), asyncHandler(customerController.getCart));
router.put('/cart/items', requirePermission('customer.cart.manage'), asyncHandler(customerController.addCartItem));
router.delete('/cart/items/:productId', requirePermission('customer.cart.manage'), asyncHandler(customerController.removeCartItem));
router.get('/addresses', requirePermission('customer.addresses.manage'), asyncHandler(customerController.listAddresses));
router.post('/addresses', requirePermission('customer.addresses.manage'), asyncHandler(customerController.createAddress));
router.patch('/addresses/:addressId', requirePermission('customer.addresses.manage'), asyncHandler(customerController.updateAddress));
router.delete('/addresses/:addressId', requirePermission('customer.addresses.manage'), asyncHandler(customerController.deleteAddress));
router.post('/checkout', requirePermission('customer.orders.create'), asyncHandler(customerController.checkout));
router.get('/orders', requirePermission('customer.orders.read'), asyncHandler(customerController.listOrders));
router.get('/orders/:orderId', requirePermission('customer.orders.read'), asyncHandler(customerController.getOrder));
router.post('/orders/:orderId/cancel', requirePermission('customer.orders.cancel'), asyncHandler(customerController.cancelOrder));

export default router;
