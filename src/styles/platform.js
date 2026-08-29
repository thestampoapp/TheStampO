/**
 * platform.js
 *
 * ANDROID-ONLY build. Every helper here assumes Android, so screens contain
 * no runtime platform branching at all.
 *
 * Kept as a module (rather than inlining the values) because these are the
 * things that differ per DEVICE — status bar height, font faces, elevation —
 * and having one place for them is what stopped 15 screens diverging.
 *
 * If iOS is ever added back, this is the only file that needs branches.
 */

import { StatusBar, StyleSheet } from 'react-native';

/**
 * Android does not inset SafeAreaView, so screens reserve the status bar
 * themselves. `currentHeight` is null on a few OEM builds -> fall back to 24.
 */
export const STATUS_BAR_HEIGHT = StatusBar.currentHeight || 24;

/**
 * Bottom navigation clearance.
 *
 * A FIXED value cannot work here: Android has two navigation modes and they
 * are wildly different heights.
 *
 *   gesture pill      ~16-24dp
 *   3-button nav bar  ~48dp     <- content was being overlapped
 *
 * So this is now only a FLOOR. Components must add the real measured inset
 * from `useBottomInset()` on top of their own padding. The constant is kept
 * so the many screens already importing it keep compiling, and so anything
 * rendered outside a SafeAreaProvider still clears the gesture pill.
 */
export const BOTTOM_INSET = 12;

/**
 * The REAL bottom inset for this device, measured at runtime.
 *
 * Resolved through a guarded require: react-native-safe-area-context ships
 * with Expo Go and is autolinked in the build, but a missing package must not
 * break the bundle -- it falls back to the constant above.
 *
 * Usage (inside a component):
 *     const bottom = useBottomInset();
 *     <View style={{ paddingBottom: 10 + bottom }} />
 */
let useSafeAreaInsetsFn = null;
try {
  // eslint-disable-next-line global-require
  const sac = require('react-native-safe-area-context');
  useSafeAreaInsetsFn = sac.useSafeAreaInsets;
} catch (e) {
  useSafeAreaInsetsFn = null;
}

export function useBottomInset() {
  if (!useSafeAreaInsetsFn) return BOTTOM_INSET;
  // Hook order is stable: the require result never changes at runtime.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const insets = useSafeAreaInsetsFn();
  // Never go below the floor: some OEMs report 0 even with a visible bar.
  return Math.max(insets?.bottom ?? 0, BOTTOM_INSET);
}

/**
 * Elevation.
 *
 * On Android the shadow comes from `elevation`; the iOS `shadow*` props are
 * ignored entirely, so they are not emitted. `shadowColor` IS honoured on
 * API 28+ to tint the elevation shadow, so it stays.
 *
 * @param {number} level 1 (subtle) .. 5 (prominent)
 */
export function shadow(level = 2) {
  const elevation = { 1: 1, 2: 3, 3: 6, 4: 10, 5: 14 }[level] ?? 3;
  return { elevation, shadowColor: '#000' };
}

/**
 * Font weight.
 *
 * The stock Android font family only ships Regular and Bold, so numeric
 * weights like '500'/'600' silently collapse to Regular and headings look
 * unstyled. Mapping to the concrete family names keeps the intended weight.
 */
export function weight(w) {
  const n = parseInt(w, 10);
  if (n >= 700) return { fontFamily: 'sans-serif', fontWeight: 'bold' };
  if (n >= 500) return { fontFamily: 'sans-serif-medium', fontWeight: 'normal' };
  if (n <= 300) return { fontFamily: 'sans-serif-light', fontWeight: 'normal' };
  return { fontFamily: 'sans-serif', fontWeight: 'normal' };
}

/**
 * Italic.
 *
 * Android synthesises italics by shearing glyphs, which looks wrong at display
 * sizes. Naming the family explicitly picks the real italic face.
 */
export function italic() {
  return { fontFamily: 'sans-serif', fontStyle: 'italic' };
}

/**
 * Replacement for the `gap` style prop, which is unsupported on older React
 * Native and renders inconsistently on Android.
 * Apply to the CHILDREN of a row/column, not the parent.
 */
/** Hairline that stays visible on high-density screens. */
export const HAIRLINE = Math.max(StyleSheet.hairlineWidth, 0.5);

/** Consistent touch feedback across the app. */
export const ACTIVE_OPACITY = 0.8;
