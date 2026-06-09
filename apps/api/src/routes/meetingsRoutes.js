const express = require('express');
const meetingsController = require('../controllers/meetingsController');
const authMiddleware = require('../middleware/authMiddleware');
const { validateCreateMeeting } = require('../validators/meetingValidator');

const router = express.Router();

router.post('/', authMiddleware, validateCreateMeeting, meetingsController.create);
router.get('/', authMiddleware, meetingsController.list);
router.get('/:id', authMiddleware, meetingsController.getById);

module.exports = router;
