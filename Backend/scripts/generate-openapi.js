import fs from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const ref = name => ({ $ref: `#/components/schemas/${name}` });
const uuid = { type: 'string', format: 'uuid' };
const text = (maxLength = 255) => ({ type: 'string', maxLength });
const integer = (minimum = 0) => ({ type: 'integer', minimum, maximum: 2147483647 });
const object = (properties, required = []) => ({ type: 'object', properties, required });
const schemas = {
  Error: object({ success: { type: 'boolean' }, message: text(), requestId: uuid, details: {} }, ['success','message']),
  Login: object({ email: { type: 'string', format: 'email' }, password: text(72) }, ['email','password']),
  Register: object({ email: { type: 'string', format: 'email' }, password: { type: 'string', minLength: 8 }, fullName: text(150), phone: text(30) }, ['email','password','fullName']),
  Category: object({ name: text(120), description: { type: 'string', nullable: true, maxLength: 255 }, isActive: { type: 'boolean' } }, ['name']),
  CategoryUpdate: object({ name: text(120), description: { type: 'string', nullable: true, maxLength: 255 }, isActive: { type: 'boolean' } }),
  WarehouseAccess: object({ warehouseIds: { type: 'array', uniqueItems: true, items: uuid } }, ['warehouseIds']),
  Product: object({ sku: text(60), barcode: text(100), name: text(180), description: text(), categoryId: uuid,
    costPrice: { type: 'number', minimum: 0 }, salePrice: { type: 'number', minimum: 0 }, reorderLevel: integer(), isActive: { type: 'boolean' } }, ['sku','name']),
  Warehouse: object({ code: text(30), name: text(120), address: text(), isActive: { type: 'boolean' } }, ['code','name']),
  StockAdjustment: object({ warehouseId: uuid, productId: uuid, type: { type: 'string', enum: ['receipt','issue','adjustment'] },
    quantity: { type: 'integer', description: 'Signed delta for adjustment; positive for receipt/issue.' }, referenceCode: text(80), note: text() }, ['warehouseId','productId','type','quantity']),
  Address: object({ recipientName: text(150), phone: text(30), addressLine: text(), ward: text(100), district: text(100), province: text(100), isDefault: { type: 'boolean' } }, ['recipientName','phone','addressLine','province']),
  CartItem: object({ productId: uuid, quantity: integer(1) }, ['productId','quantity']),
  Checkout: object({ warehouseId: uuid, addressId: uuid, channel: { type: 'string', enum: ['web','mobile'], default: 'web' }, customerName: text(150), customerPhone: text(30), note: text() }, ['warehouseId']),
  Note: object({ note: text() }),
  OpenSession: object({ warehouseId: uuid, openingCash: { type: 'number', minimum: 0, default: 0 } }, ['warehouseId']),
  CloseSession: object({ closingCash: { type: 'number', minimum: 0 } }, ['closingCash']),
  Sale: object({ sessionId: uuid, customerName: text(150), customerPhone: text(30), paymentMethod: { type: 'string', enum: ['cash','card','transfer'] },
    transactionReference: text(100), items: { type: 'array', minItems: 1, items: ref('CartItem') } }, ['sessionId','paymentMethod','items']),
  VoidSale: object({ reason: text(), refundConfirmed: { type: 'boolean', description: 'Staff confirms actual refund has been performed; required when payment exists.' },
    refundReference: { ...text(100), description: 'Required for card/transfer refunds.' } }, ['reason']),
  WarehouseDocument: object({ documentNumber: text(50), warehouseId: uuid, type: { type: 'string', enum: ['receipt','issue'] },
    supplierName: text(150), referenceCode: text(80), note: text(), items: { type: 'array', minItems: 1,
      items: object({ productId: uuid, quantity: integer(1), unitCost: { type: 'number', minimum: 0 } }, ['productId','quantity']) } }, ['documentNumber','warehouseId','type','items']),
  Pack: object({ warehouseId: { ...uuid, description: 'Optional assertion. Actual warehouse is derived from the order.' } }),
  OrderScan: object({ identifier: text(100), quantity: { ...integer(1), default: 1 }, requestId: { ...uuid, description: 'Unique ID per physical scan; reuse on retry.' } }, ['identifier','requestId']),
  ReturnReceipt: object({ note: text(), items: { type: 'array', minItems: 1, items: object({ orderItemId: uuid, receivedQuantity: integer(1), restockQuantity: integer() }, ['orderItemId','receivedQuantity','restockQuantity']) } }, ['items']),
  AssignOrder: object({ assignedTo: uuid, note: text() }, ['assignedTo']),
  Task: object({ status: { type: 'string', enum: ['picking','ready_to_pack'] }, note: text() }, ['status']),
  Shipment: object({ orderId: uuid, trackingNumber: text(60), assignedTo: uuid, carrier: text(100), note: text() }, ['orderId','trackingNumber','assignedTo']),
  ShipmentStatus: object({ status: { type: 'string', enum: ['picked_up','in_transit','delivered','failed','returned'] }, note: text() }, ['status']),
  Transfer: object({ bankReference: text(100), note: text() }, ['bankReference']),
  TransferReview: object({ decision: { type: 'string', enum: ['confirmed','rejected'] }, bankReference: text(100), receivedAmount: { type: 'string', pattern: '^\\d+(\\.\\d{1,2})?$', description: 'Required for confirmed. Must match order total.' }, reviewNote: text() }, ['decision']),
  Refund: object({ bankReference: text(100), note: text() }, ['bankReference']),
  ForecastRun: object({ model: { type: 'string', enum: ['baseline','python'], default: 'baseline' }, productId: uuid, warehouseId: uuid,
    fromDate: { type: 'string', format: 'date' }, toDate: { type: 'string', format: 'date' }, lookbackDays: { type: 'integer', minimum: 7, maximum: 365 }, horizonDays: { type: 'integer', minimum: 1, maximum: 30 } }),
  User: object({ email: { type: 'string', format: 'email' }, password: text(72), fullName: text(150), phone: text(30), roleId: uuid }, ['email','password','fullName','roleId']),
  UserUpdate: object({ fullName: text(150), phone: text(30), roleId: uuid, status: { type: 'string', enum: ['active','inactive','locked'] } }),
  Role: object({ code: text(50), name: text(100), description: text() }, ['code','name']),
  RoleUpdate: object({ name: text(100), description: text() }),
  RolePermissions: object({ permissionIds: { type: 'array', uniqueItems: true, items: uuid } }, ['permissionIds'])
};
const bodySchemas = {
  'post /auth/login': 'Login', 'post /auth/register': 'Register', 'post /auth/users': 'User', 'patch /auth/users/{userId}': 'UserUpdate',
  'post /auth/roles': 'Role', 'patch /auth/roles/{roleId}': 'RoleUpdate', 'put /auth/roles/{roleId}/permissions': 'RolePermissions',
  'put /auth/users/{userId}/warehouses': 'WarehouseAccess',
  'post /manager/categories': 'Category', 'patch /manager/categories/{categoryId}': 'CategoryUpdate',
  'post /manager/products': 'Product', 'patch /manager/products/{productId}': 'Product',
  'post /manager/warehouses': 'Warehouse', 'patch /manager/warehouses/{warehouseId}': 'Warehouse',
  'post /manager/inventory/adjustments': 'StockAdjustment',
  'post /manager/orders/{orderId}/cancel': 'Note',
  'put /customer/cart/items': 'CartItem', 'post /customer/addresses': 'Address', 'post /customer/checkout': 'Checkout',
  'post /customer/orders/{orderId}/cancel': 'Note',
  'post /pos/sessions/open': 'OpenSession', 'post /pos/sessions/{sessionId}/close': 'CloseSession', 'post /pos/sales': 'Sale', 'post /pos/sales/{saleId}/void': 'VoidSale',
  'post /warehouse/documents': 'WarehouseDocument', 'post /warehouse/orders/{orderId}/pack': 'Pack',
  'post /warehouse/documents/{documentId}/scan': 'OrderScan',
  'post /warehouse/orders/{orderId}/scan': 'OrderScan', 'post /warehouse/orders/{orderId}/return-receipt': 'ReturnReceipt',
  'post /order-processing/orders/{orderId}/confirm': 'Note', 'post /order-processing/orders/{orderId}/assign': 'AssignOrder', 'patch /order-processing/orders/{orderId}/task': 'Task',
  'post /shipping/shipments': 'Shipment', 'patch /shipping/shipments/{shipmentId}/status': 'ShipmentStatus',
  'post /payments/orders/{orderId}/transfers': 'Transfer', 'post /payments/transfers/{requestId}/review': 'TransferReview',
  'post /payments/orders/{orderId}/refund': 'Refund', 'post /forecasting/runs': 'ForecastRun'
};
// PATCH must not inherit the required create fields.
schemas.ProductUpdate = { ...schemas.Product, required: [] };
schemas.WarehouseUpdate = { ...schemas.Warehouse, required: [] };
schemas.AddressUpdate = { ...schemas.Address, required: [] };
bodySchemas['patch /customer/addresses/{addressId}'] = 'AddressUpdate';
bodySchemas['patch /manager/products/{productId}'] = 'ProductUpdate';
bodySchemas['patch /manager/warehouses/{warehouseId}'] = 'WarehouseUpdate';
const queryParam = (name, schema = text(), required = false) => ({ name, in: 'query', required, schema });
const paramsFor = (path, method) => {
  const params = [];
  if (method === 'get' && !path.includes('{') && !/lookup|scan|health|dashboard|alerts|reports|export|sessions\/current|auth\/me|auth\/roles|auth\/permissions|warehouses$/.test(path)) {
    params.push(queryParam('page', { type: 'integer', minimum: 1, default: 1 }), queryParam('limit', { type: 'integer', minimum: 1, maximum: 100, default: 20 }));
  }
  if (/products$|catalog$|categories$|auth\/users$/.test(path) && method === 'get') params.push(queryParam('search'));
  if (/products$|catalog$/.test(path) && method === 'get') params.push(queryParam('categoryId', uuid));
  if (/manager\/(products|categories)$/.test(path) && method === 'get') params.push(queryParam('isActive', { type: 'boolean' }));
  if (/orders$|sales$|documents$|shipments$|payments\/transfers$/.test(path) && method === 'get') params.push(queryParam('status'));
  if (/warehouse\/(scan|documents|orders)$|order-processing\/orders$|pos\/products\/lookup$|manager\/inventory$/.test(path) && method === 'get') {
    params.push(queryParam('warehouseId', { ...uuid, description: 'Required for warehouse/order_processor/sales staff; must be assigned to the user.' }));
  }
  if (/manager\/inventory\/(discrepancies|transactions)$/.test(path) && method === 'get') {
    params.push(queryParam('warehouseId', uuid), queryParam('productId', uuid));
  }
  if (path === '/manager/inventory/transactions' && method === 'get') {
    params.push(queryParam('type', { type: 'string', enum: ['receipt','issue','adjustment'] }),
      queryParam('referenceCode', text(80)), queryParam('from', { type: 'string', format: 'date' }),
      queryParam('to', { type: 'string', format: 'date' }));
  }
  if (path.endsWith('/reservations') && method === 'get') {
    params.push(queryParam('page', { type: 'integer', minimum: 1, default: 1 }),
      queryParam('limit', { type: 'integer', minimum: 1, maximum: 100, default: 20 }),
      queryParam('status', { type: 'string', enum: ['active','consumed','released'] }));
  }
  if (path.endsWith('/scan') || path.endsWith('/lookup')) params.push(queryParam('identifier', text(100), true));
  if (/dashboard|reports|manager\/orders$|pos\/sales$/.test(path) && method === 'get') params.push(queryParam('from', { type: 'string', format: 'date' }), queryParam('to', { type: 'string', format: 'date' }));
  if (path === '/forecasting/alerts') params.push(queryParam('runId', uuid, true), queryParam('warehouseId', uuid), queryParam('fromDate', { type: 'string', format: 'date' }), queryParam('toDate', { type: 'string', format: 'date' }));
  return params;
};
const appSource = await fs.readFile(new URL('src/app.js', root), 'utf8');
const imports = new Map([...appSource.matchAll(/import (\w+) from '\.\/routes\/([^']+)';/g)].map(m => [m[1], m[2]]));
const paths = {};
for (const mount of appSource.matchAll(/app\.use\('\/api\/v1\/([^']+)', (\w+)\)/g)) {
  const routeFile = imports.get(mount[2]);
  if (!routeFile) continue;
  const source = await fs.readFile(new URL(`src/routes/${routeFile}`, root), 'utf8');
  for (const match of source.matchAll(/router\.(get|post|put|patch|delete)\('([^']+)'/g)) {
    const method = match[1], path = `/${mount[1]}${match[2] === '/' ? '' : match[2]}`.replace(/:(\w+)/g, '{$1}');
    const publicRoute = mount[1] === 'catalog' || mount[1] === 'health' || /\/auth\/(login|register)$/.test(path);
    const schemaName = bodySchemas[`${method} ${path}`];
    const parameters = [...path.matchAll(/\{(\w+)\}/g)].map(m => ({ name: m[1], in: 'path', required: true,
      schema: m[1].endsWith('Id') ? uuid : { type: 'string' } }));
    parameters.push(...paramsFor(path, method));
    const operation = { tags: [mount[1]], operationId: `${method}_${path.replace(/[^a-zA-Z0-9]+/g, '_')}`,
      summary: `${method.toUpperCase()} ${path}`, security: publicRoute ? [] : [{ bearerAuth: [] }], parameters,
      responses: { '200': { description: 'Success; response body uses data or data + pagination.' },
        '400': { description: 'Invalid input', content: { 'application/json': { schema: ref('Error') } } },
        '401': { description: 'Authentication required' }, '403': { description: 'Permission, assignment or warehouse scope denied' },
        '404': { description: 'Resource not found' }, '409': { description: 'Duplicate request with different input, stock conflict or invalid state transition' } } };
    if (schemaName) operation.requestBody = { required: !['Pack','Note'].includes(schemaName), content: { 'application/json': { schema: ref(schemaName) } } };
    if (method === 'post' && !path.endsWith('/login')) operation.responses['201'] = { description: 'Resource created where applicable.' };
    if (['/customer/checkout','/pos/sales'].includes(path) && method === 'post') {
      parameters.push({ name: 'Idempotency-Key', in: 'header', required: false, schema: { type: 'string', maxLength: 120, pattern: '^[A-Za-z0-9._:-]+$' },
        description: 'Reuse for retries of the same action. Different input with the same key returns 409. Use a new key for a new cart/sale.' });
    }
    if (path.includes('/data-exchange/import/')) {
      operation.requestBody = { required: true, content: { 'multipart/form-data': { schema: object({ file: { type: 'string', format: 'binary' }, warehouseId: uuid }, ['file']) } } };
      parameters.find(p => p.name === 'dataType').schema = { type: 'string', enum: ['categories','products','inventory'] };
      operation.responses['422'] = { description: 'Atomic import rejected; response includes errors, errorDetails and job. No row was committed.' };
    }
    if (path.includes('/data-exchange/export/')) {
      parameters.find(p => p.name === 'dataType').schema = { type: 'string', enum: ['categories','products','inventory','orders','sales'] };
      parameters.push(queryParam('format', { type: 'string', enum: ['xlsx','csv'], default: 'xlsx' }), queryParam('warehouseId', uuid),
        queryParam('from', { type: 'string', format: 'date' }), queryParam('to', { type: 'string', format: 'date' }));
      operation.responses['200'] = { description: 'Downloaded spreadsheet.', content: { 'text/csv': { schema: { type: 'string', format: 'binary' } },
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { schema: { type: 'string', format: 'binary' } } } };
    }
    paths[path] ??= {};
    paths[path][method] = operation;
  }
}
const spec = { openapi: '3.0.3', info: { title: 'Omnichannel Retail Backend', version: '1.2.0',
  description: 'Shared Web/Flutter API. Run migrations 001–017 before using this version. Orders use the centralized state machine; fulfillment consumes reservations at packed. Transfers require manual bank reconciliation. See docs/implementation-progress.md for migration and workflow requirements.' },
  servers: [{ url: '/api/v1' }], paths, components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } }, schemas } };
await fs.writeFile(new URL('docs/openapi.json', root), JSON.stringify(spec, null, 2) + '\n');
console.log(`OpenAPI generated: ${Object.values(paths).reduce((n, path) => n + Object.keys(path).length, 0)} operations`);
