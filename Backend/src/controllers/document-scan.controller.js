import * as service from '../services/document-scan.service.js';
export const check = async (request, response) => response.json({ data: await service.check(request.params.documentId) });
export const scan = async (request, response) => response.json({ data: await service.scan(request.params.documentId, request.body, request.user.id) });
