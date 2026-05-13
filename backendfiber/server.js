const express = require('express');
const mongoose = require('mongoose');
const morgan = require('morgan');
require('dotenv').config();
const connectDatabase = require('./config/database');
const { requireAuth } = require('./middleware/auth');
const {
  buildCorsMiddleware,
  buildApiRateLimit,
  buildAuthRateLimit,
  buildHelmetMiddleware,
  compression,
  hpp,
} = require('./middleware/security');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const apiRequireAuth =
  process.env.API_REQUIRE_AUTH != null
    ? process.env.API_REQUIRE_AUTH === 'true'
    : isProduction;

app.set('trust proxy', process.env.TRUST_PROXY || 1);

// Middleware
app.use(buildHelmetMiddleware());
app.use(buildCorsMiddleware());
app.use(compression());
app.use(hpp());
app.use(buildApiRateLimit());
app.use(morgan(isProduction ? 'combined' : 'dev'));
app.use(express.json({ limit: process.env.REQUEST_BODY_LIMIT || '10mb' }));
app.use(
  express.urlencoded({
    extended: true,
    limit: process.env.REQUEST_BODY_LIMIT || '10mb',
  })
);

// Static files for uploads
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/auth', buildAuthRateLimit(), require('./routes/auth'));

if (apiRequireAuth) {
  app.use('/api/buildings', requireAuth, require('./routes/buildings'));
  app.use('/api/technicians', requireAuth, require('./routes/technicians'));
  app.use('/api/assignments', requireAuth, require('./routes/assignments'));
  app.use('/api/sync', requireAuth, require('./routes/sync'));
  app.use('/api/photos', requireAuth, require('./routes/photos'));
  app.use('/api/items', requireAuth, require('./routes/items'));
  app.use('/api/building-statuses', requireAuth, require('./routes/buildingStatuses'));
  app.use('/api/route-optique', requireAuth, require('./routes/routeOptique'));
  app.use('/api/technical-dossiers', requireAuth, require('./routes/technicalDossiers'));
  app.use('/api/kmz', requireAuth, require('./routes/kmz'));
  app.use('/api/zone-documents', requireAuth, require('./routes/zoneDocuments'));
} else {
  app.use('/api/buildings', require('./routes/buildings'));
  app.use('/api/technicians', require('./routes/technicians'));
  app.use('/api/assignments', require('./routes/assignments'));
  app.use('/api/sync', require('./routes/sync'));
  app.use('/api/photos', require('./routes/photos'));
  app.use('/api/items', require('./routes/items'));
  app.use('/api/building-statuses', require('./routes/buildingStatuses'));
  app.use('/api/route-optique', require('./routes/routeOptique'));
  app.use('/api/technical-dossiers', require('./routes/technicalDossiers'));
  app.use('/api/kmz', require('./routes/kmz'));
  app.use('/api/zone-documents', require('./routes/zoneDocuments'));
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'BackendFiber server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  if (err.message === 'CORS origin denied') {
    return res.status(403).json({ success: false, message: 'Origin not allowed' });
  }
  console.error(err.stack);
  return res.status(500).json({
    success: false,
    message: isProduction ? 'Internal server error' : err.message || 'Something went wrong!',
  });
});

// Handle 404
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

const PORT = process.env.PORT || 8084;

connectDatabase().then(() => {
  app.listen(PORT);
});
