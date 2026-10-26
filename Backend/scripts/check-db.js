import { query, closeDatabase } from '../src/config/database.js';
import { env } from '../src/config/env.js';

if (!env.databaseUrl && !env.dbPassword) {
  console.error('PostgreSQL connection: FAILED');
  console.error('Missing DB_PASSWORD. Copy .env.example to .env and configure PostgreSQL credentials.');
  process.exit(1);
}

try {
  const result = await query('SELECT NOW() AS database_time, current_database() AS database_name');
  console.log('PostgreSQL connection: OK');
  console.log(`Database: ${result.rows[0].database_name}`);
  console.log(`Server time: ${result.rows[0].database_time.toISOString()}`);
} catch (error) {
  console.error('PostgreSQL connection: FAILED');
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
