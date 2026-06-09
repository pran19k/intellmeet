const express = require('express');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const meetingsRoutes = require('./routes/meetingsRoutes');
const { sendError } = require('./utils/http');

const app = express();

app.use(express.json());

// Handle malformed JSON bodies gracefully
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    return sendError(res, 400, 'INVALID_JSON', 'Malformed JSON body', []);
  }
  return next(err);
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'api' });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/meetings', meetingsRoutes);

app.use((req, res) => {
  sendError(res, 404, 'NOT_FOUND', 'Route not found');
});

// Global error handler
app.use((err, req, res, next) => {
  // eslint-disable-next-line no-console
  console.error('Unhandled error:', err && (err.stack || err.message || err));
  const status = err && err.status ? err.status : 500;
  const code = err && err.code ? err.code : 'INTERNAL_ERROR';
  const message = err && err.message ? err.message : 'Internal server error';
  sendError(res, status, code, message, err && err.details ? err.details : []);
});

module.exports = app;
