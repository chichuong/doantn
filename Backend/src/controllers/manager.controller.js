import * as managerService from '../services/manager.service.js';

export const dashboard = async (request, response) => response.json({ data: await managerService.dashboard(request.query) });
export const listProducts = async (request, response) => response.json(await managerService.products(request.query));
export const createProduct = async (request, response) => response.status(201).json({ data: await managerService.addProduct(request.body) });
export const updateProduct = async (request, response) => response.json({ data: await managerService.editProduct(request.params.productId, request.body) });
export const listWarehouses = async (request, response) => response.json({ data: await managerService.warehouses() });
export const createWarehouse = async (request, response) => response.status(201).json({ data: await managerService.addWarehouse(request.body) });
export const updateWarehouse = async (request, response) => response.json({ data: await managerService.editWarehouse(request.params.warehouseId, request.body) });
export const listInventory = async (request, response) => response.json(await managerService.inventory(request.query));
export const listInventoryDiscrepancies = async (request, response) => response.json(await managerService.inventoryDiscrepancies(request.query));
export const listInventoryTransactions = async (request, response) => response.json(await managerService.inventoryTransactions(request.query));
export const listInventoryReservations = async (request, response) => response.json(await managerService.inventoryReservations(
  request.params.warehouseId, request.params.productId, request.query
));
export const adjustInventory = async (request, response) => response.status(201).json({ data: await managerService.adjustStock(request.body, request.user.id) });
export const listOrders = async (request, response) => response.json(await managerService.orders(request.query));
export const cancelOrder = async (request, response) => response.json({ data: await managerService.cancelOrder(request.params.orderId, request.body, request.user.id) });
export const salesReport = async (request, response) => response.json({ data: await managerService.salesReport(request.query) });
