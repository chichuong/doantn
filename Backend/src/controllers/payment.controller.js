import * as service from '../services/payment.service.js';
export const instructions = async (request, response) => response.json({ data: await service.instructions(request.params.orderId, request.user.id) });
export const submit = async (request, response) => response.status(201).json({ data: await service.submit(request.params.orderId, request.body, request.user.id) });
export const list = async (request, response) => response.json(await service.list(request.query));
export const review = async (request, response) => response.json({ data: await service.review(request.params.requestId, request.body, request.user.id) });
export const refund = async (request, response) => response.json({ data: await service.refund(request.params.orderId, request.body, request.user.id) });
