const { prisma } = require('../config/db');
const AppError = require('../utils/AppError');
const { getCurrentWeather } = require('./weatherService');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const VALID_TYPES = new Set([
  'WEATHER_ALERT',
  'DISEASE_ALERT',
  'FARMING_REMINDER',
  'SCAN_COMPLETION',
]);

function isExpoPushToken(token) {
  return typeof token === 'string' && /^Expo(nent)?PushToken\[[\w-]+\]$/.test(token);
}

function normalizeNotificationData(data = {}) {
  return Object.entries(data).reduce((acc, [key, value]) => {
    if (value !== undefined && value !== null) acc[key] = value;
    return acc;
  }, {});
}

async function registerToken({ userId, token, platform, deviceName }) {
  if (!isExpoPushToken(token)) {
    throw new AppError('A valid Expo push token is required.', 400);
  }

  const savedToken = await prisma.notificationToken.upsert({
    where: { token },
    update: {
      userId,
      platform: platform || null,
      deviceName: deviceName || null,
      lastUsedAt: new Date(),
    },
    create: {
      userId,
      token,
      platform: platform || null,
      deviceName: deviceName || null,
    },
  });

  return {
    id: savedToken.id,
    token: savedToken.token,
    platform: savedToken.platform,
    deviceName: savedToken.deviceName,
  };
}

async function unregisterToken({ userId, token }) {
  if (!token) return { removed: 0 };

  const result = await prisma.notificationToken.deleteMany({
    where: { userId, token },
  });

  return { removed: result.count };
}

async function createReminder({ userId, title, body, scheduledFor, isRecurring = false, recurrenceRule = null }) {
  if (!title || !body || !scheduledFor) {
    throw new AppError('Title, body, and scheduledFor are required.', 400);
  }

  const date = new Date(scheduledFor);
  if (Number.isNaN(date.getTime())) {
    throw new AppError('scheduledFor must be a valid date.', 400);
  }

  const reminder = await prisma.farmingReminder.create({
    data: {
      userId,
      title,
      body,
      scheduledFor: date,
      isRecurring: Boolean(isRecurring),
      recurrenceRule: recurrenceRule || null,
    },
  });

  return reminder;
}

async function getReminders(userId) {
  return prisma.farmingReminder.findMany({
    where: { userId },
    orderBy: { scheduledFor: 'asc' },
  });
}

async function saveNotification({ userId, type, title, body, data }) {
  if (!VALID_TYPES.has(type)) {
    throw new AppError('Invalid notification type.', 400);
  }

  return prisma.notification.create({
    data: {
      userId,
      type,
      title,
      body,
      data: normalizeNotificationData(data),
    },
  });
}

async function sendExpoMessages(messages) {
  if (!messages.length) return [];

  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messages),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new AppError(payload?.errors?.[0]?.message || 'Expo push delivery failed.', 502);
  }

  return payload.data || [];
}

async function sendPushToUser({ userId, type, title, body, data = {} }) {
  const tokens = await prisma.notificationToken.findMany({ where: { userId } });
  const validTokens = tokens.filter(({ token }) => isExpoPushToken(token));

  const notification = await saveNotification({ userId, type, title, body, data });

  if (!validTokens.length) {
    return { notification, tickets: [], delivered: 0 };
  }

  const messages = validTokens.map(({ token }) => ({
    to: token,
    sound: 'default',
    title,
    body,
    data: {
      notificationId: notification.id,
      type,
      ...normalizeNotificationData(data),
    },
  }));

  const tickets = await sendExpoMessages(messages);
  await prisma.notificationToken.updateMany({
    where: { id: { in: validTokens.map((item) => item.id) } },
    data: { lastUsedAt: new Date() },
  });

  return { notification, tickets, delivered: validTokens.length };
}

function buildDiseaseAlert(analysis, scan) {
  if (!analysis || analysis.isHealthy || analysis.diseaseName === 'Healthy') return null;

  const severity = analysis.severity || 'Unknown';
  return {
    type: 'DISEASE_ALERT',
    title: `${analysis.cropName || scan.cropName} disease alert`,
    body: `${analysis.diseaseName || 'Disease detected'} detected with ${severity.toLowerCase()} severity.`,
    data: {
      scanId: scan.id,
      diseaseName: analysis.diseaseName,
      cropName: analysis.cropName || scan.cropName,
      severity,
    },
  };
}

async function notifyScanCompleted({ userId, scan, analysis }) {
  await sendPushToUser({
    userId,
    type: 'SCAN_COMPLETION',
    title: 'Crop scan complete',
    body: scan.status === 'COMPLETED'
      ? `Your ${scan.cropName} scan is ready.`
      : 'Your scan finished, but AI analysis needs a retry.',
    data: { scanId: scan.id, status: scan.status },
  });

  const diseaseAlert = buildDiseaseAlert(analysis, scan);
  if (diseaseAlert) {
    await sendPushToUser({ userId, ...diseaseAlert });
  }
}

async function notifyWeatherAlerts({ userId, latitude, longitude }) {
  const weather = await getCurrentWeather({ latitude, longitude });
  const alerts = weather.insights?.alerts || [];

  for (const alert of alerts.slice(0, 2)) {
    await sendPushToUser({
      userId,
      type: 'WEATHER_ALERT',
      title: alert.title,
      body: alert.message,
      data: {
        alertType: alert.type,
        severity: alert.severity,
        latitude,
        longitude,
      },
    });
  }

  return { weather, sent: alerts.length };
}

async function processDueReminders() {
  const now = new Date();
  const reminders = await prisma.farmingReminder.findMany({
    where: {
      scheduledFor: { lte: now },
      OR: [
        { lastSentAt: null },
        { isRecurring: true },
      ],
    },
    take: 50,
  });

  for (const reminder of reminders) {
    if (reminder.lastSentAt && !reminder.isRecurring) continue;

    await sendPushToUser({
      userId: reminder.userId,
      type: 'FARMING_REMINDER',
      title: reminder.title,
      body: reminder.body,
      data: { reminderId: reminder.id },
    });

    const data = { lastSentAt: now };
    if (reminder.isRecurring && reminder.recurrenceRule === 'DAILY') {
      data.scheduledFor = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    }

    await prisma.farmingReminder.update({
      where: { id: reminder.id },
      data,
    });
  }

  return reminders.length;
}

module.exports = {
  createReminder,
  getReminders,
  notifyScanCompleted,
  notifyWeatherAlerts,
  processDueReminders,
  registerToken,
  sendPushToUser,
  unregisterToken,
};
