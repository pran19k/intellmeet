const authService = require('../services/authService');
const { sendSuccess, sendError } = require('../utils/http');

async function signup(req, res) {
  const result = await authService.signup(req.body || {});
  if (!result.ok) {
    return sendError(res, result.status, result.code, result.message, result.details);
  }
  return sendSuccess(res, result.status, result.data);
}

async function login(req, res) {
  const result = await authService.login(req.body || {});
  if (!result.ok) {
    return sendError(res, result.status, result.code, result.message, result.details);
  }
  return sendSuccess(res, result.status, result.data);
}

async function refresh(req, res) {
  const refreshToken = req.body?.refreshToken;
  const result = await authService.refresh(refreshToken);
  if (!result.ok) {
    return sendError(res, result.status, result.code, result.message, result.details);
  }
  return sendSuccess(res, result.status, result.data);
}

module.exports = {
  signup,
  login,
  refresh,
};
