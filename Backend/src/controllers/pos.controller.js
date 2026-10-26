import * as posService from '../services/pos.service.js';

export const currentSession = async (request, response) => response.json({ data: await posService.currentSession(request.user.id) });
export const openSession = async (request, response) => response.status(201).json({ data: await posService.open(request.body, request.user.id) });
export const closeSession = async (request, response) => response.json({ data: await posService.close(request.params.sessionId, request.body, request.user.id) });
export const lookupProduct = async (request, response) => response.json({ data: await posService.lookupProduct(request.query.identifier, request.query.warehouseId) });
export const createSale = async (request, response) => response.status(201).json({ data: await posService.create(request.body, request.user.id, request.get('Idempotency-Key')) });
export const listSales = async (request, response) => response.json(await posService.sales(request.query, request.user.id));
export const getSale = async (request, response) => response.json({ data: await posService.saleDetail(request.params.saleId, request.user.id) });
export const voidSale = async (request, response) => response.json({ data: await posService.voidSaleById(request.params.saleId, request.body, request.user.id) });
