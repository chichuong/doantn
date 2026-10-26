import * as dataExchangeService from '../services/data-exchange.service.js';

export const importFile = async (request, response) => {
  const result = await dataExchangeService.importFile({ file: request.file, dataType: request.params.dataType, warehouseId: request.body.warehouseId, userId: request.user.id });
  response.status(result.errors.length ? 422 : 201).json(result);
};

export const exportFile = async (request, response) => {
  const result = await dataExchangeService.exportFile({ dataType: request.params.dataType, format: request.query.format || 'xlsx', query: request.query, userId: request.user.id });
  const contentType = result.filename.endsWith('.csv') ? 'text/csv; charset=utf-8' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  response.setHeader('Content-Type', contentType);
  response.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
  response.setHeader('X-Export-Row-Count', String(result.count));
  response.send(result.buffer);
};

export const listJobs = async (request, response) => response.json(await dataExchangeService.jobs(request.query, request.user.id));
