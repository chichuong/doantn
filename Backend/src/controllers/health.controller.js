import { getSystemHealth } from '../services/health.service.js';

export const healthCheck = async (request, response, next) => {
  try {
    const health = await getSystemHealth();
    response.status(200).json(health);
  } catch (error) {
    next(error);
  }
};
