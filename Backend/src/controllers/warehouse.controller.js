import * as warehouseService from '../services/warehouse.service.js';

export const scan = async (request, response) => response.json({ data: await warehouseService.scan(request.query.identifier, request.query.warehouseId) });
export const listDocuments = async (request, response) => response.json(await warehouseService.documents(request.query));
export const getDocument = async (request, response) => response.json({ data: await warehouseService.documentDetail(request.params.documentId) });
export const createDocument = async (request, response) => response.status(201).json({ data: await warehouseService.createWarehouseDocument(request.body, request.user.id) });
export const completeDocument = async (request, response) => response.json({ data: await warehouseService.complete(request.params.documentId, request.user.id) });
export const listOrders = async (request, response) => response.json(await warehouseService.orders(request.query));
export const packOrder = async (request, response) => response.json({ data: await warehouseService.pack(request.params.orderId, request.body.warehouseId, request.user.id) });
