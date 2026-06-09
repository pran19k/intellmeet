const { createMeeting, listMeetings, findById } = require('../repositories/meetingRepository');

function validateMeetingPayload(payload) {
  const errors = [];
  if (!payload.title || String(payload.title).trim().length < 1) {
    errors.push({ field: 'title', message: 'Title is required.' });
  }
  if (payload.duration && typeof payload.duration !== 'number') {
    errors.push({ field: 'duration', message: 'Duration must be a number.' });
  }
  return errors;
}

async function create(payload, hostUser) {
  const errors = validateMeetingPayload(payload);
  if (errors.length > 0) return { ok: false, status: 400, code: 'VALIDATION_ERROR', message: 'Invalid meeting payload', details: errors };

  const meeting = await createMeeting({
    title: payload.title,
    description: payload.description,
    scheduledAt: payload.scheduledAt,
    duration: payload.duration,
    settings: payload.settings,
    host: hostUser ? { id: hostUser.id, name: hostUser.name } : null,
  });

  return { ok: true, status: 201, data: meeting };
  return { ok: true, status: 201, data: meeting };
}

async function list(query) {
  const page = Number(query.page || 1);
  const limit = Math.min(Number(query.limit || 20), 100);
  const status = query.status;
  const from = query.from;
  const to = query.to;

  const result = await listMeetings({ page, limit, status, from, to });
  return { ok: true, status: 200, data: result };
}

async function getById(id) {
  const meeting = await findById(id);
  if (!meeting) return { ok: false, status: 404, code: 'NOT_FOUND', message: 'Meeting not found', details: [] };
  return { ok: true, status: 200, data: meeting };
}

module.exports = { create, list, getById };
