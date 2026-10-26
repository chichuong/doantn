import * as service from '../services/warehouse-workflow.service.js';
export const check = async (request, response) => response.json({ data: await service.check(request.params.orderId) });
export const scan = async (request, response) => response.json({ data: await service.scan(request.params.orderId, request.body, request.user.id) });
export const receipt = async (request, response) => response.json({ data: await service.receipt(request.params.orderId) });
export const receiveReturn = async (request, response) => response.status(201).json({ data: await service.receiveReturn(request.params.orderId, request.body, request.user.id) });
