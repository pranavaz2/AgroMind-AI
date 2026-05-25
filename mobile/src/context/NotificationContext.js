import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { useAuth } from './AuthContext';
import {
  getNotificationPermissionStatus,
  registerBackgroundNotificationTask,
  registerForPushNotificationsAsync,
  scheduleDailyFarmingReminder,
  syncPushTokenWithBackend,
  unregisterPushToken,
} from '../services/notificationService';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [expoPushToken, setExpoPushToken] = useState(null);
  const [permissionStatus, setPermissionStatus] = useState('undetermined');
  const [lastNotification, setLastNotification] = useState(null);
  const responseListener = useRef(null);
  const receivedListener = useRef(null);

  useEffect(() => {
    getNotificationPermissionStatus()
      .then(setPermissionStatus)
      .catch(() => setPermissionStatus('undetermined'));
  }, []);

  useEffect(() => {
    receivedListener.current = Notifications.addNotificationReceivedListener((notification) => {
      setLastNotification(notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      setLastNotification(response.notification);
    });

    return () => {
      receivedListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function enableNotifications() {
      if (!isAuthenticated) {
        if (expoPushToken) {
          await unregisterPushToken(expoPushToken).catch(() => null);
        }
        if (isMounted) setExpoPushToken(null);
        return;
      }

      try {
        await registerBackgroundNotificationTask().catch((error) => {
          console.warn('Background notification setup skipped:', error.message);
        });
        const result = await registerForPushNotificationsAsync();
        if (!isMounted) return;

        setPermissionStatus(result.granted ? 'granted' : 'denied');
        setExpoPushToken(result.token || null);

        if (result.token) {
          await syncPushTokenWithBackend(result.token);
          await scheduleDailyFarmingReminder();
        }
      } catch (error) {
        console.warn('Notification setup failed:', error.message);
      }
    }

    enableNotifications();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated]);

  const value = useMemo(
    () => ({
      expoPushToken,
      lastNotification,
      permissionStatus,
      isPermissionGranted: permissionStatus === 'granted',
    }),
    [expoPushToken, lastNotification, permissionStatus]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
