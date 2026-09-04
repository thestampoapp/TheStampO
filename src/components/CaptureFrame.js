import React from 'react';
import { Image, StyleSheet } from 'react-native';

import {
  APERTURE,
  PUNCHER_ASPECT,
  PUNCHER_OPAQUE,
  PUNCHER_SRC,
} from '../utils/puncherAsset';

/**
 * Each PNG keeps its own puncher artwork and transparent stamp opening.
 * The geometry was measured directly from the supplied PNGs, so the camera
 * crop always matches the visible opening for the selected frame.
 */
export const FRAME_OPTIONS = [
  {
    id: 'steel',
    label: 'Steel',
    source: PUNCHER_SRC,
    geometry: {
      aspect: PUNCHER_ASPECT,
      opaque: PUNCHER_OPAQUE,
      opaqueLeft: 0.125,
      aperture: APERTURE,
    },
  },
  // Fancy puncher frames disabled for now — geometry was misaligned and cropped
  // stamps incorrectly. Re-enable one at a time after re-measuring aperture.
  // {
  //   id: 'alloy',
  //   label: 'Alloy',
  //   source: require('../../stamper 2 (1).png'),
  //   geometry: {
  //     aspect: 0.970830,
  //     opaque: { width: 0.811268, height: 0.999088 },
  //     opaqueLeft: 0.037559,
  //     aperture: { left: 0.264789, top: 0.238833, width: 0.351174, height: 0.527347 },
  //   },
  // },
  // {
  //   id: 'lime',
  //   label: 'Lime',
  //   source: require('../../stamper 2.png'),
  //   geometry: {
  //     aspect: 0.970765,
  //     opaque: { width: 0.781222, height: 0.944970 },
  //     opaqueLeft: 0.093003,
  //     aperture: { left: 0.307352, top: 0.247635, width: 0.351639, height: 0.512468 },
  //   },
  // },
  // {
  //   id: 'onyx',
  //   label: 'Onyx',
  //   source: require('../../stamper 3.png'),
  //   geometry: {
  //     aspect: 0.970548,
  //     opaque: { width: 0.816527, height: 0.988672 },
  //     opaqueLeft: 0.073296,
  //     aperture: { left: 0.307656, top: 0.231536, width: 0.349673, height: 0.528772 },
  //   },
  // },
  // {
  //   id: 'ivory',
  //   label: 'Ivory',
  //   source: require('../../stamper 5.png'),
  //   geometry: {
  //     aspect: 0.970548,
  //     opaque: { width: 0.782446, height: 0.990938 },
  //     opaqueLeft: 0.147993,
  //     aperture: { left: 0.365546, top: 0.231989, width: 0.344538, height: 0.524241 },
  //   },
  // },
  // {
  //   id: 'chrome',
  //   label: 'Chrome',
  //   source: require('../../stamper 6.png'),
  //   geometry: {
  //     aspect: 0.843155,
  //     opaque: { width: 0.837634, height: 0.987307 },
  //     opaqueLeft: 0.038710,
  //     aperture: { left: 0.280645, top: 0.281958, width: 0.351613, height: 0.469628 },
  //   },
  // },
  // {
  //   id: 'bloom',
  //   label: 'Bloom',
  //   source: require('../../stamper 7.png'),
  //   geometry: {
  //     aspect: 0.843155,
  //     opaque: { width: 0.849462, height: 0.971895 },
  //     opaqueLeft: 0.066667,
  //     aperture: { left: 0.310753, top: 0.265639, width: 0.354839, height: 0.476881 },
  //   },
  // },
  // {
  //   id: 'garden',
  //   label: 'Garden',
  //   source: require('../../stamper 8.png'),
  //   geometry: {
  //     aspect: 0.792384,
  //     opaque: { width: 0.836384, height: 0.977335 },
  //     opaqueLeft: 0.092677,
  //     aperture: { left: 0.331808, top: 0.246600, width: 0.363844, height: 0.488667 },
  //   },
  // },
];

export function getFrameOption(frameId) {
  return FRAME_OPTIONS.find((frame) => frame.id === frameId) || FRAME_OPTIONS[0];
}

function CaptureFrame({ frameId = 'steel', style }) {
  const frame = getFrameOption(frameId);

  return (
    <Image
      source={frame.source}
      resizeMode="contain"
      style={[styles.frame, style]}
    />
  );
}

const styles = StyleSheet.create({
  frame: { position: 'absolute' },
});

export default React.memo(CaptureFrame);
