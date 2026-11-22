import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import healthRoutes from './routes/health.routes.js';
import authRoutes from './routes/auth.routes.js';
import managerRoutes from './routes/manager.routes.js';
import warehouseRoutes from './routes/warehouse.routes.js';
import posRoutes from './routes/pos.routes.js';
import customerRoutes from './routes/customer.routes.js';
import shippingRoutes from './routes/shipping.routes.js';
import forecastingRoutes from './routes/forecasting.routes.js';
import orderProcessingRoutes from './routes/order-processing.routes.js';
import dataExchangeRoutes from './routes/data-exchange.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import catalogRoutes from './routes/catalog.routes.js';
import documentationRoutes from './routes/documentation.routes.js';
import { httpSecurity } from './middlewares/http-security.middleware.js';
import { randomUUID } from 'node:crypto';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDistPath = path.resolve(__dirname, '../../Frontend_Web/dist');
const frontendIndexHtml = path.join(frontendDistPath, 'index.html');

const app = express();

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(httpSecurity);
app.use((request, response, next) => {
  request.requestId = randomUUID();
  response.setHeader('X-Request-Id', request.requestId);
  next();
});
app.use(express.json({ limit: '1mb' }));
app.use((request, response, next) => { request.body ??= {}; next(); });
app.use('/api/v1/health', healthRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/manager', managerRoutes);
app.use('/api/v1/warehouse', warehouseRoutes);
app.use('/api/v1/pos', posRoutes);
app.use('/api/v1/customer', customerRoutes);
app.use('/api/v1/shipping', shippingRoutes);
app.use('/api/v1/forecasting', forecastingRoutes);
app.use('/api/v1/order-processing', orderProcessingRoutes);
app.use('/api/v1/data-exchange', dataExchangeRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/catalog', catalogRoutes);
app.use(documentationRoutes);

// Phục vụ tĩnh Frontend Web (Production Build) nếu đã build
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
  app.get(/^\/(?!api\/|docs).*/, (request, response, next) => {
    if (fs.existsSync(frontendIndexHtml)) {
      return response.sendFile(frontendIndexHtml);
    }
    next();
  });
}

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
