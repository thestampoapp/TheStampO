/**
 * StampRenderer.js
 *
 * THE ONLY COMPONENT IN THIS APP THAT KNOWS WHAT A STAMP LOOKS LIKE.
 *
 * The photo is clipped to the full scalloped silhouette -- edge to edge, with
 * no white paper border. The perforations bite into the photo itself.
 *
 * Screens pass a photo URI and (optionally) a size. They do not know about
 * scallops, clipping, paper colour, shadows or rotation.
 *
 * Rendering strategy
 * ------------------
 *   1. @shopify/react-native-skia if it is installed  -> the photo bitmap is
 *      genuinely clipped to the scalloped silhouette, and the shadow is a real
 *      blurred drop shadow of that silhouette.
 *   2. react-native-svg otherwise  -> identical geometry via <ClipPath>, using
 *      the exact same memoized path string.
 *
 * There is no third path, no frame PNG, and no rectangular fallback.
 */

import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Defs, ClipPath, Image as SvgImage, G } from 'react-native-svg';

import { STAMP, getStampLayout } from '../utils/stampGeometry';
import { STAMP_COLORS } from '../styles/stampTheme';

// ---------------------------------------------------------------------------
// Optional Skia. Resolved once at module load; never inside render.
// ---------------------------------------------------------------------------

let Skia = null;
try {
  // eslint-disable-next-line global-require
  const S = require('@shopify/react-native-skia');
  if (S && S.Canvas && S.Skia && S.Skia.Path) {
    Skia = S;
  }
} catch (e) {
  Skia = null;
}

export const IS_SKIA_ENABLED = !!Skia;

// ---------------------------------------------------------------------------
// Skia implementation
// ---------------------------------------------------------------------------

function SkiaStamp({ layout, uri }) {
  const {
    Canvas,
    Group,
    Path: SkPath,
    Image: SkImage,
    Shadow,
    useImage,
    Skia: SkiaApi,
  } = Skia;

  const { outerWidth, outerHeight } = layout;

  // Parse the cached SVG string into a Skia path exactly once per geometry.
  const skPath = useMemo(
    () => SkiaApi.Path.MakeFromSVGString(layout.path.d),
    [SkiaApi, layout.path.d]
  );

  const image = useImage(uri);

  // Padding so the blurred shadow is not clipped by the canvas bounds.
  const pad = 34;

  if (!skPath) return null;

  return (
    <Canvas style={{ width: outerWidth + pad * 2, height: outerHeight + pad * 2 }}>
      <Group transform={[{ translateX: pad }, { translateY: pad }]}>
        {/* Silhouette + floating shadow. Drawn underneath the photo so the
            scalloped drop shadow is preserved. When no photo is loaded yet
            this also acts as the paper-coloured placeholder. */}
        <SkPath path={skPath} color={STAMP_COLORS.paper}>
          <Shadow
            dx={0}
            dy={10}
            blur={18}
            color={`rgba(0,0,0,${STAMP_COLORS.shadowOpacity})`}
          />
          <Shadow dx={0} dy={2} blur={4} color="rgba(0,0,0,0.10)" />
        </SkPath>

        {/* Photo clipped to the FULL silhouette -- no border. The bitmap
            itself is scalloped edge to edge. */}
        {image ? (
          <Group clip={skPath}>
            <SkImage
              image={image}
              x={0}
              y={0}
              width={outerWidth}
              height={outerHeight}
              fit="cover"
            />
          </Group>
        ) : null}
      </Group>
    </Canvas>
  );
}

// ---------------------------------------------------------------------------
// SVG implementation (same geometry, same result)
// ---------------------------------------------------------------------------

