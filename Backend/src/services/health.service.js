import { query } from '../config/database.js';

export const getSystemHealth = async () => {
  const result = await query('SELECT NOW() AS database_time');

  return {
    status: 'ok',
    database: 'connected',
    databaseTime: result.rows[0].database_time
  };
};
