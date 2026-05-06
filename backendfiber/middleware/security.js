const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const hpp = require('hpp');
const rateLimit = require('express-rate-limit');

const parseAllowedOrigins = () => {
  const raw = process.env.CORS_ORIGIN || '';
  if (!raw.trim()) {
    return [];
  }
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
};

const buildCorsMiddleware = () => {
  const allowedOrigins = parseAllowedOrigins();

  return cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('CORS origin denied'));
    },
    credentials: process.env.CORS_CREDENTIALS === 'true',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    maxAge: 86400,
  });
};

const buildApiRateLimit = () =>
  rateLimit({
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
    max: Number(process.env.RATE_LIMIT_MAX || 300),
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests, try again later' },
  });

const buildAuthRateLimit = () =>
  rateLimit({
    windowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 10 * 60 * 1000),
    max: Number(process.env.AUTH_RATE_LIMIT_MAX || 10),
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many login attempts, try later' },
  });

const buildHelmetMiddleware = () =>
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
  });

module.exports = {
  buildCorsMiddleware,
  buildApiRateLimit,
  buildAuthRateLimit,
  buildHelmetMiddleware,
  compression,
  hpp,
};
