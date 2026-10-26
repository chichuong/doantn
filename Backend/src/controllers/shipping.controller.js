import * as shippingService from '../services/shipping.service.js';

const actor = (request) => ({ id: request.user.id, role_code: request.user.role_code });

export const create = async (request, response) => response.status(201).json({ data: await shippingService.create(request.body, actor(request)) });
export const list = async (request, response) => response.json(await shippingService.list(request.query, actor(request)));
export const detail = async (request, response) => response.json({ data: await shippingService.detail(request.params.shipmentId, actor(request)) });
export const updateStatus = async (request, response) => response.json({ data: await shippingService.updateStatus(request.params.shipmentId, request.body, actor(request)) });
