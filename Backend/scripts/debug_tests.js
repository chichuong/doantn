import { query, closeDatabase } from '../src/config/database.js';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env.js';
import { randomUUID } from 'node:crypto';

async function debugT15T16() {
  try {
    const adminUser = await query("SELECT u.id, u.email FROM users u JOIN roles r ON r.id = u.role_id WHERE r.code = 'admin' LIMIT 1");
    const token = jwt.sign(
      { sub: adminUser.rows[0].id, email: adminUser.rows[0].email, role: 'admin' },
      env.jwtSecret,
      { expiresIn: '1h' }
    );
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

    const currSession = await fetch('http://localhost:3000/api/v1/pos/sessions/current', { headers });
    const sessData = await currSession.json();
    console.log('Current POS Session:', sessData);

    const whId = sessData.data.warehouse_id;
    console.log('Session Warehouse ID:', whId);

    // Kiểm tra category cho T08
    const cats = await query('SELECT name FROM categories LIMIT 5');
    console.log('Categories:', cats.rows);

  } catch (err) {
    console.error(err);
  } finally {
    await closeDatabase();
  }
}

debugT15T16();
