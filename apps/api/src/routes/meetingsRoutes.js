const express = require('express');
const meetingsController = require('../controllers/meetingsController');
const authMiddleware = require('../middleware/authMiddleware');
const { validateCreateMeeting } = require('../validators/meetingValidator');

const router = express.Router();

router.post('/', authMiddleware, validateCreateMeeting, meetingsController.create);
router.get('/', authMiddleware, meetingsController.list);
router.get('/:id', authMiddleware, meetingsController.getById);
router.get('/:id/messages', authMiddleware, require('../controllers/chatController').listByMeeting);
router.post('/:id/messages', authMiddleware, require('../controllers/chatController').createMessage);

module.exports = router;
