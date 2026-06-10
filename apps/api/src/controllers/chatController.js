const { sendSuccess, sendError } = require('../utils/http');
const { listMessages } = require('../repositories/chatRepository');

const { appendMessage } = require('../repositories/chatRepository');

async function listByMeeting(req, res) {
  const meetingId = req.params.id;
  const limit = Math.min(Number(req.query.limit || 50), 500);
  const since = req.query.since || null;
  try {
    const messages = await listMessages(meetingId, { limit, since });
    return sendSuccess(res, 200, { ok: true, status: 200, data: { items: messages } });
  } catch (err) {
    return sendError(res, 500, 'ERROR', 'Failed to load messages', [err.message || String(err)]);
  }
}

module.exports = { listByMeeting };

async function createMessage(req, res) {
  const meetingId = req.params.id;
  const payload = req.body || {};
  if (!payload.text || String(payload.text).trim().length === 0) return sendError(res, 400, 'EMPTY_MESSAGE', 'Message text is required');
  try {
    const message = {
      meetingId,
      senderId: req.user ? req.user.id : payload.senderId,
      senderName: req.user ? req.user.name || req.user.email : payload.senderName,
      text: String(payload.text),
      timestamp: payload.timestamp || new Date().toISOString(),
    };
    const saved = await appendMessage(message);
    return sendSuccess(res, 201, { ok: true, status: 201, data: saved });
  } catch (err) {
    return sendError(res, 500, 'ERROR', 'Failed to persist message', [err.message || String(err)]);
  }
}

module.exports.createMessage = createMessage;
