/**
 * subscriptionStore.js
 *
 * Two tiers, no clock:
 *
 *   free  -> an ad is shown after every successful stamp save
 *   pro   -> no ads, ever
 *
 * Replaces the old 7-day trial (deleted). A date-based trial needed the start
 * time persisted, migrated and defended against clock changes; "free means
 * ads" needs none of that -- the tier is a single boolean and the ad is a
 * consequence of an action, not of elapsed time.
 *
 * Keyed BY UID so two accounts on one device don't share a subscription.
 *
 * HONESTY NOTE
 * ------------
 * This is device-local and trivially defeated by clearing app data. It is the
 * right shape for wiring up the UX, but it is NOT entitlement enforcement --
 * before launch the `pro` flag must come from Play Billing (or your server),
 * not AsyncStorage. `setPro()` is deliberately the only writer, so swapping in
 * a real purchase check touches one function.
 */

let AsyncStorage = null;
try {
  // eslint-disable-next-line global-require
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
} catch (e) {
  AsyncStorage = null;
}

const KEY = (uid) => `@stampa/pro/v1/${uid}`;

/** uid -> boolean, mirrored in memory so gating checks are synchronous. */
const cache = new Map();
const listeners = new Set();

const notify = () => {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      /* one broken listener must not break the others */
    }
  });
};

/** Load a uid's tier from disk into memory. Safe to call repeatedly. */
export async function loadSubscription(uid) {
  if (!uid || cache.has(uid)) return isPro(uid);
  try {
    if (AsyncStorage) {
      const raw = await AsyncStorage.getItem(KEY(uid));
      cache.set(uid, raw === '1');
    } else {
      cache.set(uid, false);
    }
  } catch (e) {
    cache.set(uid, false);
  }
  notify();
  return isPro(uid);
}

/**
 * Synchronous tier check.
 *
 * Defaults to FALSE (free) when unknown: showing an ad to someone who paid is
 * a bug, but so is silently giving away Pro, and the latter is invisible. The
 * splash warms the cache before the dashboard, so "unknown" is a brief edge.
 */
export function isPro(uid) {
  if (!uid) return false;
  return cache.get(uid) === true;
}

/**
 * The ONLY writer. Swap the body for a Play Billing entitlement check and the
 * rest of the app needs no changes.
 */
export async function setPro(uid, value = true) {
  if (!uid) return;
  cache.set(uid, !!value);
  try {
    if (AsyncStorage) {
      await AsyncStorage.setItem(KEY(uid), value ? '1' : '0');
    }
  } catch (e) {
    /* in-memory for this session */
  }
  notify();
}

/** Subscribe to tier changes. Returns an unsubscribe fn. */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
