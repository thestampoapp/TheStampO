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
