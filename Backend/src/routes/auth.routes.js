import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { asyncHandler } from '../middlewares/async-handler.js';
import { authenticate, requirePermission, requireRole } from '../middlewares/auth.middleware.js';
import * as warehouseAccessController from '../controllers/warehouse-access.controller.js';
import { loginRateLimit } from '../middlewares/http-security.middleware.js';

const router = Router();

const authenticationLimit = loginRateLimit();
router.post('/login', authenticationLimit, asyncHandler(authController.login));
router.post('/register', authenticationLimit, asyncHandler(authController.register));
router.use(authenticate);
router.get('/me', asyncHandler(authController.me));

router.get('/users', requirePermission('auth.users.read'), asyncHandler(authController.listUsers));
router.post('/users', requirePermission('auth.users.create'), asyncHandler(authController.createUser));
router.patch('/users/:userId', requirePermission('auth.users.update'), asyncHandler(authController.updateUser));
router.get('/users/:userId/warehouses', requireRole('admin'), requirePermission('auth.users.read'), asyncHandler(warehouseAccessController.list));
router.put('/users/:userId/warehouses', requireRole('admin'), requirePermission('auth.users.update'), asyncHandler(warehouseAccessController.replace));

router.get('/roles', requirePermission('auth.roles.read'), asyncHandler(authController.listRoles));
router.post('/roles', requirePermission('auth.roles.create'), asyncHandler(authController.createRole));
router.patch('/roles/:roleId', requirePermission('auth.roles.update'), asyncHandler(authController.updateRole));
router.put('/roles/:roleId/permissions', requirePermission('auth.roles.update'), asyncHandler(authController.replaceRolePermissions));

router.get('/permissions', requirePermission('auth.permissions.read'), asyncHandler(authController.listPermissions));

export default router;
