/**
 * ads.js
 *
 * Real Google AdMob interstitials, behind the same guarded-require pattern as
 * firebase.js -- a bare import of an uninstalled native module is a BUNDLER
 * error, and the app must still run (showing the in-app fallback card) before
 * the package is installed or in Expo Go.
 *
 * WHY PRELOAD
 * -----------
 * An interstitial that is loaded when you want to show it produces a 1-3s
 * blank pause, and often fails outright on a slow connection. So one ad is
 * always kept warm: we load at startup, and immediately load the NEXT one as
 * soon as the current is dismissed. `showInterstitial()` therefore either
 * shows instantly or reports "not ready" straight away -- it never stalls the
 * user between saving a stamp and seeing their collection.
 *
 * TEST vs PRODUCTION
 * ------------------
 * `__DEV__` builds always use Google's TEST unit ids. Serving real ads to
 * yourself during development is the fastest way to get an AdMob account
 * suspended, so the production id is only ever used in a release build.
 *
 * PASTE YOUR REAL UNIT ID BELOW once AdMob has issued one.
 */

/**
 * Production interstitial AD UNIT id (AdMob -> Ad units -> your interstitial).
 *
 *   AD UNIT id:  ca-app-pub-9787924287473838/4208530246   <- SLASH
 *   APP id:      ca-app-pub-9787924287473838~1465716759   <- TILDE (app.json)
 *
 * These are NOT interchangeable. Pasting the app id here is the most common
 * AdMob mistake and fails SILENTLY -- no ads, no error -- so it is validated
 * below rather than left to chance.
 *
 * If this is ever emptied, the app shows the in-app fallback card instead of
 * requesting an invalid unit.
 */
export const INTERSTITIAL_UNIT_ID_ANDROID =
  'ca-app-pub-9787924287473838/4208530246';

/** An ad unit id contains a slash; an app id contains a tilde. */
function validUnitId(id) {
  return typeof id === 'string' && id.includes('/') && !id.includes('~');
}

// ---------------------------------------------------------------------------
// Guarded module resolution
// ---------------------------------------------------------------------------

let Ads = null;
let unavailableReason = null;

try {
  // eslint-disable-next-line global-require
  Ads = require('react-native-google-mobile-ads');
} catch (e) {
  Ads = null;
  unavailableReason =
    'react-native-google-mobile-ads is not installed (npx expo install react-native-google-mobile-ads)';
}

const isDev = typeof __DEV__ !== 'undefined' && __DEV__;

/** The unit id to request: always the test id in development. */
function unitId() {
  if (!Ads) return null;
  if (isDev) return Ads.TestIds?.INTERSTITIAL || null;
  if (!INTERSTITIAL_UNIT_ID_ANDROID) return null;

  // Catch the app-id-in-the-wrong-slot mistake loudly instead of serving
  // nothing forever.
  if (!validUnitId(INTERSTITIAL_UNIT_ID_ANDROID)) {
    unavailableReason =
      'INTERSTITIAL_UNIT_ID_ANDROID looks wrong. An ad UNIT id contains "/" ' +
      '(ca-app-pub-.../..........). You appear to have pasted the APP id, ' +
      'which contains "~" and belongs in app.json.';
    return null;
  }
  return INTERSTITIAL_UNIT_ID_ANDROID;
}

/**
 * True when a real ad CAN be requested.
 *
 * In production with no unit id pasted this is false, so the app shows the
 * in-app fallback instead of silently showing nothing.
 */
export function isAdsAvailable() {
  if (!Ads) return false;
  const id = unitId();
  if (!id) {
    unavailableReason =
      'No production ad unit id set in src/data/ads.js (INTERSTITIAL_UNIT_ID_ANDROID)';
    return false;
  }
  return true;
}

