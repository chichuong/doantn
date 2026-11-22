import { query, closeDatabase } from '../src/config/database.js';

try {
  const result = await query('SELECT SYSDATETIMEOFFSET() AS database_time, DB_NAME() AS database_name, @@VERSION AS version');
  console.log('SQL Server connection: OK');
  console.log(`Database: ${result.rows[0].database_name}`);
  console.log(`Server time: ${new Date(result.rows[0].database_time).toISOString()}`);
} catch (error) {
  console.error('SQL Server connection: FAILED');
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
