/**
 * pushNotifications.js
 *
 * Android and iOS push notification setup via expo-notifications + Expo Push
 * Service.
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
 *   - A physical device (remote push does not work reliably on simulators)
 *   - iOS: an APNs key uploaded to Expo (`eas credentials`)
 *   - Android: an FCM V1 service-account key uploaded to EAS
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
  getStoredReminderIds,
  saveReminderIds,
} from '../data/notificationStore';
import { computeStreak, dayKeyOf } from '../utils/streak';

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

const ANDROID_CHANNEL_ID = 'default';
// Two reminders per unstamped day. 28 days keeps the rolling schedule useful
// for an inactive user while remaining below iOS's pending-notification cap.
const REMINDER_DAYS = 28;
const AFTERNOON = { hour: 14, minute: 0 };
const EVENING = { hour: 19, minute: 30 };
const COMPLETE = { hour: 20, minute: 0 };

/** Android 8+ requires a channel; Android 13 creates the permission prompt
 * only after a channel exists. Calling this repeatedly is safe. */
async function ensureAndroidNotificationChannel() {
  if (!Notifications || Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'General notifications',
    description: 'Reminders and updates from TheStampO',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 200, 250],
    lightColor: '#5B2B8A',
    sound: 'default',
  });
}

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

  ensureAndroidNotificationChannel().catch((err) => {
    if (__DEV__) console.warn('[push] Could not create Android channel', err);
  });
}

/** 'granted' | 'denied' | 'undetermined' | 'unavailable' */
export async function getPushPermissionStatus() {
  if (!Notifications) return 'unavailable';

  const settings = await Notifications.getPermissionsAsync();
  return settings?.status || 'undetermined';
}

/** Check and request notification permission using the correct OS behavior. */
export async function requestPushNotificationPermission() {
  if (!Notifications) {
    return {
      ok: false,
      status: 'unavailable',
      error: 'Notifications are not available in this build.',
    };
  }

  try {
    // Android requires a channel before its notification prompt is requested.
    await ensureAndroidNotificationChannel();
    const existing = await Notifications.getPermissionsAsync();

    if (existing?.status === 'granted') {
      return { ok: true, status: 'granted', alreadyGranted: true };
    }

    const androidApi =
      Platform.OS === 'android' ? Number.parseInt(String(Platform.Version), 10) : null;

    // Android 12 and older have no runtime POST_NOTIFICATIONS prompt. When a
    // user has disabled notifications there, only system Settings can restore them.
    if (Platform.OS === 'android' && androidApi < 33) {
      return {
        ok: false,
        status: existing?.status || 'denied',
        blocked: true,
        error: 'Notifications are off for TheStampO. Enable them in system Settings.',
      };
    }

    if (existing?.canAskAgain === false) {
      return {
        ok: false,
        status: existing?.status || 'denied',
        blocked: true,
        error: 'Notifications are off. Enable them in system Settings.',
      };
    }

    const requested = await Notifications.requestPermissionsAsync(
      Platform.OS === 'ios'
        ? {
            ios: {
              allowAlert: true,
              allowBadge: true,
              allowSound: true,
            },
          }
        : undefined
    );

    const status = requested?.status || 'undetermined';
    if (status === 'granted') return { ok: true, status };

    return {
      ok: false,
      status,
      blocked: requested?.canAskAgain === false,
      error:
        requested?.canAskAgain === false
          ? 'Notifications were denied. Enable them in system Settings.'
          : 'Notification permission was not granted.',
    };
  } catch (err) {
    return {
      ok: false,
      status: 'unavailable',
      error: `Could not request notification permission: ${err?.message || err}`,
    };
  }
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
 * Ask for permission and register with APNs/FCM via Expo.
 * @returns {Promise<{ok: boolean, token?: string, status?: string, error?: string}>}
 */
export async function registerForPushNotifications() {
  if (!Notifications) {
    return {
      ok: false,
      error: 'expo-notifications is not installed in this build.',
    };
  }

  const permission = await requestPushNotificationPermission();
  if (!permission.ok) return permission;
  const { status } = permission;

  // Local reminders can run on a simulator; only remote tokens require a
  // physical device.
  if (Device && !Device.isDevice) {
    return { ok: true, token: null, status, localOnly: true, simulator: true };
  }

  // Local streak reminders only need notification permission. A project ID
  // and APNs/FCM credentials are needed solely for server-sent remote pushes.
  const projectId = getProjectId();
  if (!projectId) {
    return { ok: true, token: null, status, localOnly: true };
  }

  try {
    const tokenResult = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenResult?.data;
    if (!token) return { ok: true, token: null, status, localOnly: true };

    await savePushToken(token);
    return { ok: true, token, status };
  } catch (err) {
    const message = err?.message || String(err);
    return {
      ok: true,
      token: null,
      status,
      localOnly: true,
      remoteError: message.includes('aps-environment')
        ? 'Push capability is missing from the iOS build. Re-run the iOS prebuild.'
        : message.toLowerCase().includes('firebase') || message.toLowerCase().includes('fcm')
          ? 'Android push credentials are missing. Upload the FCM V1 service-account key with EAS credentials.'
          : `Could not register for push: ${message}`,
    };
  }
}

/** Re-use a saved token when permission is already granted. */
export async function ensurePushRegistration() {
  await ensureAndroidNotificationChannel();
  const status = await getPushPermissionStatus();
  if (status !== 'granted') return { ok: false, status };

  const cached = await getStoredPushToken();
  if (cached) return { ok: true, token: cached, status, cached: true };

  return registerForPushNotifications();
}

export async function unregisterPushNotifications() {
  await clearPushToken();
  await cancelStreakReminders();
  return { ok: true };
}

function atLocalTime(dayOffset, { hour, minute }) {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, minute, 0, 0);
  return date;
}

