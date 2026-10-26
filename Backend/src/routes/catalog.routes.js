import { Router } from 'express';
import { asyncHandler } from '../middlewares/async-handler.js';
import * as customerService from '../services/customer.service.js';
import * as categoryService from '../services/category.service.js';
import { getProduct } from '../models/catalog.model.js';
import { assertUuid } from '../utils/validation.js';
import { AppError } from '../utils/app-error.js';

const router = Router();
router.get('/products', asyncHandler(async (request, response) => response.json(await customerService.catalog(request.query))));
router.get('/products/:productId', asyncHandler(async (request, response) => {
  const product = await getProduct(assertUuid(request.params.productId, 'productId'));
  if (!product) throw new AppError(404, 'Không tìm thấy sản phẩm đang bán');
  response.json({ data: product });
}));
router.get('/categories', asyncHandler(async (request, response) => response.json(await categoryService.list({ ...request.query, isActive: 'true' }))));
export default router;
