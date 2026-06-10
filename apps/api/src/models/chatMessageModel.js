const { Schema } = require('mongoose');

const ChatMessageSchema = new Schema({
  meetingId: { type: String, required: true, index: true },
  senderId: { type: String, required: true },
  senderName: { type: String },
  text: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

module.exports = (mongoose) => mongoose.model('ChatMessage', ChatMessageSchema);
