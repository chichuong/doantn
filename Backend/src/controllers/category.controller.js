import * as service from '../services/category.service.js';

export const list = async (request, response) => response.json(await service.list(request.query));
export const create = async (request, response) => response.status(201).json({ data: await service.create(request.body) });
export const update = async (request, response) => response.json({ data: await service.update(request.params.categoryId, request.body) });
