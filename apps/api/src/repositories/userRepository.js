const { mongoose } = require('../db/mongo');
let UserModel = null;
try {
  if (mongoose && mongoose.model) {
    UserModel = require('../models/userModel')(mongoose);
  }
} catch (e) {
  UserModel = null;
}

// In-memory fallback
const usersById = new Map();
const usersByEmail = new Map();
let nextId = 1;

async function createUser({ name, email, passwordHash }) {
  const normalizedEmail = email.trim().toLowerCase();
  if (mongoose && mongoose.connection && mongoose.connection.readyState === 1 && UserModel) {
    const user = await UserModel.create({ name, email: normalizedEmail, passwordHash });
    return { id: user._id.toString(), name: user.name, email: user.email, role: user.role, passwordHash: user.passwordHash };
  }

  const user = {
    id: String(nextId++),
    name,
    email: normalizedEmail,
    passwordHash,
    role: 'member',
    createdAt: new Date().toISOString(),
  };

  usersById.set(user.id, user);
  usersByEmail.set(normalizedEmail, user);
  return user;
}

async function findByEmail(email) {
  const normalized = email.trim().toLowerCase();
  if (mongoose && mongoose.connection && mongoose.connection.readyState === 1 && UserModel) {
    const u = await UserModel.findOne({ email: normalized }).lean();
    return u ? { id: u._id.toString(), name: u.name, email: u.email, role: u.role, passwordHash: u.passwordHash } : null;
  }
  return usersByEmail.get(normalized) || null;
}

async function findById(id) {
  if (mongoose && mongoose.connection && mongoose.connection.readyState === 1 && UserModel) {
    const u = await UserModel.findById(id).lean();
    return u ? { id: u._id.toString(), name: u.name, email: u.email, role: u.role, passwordHash: u.passwordHash } : null;
  }
  return usersById.get(String(id)) || null;
}

module.exports = { createUser, findByEmail, findById };
