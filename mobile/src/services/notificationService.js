import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import apiClient from './apiClient';

const BACKGROUND_NOTIFICATION_TASK = 'AGROMIND_BACKGROUND_NOTIFICATION_TASK';
const DEFAULT_REMINDER_KEY = 'AGROMIND_DEFAULT_DAILY_REMINDER';
const DEFAULT_REMINDER_HOUR = 7;
const DEFAULT_REMINDER_MINUTE = 30;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, ({ data, error }) => {
  if (error) {
    console.warn('Background notification task failed:', error.message);
    return;
  }
  console.log('Background notification received:', data?.notification?.request?.content?.data || {});
});

function getProjectId() {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ||
    Constants.easConfig?.projectId ||
    Constants.manifest2?.extra?.expoClient?.extra?.eas?.projectId
  );
}

export async function configureNotificationChannel() {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('agromind-alerts', {
    name: 'AgroMind Alerts',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#4ADE80',
  });
}

export async function getNotificationPermissionStatus() {
  const settings = await Notifications.getPermissionsAsync();
  return settings.status;
}

export async function requestNotificationPermission() {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted || current.status === 'granted') return current;

  return Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
    },
  });
}

export async function registerForPushNotificationsAsync() {
  await configureNotificationChannel();

  const permission = await requestNotificationPermission();
  if (!permission.granted && permission.status !== 'granted') {
    return { granted: false, token: null };
  }

  if (!Device.isDevice) {
    return { granted: true, token: null, reason: 'Push tokens require a physical device.' };
  }

  const projectId = getProjectId();
  const tokenResult = projectId
    ? await Notifications.getExpoPushTokenAsync({ projectId })
    : await Notifications.getExpoPushTokenAsync();

  return { granted: true, token: tokenResult.data };
}

export async function syncPushTokenWithBackend(token) {
  if (!token) return null;

  const response = await apiClient.post('/notifications/register-token', {
    token,
    platform: Platform.OS,
    deviceName: Device.deviceName || Device.modelName || Platform.OS,
  });

  return response.data.data;
}

export async function unregisterPushToken(token) {
  if (!token) return null;

  const response = await apiClient.delete('/notifications/register-token', {
    data: { token },
  });

  return response.data.data;
}

export async function registerBackgroundNotificationTask() {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_NOTIFICATION_TASK);
  if (!isRegistered) {
    await Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK);
  }
}

export async function scheduleLocalNotification({ title, body, data, seconds = 1 }) {
  const permission = await requestNotificationPermission();
  if (!permission.granted && permission.status !== 'granted') return null;

  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: data || {},
      sound: 'default',
    },
    trigger: {
      channelId: 'agromind-alerts',
      seconds,
    },
  });
}

export async function scheduleDailyFarmingReminder({
  title = 'Farm check reminder',
  body = 'Inspect crop leaves, soil moisture, and irrigation needs today.',
  hour = DEFAULT_REMINDER_HOUR,
  minute = DEFAULT_REMINDER_MINUTE,
} = {}) {
  const permission = await requestNotificationPermission();
  if (!permission.granted && permission.status !== 'granted') return null;

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((item) => item.content?.data?.scheduleKey === DEFAULT_REMINDER_KEY)
      .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier))
  );

  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: { type: 'FARMING_REMINDER', scheduleKey: DEFAULT_REMINDER_KEY },
      sound: 'default',
    },
    trigger: {
      channelId: 'agromind-alerts',
      hour,
      minute,
      repeats: true,
    },
  });
}

export async function scheduleWeatherAlerts(weather) {
  const alerts = weather?.insights?.alerts || [];
  const scheduled = [];

  for (const alert of alerts.slice(0, 2)) {
    const id = await scheduleLocalNotification({
      title: alert.title,
      body: alert.message,
      data: {
        type: 'WEATHER_ALERT',
        alertType: alert.type,
        severity: alert.severity,
      },
      seconds: 2,
    });
    if (id) scheduled.push(id);
  }

  return scheduled;
}

export async function notifyScanCompletion(scanResult) {
  const scan = scanResult?.scan;
  if (!scan) return null;

  return scheduleLocalNotification({
    title: 'Crop scan complete',
    body: scan.status === 'COMPLETED'
      ? `Your ${scan.cropName} scan is ready.`
      : 'Your scan finished, but AI analysis needs a retry.',
    data: {
      type: 'SCAN_COMPLETION',
      scanId: scan.id,
      status: scan.status,
    },
    seconds: 1,
  });
}

export async function notifyDiseaseAlert(scanResult) {
  const scan = scanResult?.scan;
  const analysis = scanResult?.analysis;
  if (!scan || !analysis || analysis.isHealthy || analysis.diseaseName === 'Healthy') return null;

  return scheduleLocalNotification({
    title: `${analysis.cropName || scan.cropName} disease alert`,
    body: `${analysis.diseaseName || 'Disease detected'} detected. Open AgroMind AI for treatment steps.`,
    data: {
      type: 'DISEASE_ALERT',
      scanId: scan.id,
      diseaseName: analysis.diseaseName,
      severity: analysis.severity,
    },
    seconds: 2,
  });
}

export async function createBackendReminder(reminder) {
  const response = await apiClient.post('/notifications/reminders', reminder);
  return response.data.data;
}

export async function triggerBackendWeatherAlerts({ latitude, longitude }) {
  const response = await apiClient.post('/notifications/weather-alerts', {
    latitude,
    longitude,
  });
  return response.data.data;
}
