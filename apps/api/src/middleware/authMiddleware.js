const authService = require('../services/authService');
const { sendError } = require('../utils/http');

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return sendError(res, 401, 'MISSING_ACCESS_TOKEN', 'Bearer token is required.');
  }

  const result = await authService.getUserFromAccessToken(token);
  if (!result.ok) {
    return sendError(res, result.status, result.code, result.message, result.details);
  }

  req.user = result.data;
  return next();
}

module.exports = authMiddleware;
