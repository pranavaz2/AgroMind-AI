const express = require('express');
const {
  listReminders,
  registerDevice,
  scheduleReminder,
  sendTest,
  sendWeatherAlerts,
  unregisterDevice,
} = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.post('/register-token', registerDevice);
router.delete('/register-token', unregisterDevice);
router.get('/reminders', listReminders);
router.post('/reminders', scheduleReminder);
router.post('/weather-alerts', sendWeatherAlerts);
router.post('/test', sendTest);

module.exports = router;
