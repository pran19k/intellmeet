const { sendError } = require('../utils/http');

function validateCreateMeeting(req, res, next) {
  const { title, duration, scheduledAt } = req.body || {};
  const errors = [];

  if (!title || String(title).trim().length === 0) {
    errors.push({ field: 'title', message: 'Title is required.' });
  }

  if (duration !== undefined) {
    const d = Number(duration);
    if (Number.isNaN(d) || d <= 0) {
      errors.push({ field: 'duration', message: 'Duration must be a positive number.' });
    }
  }

  if (scheduledAt !== undefined && scheduledAt !== null) {
    const date = Date.parse(scheduledAt);
    if (Number.isNaN(date)) {
      errors.push({ field: 'scheduledAt', message: 'scheduledAt must be a valid ISO date string.' });
    }
  }

  if (errors.length > 0) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid meeting payload', errors);
  }

  return next();
}

module.exports = { validateCreateMeeting };
