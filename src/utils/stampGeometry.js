/**
 * stampGeometry.js
 *
 * PURE MATH. No React. No rendering. No side effects.
 *
 * This is the ONE place in the entire app where the shape of a stamp is
 * defined. StampRenderer consumes it. Nothing else should import it.
 *
 * The scalloped silhouette is generated as an SVG path string and cached in a
 * module-level Map keyed by geometry, so the (relatively expensive) trig +
 * string building happens exactly once per unique stamp size for the lifetime
 * of the JS context -- never during a render pass.
 */

// ---------------------------------------------------------------------------
// Canonical STAMPA dimensions
// ---------------------------------------------------------------------------

export const STAMP = {
  OUTER_WIDTH: 212,
  OUTER_HEIGHT: 292,
  BORDER: 8,
  ROTATION: -2, // degrees
};

// ---------------------------------------------------------------------------
// Perforation tuning
// ---------------------------------------------------------------------------

/**
 * Number of perforation notches per edge.
 *
 * Fixed COUNTS rather than derived ones. The stamp is taller than it is wide
 * (212x292), so the vertical edges carry more notches than the horizontal
 * ones -- which also keeps the individual notches close to the same size on
 * every edge.
 */
const NOTCH_COUNT = { horizontal: 7, vertical: 9 };

/**
 * Notch size as a fraction of the available period (one notch + one gap).
 * 0.62 leaves a comfortable strip of flat paper between perforations.
 */
const NOTCH_WIDTH_RATIO = 0.62;

/**
 * How deep a notch bites into the paper, as a fraction of its radius.
 * 1.0 = perfect half circle. Slightly under 1 reads as more "paper" and less
 * as "gear", which is what STAMPA does.
 */
const NOTCH_DEPTH_RATIO = 0.92;

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const cache = new Map();

const round = (n) => Math.round(n * 1000) / 1000;

/**
 * Fit exactly `count` notches along an edge of `length`.
 *
 * The notch diameter is derived from the edge length so that both the short
 * and the long edges carry the same number of perforations. Corner margins are
 * equal, so all four corners look identical.
 *
 * Returns { count, gap, margin, diameter }.
 */
function solveEdge(length, count) {
  // The edge is divided into `count` notches plus (count + 1) flat runs:
  // one at each corner and one between every pair of notches.
  const period = length / count;
  const diameter = period * NOTCH_WIDTH_RATIO;
  const gap = (length - count * diameter) / (count + 1);
  // Corner margin equals the inter-notch gap, so corners match everywhere.
  const margin = gap;
  return { count, gap, margin, diameter };
}

/**
 * Build the closed scalloped outline, walking clockwise from the top-left
 * corner. Notches are cut INWARD (concave), which is what makes it read as a
 * torn perforation rather than a flower.
 *
 * We use arcs with sweep flag 0 on the top/right/bottom/left walks so the
 * curvature always bites toward the centre of the stamp.
 */
function buildScallopPath(width, height, counts, depthRatio) {
  const top = solveEdge(width, counts.horizontal);
  const side = solveEdge(height, counts.vertical);

  // Each edge gets its own radius from its own count.
  // Depth is driven by the SMALLER radius so the bite looks even all round.
  const rTop = top.diameter / 2;
  const rSide = side.diameter / 2;
  const depth = Math.min(rTop, rSide) * depthRatio;

  const parts = [];

  // Each notch is an exact half-ellipse of width `diameter` and depth `ry`,
  // separated by `gap` px of flat paper. Sweep flag 0 always bites inward.

  // --- start at top-left ---
  parts.push('M 0 0');

  // --- top edge: left -> right, bites downward (+y) ---
  let x = top.margin;
  parts.push(`L ${round(x)} 0`);
  for (let i = 0; i < top.count; i++) {
    const end = x + top.diameter;
    parts.push(`A ${round(rTop)} ${round(depth)} 0 0 0 ${round(end)} 0`);
    x = end;
    if (i < top.count - 1) {
      x += top.gap;
      parts.push(`L ${round(x)} 0`);
    }
  }
  parts.push(`L ${round(width)} 0`);

  // --- right edge: top -> bottom, bites leftward (-x) ---
  let y = side.margin;
  parts.push(`L ${round(width)} ${round(y)}`);
  for (let i = 0; i < side.count; i++) {
    const end = y + side.diameter;
    parts.push(`A ${round(depth)} ${round(rSide)} 0 0 0 ${round(width)} ${round(end)}`);
    y = end;
    if (i < side.count - 1) {
      y += side.gap;
      parts.push(`L ${round(width)} ${round(y)}`);
    }
  }
  parts.push(`L ${round(width)} ${round(height)}`);

  // --- bottom edge: right -> left, bites upward (-y) ---
  x = width - top.margin;
  parts.push(`L ${round(x)} ${round(height)}`);
  for (let i = 0; i < top.count; i++) {
    const end = x - top.diameter;
    parts.push(`A ${round(rTop)} ${round(depth)} 0 0 0 ${round(end)} ${round(height)}`);
    x = end;
    if (i < top.count - 1) {
      x -= top.gap;
      parts.push(`L ${round(x)} ${round(height)}`);
    }
  }
  parts.push(`L 0 ${round(height)}`);

  // --- left edge: bottom -> top, bites rightward (+x) ---
  y = height - side.margin;
  parts.push(`L 0 ${round(y)}`);
  for (let i = 0; i < side.count; i++) {
    const end = y - side.diameter;
    parts.push(`A ${round(depth)} ${round(rSide)} 0 0 0 0 ${round(end)}`);
    y = end;
    if (i < side.count - 1) {
      y -= side.gap;
      parts.push(`L 0 ${round(y)}`);
    }
  }

  parts.push('Z');

  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get the memoized scalloped outline for a stamp of the given outer size.
 *
 * The notch COUNTS are fixed (7 top/bottom, 9 left/right), so the perforations
 * scale with the stamp instead of multiplying on larger sizes.
 *
 * @param {number} width  outer width in px
 * @param {number} height outer height in px
 * @param {{horizontal:number,vertical:number}} [counts] notches per edge
 * @returns {{ d: string, width: number, height: number }}
 */
export function getStampPath(
  width = STAMP.OUTER_WIDTH,
  height = STAMP.OUTER_HEIGHT,
  counts = NOTCH_COUNT
) {
  const key = `${round(width)}x${round(height)}#${counts.horizontal}x${counts.vertical}`;

  let entry = cache.get(key);
  if (!entry) {
    entry = {
      d: buildScallopPath(width, height, counts, NOTCH_DEPTH_RATIO),
      width,
      height,
    };
    cache.set(key, entry);
  }
  return entry;
}

/**
 * Geometry for a stamp rendered at an arbitrary display width, preserving the
 * canonical 212:292 ratio and the 8px border proportionally.
 *
 * Everything a renderer needs, computed once.
 */
export function getStampLayout(outerWidth = STAMP.OUTER_WIDTH) {
  const scale = outerWidth / STAMP.OUTER_WIDTH;
  const outerHeight = STAMP.OUTER_HEIGHT * scale;
  const border = STAMP.BORDER * scale;

  return {
    scale,
    outerWidth,
    outerHeight,
    border,
    innerWidth: outerWidth - border * 2,
    innerHeight: outerHeight - border * 2,
    path: getStampPath(outerWidth, outerHeight),
  };
}
