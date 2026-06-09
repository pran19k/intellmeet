const meetingService = require('../services/meetingService');
const { sendSuccess, sendError } = require('../utils/http');

async function create(req, res) {
  const result = await meetingService.create(req.body || {}, req.user);
  if (!result.ok) return sendError(res, result.status, result.code || 'ERROR', result.message, result.details || []);
  return sendSuccess(res, result.status, result.data);
}

async function list(req, res) {
  const result = await meetingService.list(req.query || {});
  if (!result.ok) return sendError(res, result.status, result.code || 'ERROR', result.message, result.details || []);
  return res.status(result.status).json(result);
}

async function getById(req, res) {
  const result = await meetingService.getById(req.params.id);
  if (!result.ok) return sendError(res, result.status, result.code || 'ERROR', result.message, result.details || []);
  return res.status(result.status).json(result);
}

module.exports = { create, list, getById };
