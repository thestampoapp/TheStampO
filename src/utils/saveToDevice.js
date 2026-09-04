/**
 * saveToDevice.js
 *
 * Saves a stamp into the device gallery.
 *
 * TWO DIFFERENT THINGS CAN BE SAVED
 * ---------------------------------
 *   'stamp'  the scalloped stamp exactly as the app draws it, transparent
 *            around the perforations -- must be CAPTURED from a rendered
 *            view, because the stamp is SVG/Skia geometry, not a bitmap.
 *   'photo'  the original cropped photo file, copied straight across. No
 *            capture, no quality loss, no render needed.
 *
 * WHY CAPTURE AT ALL
 * ------------------
 * `stamp.uri` is only the rectangular photo. The scallops, border and
 * rotation live in StampRenderer. Copying the file would silently save a
 * plain rectangle -- which looks like the feature is broken.
 *
 * RESOLUTION
 * ----------
 * Captures are done at CAPTURE_WIDTH (636 = 3x the canonical 212), so the
 * saved PNG is print-usable rather than limited to whatever size the stamp
 * happened to be on screen.
 *
 * Everything is resolved through guarded requires, and every function
 * resolves { ok, error } instead of throwing -- these are called from onPress
 * handlers where a rejected promise becomes an unhandled rejection.
 */

import { Image, Platform } from 'react-native';

import { STAMP } from './stampGeometry';

let MediaLibrary = null;
try {
  // eslint-disable-next-line global-require
  MediaLibrary = require('expo-media-library');
} catch (e) {
  MediaLibrary = null;
}

let ViewShot = null;
try {
  // eslint-disable-next-line global-require
  ViewShot = require('react-native-view-shot');
} catch (e) {
  ViewShot = null;
}

let Sharing = null;
try {
  // eslint-disable-next-line global-require
  Sharing = require('expo-sharing');
} catch (e) {
  Sharing = null;
}

/** Album the stamps land in, so they group together in the gallery. */
export const ALBUM_NAME = 'TheStampO';

/**
 * ViewShot gives us a local temporary PNG. Keep one per source stamp for this
 * JS session so opening the share sheet again does not redraw and recapture
 * the same white-framed image.
 */
const framedShareCache = new Map();

/** 3x the canonical stamp width -- crisp when printed or zoomed. */
export const CAPTURE_WIDTH = STAMP.OUTER_WIDTH * 3;
export const CAPTURE_HEIGHT = Math.round(
  CAPTURE_WIDTH * (STAMP.OUTER_HEIGHT / STAMP.OUTER_WIDTH)
);

export function isSaveAvailable() {
  return !!MediaLibrary;
}

export function isCaptureAvailable() {
  return !!ViewShot && !!ViewShot.captureRef;
}

export function isShareAvailable() {
  return !!Sharing;
}

export function hasCachedFramedShare(cacheKey) {
  return !!cacheKey && framedShareCache.has(cacheKey);
}

/**
 * Gate that resolves once StampRenderer reports its photo bitmap is ready.
 * ViewShot does not wait for SvgImage/Skia decode — without this, iOS captures
 * show the white frame with a blank interior.
 */
export function createImageReadyGate() {
  let resolve = () => {};
  let settled = false;
  let promise = new Promise((r) => {
    resolve = r;
  });

  return {
    reset() {
      settled = false;
      promise = new Promise((r) => {
        resolve = r;
      });
    },
    notify() {
      if (settled) return;
      settled = true;
      resolve();
    },
    wait(timeoutMs = 8000) {
      return Promise.race([
        promise,
        new Promise((resolveTimeout) => setTimeout(resolveTimeout, timeoutMs)),
      ]);
    },
  };
}

async function waitForCapturePaint(uri, readyGate, { framed = false } = {}) {
  if (uri) {
    try {
      await Image.prefetch(uri);
    } catch (e) {
      /* local file:// URIs can still paint without prefetch */
    }
  }

  if (readyGate) {
    await readyGate.wait();
  }

  // Two frames so layout + async SVG/Skia paint finish before snapshot.
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  if (Platform.OS === 'ios') {
    // Framed SVG paths need a little longer when not using renderInContext.
    await new Promise((r) => setTimeout(r, framed ? 280 : 150));
  }
}

async function captureView(viewRef, uri, readyGate, { framed = false } = {}) {
  await waitForCapturePaint(uri, readyGate, { framed });

  const opts = {
    format: 'png',
    quality: 1,
    result: 'tmpfile',
  };

  if (Platform.OS === 'ios') {
    // Scalloped stamp (transparent PNG): renderInContext loads SvgImage reliably.
    // Framed stamp (white mat + perforations): renderInContext flattens the SVG
    // path into a plain white rectangle and drops the scalloped border.
    opts.useRenderInContext = !framed;
  }

  return ViewShot.captureRef(viewRef, opts);
}

/**
 * Ask for gallery write access.
 *
 * `writeOnly: true` matters: it requests only the "add photos" permission,
 * which Android grants far more readily than full read access, and keeps the
 * Play Console data-safety disclosure smaller.
 */
