import pg from 'pg';
import { env } from './env.js';

const { Pool } = pg;

const poolConfig = env.databaseUrl
  ? { connectionString: env.databaseUrl }
  : {
      host: env.dbHost,
      port: env.dbPort,
      database: env.dbName,
      user: env.dbUser,
      password: env.dbPassword
    };

export const pool = new Pool({
  ...poolConfig,
  max: env.dbPoolMax,
  ssl: env.dbSsl ? { rejectUnauthorized: env.dbSslRejectUnauthorized } : false
});

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error:', error);
});

export const query = (text, params) => pool.query(text, params);

export const closeDatabase = () => pool.end();
