import { env } from '../config/env.js';
import { AppError } from '../utils/app-error.js';

export const httpSecurity = (request, response, next) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
  const origin = request.get('Origin');
  if (origin && env.corsOrigins.includes(origin)) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.vary('Origin');
    response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Idempotency-Key');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    response.setHeader('Access-Control-Expose-Headers', 'X-Export-Row-Count, X-Request-Id');
  }
  if (request.method === 'OPTIONS') return response.sendStatus(204);
  next();
};

// Per-process protection for the thesis deployment; use shared storage if running multiple replicas.
export const loginRateLimit = () => {
  const attempts = new Map();
  const windowMs = 15 * 60 * 1000;
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of attempts) if (entry.expiresAt <= now) attempts.delete(ip);
  }, 60000);
  timer.unref();
  return (request, response, next) => {
    const now = Date.now();
    const ip = request.ip;
    let entry = attempts.get(ip);
    if (!entry || entry.expiresAt <= now) { entry = { count: 0, expiresAt: now + windowMs }; attempts.set(ip, entry); }
    entry.count += 1;
    if (entry.count > 20) {
      response.setHeader('Retry-After', String(Math.ceil((entry.expiresAt - now) / 1000)));
      return next(new AppError(429, 'Quá nhiều yêu cầu xác thực; vui lòng thử lại sau'));
    }
    next();
  };
};