async function ensurePermission() {
  if (!MediaLibrary) {
    return {
      ok: false,
      error: 'Saving needs expo-media-library (npx expo install expo-media-library)',
    };
  }
  try {
    const current = await MediaLibrary.getPermissionsAsync(true);
    if (current.granted) return { ok: true };

    if (!current.canAskAgain) {
      return {
        ok: false,
        error: 'Photo permission is off. Turn it on in Settings to save stamps.',
        blocked: true,
      };
    }

    const asked = await MediaLibrary.requestPermissionsAsync(true);
    if (asked.granted) return { ok: true };
    return { ok: false, error: 'Permission denied', denied: true };
  } catch (err) {
    return { ok: false, error: 'Could not request photo permission' };
  }
}

/**
 * Put a local file into the gallery album.
 *
 * Adding to an album can fail on some OEM ROMs even though the asset saved
 * fine, so an album failure is swallowed -- the user still has their image,
 * just in the camera roll rather than a folder.
 */
async function fileToGallery(uri) {
  const asset = await MediaLibrary.createAssetAsync(uri);
  try {
    const album = await MediaLibrary.getAlbumAsync(ALBUM_NAME);
    if (album) {
      await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
    } else {
      await MediaLibrary.createAlbumAsync(ALBUM_NAME, asset, false);
    }
  } catch (e) {
    /* asset is saved; album grouping is a nicety */
  }
  return asset;
}

/**
 * Save an already-rendered view as a PNG in the gallery.
 *
 * @param {object} viewRef  ref to the view holding a StampRenderer
 * @returns {Promise<{ok: boolean, error?: string, uri?: string}>}
 */
export async function saveStampView(viewRef, uri, readyGate) {
  if (!isCaptureAvailable()) {
    return {
      ok: false,
      error: 'Saving the stamp needs react-native-view-shot.',
    };
  }
  if (!viewRef?.current) {
    return { ok: false, error: 'Nothing to save yet. Try again in a moment.' };
  }

  const perm = await ensurePermission();
  if (!perm.ok) return perm;

  try {
    // PNG, not JPG: the area outside the scallops must stay transparent.
    const shot = await captureView(viewRef, uri, readyGate);

    await fileToGallery(shot);
    return { ok: true, uri: shot };
  } catch (err) {
    return {
      ok: false,
      error: `Could not save the stamp: ${err?.message || 'unknown error'}`,
    };
  }
}

/**
 * Save the complete photo inside a white, scalloped stamp frame as PNG.
 * The rendered view uses a `contain` fit, so the source photo is never cropped.
 */
export async function saveFramedStampView(viewRef, uri, readyGate) {
  if (!isCaptureAvailable()) {
    return {
      ok: false,
      error: 'Saving the PNG needs react-native-view-shot.',
    };
  }
  if (!viewRef?.current) {
    return { ok: false, error: 'Nothing to save yet. Try again in a moment.' };
  }

  const perm = await ensurePermission();
  if (!perm.ok) return perm;

  try {
    const shot = await captureView(viewRef, uri, readyGate, { framed: true });

    await fileToGallery(shot);
    return { ok: true, uri: shot };
  } catch (err) {
    return {
      ok: false,
      error: `Could not save the PNG: ${err?.message || 'unknown error'}`,
    };
  }
}

/**
 * Render and share the same framed PNG used by "Save as PNG". The Android
 * system share sheet decides which installed compatible apps to show.
 */
export async function shareFramedStampView(viewRef, cacheKey, uri, readyGate) {
  if (!isCaptureAvailable()) {
    return {
      ok: false,
      error: 'Sharing the PNG needs react-native-view-shot.',
    };
  }
  if (!Sharing) {
    return {
      ok: false,
      error: 'Sharing needs expo-sharing. Rebuild the app after installing it.',
    };
  }
  try {
    const available = await Sharing.isAvailableAsync();
    if (!available) {
      return { ok: false, error: 'Sharing is not available on this device.' };
    }

    let shot = cacheKey ? framedShareCache.get(cacheKey) : null;
    if (!shot) {
      if (!viewRef?.current) {
        return { ok: false, error: 'Nothing to share yet. Try again in a moment.' };
      }
      shot = await captureView(viewRef, uri, readyGate, { framed: true });
      if (cacheKey) framedShareCache.set(cacheKey, shot);
    }

    await Sharing.shareAsync(shot, {
      mimeType: 'image/png',
      dialogTitle: 'Share your stamp',
      UTI: 'public.png',
    });
    return { ok: true, uri: shot, cached: !!cacheKey && framedShareCache.get(cacheKey) === shot };
  } catch (err) {
    // The OS can clear a temporary file while the app is in the background.
    // Drop a failed cached entry so the next tap renders a fresh PNG.
    if (cacheKey) framedShareCache.delete(cacheKey);
    return {
      ok: false,
      error: `Could not share the stamp: ${err?.message || 'unknown error'}`,
    };
  }
}
