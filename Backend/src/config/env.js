import 'dotenv/config';

const required = (name, fallback) => process.env[name] || fallback;

export const env = {
  nodeEnv: required('NODE_ENV', 'development'),
  port: Number(required('PORT', 3000)),
  databaseUrl: process.env.DATABASE_URL,
  dbHost: required('DB_HOST', 'localhost'),
  dbPort: Number(required('DB_PORT', 5432)),
  dbName: required('DB_NAME', 'omnichannel_retail'),
  dbUser: required('DB_USER', 'postgres'),
  dbPassword: process.env.DB_PASSWORD || '',
  dbSsl: process.env.DB_SSL === 'true',
  dbSslRejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
  dbPoolMax: Number(required('DB_POOL_MAX', 10)),
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: required('JWT_EXPIRES_IN', '8h'),
  bcryptSaltRounds: Number(required('BCRYPT_SALT_ROUNDS', 12)),
  bankName: process.env.BANK_NAME || '',
  bankAccountNumber: process.env.BANK_ACCOUNT_NUMBER || '',
  bankAccountName: process.env.BANK_ACCOUNT_NAME || '',
  bankQrImageUrl: process.env.BANK_QR_IMAGE_URL || '',
  forecastServiceUrl: process.env.FORECAST_SERVICE_URL || '',
  forecastServiceToken: process.env.FORECAST_SERVICE_TOKEN || '',
  forecastTimeoutMs: Number(required('FORECAST_TIMEOUT_MS', 30000)),
  corsOrigins: (process.env.CORS_ORIGINS || '').split(',').map(origin => origin.trim()).filter(Boolean),
  reservationTtlMinutes: Number(required('RESERVATION_TTL_MINUTES', 0))
};

if (!Number.isInteger(env.reservationTtlMinutes) || env.reservationTtlMinutes < 0 || env.reservationTtlMinutes > 10080) {
  throw new Error('RESERVATION_TTL_MINUTES must be an integer from 0 to 10080');
}
if (!Number.isInteger(env.forecastTimeoutMs) || env.forecastTimeoutMs < 1000 || env.forecastTimeoutMs > 60000) {
  throw new Error('FORECAST_TIMEOUT_MS must be an integer from 1000 to 60000');
}
