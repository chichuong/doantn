import { query, pool } from '../src/config/database.js';
import app from '../src/app.js';

// Simple request helper using native fetch against a running test server or by starting an ephemeral server
import http from 'node:http';

async function main() {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api/v1`;

  const request = async (method, url, { body, token } = {}) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${baseUrl}${url}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  };

  console.log('--- 1. AUTHENTICATING TEST USERS ---');
  // Login warehouse
  const whLogin = await request('POST', '/auth/login', {
    body: { email: 'warehouse@example.com', password: 'Warehouse@123' }
  });
  if (whLogin.status !== 200) throw new Error('Warehouse login failed: ' + JSON.stringify(whLogin.data));
  const whToken = whLogin.data.data.accessToken;
  console.log('✓ Warehouse logged in');

  // Login manager
  const mgrLogin = await request('POST', '/auth/login', {
    body: { email: 'manager@example.com', password: 'Manager@123' }
  });
  if (mgrLogin.status !== 200) throw new Error('Manager login failed: ' + JSON.stringify(mgrLogin.data));
  const mgrToken = mgrLogin.data.data.accessToken;
  console.log('✓ Manager logged in');

  // Login customer
  const custLogin = await request('POST', '/auth/login', {
    body: { email: 'customer@example.com', password: 'Customer@123' }
  });
  const custToken = custLogin.data.data.accessToken;
  console.log('✓ Customer logged in');

  // Login shipper
  const shipLogin = await request('POST', '/auth/login', {
    body: { email: 'shipper@example.com', password: 'Shipper@123' }
  });
  const shipToken = shipLogin.data.data.accessToken;
  console.log('✓ Shipper logged in');

  console.log('\n--- 2. RBAC ACCESS VERIFICATION ---');
  // Customer cannot access warehouse documents
  const custAccess = await request('GET', '/warehouse/documents', { token: custToken });
  if (custAccess.status !== 403) throw new Error(`Expected 403 for customer, got ${custAccess.status}`);
  console.log('✓ Customer forbidden on warehouse documents (403)');

  // Shipper cannot access warehouse documents
  const shipAccess = await request('GET', '/warehouse/documents', { token: shipToken });
  if (shipAccess.status !== 403) throw new Error(`Expected 403 for shipper, got ${shipAccess.status}`);
  console.log('✓ Shipper forbidden on warehouse documents (403)');

  // Warehouse cannot call manager approval route
  const whApproveAttempt = await request('POST', '/manager/documents/00000000-0000-0000-0000-000000000000/approve', { token: whToken });
  if (whApproveAttempt.status !== 403) throw new Error(`Expected 403 for warehouse calling manager approve, got ${whApproveAttempt.status}`);
  console.log('✓ Warehouse staff forbidden on approval endpoint (403)');

  console.log('\n--- 3. INBOUND REQUEST & APPROVAL FLOW ---');
  // Get warehouse and product info
  const whRow = (await query("SELECT id FROM warehouses WHERE code = 'WH-HCM-01'")).rows[0];
  const prodRow = (await query("SELECT id, sku FROM products WHERE is_active = 1 ORDER BY created_at ASC LIMIT 1")).rows[0];
  const initStock = (await query("SELECT quantity, reserved_quantity FROM inventory WHERE warehouse_id = $1 AND product_id = $2", [whRow.id, prodRow.id])).rows[0];
  console.log(`Initial stock for SP-001: ${initStock.quantity} (reserved: ${initStock.reserved_quantity})`);

  // Warehouse creates inbound request
  const createInbound = await request('POST', '/warehouse/documents', {
    token: whToken,
    body: {
      warehouseId: whRow.id,
      type: 'receipt',
      supplierName: 'Nha cung cap An Phat',
      note: 'Yeu cau nhap bo sung 15 binh nuoc',
      items: [{ productId: prodRow.id, quantity: 15, unitCost: 90000 }]
    }
  });
  if (createInbound.status !== 201) throw new Error('Create inbound request failed: ' + JSON.stringify(createInbound.data));
  const inboundDoc = createInbound.data.data;
  console.log(`✓ Inbound request created: ${inboundDoc.document_number}, status = ${inboundDoc.status}`);
  if (inboundDoc.status !== 'pending') throw new Error(`Expected pending status, got ${inboundDoc.status}`);

  // Check inventory has NOT changed yet
  const stockAfterCreate = (await query("SELECT quantity FROM inventory WHERE warehouse_id = $1 AND product_id = $2", [whRow.id, prodRow.id])).rows[0];
  if (Number(stockAfterCreate.quantity) !== Number(initStock.quantity)) throw new Error('Stock changed at request creation!');
  console.log('✓ Inventory unchanged at request creation time');

  // Attempt to complete pending request before approval -> must fail
  const prematureComplete = await request('POST', `/warehouse/documents/${inboundDoc.id}/complete`, { token: whToken });
  if (prematureComplete.status !== 409) throw new Error(`Expected 409 for premature completion, got ${prematureComplete.status}`);
  console.log('✓ Completing unapproved document blocked (409)');

  // Manager approves inbound request
  const approveRes = await request('POST', `/manager/documents/${inboundDoc.id}/approve`, { token: mgrToken });
  if (approveRes.status !== 200) throw new Error('Approval failed: ' + JSON.stringify(approveRes.data));
  const approvedDoc = approveRes.data.data;
  console.log(`✓ Request approved by Manager. Status = ${approvedDoc.status}, QR Code = ${approvedDoc.qr_code}`);
  if (approvedDoc.status !== 'approved' || !approvedDoc.qr_code) throw new Error('Document not properly approved');

  // Warehouse staff scans QR / looks up document
  const qrLookup = await request('GET', `/warehouse/documents/lookup/${encodeURIComponent(approvedDoc.qr_code)}`, { token: whToken });
  if (qrLookup.status !== 200) throw new Error('QR lookup failed: ' + JSON.stringify(qrLookup.data));
  console.log(`✓ Document verified via QR scan: ${qrLookup.data.data.document_number}`);

  // Warehouse staff receives goods and completes with actual quantity = 15
  const completeRes = await request('POST', `/warehouse/documents/${inboundDoc.id}/complete`, {
    token: whToken,
    body: {
      items: [{ productId: prodRow.id, actualQuantity: 15 }]
    }
  });
  if (completeRes.status !== 200) throw new Error('Complete document failed: ' + JSON.stringify(completeRes.data));
  const completedDoc = completeRes.data.data;
  console.log(`✓ Document completed: status = ${completedDoc.status}`);

  // Check inventory has increased by exactly 15
  const stockAfterComplete = (await query("SELECT quantity FROM inventory WHERE warehouse_id = $1 AND product_id = $2", [whRow.id, prodRow.id])).rows[0];
  const expectedStock = Number(initStock.quantity) + 15;
  if (Number(stockAfterComplete.quantity) !== expectedStock) {
    throw new Error(`Expected stock ${expectedStock}, got ${stockAfterComplete.quantity}`);
  }
  console.log(`✓ Inventory updated accurately: ${initStock.quantity} -> ${stockAfterComplete.quantity} (+15)`);

  // Attempt duplicate completion -> idempotent / safe
  const dupComplete = await request('POST', `/warehouse/documents/${inboundDoc.id}/complete`, { token: whToken });
  const stockAfterDup = (await query("SELECT quantity FROM inventory WHERE warehouse_id = $1 AND product_id = $2", [whRow.id, prodRow.id])).rows[0];
  if (Number(stockAfterDup.quantity) !== expectedStock) throw new Error('Inventory double-incremented on duplicate completion!');
  console.log('✓ Idempotency verified: duplicate completion did not alter inventory');

  console.log('\n--- 4. OUTBOUND FLOW & STOCK VALIDATION ---');
  // Warehouse creates outbound request for 5 units
  const createOutbound = await request('POST', '/warehouse/documents', {
    token: whToken,
    body: {
      warehouseId: whRow.id,
      type: 'issue',
      note: 'Yeu cau xuat 5 binh nuoc',
      items: [{ productId: prodRow.id, quantity: 5, unitCost: 90000 }]
    }
  });
  const outboundDoc = createOutbound.data.data;
  console.log(`✓ Outbound request created: ${outboundDoc.document_number}`);

  // Manager approves outbound
  const approvedOutRes = await request('POST', `/manager/documents/${outboundDoc.id}/approve`, { token: mgrToken });
  const approvedOutDoc = approvedOutRes.data.data;
  console.log('✓ Outbound request approved');

  // Warehouse staff scans QR before completing outbound
  const qrOutLookup = await request('GET', `/warehouse/documents/lookup/${encodeURIComponent(approvedOutDoc.qr_code)}`, { token: whToken });
  if (qrOutLookup.status !== 200) throw new Error('Outbound QR lookup failed');
  console.log(`✓ Outbound document verified via QR scan: ${qrOutLookup.data.data.document_number}`);

  // Attempt to dispatch more than approved (say 10 units when approved was 5) -> must be blocked
  const exceedRes = await request('POST', `/warehouse/documents/${outboundDoc.id}/complete`, {
    token: whToken,
    body: {
      items: [{ productId: prodRow.id, actualQuantity: 10 }]
    }
  });
  if (exceedRes.status !== 409) throw new Error(`Expected 409 for exceeding approved quantity, got ${exceedRes.status}`);
  console.log('✓ Dispatch exceeding approved quantity rejected (409)');

  // Complete outbound with actual quantity = 5
  const completeOutbound = await request('POST', `/warehouse/documents/${outboundDoc.id}/complete`, {
    token: whToken,
    body: {
      items: [{ productId: prodRow.id, actualQuantity: 5 }]
    }
  });
  if (completeOutbound.status !== 200) throw new Error('Complete outbound failed: ' + JSON.stringify(completeOutbound.data));
  const finalStock = (await query("SELECT quantity FROM inventory WHERE warehouse_id = $1 AND product_id = $2", [whRow.id, prodRow.id])).rows[0];
  const expectedFinal = expectedStock - 5;
  if (Number(finalStock.quantity) !== expectedFinal) throw new Error(`Expected final stock ${expectedFinal}, got ${finalStock.quantity}`);
  console.log(`✓ Outbound completed: inventory decreased accurately ${expectedStock} -> ${finalStock.quantity} (-5)`);

  console.log('\n--- 5. REJECTION WORKFLOW ---');
  // Create another request and reject it
  const createRejectDoc = await request('POST', '/warehouse/documents', {
    token: whToken,
    body: {
      warehouseId: whRow.id,
      type: 'receipt',
      note: 'Yeu cau khong hop le de kiem tra tu choi',
      items: [{ productId: prodRow.id, quantity: 100, unitCost: 90000 }]
    }
  });
  const rejectDocId = createRejectDoc.data.data.id;
  const rejectRes = await request('POST', `/manager/documents/${rejectDocId}/reject`, {
    token: mgrToken,
    body: { reason: 'Nha cung cap het hang, khong the nhap dot nay' }
  });
  if (rejectRes.status !== 200) throw new Error('Reject failed: ' + JSON.stringify(rejectRes.data));
  const rejectedDoc = rejectRes.data.data;
  console.log(`✓ Request rejected: status = ${rejectedDoc.status}, reason = "${rejectedDoc.rejection_reason}"`);

  // Attempting to complete rejected doc -> must fail
  const compRej = await request('POST', `/warehouse/documents/${rejectDocId}/complete`, { token: whToken });
  if (compRej.status !== 409) throw new Error(`Expected 409 for completing rejected document, got ${compRej.status}`);
  console.log('✓ Completing rejected document blocked (409)');

  console.log('\n========================================');
  console.log('🎉 ALL INTEGRATION TESTS PASSED 100%! 🎉');
  console.log('========================================');

  server.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
