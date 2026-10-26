import * as customerService from '../services/customer.service.js';

export const catalog = async (request, response) => response.json(await customerService.catalog(request.query));
export const getCart = async (request, response) => response.json({ data: await customerService.cart(request.user.id) });
export const addCartItem = async (request, response) => response.status(201).json({ data: await customerService.addCartItem(request.user.id, request.body) });
export const removeCartItem = async (request, response) => response.json({ data: await customerService.deleteCartItem(request.user.id, request.params.productId) });
export const listAddresses = async (request, response) => response.json({ data: await customerService.addresses(request.user.id) });
export const createAddress = async (request, response) => response.status(201).json({ data: await customerService.addAddress(request.user.id, request.body) });
export const updateAddress = async (request, response) => response.json({ data: await customerService.editAddress(request.user.id, request.params.addressId, request.body) });
export const deleteAddress = async (request, response) => response.json({ data: await customerService.removeAddress(request.user.id, request.params.addressId) });
export const checkout = async (request, response) => response.status(201).json({ data: await customerService.createOrder(request.user.id, request.body, request.get('Idempotency-Key')) });
export const listOrders = async (request, response) => response.json(await customerService.orders(request.user.id, request.query));
export const getOrder = async (request, response) => response.json({ data: await customerService.orderDetail(request.user.id, request.params.orderId) });
export const cancelOrder = async (request, response) => response.json({ data: await customerService.cancel(request.user.id, request.params.orderId, request.body.note) });
