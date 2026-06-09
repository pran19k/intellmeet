const { mongoose } = require('../db/mongo');
let MeetingModel = null;
try {
  if (mongoose && mongoose.model) {
    MeetingModel = require('../models/meetingModel')(mongoose);
  }
} catch (e) {
  MeetingModel = null;
}

// In-memory fallback
const meetingsById = new Map();
let nextId = 1;

async function createMeeting({ title, description, scheduledAt, duration, settings, host }) {
  if (mongoose && mongoose.connection && mongoose.connection.readyState === 1 && MeetingModel) {
    const doc = await MeetingModel.create({ title, description, scheduledAt, duration, settings, host });
    return { id: doc._id.toString(), title: doc.title, description: doc.description, host: doc.host, scheduledAt: doc.scheduledAt, duration: doc.duration, status: doc.status, settings: doc.settings, participants: doc.participants, aiSummary: doc.aiSummary, recordings: doc.recordings, createdAt: doc.createdAt, updatedAt: doc.updatedAt };
  }

  const meeting = {
    id: String(nextId++),
    title: title || 'Untitled meeting',
    description: description || '',
    host: host || null,
    scheduledAt: scheduledAt || null,
    duration: duration || 30,
    status: 'scheduled',
    settings: settings || { isRecorded: false, allowChat: true, muteOnJoin: true },
    participants: [],
    aiSummary: null,
    recordings: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  meetingsById.set(meeting.id, meeting);
  return meeting;
}

async function listMeetings({ page = 1, limit = 20, status, from, to } = {}) {
  if (mongoose && mongoose.connection && mongoose.connection.readyState === 1 && MeetingModel) {
    const filter = {};
    if (status) filter.status = status;
    if (from || to) filter.scheduledAt = {};
    if (from) filter.scheduledAt.$gte = new Date(from);
    if (to) filter.scheduledAt.$lte = new Date(to);

    const total = await MeetingModel.countDocuments(filter);
    const items = await MeetingModel.find(filter).skip((page - 1) * limit).limit(limit).lean();
    return { items: items.map((d) => ({ ...d, id: d._id.toString() })), total, page, limit };
  }

  let items = Array.from(meetingsById.values());

  if (status) items = items.filter((m) => m.status === status);
  if (from) items = items.filter((m) => m.scheduledAt && m.scheduledAt >= from);
  if (to) items = items.filter((m) => m.scheduledAt && m.scheduledAt <= to);

  const start = (page - 1) * limit;
  const paged = items.slice(start, start + limit);

  return { items: paged, total: items.length, page, limit };
}

async function findById(id) {
  if (mongoose && mongoose.connection && mongoose.connection.readyState === 1 && MeetingModel) {
    const d = await MeetingModel.findById(id).lean();
    return d ? { ...d, id: d._id.toString() } : null;
  }
  return meetingsById.get(String(id)) || null;
}

module.exports = {
  createMeeting,
  listMeetings,
  findById,
};
