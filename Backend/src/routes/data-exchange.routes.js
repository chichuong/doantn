import { Router } from 'express';
import * as dataExchangeController from '../controllers/data-exchange.controller.js';
import { asyncHandler } from '../middlewares/async-handler.js';
import { authenticate, requirePermission, requireRole } from '../middlewares/auth.middleware.js';
import { uploadSingleFile } from '../middlewares/file-upload.middleware.js';

const router = Router();
router.use(authenticate, requireRole('admin', 'manager'));

router.post('/import/:dataType', requirePermission('data_exchange.import'), uploadSingleFile('file'), asyncHandler(dataExchangeController.importFile));
router.get('/export/:dataType', requirePermission('data_exchange.export'), asyncHandler(dataExchangeController.exportFile));
router.get('/jobs', requirePermission('data_exchange.jobs.read'), asyncHandler(dataExchangeController.listJobs));

export default router;
