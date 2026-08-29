/**
 * cropStamp.js
 *
 * THE ONLY CROP LOGIC IN THE APP.
 *
 * Problem this solves
 * -------------------
 * `CameraView` renders the sensor frame with "cover" semantics: the photo
 * (typically 4:3) is scaled up until it fills the preview box and the overflow
 * is clipped equally on both sides. The old code assumed the preview showed the
 * whole photo 1:1, so it used photo.width / previewWidth as the scale. Whenever
 * the preview aspect != photo aspect (i.e. essentially always on a full-height
 * preview) the crop was both mis-scaled and offset.
 *
 * Here we invert the real cover transform, so the crop matches exactly what the
 * user saw through the punch window. Front-camera mirroring is handled too.
 *
 * No hardcoded numbers: everything comes from measured layout + the actual
 * captured resolution.
 */

import * as ImageManipulator from 'expo-image-manipulator';
import { STAMP } from './stampGeometry';

/**
 * Final stamp photo size.
 *
 * The photo is clipped to the FULL scalloped silhouette (there is no white
 * border), so it must be produced at the OUTER stamp size -- not the inner
 * one. Using the inner size here would force the renderer to upscale by 8px
 * on each axis and would subtly crop the edges the user framed.
 */
export const CROP_OUTPUT = {
  width: STAMP.OUTER_WIDTH,   // 212
  height: STAMP.OUTER_HEIGHT, // 292
};

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

/**
 * Map a rect expressed in preview coordinates into source-image pixels,
 * inverting a "cover" fit.
 *
 * @param {{width:number,height:number}} preview  measured preview box
 * @param {{x:number,y:number,width:number,height:number}} window rect relative to preview
 * @param {{width:number,height:number}} photo  captured image resolution
 * @param {boolean} mirrored  true for the front camera
 */
export function previewRectToImageRect(preview, window, photo, mirrored = false) {
  // Cover scale: the factor the photo was blown up by to fill the preview.
  const scale = Math.max(preview.width / photo.width, preview.height / photo.height);

  // Size of the photo once displayed, and how much of it hangs outside.
  const displayedW = photo.width * scale;
  const displayedH = photo.height * scale;
  const offsetX = (displayedW - preview.width) / 2;
  const offsetY = (displayedH - preview.height) / 2;

  // Preview point -> displayed-photo point -> source pixel.
  let originX = (window.x + offsetX) / scale;
  let originY = (window.y + offsetY) / scale;
  let width = window.width / scale;
  let height = window.height / scale;

  // The front preview is mirrored but the saved file is not, so the region the
  // user framed lives on the opposite side of the image.
  if (mirrored) {
    originX = photo.width - (originX + width);
  }

  // Never hand out-of-bounds numbers to the manipulator.
  width = clamp(Math.round(width), 1, photo.width);
  height = clamp(Math.round(height), 1, photo.height);
  originX = clamp(Math.round(originX), 0, photo.width - width);
  originY = clamp(Math.round(originY), 0, photo.height - height);

  return { originX, originY, width, height };
}

/**
 * Adjust a crop rect so it matches the stamp's 196:276 aspect ratio, growing
 * the short axis where possible and shrinking otherwise. Keeps the rect
 * centred on the region the user framed and inside the image.
 */
export function fitAspect(rect, photo, targetAspect) {
  let { originX, originY, width, height } = rect;
  const cx = originX + width / 2;
  const cy = originY + height / 2;

  if (width / height > targetAspect) {
    width = height * targetAspect;
  } else {
    height = width / targetAspect;
  }

  // Shrink if the ideal rect cannot fit in the source.
  if (width > photo.width) {
    width = photo.width;
    height = width / targetAspect;
  }
  if (height > photo.height) {
    height = photo.height;
    width = height * targetAspect;
  }

  width = Math.round(width);
  height = Math.round(height);
  originX = clamp(Math.round(cx - width / 2), 0, photo.width - width);
  originY = clamp(Math.round(cy - height / 2), 0, photo.height - height);

  return { originX, originY, width, height };
}

/**
 * Full pipeline: capture -> crop to the punch window -> resize once -> PNG.
 *
 * @param {object} params
 * @param {{uri:string,width:number,height:number}} params.photo
 * @param {{width:number,height:number}} params.previewSize
 * @param {{x:number,y:number,width:number,height:number}} params.windowRect
 *        punch window, already relative to the preview's top-left
 * @param {boolean} params.mirrored
 * @returns {Promise<string>} uri of a 196x276 PNG
 */
export async function cropToStamp({ photo, previewSize, windowRect, mirrored }) {
  const targetAspect = CROP_OUTPUT.width / CROP_OUTPUT.height;

  const raw = previewRectToImageRect(previewSize, windowRect, photo, mirrored);
  const crop = fitAspect(raw, photo, targetAspect);

  // One crop + one resize + one encode. No repeated compression anywhere.
  const result = await ImageManipulator.manipulateAsync(
    photo.uri,
    [
      { crop },
      { resize: { width: CROP_OUTPUT.width, height: CROP_OUTPUT.height } },
    ],
    { compress: 1, format: ImageManipulator.SaveFormat.PNG }
  );

  return result.uri;
}
