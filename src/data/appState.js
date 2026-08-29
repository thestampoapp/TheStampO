/**
 * appState.js
 *
 * Tiny persisted flags that decide WHERE the app opens.
 *
 * Kept separate from stampStore (content) and authStore (identity) because it
 * is neither -- it is navigation memory. One concern per file.
 *
 * AsyncStorage is resolved through a guarded require for the same reason as
 * stampStore: a bare import of a missing package is a bundler error, and the
 * app must still run (just without memory) if the dep isn't installed yet.
 */

let AsyncStorage = null;
try {
  // eslint-disable-next-line global-require
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
} catch (e) {
  AsyncStorage = null;
}

const ONBOARDED_KEY = '@stampa/onboarded/v1';

/** In-memory mirror so navigation decisions can be synchronous after load. */
let onboarded = false;
let loaded = false;

/** Read the flags from disk. Safe to call repeatedly. */
export async function loadAppState() {
  if (loaded) return { onboarded };
  try {
    if (AsyncStorage) {
      const raw = await AsyncStorage.getItem(ONBOARDED_KEY);
      onboarded = raw === '1';
    }
  } catch (e) {
    onboarded = false;
  }
  loaded = true;
  return { onboarded };
}

/**
 * Mark onboarding finished.
 *
 * Called at the moment the user reaches the dashboard with a real account --
 * NOT earlier, so a half-finished first run replays from the top.
 */
export async function setOnboarded(value = true) {
  onboarded = !!value;
  try {
    if (AsyncStorage) {
      await AsyncStorage.setItem(ONBOARDED_KEY, onboarded ? '1' : '0');
    }
  } catch (e) {
    /* the in-memory value still holds for this session */
  }
}

/** Synchronous peek; only meaningful after loadAppState() has resolved. */
export function hasOnboarded() {
  return onboarded;
}

/** Test / "start over" helper. */
export async function resetAppState() {
  onboarded = false;
  loaded = false;
  try {
    if (AsyncStorage) await AsyncStorage.removeItem(ONBOARDED_KEY);
  } catch (e) {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Last-used collection
//
// Remembered so a run of stamps from one outing does not need the collection
// re-picked every time. Purely a UI convenience -- the save screen still
// REQUIRES an explicit valid selection, this only pre-selects it.
// ---------------------------------------------------------------------------

const LAST_COLLECTION_KEY = '@stampa/lastCollection/v1';

let lastCollection = null;

export async function loadLastCollection() {
  try {
    if (AsyncStorage) {
      lastCollection = await AsyncStorage.getItem(LAST_COLLECTION_KEY);
    }
  } catch (e) {
    lastCollection = null;
  }
  return lastCollection;
}

export function getLastCollection() {
  return lastCollection;
}

export async function setLastCollection(id) {
  lastCollection = id || null;
  try {
    if (AsyncStorage) {
      if (id) await AsyncStorage.setItem(LAST_COLLECTION_KEY, id);
      else await AsyncStorage.removeItem(LAST_COLLECTION_KEY);
    }
  } catch (e) {
    /* in-memory for this session */
  }
}
