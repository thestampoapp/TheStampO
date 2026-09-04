/**
 * notificationStore.js
 *
 * Persists the Expo push token on-device until a backend endpoint exists to
 * receive it. Kept separate from authStore because the token can exist before
 * sign-in and may need re-registration after reinstall.
 */

let AsyncStorage = null;
try {
  // eslint-disable-next-line global-require
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
} catch (e) {
  AsyncStorage = null;
}

const TOKEN_KEY = '@stampa/pushToken/v1';
const REMINDER_IDS_KEY = '@stampa/streakReminderIds/v1';

let cachedToken = null;
let loaded = false;

export async function loadPushToken() {
  if (loaded) return cachedToken;
  try {
    if (AsyncStorage) {
      cachedToken = await AsyncStorage.getItem(TOKEN_KEY);
    }
  } catch (e) {
    cachedToken = null;
  }
  loaded = true;
  return cachedToken;
}

export async function getStoredPushToken() {
  if (!loaded) await loadPushToken();
  return cachedToken;
}

export async function savePushToken(token) {
  cachedToken = token || null;
  loaded = true;
  try {
    if (AsyncStorage) {
      if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
      else await AsyncStorage.removeItem(TOKEN_KEY);
    }
  } catch (e) {
    /* in-memory copy still holds for this session */
  }
}

export async function clearPushToken() {
  await savePushToken(null);
}

/** Notification request IDs are persisted so old reminders can be replaced. */
export async function getStoredReminderIds() {
  try {
    if (!AsyncStorage) return [];
    const raw = await AsyncStorage.getItem(REMINDER_IDS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch (e) {
    return [];
  }
}

export async function saveReminderIds(ids) {
  try {
    if (!AsyncStorage) return;
    const clean = Array.isArray(ids) ? ids.filter(Boolean) : [];
    if (clean.length) {
      await AsyncStorage.setItem(REMINDER_IDS_KEY, JSON.stringify(clean));
    } else {
      await AsyncStorage.removeItem(REMINDER_IDS_KEY);
    }
  } catch (e) {
    /* reminders still work for this session */
  }
}
