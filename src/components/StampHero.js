/**
 * StampHero.js
 *
 * The illustrated stamp + postmark used at the top of the signup screen.
 *
 * Drawn as vectors rather than shipped as a PNG so it stays crisp on every
 * Android density (ldpi .. xxxhdpi) with no asset variants, and so the accent
 * colour can be themed.
 *
 * The scalloped outline reuses getStampPath() from stampGeometry, which is the
 * same silhouette every real stamp in the app uses -- the hero and the product
 * cannot drift apart.
 */

import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, {
  Path,
  G,
  Rect,
  Circle,
  Defs,
  ClipPath,
  Ellipse,
} from 'react-native-svg';

import { getStampPath } from '../utils/stampGeometry';

const INK = '#5B2B8A';
const INK_SOFT = '#A77DCA';
const INK_PALE = '#E8DCF3';
const PAPER = '#FFFFFF';

function StampHero({ width = 210 }) {
  const geo = useMemo(() => {
    // Stamp card occupies the left ~68% of the canvas; the postmark overlaps
    // its bottom-right, exactly as in the reference.
    const cardW = width * 0.6;
    const cardH = cardW * 1.18;
    const path = getStampPath(cardW, cardH);
    return { cardW, cardH, d: path.d };
  }, [width]);

  const { cardW, cardH, d } = geo;
  const height = cardH * 1.12;

  // Postmark
  const markR = width * 0.155;
  const markCx = width * 0.72;
  const markCy = cardH * 0.72;

  const inset = cardW * 0.1;

  return (
    <View style={[styles.wrap, { width, height }]} pointerEvents="none">
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <ClipPath id="heroPhoto">
            <Rect
              x={inset}
              y={inset}
              width={cardW - inset * 2}
              height={cardH - inset * 2}
              rx={2}
            />
          </ClipPath>
        </Defs>

        {/* --- stamp card, tilted like the reference --- */}
        <G transform={`rotate(-4 ${cardW / 2} ${cardH / 2})`}>
          <Path d={d} fill={PAPER} stroke={INK_SOFT} strokeWidth={1.6} />

          <G clipPath="url(#heroPhoto)">
            {/* sky */}
            <Rect
              x={inset}
              y={inset}
              width={cardW - inset * 2}
              height={cardH - inset * 2}
              fill={INK_PALE}
            />
            {/* sun */}
            <Circle
              cx={inset + (cardW - inset * 2) * 0.28}
              cy={inset + (cardH - inset * 2) * 0.26}
              r={cardW * 0.085}
              fill={INK}
            />
            {/* cloud */}
            <Ellipse
              cx={inset + (cardW - inset * 2) * 0.66}
              cy={inset + (cardH - inset * 2) * 0.3}
              rx={cardW * 0.16}
              ry={cardW * 0.075}
              fill="#FFFFFF"
              opacity={0.95}
            />
            {/* far hill */}
            <Path
              d={`M ${inset} ${inset + (cardH - inset * 2) * 0.72}
                  L ${inset + (cardW - inset * 2) * 0.34} ${inset + (cardH - inset * 2) * 0.4}
                  L ${inset + (cardW - inset * 2) * 0.68} ${inset + (cardH - inset * 2) * 0.72}
                  Z`}
              fill={INK_SOFT}
            />
            {/* near hill */}
            <Path
              d={`M ${inset} ${inset + (cardH - inset * 2)}
                  L ${inset + (cardW - inset * 2) * 0.42} ${inset + (cardH - inset * 2) * 0.52}
                  L ${inset + (cardW - inset * 2)} ${inset + (cardH - inset * 2)}
                  Z`}
              fill={INK}
              opacity={0.85}
            />
            {/* foreground band */}
            <Rect
              x={inset}
              y={inset + (cardH - inset * 2) * 0.86}
              width={cardW - inset * 2}
              height={(cardH - inset * 2) * 0.14}
              fill={INK}
              opacity={0.55}
            />
          </G>
        </G>

        {/* --- cancellation waves --- */}
        {[0, 1, 2].map((i) => {
          const y = markCy - markR * 0.42 + i * markR * 0.42;
          const x0 = markCx + markR * 0.75;
          const len = width - x0 - 2;
          return (
            <Path
              key={i}
              d={`M ${x0} ${y}
                  c ${len * 0.22} ${-markR * 0.16}, ${len * 0.38} ${markR * 0.16}, ${len * 0.5} 0
                  c ${len * 0.12} ${-markR * 0.16}, ${len * 0.3} ${markR * 0.16}, ${len * 0.5} 0`}
              stroke={INK_SOFT}
              strokeWidth={1.5}
              fill="none"
              strokeLinecap="round"
            />
          );
        })}

        {/* --- postmark --- */}
        <Circle
          cx={markCx}
          cy={markCy}
          r={markR}
          fill={PAPER}
          stroke={INK}
          strokeWidth={1.7}
        />
        <Circle
          cx={markCx}
          cy={markCy}
          r={markR * 0.74}
          stroke={INK_SOFT}
          strokeWidth={1}
          fill="none"
        />
        {/* four-point star */}
        <Path
          d={`M ${markCx} ${markCy - markR * 0.42}
              Q ${markCx + markR * 0.1} ${markCy - markR * 0.1} ${markCx + markR * 0.42} ${markCy}
              Q ${markCx + markR * 0.1} ${markCy + markR * 0.1} ${markCx} ${markCy + markR * 0.42}
              Q ${markCx - markR * 0.1} ${markCy + markR * 0.1} ${markCx - markR * 0.42} ${markCy}
              Q ${markCx - markR * 0.1} ${markCy - markR * 0.1} ${markCx} ${markCy - markR * 0.42} Z`}
          fill={INK}
        />

        {/* --- sparkles --- */}
        {[
          { x: width * 0.05, y: cardH * 0.62, s: 5 },
          { x: width * 0.86, y: cardH * 0.2, s: 6 },
          { x: width * 0.77, y: cardH * 0.33, s: 3.5 },
        ].map((sp, i) => (
          <Path
            key={i}
            d={`M ${sp.x} ${sp.y - sp.s}
                Q ${sp.x + sp.s * 0.22} ${sp.y - sp.s * 0.22} ${sp.x + sp.s} ${sp.y}
                Q ${sp.x + sp.s * 0.22} ${sp.y + sp.s * 0.22} ${sp.x} ${sp.y + sp.s}
                Q ${sp.x - sp.s * 0.22} ${sp.y + sp.s * 0.22} ${sp.x - sp.s} ${sp.y}
                Q ${sp.x - sp.s * 0.22} ${sp.y - sp.s * 0.22} ${sp.x} ${sp.y - sp.s} Z`}
            fill={INK_SOFT}
          />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
});

export default React.memo(StampHero);
