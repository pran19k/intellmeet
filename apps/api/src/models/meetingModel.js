const { Schema } = require('mongoose');

const MeetingSchema = new Schema({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  host: { id: String, name: String },
  scheduledAt: { type: Date },
  duration: { type: Number, default: 30 },
  status: { type: String, enum: ['scheduled', 'live', 'ended'], default: 'scheduled' },
  settings: { type: Object, default: {} },
  participants: { type: Array, default: [] },
  aiSummary: { type: Object, default: null },
  recordings: { type: Array, default: [] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = (mongoose) => mongoose.model('Meeting', MeetingSchema);
