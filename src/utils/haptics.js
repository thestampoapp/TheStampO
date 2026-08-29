/**
 * haptics.js
 *
 * Short vibration feedback, mainly for the punch.
 *
 * WHY A WRAPPER
 * -------------
 * Two layers of fallback are needed, and doing that inline at every call site
 * would be repeated three ways and drift:
 *
 *   1. expo-haptics  -- the good path. Real haptic actuator patterns, which
 *                       feel like a click rather than a buzz.
 *   2. Vibration     -- React Native core, always present. Cruder, but works
 *                       everywhere and needs no package.
 *   3. nothing       -- silently skipped.
 *
 * Both are resolved through guarded requires so a missing package degrades
 * instead of breaking the bundle.
 *
 * FIRE AND FORGET
 * ---------------
 * Every function returns void and swallows errors. Haptics are decoration:
 * awaiting one would delay the shutter, and a rejected promise in an onPress
 * handler is an unhandled rejection. Never `await` these.
 *
 * ANDROID PERMISSION
 * ------------------
 * `android.permission.VIBRATE` is a normal (non-dangerous) permission -- it is
 * granted at install with no prompt and does not appear in the runtime
 * permission list, so adding it costs the user nothing.
 */

import { Vibration } from 'react-native';

let Haptics = null;
try {
  // eslint-disable-next-line global-require
  Haptics = require('expo-haptics');
} catch (e) {
  Haptics = null;
}

let enabled = true;

/**
 * The punch: one crisp tap at the instant the shutter fires.
 *
 * Medium, not Heavy: this happens on every capture, and Heavy on a repeated
 * action becomes irritating within a handful of uses. 12ms is the fallback
 * duration -- long enough to feel, short enough not to read as a "buzz".
 */
export function punchTap() {
  if (!enabled) return;
  try {
    if (Haptics?.impactAsync) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      return;
    }
    Vibration.vibrate(12);
  } catch (e) {
    /* haptics must never break a capture */
  }
}

/** Lighter tap for secondary controls (flip, zoom, selection). */
export function lightTap() {
  if (!enabled) return;
  try {
    if (Haptics?.impactAsync) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      return;
    }
    Vibration.vibrate(8);
  } catch (e) {
    /* ignore */
  }
}
