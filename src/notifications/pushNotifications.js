/**
 * pushNotifications.js
 *
 * iOS push notification setup via expo-notifications + Expo Push Service.
 *
 * WHAT THIS DOES
 * --------------
 *   1. Configures how notifications appear while the app is open
 *   2. Requests APNs permission and fetches an Expo push token
 *   3. Persists the token locally so a future backend can target this device
 *   4. Wires foreground / tap listeners
 *
 * WHAT YOU STILL NEED (outside the repo)
 * --------------------------------------
 *   - A physical iPhone (simulators are unreliable for push)
 *   - An APNs key uploaded to Expo:  eas credentials  (or Expo dashboard)
 *   - Re-run native prebuild after app.json plugin changes:
 *       npx expo prebuild --platform ios --clean
 *
 * Sending a test push (once the token is registered):
 *   curl -X POST https://exp.host/--/api/v2/push/send \
 *     -H "Content-Type: application/json" \
 *     -d '{"to":"ExponentPushToken[...]","title":"Hello","body":"From TheStampO"}'
 */

import { Platform, Linking } from 'react-native';
import Constants from 'expo-constants';

import {
  getStoredPushToken,
  savePushToken,
  clearPushToken,
} from '../data/notificationStore';

let Notifications = null;
let Device = null;

try {
  // eslint-disable-next-line global-require
  Notifications = require('expo-notifications');
} catch (e) {
  Notifications = null;
}

try {
  // eslint-disable-next-line global-require
  Device = require('expo-device');
} catch (e) {
  Device = null;
}

export const IS_PUSH_AVAILABLE = !!Notifications;

const PROJECT_ID =
  Constants?.expoConfig?.extra?.eas?.projectId ??
  Constants?.easConfig?.projectId ??
  null;

/** Configure foreground presentation. Safe to call on every cold start. */
export function configureNotificationHandler() {
  if (!Notifications) return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/** 'granted' | 'denied' | 'undetermined' | 'unavailable' */
export async function getPushPermissionStatus() {
  if (!Notifications || Platform.OS !== 'ios') return 'unavailable';

  const settings = await Notifications.getPermissionsAsync();
  return settings?.status || 'undetermined';
}

function getProjectId() {
  if (!PROJECT_ID) {
    console.warn(
      '[push] Missing EAS projectId in app.json extra.eas.projectId. ' +
        'Push token registration will fail until it is set.'
    );
    return null;
  }
  return PROJECT_ID;
}

/**
 * Ask for permission and register with APNs via Expo.
 * @returns {Promise<{ok: boolean, token?: string, status?: string, error?: string}>}
 */
export async function registerForPushNotifications() {
  if (!Notifications) {
    return {
      ok: false,
      error: 'expo-notifications is not installed in this build.',
    };
  }

  if (Platform.OS !== 'ios') {
    return { ok: false, error: 'Push is only configured for iOS in this release.' };
  }

  if (Device && !Device.isDevice) {
    return {
      ok: false,
      error: 'Push notifications need a physical iPhone. They do not work on the simulator.',
    };
  }

  const projectId = getProjectId();
  if (!projectId) {
    return {
      ok: false,
      error: 'Missing EAS project ID. Add extra.eas.projectId to app.json.',
    };
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing?.status;

  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
    status = requested?.status;
  }

  if (status !== 'granted') {
    return {
      ok: false,
      status,
      error:
        status === 'denied'
          ? 'Notifications are off. Enable them in Settings → TheStampO → Notifications.'
          : 'Notification permission was not granted.',
    };
  }

  try {
    const tokenResult = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenResult?.data;
    if (!token) {
      return { ok: false, error: 'Could not get a push token from Apple.' };
    }

    await savePushToken(token);
    return { ok: true, token, status };
  } catch (err) {
    const message = err?.message || String(err);
    return {
      ok: false,
      error: message.includes('aps-environment')
        ? 'Push capability is missing from the native build. Re-run: npx expo prebuild --platform ios --clean'
        : `Could not register for push: ${message}`,
    };
  }
}

/** Re-use a saved token when permission is already granted. */
export async function ensurePushRegistration() {
  const status = await getPushPermissionStatus();
  if (status !== 'granted') return { ok: false, status };

  const cached = await getStoredPushToken();
  if (cached) return { ok: true, token: cached, status, cached: true };

  return registerForPushNotifications();
}

export async function unregisterPushNotifications() {
  await clearPushToken();
  return { ok: true };
}

export function openNotificationSettings() {
  return Linking.openSettings().catch(() => {});
}

/**
 * Subscribe to notification events.
 * @returns {() => void} cleanup
 */
export function addNotificationListeners({ onReceive, onResponse } = {}) {
  if (!Notifications) return () => {};

  const subs = [];

  if (onReceive) {
    subs.push(Notifications.addNotificationReceivedListener(onReceive));
  }
  if (onResponse) {
    subs.push(Notifications.addNotificationResponseReceivedListener(onResponse));
  }

  return () => {
    subs.forEach((sub) => {
      try {
        sub.remove();
      } catch (e) {
        /* ignore */
      }
    });
  };
}

/** Dev helper: schedule a local notification to verify permissions/UI. */
export async function scheduleLocalTestNotification() {
  if (!Notifications || Platform.OS !== 'ios') {
    return { ok: false, error: 'Local notifications are only set up for iOS.' };
  }

  const status = await getPushPermissionStatus();
  if (status !== 'granted') {
    const reg = await registerForPushNotifications();
    if (!reg.ok) return reg;
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'TheStampO',
      body: 'Notifications are working on this device.',
      sound: true,
    },
    trigger: { seconds: 2 },
  });

  return { ok: true };
}
