import { Router } from 'express';
import * as forecastingController from '../controllers/forecasting.controller.js';
import { asyncHandler } from '../middlewares/async-handler.js';
import { authenticate, requirePermission, requireRole } from '../middlewares/auth.middleware.js';

const router = Router();
router.use(authenticate, requireRole('admin', 'manager'));

router.post('/runs', requirePermission('forecasting.run'), asyncHandler(forecastingController.run));
router.get('/runs', requirePermission('forecasting.read'), asyncHandler(forecastingController.listRuns));
router.get('/runs/:runId', requirePermission('forecasting.read'), asyncHandler(forecastingController.getRun));
router.get('/alerts', requirePermission('forecasting.alerts.read'), asyncHandler(forecastingController.alerts));

export default router;
