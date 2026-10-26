import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, closeDatabase } from '../src/config/database.js';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const databaseRoot = path.join(backendRoot, 'database');
const requestedPath = process.argv[2];

const fail = (message) => {
  console.error(message);
  process.exitCode = 1;
};

if (!requestedPath) {
  fail('Usage: node scripts/run-sql-file.js <path under database/>');
} else {
  const sqlPath = path.resolve(backendRoot, requestedPath);
  const relative = path.relative(databaseRoot, sqlPath);

  if (relative.startsWith('..') || path.isAbsolute(relative) || path.extname(sqlPath).toLowerCase() !== '.sql') {
    fail('Only .sql files inside Backend/database may be executed');
  } else {
    let client;
    try {
      const sql = await fs.readFile(sqlPath, 'utf8');
      client = await pool.connect();
      const database = await client.query('SELECT current_database() AS name');
      console.log(`Database: ${database.rows[0].name}`);
      console.log(`Executing: database/${relative.replaceAll('\\', '/')}`);

      const result = await client.query(sql);
      const results = Array.isArray(result) ? result : [result];
      results.forEach((item, index) => {
        if (item.command === 'SELECT' && item.rows.length > 0) {
          console.log(`Result ${index + 1}: ${item.rowCount} row(s)`);
          console.table(item.rows);
        }
      });
      console.log('SQL file completed successfully.');
    } catch (error) {
      if (client) {
        try { await client.query('ROLLBACK'); } catch {}
      }
      console.error('SQL file failed.');
      console.error(`Code: ${error.code || 'UNKNOWN'}`);
      console.error(`Message: ${error.message}`);
      if (error.hint) console.error(`Hint: ${error.hint}`);
      process.exitCode = 1;
    } finally {
      client?.release();
    }
  }
}

await closeDatabase();
