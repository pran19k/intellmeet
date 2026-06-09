module.exports = function (mongoose) {
  const Schema = mongoose.Schema;

  const RefreshTokenSchema = new Schema({
    token: { type: String, required: true, index: true, unique: true },
    userId: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: false },
    createdAt: { type: Date, default: Date.now },
  });

  // TTL index: expire tokens at `expiresAt` if set
  RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

  return mongoose.models.RefreshToken || mongoose.model('RefreshToken', RefreshTokenSchema);
};