export function adsUnavailableReason() {
  return unavailableReason;
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

let initialised = false;
let interstitial = null;
let loaded = false;
let loading = false;
let unsubscribers = [];

/** Callbacks waiting for the ad currently on screen to close. */
let pendingClose = [];

const flushClose = () => {
  const list = pendingClose;
  pendingClose = [];
  list.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      /* one bad callback must not strand the rest */
    }
  });
};

function teardown() {
  unsubscribers.forEach((u) => {
    try {
      u();
    } catch (e) {}
  });
  unsubscribers = [];
  interstitial = null;
  loaded = false;
  loading = false;
}

/**
 * Build and start loading one interstitial.
 *
 * A fresh InterstitialAd object is created per ad: the SDK does not allow
 * re-showing a consumed one, and reusing it silently no-ops.
 */
function createAndLoad() {
  if (!isAdsAvailable() || loading) return;

  teardown();
  loading = true;

  try {
    const { InterstitialAd, AdEventType } = Ads;
    interstitial = InterstitialAd.createForAdRequest(unitId(), {
      requestNonPersonalizedAdsOnly: true,
    });

    unsubscribers.push(
      interstitial.addAdEventListener(AdEventType.LOADED, () => {
        loaded = true;
        loading = false;
      })
    );

    unsubscribers.push(
      interstitial.addAdEventListener(AdEventType.ERROR, (err) => {
        loaded = false;
        loading = false;
        unavailableReason = `Ad failed to load: ${err?.message || 'unknown'}`;
        // Anyone waiting must not be stranded on a screen that never advances.
        flushClose();
      })
    );

    unsubscribers.push(
      interstitial.addAdEventListener(AdEventType.CLOSED, () => {
        loaded = false;
        flushClose();
        // Warm the next one immediately.
        createAndLoad();
      })
    );

    interstitial.load();
  } catch (e) {
    loading = false;
    loaded = false;
    unavailableReason = `Ad setup failed: ${e?.message || e}`;
  }
}

/**
 * Initialise the SDK and warm the first ad. Call once at app start.
 * Never rejects -- ads failing must not affect anything else.
 */
export async function initAds() {
  if (initialised || !Ads) return false;
  initialised = true;

  try {
    // The SDK entry point moved between versions: v16 exports MobileAds as
    // both `default` and a named export. Resolve whichever is a function
    // rather than assuming -- calling a non-function here would crash the
    // app at launch, before any screen renders.
    const entry =
      typeof Ads.default === 'function'
        ? Ads.default
        : typeof Ads.MobileAds === 'function'
        ? Ads.MobileAds
        : null;

    if (!entry) {
      unavailableReason =
        'react-native-google-mobile-ads exposes no MobileAds() entry point.';
      return false;
    }

    await entry().initialize();
    createAndLoad();
    return true;
  } catch (e) {
    unavailableReason = `AdMob init failed: ${e?.message || e}`;
    return false;
  }
}

/** Is an ad loaded and ready to display right now? */
export function isInterstitialReady() {
  return !!(interstitial && loaded);
}

/**
 * Show the preloaded interstitial.
 *
 * @returns {Promise<boolean>} true if a real ad was shown (the promise
 *          resolves when it is DISMISSED); false immediately if none was
 *          ready, so the caller can fall back to the in-app card.
 */
export function showInterstitial() {
  return new Promise((resolve) => {
    if (!isInterstitialReady()) {
      // Nothing warm: kick off a load for next time and tell the caller now.
      createAndLoad();
      resolve(false);
      return;
    }

    let settled = false;
    const done = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    pendingClose.push(() => done(true));

    try {
      interstitial.show();
    } catch (e) {
      pendingClose = pendingClose.filter((f) => f !== done);
      loaded = false;
      createAndLoad();
      done(false);
      return;
    }

    // Safety net: if CLOSED never arrives (SDK edge cases do exist), don't
    // leave the user stuck on the save screen forever.
    setTimeout(() => {
      if (!settled) {
        done(true);
        createAndLoad();
      }
    }, 60000);
  });
}
