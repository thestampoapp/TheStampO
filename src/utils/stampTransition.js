/**
 * stampTransition.js
 *
 * Shared geometry for the camera -> detail "match and move" transition.
 *
 * The stamp flies from the puncher aperture to the exact spot StampDetail
 * renders it. Both screens import these values, so the hand-off cannot drift:
 * if the detail layout changes, the flight target changes with it.
 *
 * All coordinates are relative to a screen's own root container (the child of
 * SafeAreaView), never to the window -- that keeps iOS safe-area insets and
 * Android status bars from shifting one screen relative to the other.
 */

import { StatusBar } from 'react-native';
import { STAMP } from './stampGeometry';

/**
 * Width StampDetail renders the stamp at.
 *
 * Deliberately smaller than the canonical 212 so the stamp does not dominate
 * the screen and the note/collection/save controls sit comfortably below it.
 */
export const DETAIL_STAMP_WIDTH = 168;

/**
 * Gap between the top of the safe area and the top of the stamp.
 * This is the padding StampDetail applies, so the two stay in lockstep.
 */
export const DETAIL_STAMP_TOP = 56;

/**
 * Status bar reserved by the screens themselves (SafeAreaView does not inset
 * on Android). Kept here so the camera and the detail screen agree.
 */
export const TOP_INSET = StatusBar.currentHeight || 24;

/** Timing for the flight. Long and eased -- it should feel deliberate. */
export const FLIGHT = {
  /** Pause after the stamp finishes ejecting, before it flies. */
  holdMs: 260,
  /** Duration of the travel itself. */
  durationMs: 720,
};

/**
 * Where the stamp ends up on StampDetail, in root-relative coordinates.
 *
 * @param {number} rootWidth width of the screen's root container
 * @returns {{x:number, y:number, width:number, height:number}} centre + size
 */
export function getDetailStampRect(rootWidth) {
  const width = DETAIL_STAMP_WIDTH;
  const height = (width * STAMP.OUTER_HEIGHT) / STAMP.OUTER_WIDTH;

  return {
    width,
    height,
    x: rootWidth / 2,
    y: TOP_INSET + DETAIL_STAMP_TOP + height / 2,
  };
}
