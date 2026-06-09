const { mongoose } = require('../db/mongo');
let RefreshTokenModel = null;
try {
  if (mongoose && mongoose.model) {
    RefreshTokenModel = require('../models/refreshTokenModel')(mongoose);
  }
} catch (e) {
  RefreshTokenModel = null;
}

// in-memory fallback
const tokens = new Map();

async function saveToken(token, userId, expiresAt = null) {
  if (mongoose && mongoose.connection && mongoose.connection.readyState === 1 && RefreshTokenModel) {
    await RefreshTokenModel.create({ token, userId, expiresAt });
    return true;
  }

  tokens.set(token, { token, userId, expiresAt, createdAt: new Date().toISOString() });
  return true;
}

async function findToken(token) {
  if (mongoose && mongoose.connection && mongoose.connection.readyState === 1 && RefreshTokenModel) {
    const doc = await RefreshTokenModel.findOne({ token }).lean();
    return doc ? { token: doc.token, userId: doc.userId, expiresAt: doc.expiresAt } : null;
  }
  return tokens.get(token) || null;
}

async function deleteToken(token) {
  if (mongoose && mongoose.connection && mongoose.connection.readyState === 1 && RefreshTokenModel) {
    await RefreshTokenModel.deleteOne({ token });
    return true;
  }
  return tokens.delete(token);
}

module.exports = { saveToken, findToken, deleteToken };
