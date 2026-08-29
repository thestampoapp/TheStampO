/**
 * assets.js
 *
 * Optional bundled assets, behind guarded requires.
 *
 * WHY THIS EXISTS
 * ---------------
 * `require('../../punch.mp3')` is resolved by Metro at BUNDLE time, not at
 * runtime. If the file is absent:
 *
 *   dev  -> Metro serves from disk, red box on the screen that uses it
 *   APK  -> the bundle is baked in and the module throws while LOADING,
 *           which happens before React mounts, so ErrorBoundary never gets a
 *           chance to render. The app just closes with no message.
 *
 * That is the worst failure mode in the app: silent, and it looks identical
 * to a native crash. Wrapping each require in try/catch turns a fatal
 * bundle-time error into a missing sound or a missing picture.
 *
 * Every getter returns `null` when unavailable, and callers must handle null.
 */

/** Punch sound for the camera shutter. Root-level file. */
export function getPunchSound() {
  try {
    // eslint-disable-next-line global-require
    return require('../../punch.mp3');
  } catch (e) {
    return null;
  }
}

/** Welcome screen hero illustration. Root-level file. */
export function getWelcomeHero() {
  try {
    // eslint-disable-next-line global-require
    return require('../../phone-stamps-hero3.png');
  } catch (e) {
    return null;
  }
}

/** Bin/crumple sound used when deleting stamps. */
export function getTrashSound() {
  try {
    // eslint-disable-next-line global-require
    return require('../../assets/trash.wav');
  } catch (e) {
    return null;
  }
}