function SvgStamp({ layout, uri, clipId }) {
  const { outerWidth, outerHeight, path } = layout;

  return (
    <View style={styles.svgShadow}>
      <Svg width={outerWidth} height={outerHeight}>
        <Defs>
          <ClipPath id={clipId}>
            <Path d={path.d} />
          </ClipPath>
        </Defs>

        {/* Silhouette, also the placeholder before the photo resolves */}
        <Path d={path.d} fill={STAMP_COLORS.paper} />

        {/* Photo clipped to the FULL silhouette -- no border */}
        {uri ? (
          <G clipPath={`url(#${clipId})`}>
            <SvgImage
              href={{ uri }}
              x={0}
              y={0}
              width={outerWidth}
              height={outerHeight}
              preserveAspectRatio="xMidYMid slice"
            />
          </G>
        ) : null}
      </Svg>
    </View>
  );
}

/**
 * Full-photo export: keep the complete rectangular photo and place it inside
 * a white, scalloped stamp-shaped frame. `preserveAspectRatio="meet"` is
 * intentional here; unlike the normal stamp, this variant must never crop
 * the source photo.
 */
function SvgFramedStamp({ layout, uri }) {
  const { outerWidth, outerHeight, scale, path } = layout;
  // A slightly wider white mat around the complete photo than the standard
  // stamp renderer uses. This is intentionally limited to the framed PNG.
  const border = 15 * scale;
  const innerWidth = outerWidth - border * 2;
  const innerHeight = outerHeight - border * 2;

  return (
    <View style={styles.frame}>
      <Svg width={outerWidth} height={outerHeight}>
        {/* The area outside this path remains transparent in the PNG. */}
        <Path d={path.d} fill="#FFFFFF" />

        {/*
         * Keep the photo rectangular and complete. `meet` scales the whole
         * camera image into the frame without cropping it; the white stamp
         * silhouette remains visible around it as a border.
         */}
        <G
          transform={`translate(${border} ${border})`}
        >
          <SvgImage
            href={{ uri }}
            x={0}
            y={0}
            width={innerWidth}
            height={innerHeight}
            preserveAspectRatio="xMidYMid meet"
          />
        </G>
      </Svg>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

let uid = 0;

/**
 * @param {string}  uri       photo to place inside the stamp
 * @param {number}  width     outer width (default 212, ratio preserved)
 * @param {number}  rotation  degrees; defaults to the canonical -2
 * @param {object}  style     outer container style
 */
function StampRenderer({
  uri,
  width = STAMP.OUTER_WIDTH,
  rotation = STAMP.ROTATION,
  framed = false,
  style,
  ...rest
}) {
  /**
   * The photo prop is `uri`. Passing `photoUri` (the name used by the SCREENS
   * for their own state) silently renders an empty stamp -- the component
   * still draws its scallops, so it looks like a broken image rather than a
   * bad prop. That cost a debugging round; fail loudly instead.
   */
  if (__DEV__ && rest.photoUri && !uri) {
    console.error(
      '[StampRenderer] Received `photoUri` but the prop is `uri`. ' +
        'The stamp will render blank. Change photoUri={...} to uri={...}.'
    );
  }

  const layout = useMemo(() => getStampLayout(width), [width]);
  const clipId = useMemo(() => `stampClip${(uid += 1)}`, []);

  const containerStyle = useMemo(
    () => [
      styles.container,
      { transform: [{ rotate: `${rotation}deg` }] },
      style,
    ],
    [rotation, style]
  );

  return (
    <View style={containerStyle} pointerEvents="none">
      {framed ? (
        <SvgFramedStamp layout={layout} uri={uri} />
      ) : IS_SKIA_ENABLED ? (
        <SkiaStamp layout={layout} uri={uri} />
      ) : (
        <SvgStamp layout={layout} uri={uri} clipId={clipId} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  // Only used by the SVG fallback; Skia draws its own blurred shadow.
  // On Android the lift comes from elevation -- shadow* props are ignored.
  svgShadow: {
    shadowColor: STAMP_COLORS.shadow,
    elevation: 12,
    backgroundColor: 'transparent',
  },
});

/** Memoized: re-renders only when uri / width / rotation actually change. */
export default React.memo(StampRenderer);

export { STAMP };
