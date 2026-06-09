const {
  ACCESS_TOKEN_SECRET,
  REFRESH_TOKEN_SECRET,
  ACCESS_TOKEN_EXPIRES_IN_SECONDS,
  REFRESH_TOKEN_EXPIRES_IN_SECONDS,
} = require('../config/env');
const { createUser, findByEmail, findById } = require('../repositories/userRepository');
const { signToken, verifyToken } = require('../utils/jwt');
const { saveToken, findToken, deleteToken } = require('../repositories/refreshTokenRepository');
const { hashPassword, verifyPassword } = require('../utils/password');


function validateAuthPayload(payload, type) {
  const errors = [];

  if (type === 'signup') {
    if (!payload.name || payload.name.trim().length < 2) {
      errors.push({ field: 'name', message: 'Name must be at least 2 characters.' });
    }
  }

  if (!payload.email || !payload.email.includes('@')) {
    errors.push({ field: 'email', message: 'Valid email is required.' });
  }

  if (!payload.password || payload.password.length < 8) {
    errors.push({ field: 'password', message: 'Password must be at least 8 characters.' });
  }

  return errors;
}

function buildTokens(userId, email, role) {
  const accessToken = signToken(
    { sub: userId, email, role, type: 'access' },
    ACCESS_TOKEN_SECRET,
    ACCESS_TOKEN_EXPIRES_IN_SECONDS
  );

  const refreshToken = signToken(
    { sub: userId, email, role, type: 'refresh' },
    REFRESH_TOKEN_SECRET,
    REFRESH_TOKEN_EXPIRES_IN_SECONDS
  );

  // persist refresh token
  try {
    const expiresAt = REFRESH_TOKEN_EXPIRES_IN_SECONDS ? new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN_SECONDS * 1000) : null;
    // do not await here to keep token creation fast; save in background
    saveToken(refreshToken, userId, expiresAt).catch((e) => console.error('saveToken error', e && e.message));
  } catch (e) {
    // ignore persistence errors for now
    // eslint-disable-next-line no-console
    console.error('Failed to persist refresh token', e && e.message);
  }

  return { accessToken, refreshToken };
}

async function signup(payload) {
  const errors = validateAuthPayload(payload, 'signup');
  if (errors.length > 0) {
    return { ok: false, status: 400, code: 'VALIDATION_ERROR', message: 'Invalid request payload.', details: errors };
  }

  const existingUser = await findByEmail(payload.email);
  if (existingUser) {
    return { ok: false, status: 409, code: 'EMAIL_EXISTS', message: 'Email already registered.', details: [] };
  }

  const user = await createUser({
    name: payload.name.trim(),
    email: payload.email,
    passwordHash: hashPassword(payload.password),
  });

  const tokens = buildTokens(user.id, user.email, user.role);
  return {
    ok: true,
    status: 201,
    data: {
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      ...tokens,
    },
  };
}

async function login(payload) {
  const errors = validateAuthPayload(payload, 'login');
  if (errors.length > 0) {
    return { ok: false, status: 400, code: 'VALIDATION_ERROR', message: 'Invalid request payload.', details: errors };
  }
  const user = await findByEmail(payload.email);
  if (!user || !verifyPassword(payload.password, user.passwordHash)) {
    return { ok: false, status: 401, code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.', details: [] };
  }

  const tokens = buildTokens(user.id, user.email, user.role);
  return {
    ok: true,
    status: 200,
    data: {
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      ...tokens,
    },
  };
}

async function refresh(refreshToken) {
  if (!refreshToken) {
    return { ok: false, status: 401, code: 'MISSING_REFRESH_TOKEN', message: 'Refresh token is required.', details: [] };
  }

  // check persisted token
  const persisted = await findToken(refreshToken);
  if (!persisted) {
    return { ok: false, status: 401, code: 'INVALID_REFRESH_TOKEN', message: 'Refresh token is invalid.', details: [] };
  }

  let payload;
  try {
    payload = verifyToken(refreshToken, REFRESH_TOKEN_SECRET);
  } catch (error) {
    // remove persisted token
    await deleteToken(refreshToken).catch(() => {});
    return { ok: false, status: 401, code: 'INVALID_REFRESH_TOKEN', message: error.message, details: [] };
  }

  const user = await findById(payload.sub);
  if (!user) {
    return { ok: false, status: 401, code: 'USER_NOT_FOUND', message: 'User not found.', details: [] };
  }

  await deleteToken(refreshToken).catch(() => {});
  const tokens = buildTokens(user.id, user.email, user.role);

  return {
    ok: true,
    status: 200,
    data: {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    },
  };
}

async function getUserFromAccessToken(accessToken) {
  if (!accessToken) {
    return { ok: false, status: 401, code: 'MISSING_ACCESS_TOKEN', message: 'Access token is required.', details: [] };
  }

  let payload;
  try {
    payload = verifyToken(accessToken, ACCESS_TOKEN_SECRET);
  } catch (error) {
    return { ok: false, status: 401, code: 'INVALID_ACCESS_TOKEN', message: error.message, details: [] };
  }

  const user = await findById(payload.sub);
  if (!user) {
    return { ok: false, status: 401, code: 'USER_NOT_FOUND', message: 'User not found.', details: [] };
  }

  return {
    ok: true,
    status: 200,
    data: { id: user.id, name: user.name, email: user.email, role: user.role },
  };
}

module.exports = {
  signup,
  login,
  refresh,
  getUserFromAccessToken,
};
