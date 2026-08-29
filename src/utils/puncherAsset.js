/**
 * puncherAsset.js
 *
 * SINGLE source of truth for the puncher artwork and its aperture geometry.
 *
 * CameraScreen and CaptureScreen both used to require the puncher PNG
 * and duplicate the measured constants. Swapping the artwork then meant
 * editing two files and keeping four numbers in sync by hand -- exactly the
 * kind of drift that produced the original three-renderer mess.
 *
 * TO CHANGE THE ARTWORK: drop the new file in the project root and edit
 * PUNCHER_SRC + the measurements below. Nothing else in the app needs to know.
 *
 * ---------------------------------------------------------------------------
 * MEASURING A NEW PUNCHER
 * ---------------------------------------------------------------------------
 * The numbers are FRACTIONS of the full image canvas, not pixels, so they stay
 * correct at any render size:
 *
 *   PUNCHER_OPAQUE  how much of the canvas the visible machine covers. Used to
 *                   scale the artwork so the *machine* (not the transparent
 *                   padding) fills the requested fraction of the screen.
 *
 *   APERTURE        the transparent cut-out the photo is framed by, as
 *                   left/top/width/height fractions of the canvas. This drives
 *                   the crop, so an error here shifts every stamp.
 *
 * To measure: open the PNG, find the bounding box of the enclosed transparent
 * hole in pixels, then divide by the canvas width/height.
 */

/**
 * The puncher artwork.
 *
 * `stamperb.png` is the current design. If the file is missing the require
 * throws at BUNDLE time with a clear message, which is better than a blank
 * screen at runtime.
 */
let puncherSrc = null;
try {
  // eslint-disable-next-line global-require
  puncherSrc = require('../../stamperb.png');
} catch (e) {
  // A bare require here is evaluated at MODULE LOAD, so a missing file throws
  // before React mounts and the app closes with no error screen. Guarded, the
  // camera simply renders without the machine artwork.
  puncherSrc = null;
}

export const PUNCHER_SRC = puncherSrc;

/** Canvas aspect (width / height) of the source PNG. */
export const PUNCHER_ASPECT = 1024 / 1536;

/**
 * Fraction of the canvas the opaque machine occupies.
 *
 * MEASURED from stamperb.png (1024x1536): the opaque body spans
 * x[128..895] y[208..1315] => 768x1108 px.
 */
export const PUNCHER_OPAQUE = { width: 0.75, height: 0.72135 };

/**
 * Transparent aperture, as fractions of the canvas.
 *
 * MEASURED by flood-filling the outer transparent background and taking the
 * bounding box of what remained enclosed: x[297..723] y[450..1037],
 * i.e. 427x588 px, aspect 0.7262.
 *
 * That aspect matches the stamp geometry's 212/292 = 0.7260 to within 0.03%,
 * so photos framed by this hole crop to the stamp with no distortion.
 *
 * The hole is very slightly LEFT of and ABOVE centre (49.85% / 48.44%), which
 * is why the body is positioned from the aperture centre rather than the
 * canvas centre.
 */
export const APERTURE = {
  left: 0.29004,
  top: 0.29297,
  width: 0.41699,
  height: 0.38281,
};

/**
 * Compute the on-screen rectangles for the puncher body and its aperture.
 *
 * Shared by both camera screens so the crop window and the visible hole can
 * never disagree.
 *
 * @param {object}  p
 * @param {number}  p.screenW   container width
 * @param {number}  p.screenH   container height
 * @param {number}  p.fill      fraction of screenW the VISIBLE machine spans
 * @param {number} [p.centerY]  vertical centre (defaults to the middle)
 * @returns {{ body: object, window: object }} absolute-positioned styles
 */
export function computePuncherLayout({ screenW, screenH, fill, centerY }) {
  // Scale so the OPAQUE part -- not the padded canvas -- spans `fill`.
  const visibleW = screenW * fill;
  const canvasW = visibleW / PUNCHER_OPAQUE.width;
  const canvasH = canvasW / PUNCHER_ASPECT;

  const cx = screenW / 2;
  const cy = centerY == null ? screenH / 2 : centerY;

  // The aperture is NOT centred in the canvas, so the body is positioned by
  // the aperture's centre rather than the canvas's.
  const apCx = (APERTURE.left + APERTURE.width / 2) * canvasW;
  const apCy = (APERTURE.top + APERTURE.height / 2) * canvasH;

  const bodyLeft = cx - apCx;
  const bodyTop = cy - apCy;

  return {
    body: {
      position: 'absolute',
      left: bodyLeft,
      top: bodyTop,
      width: canvasW,
      height: canvasH,
    },
    window: {
      position: 'absolute',
      left: bodyLeft + APERTURE.left * canvasW,
      top: bodyTop + APERTURE.top * canvasH,
      width: APERTURE.width * canvasW,
      height: APERTURE.height * canvasH,
    },
  };
}
