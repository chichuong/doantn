import * as orderProcessingService from '../services/order-processing.service.js';

const actor = (request) => ({ id: request.user.id, role_code: request.user.role_code });

export const listOrders = async (request, response) => response.json(await orderProcessingService.orders(request.query));
export const getOrder = async (request, response) => response.json({ data: await orderProcessingService.detail(request.params.orderId) });
export const confirmOrder = async (request, response) => response.json({ data: await orderProcessingService.confirm(request.params.orderId, request.body, request.user.id) });
export const assignOrder = async (request, response) => response.json({ data: await orderProcessingService.assign(request.params.orderId, request.body, actor(request)) });
export const updateTask = async (request, response) => response.json({ data: await orderProcessingService.update(request.params.orderId, request.body, actor(request)) });
