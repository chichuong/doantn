import * as forecastingService from '../services/forecasting.service.js';

export const run = async (request, response) => response.status(201).json({ data: await forecastingService.run(request.body, request.user.id) });
export const listRuns = async (request, response) => response.json(await forecastingService.runs(request.query));
export const getRun = async (request, response) => response.json({ data: await forecastingService.getRun(request.params.runId) });
export const alerts = async (request, response) => response.json({ data: await forecastingService.alerts(request.query) });