function dateTrigger(date) {
  return {
    type: Notifications.SchedulableTriggerInputTypes.DATE,
    date,
    ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : {}),
  };
}

/** Cancel only reminders owned by this scheduler; other notifications remain. */
export async function cancelStreakReminders() {
  const ids = await getStoredReminderIds();
  if (Notifications) {
    await Promise.all(
      ids.map((id) =>
        Notifications.cancelScheduledNotificationAsync(id).catch(() => {})
      )
    );
  }
  await saveReminderIds([]);
}

async function scheduleReminder(date, title, body, data) {
  return Notifications.scheduleNotificationAsync({
    content: { title, body, sound: 'default', data },
    trigger: dateTrigger(date),
  });
}

async function performStreakReminderSync(stamps) {
  if (!Notifications) return { ok: false, error: 'Notifications unavailable.' };
  const status = await getPushPermissionStatus();
  if (status !== 'granted') return { ok: false, status };

  await ensureAndroidNotificationChannel();
  await cancelStreakReminders();

  const now = new Date();
  const stats = computeStreak(stamps, now);
  const stampedDays = new Set((stamps || []).map((stamp) => stamp?.day).filter(Boolean));
  const ids = [];

  try {
    for (let offset = 0; offset < REMINDER_DAYS; offset += 1) {
      const day = atLocalTime(offset, AFTERNOON);
      const dayKey = dayKeyOf(day);
      const isToday = offset === 0;

      if (stampedDays.has(dayKey)) {
        const completeAt = atLocalTime(offset, COMPLETE);
        if (completeAt.getTime() > now.getTime() + 60000) {
          // eslint-disable-next-line no-await-in-loop
          ids.push(await scheduleReminder(
            completeAt,
            'Your stamp is in ✨',
            isToday
              ? 'Nice work today. Come back tomorrow to keep your rhythm going.'
              : 'Keep your stamp habit going tomorrow.',
            { kind: 'streak-complete', day: dayKey }
          ));
        }
        continue;
      }

      const afternoonAt = atLocalTime(offset, AFTERNOON);
      if (afternoonAt.getTime() > now.getTime() + 60000) {
        // eslint-disable-next-line no-await-in-loop
        ids.push(await scheduleReminder(
          afternoonAt,
          'Ready for today’s stamp?',
          isToday && stats.current > 0
            ? `Your ${stats.current}-day streak is waiting. Add today’s stamp to keep it alive.`
            : 'Capture a small moment and add today’s stamp.',
          { kind: 'streak-afternoon', day: dayKey }
        ));
      }

      const eveningAt = atLocalTime(offset, EVENING);
      if (eveningAt.getTime() > now.getTime() + 60000) {
        // eslint-disable-next-line no-await-in-loop
        ids.push(await scheduleReminder(
          eveningAt,
          'One last nudge for today',
          isToday && stats.current > 0
            ? 'The day is nearly over—add a stamp to protect your streak.'
            : 'There’s still time to save one moment from today.',
          { kind: 'streak-evening', day: dayKey }
        ));
      }
    }
  } finally {
    // Persist partial success too, so a later refresh can clean everything up.
    await saveReminderIds(ids);
  }

  return { ok: true, scheduled: ids.length };
}

// Stamp saves and app startup can race. Serialize refreshes so an older pass
// cannot cancel the schedule produced by a newer pass.
let reminderSyncQueue = Promise.resolve();
export function syncStampReminders(stamps) {
  const run = () => performStreakReminderSync(stamps);
  reminderSyncQueue = reminderSyncQueue.then(run, run);
  return reminderSyncQueue;
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
  if (!Notifications) {
    return { ok: false, error: 'Notifications are not available in this build.' };
  }

  const status = await getPushPermissionStatus();
  if (status !== 'granted') {
    const reg = await registerForPushNotifications();
    if (!reg.ok) return reg;
  }

  try {
    await ensureAndroidNotificationChannel();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'TheStampO',
        body: 'Notifications are working on this device.',
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 2,
        ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : {}),
      },
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: `Could not schedule the test: ${err?.message || err}` };
  }
}
