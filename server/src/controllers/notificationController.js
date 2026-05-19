const {
  createReminder,
  getReminders,
  notifyWeatherAlerts,
  registerToken,
  sendPushToUser,
  unregisterToken,
} = require('../services/notificationService');
const { sendCreated, sendSuccess } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');

const registerDevice = asyncHandler(async (req, res) => {
  const token = await registerToken({
    userId: req.user.id,
    token: req.body.token,
    platform: req.body.platform,
    deviceName: req.body.deviceName,
  });

  return sendCreated(res, 'Notification token registered.', { token });
});

const unregisterDevice = asyncHandler(async (req, res) => {
  const result = await unregisterToken({
    userId: req.user.id,
    token: req.body.token,
  });

  return sendSuccess(res, 'Notification token removed.', result);
});

const scheduleReminder = asyncHandler(async (req, res) => {
  const reminder = await createReminder({
    userId: req.user.id,
    title: req.body.title,
    body: req.body.body,
    scheduledFor: req.body.scheduledFor,
    isRecurring: req.body.isRecurring,
    recurrenceRule: req.body.recurrenceRule,
  });

  return sendCreated(res, 'Farming reminder scheduled.', { reminder });
});

const listReminders = asyncHandler(async (req, res) => {
  const reminders = await getReminders(req.user.id);
  return sendSuccess(res, 'Farming reminders fetched.', { reminders });
});

const sendWeatherAlerts = asyncHandler(async (req, res) => {
  const result = await notifyWeatherAlerts({
    userId: req.user.id,
    latitude: req.body.latitude,
    longitude: req.body.longitude,
  });

  return sendSuccess(res, 'Weather alert check completed.', result);
});

const sendTest = asyncHandler(async (req, res) => {
  const result = await sendPushToUser({
    userId: req.user.id,
    type: 'FARMING_REMINDER',
    title: req.body.title || 'AgroMind AI notifications are ready',
    body: req.body.body || 'You will now receive weather alerts, reminders, and scan updates.',
    data: { source: 'test' },
  });

  return sendSuccess(res, 'Test notification sent.', result);
});

module.exports = {
  listReminders,
  registerDevice,
  scheduleReminder,
  sendTest,
  sendWeatherAlerts,
  unregisterDevice,
};
