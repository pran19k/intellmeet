const { mongoose } = require('../db/mongo');
let ChatMessageModel = null;
try {
  if (mongoose && mongoose.model) {
    ChatMessageModel = require('../models/chatMessageModel')(mongoose);
  }
} catch (e) {
  ChatMessageModel = null;
}

// in-memory fallback
const messagesByMeeting = new Map();

async function listMessages(meetingId, { limit = 50, since } = {}) {
  if (mongoose && mongoose.connection && mongoose.connection.readyState === 1 && ChatMessageModel) {
    const q = { meetingId };
    if (since) q.timestamp = { $gte: new Date(since) };
    const docs = await ChatMessageModel.find(q).sort({ timestamp: -1 }).limit(limit).lean();
    // return ascending order
    return docs.reverse().map((d) => ({ ...d, id: d._id.toString() }));
  }

  const list = messagesByMeeting.get(String(meetingId)) || [];
  let filtered = list;
  if (since) filtered = filtered.filter((m) => new Date(m.timestamp) >= new Date(since));
  return filtered.slice(-limit);
}

async function appendMessage(message) {
  if (mongoose && mongoose.connection && mongoose.connection.readyState === 1 && ChatMessageModel) {
    const doc = await ChatMessageModel.create(message);
    return { ...doc.toObject(), id: doc._id.toString() };
  }

  const meetingId = String(message.meetingId);
  const cur = messagesByMeeting.get(meetingId) || [];
  const next = [...cur, message].slice(-500);
  messagesByMeeting.set(meetingId, next);
  return message;
}

module.exports = { listMessages, appendMessage };
