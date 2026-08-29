/**
 * SavedStampScreen.js
 *
 * The celebration beat: the first stamp lands in the book.
 *
 * Android notes
 * -------------
 *   - SafeAreaView does NOT inset on Android, so the status bar height is
 *     added manually (see TOP_INSET).
 *   - The stamp width is derived from the screen instead of hardcoded to 212,
 *     so it never crowds the edges on 320-360dp devices.
 *   - The content scrolls if it cannot fit, so short/large-font devices never
 *     clip the Continue button.
 *   - Every animation runs on the native driver (opacity / transform only),
 *     which keeps it smooth on mid-range Android hardware.
 *
 * Decoration
 * ----------
 *   1. progress bar fills in on entry
 *   2. staggered fade-up for every text row
 *   3. the stamp "thumps" down like it was pressed, then floats
 *   4. an ink shockwave ring radiates out at the moment of impact
 *   5. sparkles pop around the stamp
 *   6. the shadow breathes with the float
 *   7. the Continue button has a light sweep and a press spring
 */

import { useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Animated,
  Easing,
  StatusBar,
  ScrollView,
  useWindowDimensions,
} from 'react-native';

import StampRenderer from '../components/StampRenderer';
import { STAMP_COLORS, SPACE } from '../styles/stampTheme';
import { weight, STATUS_BAR_HEIGHT} from '../styles/platform';
import { STAMP } from '../utils/stampGeometry';

const TOP_INSET = STATUS_BAR_HEIGHT;

/** Stamp sizing: proportional, but never bigger than the canonical size. */
const STAMP_WIDTH_RATIO = 0.56;
const STAMP_MIN_WIDTH = 150;

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

const formatToday = () =>
  new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

// ---------------------------------------------------------------------------
// Decorative pieces (local: they are specific to this celebration screen)
// ---------------------------------------------------------------------------

/**
 * A ring that expands and fades once, like ink spreading from the press.
 */
const Shockwave = ({ progress, size, delay = 0 }) => {
  const style = {
    width: size,
    height: size,
    borderRadius: size / 2,
    opacity: progress.interpolate({
      inputRange: [0, 0.1, 1],
      outputRange: [0, 0.5, 0],
    }),
    transform: [
      {
        scale: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0.35, 1.5],
        }),
      },
    ],
  };
  return <Animated.View pointerEvents="none" style={[styles.ring, style]} />;
};

/**
 * A small four-point sparkle that pops outward then settles.
 */
const Sparkle = ({ progress, x, y, size = 10, delay = 0 }) => {
  const appear = progress.interpolate({
    inputRange: [0, delay, Math.min(delay + 0.25, 1), 1],
    outputRange: [0, 0, 1, 1],
    extrapolate: 'clamp',
  });

  const style = {
    left: x,
    top: y,
    opacity: appear.interpolate({
      inputRange: [0, 0.6, 1],
      outputRange: [0, 1, 0.85],
    }),
    transform: [
      { scale: appear.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) },
      {
        rotate: appear.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '90deg'],
        }),
      },
    ],
  };

  return (
    <Animated.View pointerEvents="none" style={[styles.sparkle, style]}>
      <View style={[styles.sparkleBar, { width: size, height: 2 }]} />
      <View style={[styles.sparkleBar, styles.sparkleBarV, { width: 2, height: size }]} />
    </Animated.View>
  );
};

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

const SavedStampScreen = ({ navigation, route }) => {
  const { width: screenWidth } = useWindowDimensions();

  const photoUri = route?.params?.photoUri ?? null;
  const note = route?.params?.note ?? '';
  const today = useMemo(formatToday, []);

  const stampWidth = useMemo(
    () =>
      Math.round(
        clamp(screenWidth * STAMP_WIDTH_RATIO, STAMP_MIN_WIDTH, STAMP.OUTER_WIDTH)
      ),
    [screenWidth]
  );
  const stampHeight = useMemo(
    () => (stampWidth * STAMP.OUTER_HEIGHT) / STAMP.OUTER_WIDTH,
    [stampWidth]
  );

  // -- animation values ----------------------------------------------------
  const intro = useRef(new Animated.Value(0)).current;   // staggered text
  const drop = useRef(new Animated.Value(0)).current;    // stamp press-down
  const burst = useRef(new Animated.Value(0)).current;   // shockwave + sparkles
  const float = useRef(new Animated.Value(0)).current;   // idle hover
  const bar = useRef(new Animated.Value(0)).current;     // progress fill
  const sweep = useRef(new Animated.Value(0)).current;   // button shine
  const press = useRef(new Animated.Value(0)).current;   // button press

  useEffect(() => {
    // Progress bar fills, text rises, stamp thumps down, then the ink bursts.
    Animated.parallel([
      Animated.timing(bar, {
        toValue: 1,
        duration: 900,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(intro, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(180),
        Animated.spring(drop, {
          toValue: 1,
          damping: 11,
          stiffness: 170,
          mass: 0.9,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.delay(330),
        Animated.timing(burst, {
          toValue: 1,
          duration: 900,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // Idle hover, starts after the stamp has landed.
    const hover = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration: 2600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 2600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    const hoverTimer = setTimeout(() => hover.start(), 900);

    // Slow repeating shine across the CTA.
    const shine = Animated.loop(
      Animated.sequence([
        Animated.timing(sweep, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(2200),
        Animated.timing(sweep, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    const shineTimer = setTimeout(() => shine.start(), 1200);

    return () => {
      clearTimeout(hoverTimer);
      clearTimeout(shineTimer);
      hover.stop();
      shine.stop();
    };
  }, [intro, drop, burst, float, bar, sweep]);

  // -- derived styles ------------------------------------------------------

  /** Staggered fade-up. `order` shifts each row slightly later. */
  const riseIn = useCallback(
    (order = 0) => {
      const start = clamp(order * 0.12, 0, 0.6);
      const seg = intro.interpolate({
        inputRange: [0, start, Math.min(start + 0.4, 1), 1],
        outputRange: [0, 0, 1, 1],
        extrapolate: 'clamp',
      });
      return {
        opacity: seg,
        transform: [
          {
            translateY: seg.interpolate({
              inputRange: [0, 1],
              outputRange: [14, 0],
            }),
          },
        ],
      };
    },
    [intro]
  );

  const stampStyle = useMemo(
    () => ({
      opacity: drop.interpolate({
        inputRange: [0, 0.2, 1],
        outputRange: [0, 1, 1],
      }),
      transform: [
        {
          // Falls in from above and settles.
          translateY: Animated.add(
            drop.interpolate({ inputRange: [0, 1], outputRange: [-34, 0] }),
            float.interpolate({ inputRange: [0, 1], outputRange: [0, -9] })
          ),
        },
        {
          // Overshoots slightly larger, like paper hitting a surface.
          scale: drop.interpolate({
            inputRange: [0, 0.55, 1],
            outputRange: [1.14, 0.97, 1],
          }),
        },
        {
          // Gentle sway while hovering.
          rotate: float.interpolate({
            inputRange: [0, 1],
            outputRange: ['-2deg', '0.6deg'],
          }),
        },
      ],
    }),
    [drop, float]
  );

  /** The cast shadow tightens as the stamp lifts, which sells the hover. */
  const shadowStyle = useMemo(
    () => ({
      opacity: Animated.multiply(
        drop.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.1, 0.22] }),
        float.interpolate({ inputRange: [0, 1], outputRange: [1, 0.62] })
      ),
      transform: [
        {
          scaleX: float.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 0.9],
          }),
        },
      ],
    }),
    [drop, float]
  );

  // scaleX pivots on the centre, so the bar is drawn at double width and
  // shifted left; as it scales up it appears to fill from the left edge.
  const barStyle = {
    transform: [
      { translateX: -screenWidth / 2 },
      { scaleX: bar.interpolate({ inputRange: [0, 1], outputRange: [0, 0.99] }) },
      { translateX: screenWidth / 2 },
    ],
  };

  const sweepStyle = {
    opacity: sweep.interpolate({
      inputRange: [0, 0.15, 0.85, 1],
      outputRange: [0, 0.5, 0.5, 0],
    }),
    transform: [
      {
        translateX: sweep.interpolate({
          inputRange: [0, 1],
          outputRange: [-140, screenWidth],
        }),
      },
      { rotate: '18deg' },
    ],
  };

  const buttonStyle = {
    transform: [
      { scale: press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.97] }) },
    ],
  };

  const onPressIn = useCallback(() => {
    Animated.spring(press, {
      toValue: 1,
      damping: 18,
      stiffness: 320,
      useNativeDriver: true,
    }).start();
  }, [press]);

  const onPressOut = useCallback(() => {
    Animated.spring(press, {
      toValue: 0,
      damping: 14,
      stiffness: 260,
      useNativeDriver: true,
    }).start();
  }, [press]);

  const sparkleSpots = useMemo(
    () => [
      { x: -18, y: 22, size: 12, delay: 0.05 },
      { x: stampWidth + 6, y: 60, size: 9, delay: 0.22 },
      { x: -10, y: stampHeight - 70, size: 8, delay: 0.4 },
      { x: stampWidth - 2, y: stampHeight - 34, size: 11, delay: 0.3 },
      { x: stampWidth * 0.45, y: -20, size: 8, delay: 0.15 },
    ],
    [stampWidth, stampHeight]
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="transparent"
        translucent
      />

      <View style={styles.topInset} />

      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, barStyle]} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <Animated.Text style={[styles.title, riseIn(0)]}>
          Your first stamp is saved
        </Animated.Text>

        <Animated.Text style={[styles.subtitle, riseIn(1)]}>
          This is where your collection begins.
        </Animated.Text>

        <Animated.View style={[styles.dateRow, riseIn(2)]}>
          <Text style={styles.dateText}>{today}</Text>
          <View style={styles.todayPill}>
            <Text style={styles.todayText}>Today</Text>
          </View>
        </Animated.View>

        {/* Stamp stage: shockwave + shadow + stamp + sparkles */}
        <View
          style={[styles.stage, { width: stampWidth, height: stampHeight + 28 }]}
        >
          <View style={styles.ringWrap} pointerEvents="none">
            <Shockwave progress={burst} size={stampWidth * 1.5} />
          </View>

          <Animated.View
            pointerEvents="none"
            style={[
              styles.castShadow,
              { width: stampWidth * 0.82, bottom: 0 },
              shadowStyle,
            ]}
          />

          <Animated.View style={stampStyle}>
            <StampRenderer uri={photoUri} width={stampWidth} rotation={0} />
          </Animated.View>

          {sparkleSpots.map((s, i) => (
            <Sparkle
              key={i}
              progress={burst}
              x={s.x}
              y={s.y}
              size={s.size}
              delay={s.delay}
            />
          ))}
        </View>

        {note ? (
          <Animated.Text style={[styles.noteText, riseIn(3)]} numberOfLines={3}>
            “{note}”
          </Animated.Text>
        ) : null}

        <Animated.View style={[styles.footerRow, riseIn(4)]}>
          <View style={styles.footerDash} />
          <Text style={styles.footerText}>1 stamp in your book</Text>
          <View style={styles.footerDash} />
        </Animated.View>

        <View style={styles.spacer} />

        <Animated.View style={[styles.buttonWrap, riseIn(5), buttonStyle]}>
          <TouchableOpacity
            style={styles.button}
            onPress={() => navigation.navigate('Rating')}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            activeOpacity={1}
          >
            <Text style={styles.buttonText}>Continue</Text>
            <Animated.View style={[styles.sweep, sweepStyle]} pointerEvents="none" />
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: STAMP_COLORS.background },

  /** Android status bar spacer (0 on iOS, where SafeAreaView handles it). */
  topInset: { height: TOP_INSET },

  progressTrack: {
    height: 3,
    backgroundColor: '#F1E9F8',
    overflow: 'hidden',
  },
  progressFill: {
    width: '100%',
    height: 3,
    backgroundColor: STAMP_COLORS.accent,
  },

  content: {
    flexGrow: 1,
    paddingHorizontal: SPACE.l,
    paddingTop: SPACE.l,
    paddingBottom: SPACE.xl,
    alignItems: 'center',
  },

  title: {
    fontSize: 28,
    ...weight(600),
    textAlign: 'center',
    color: STAMP_COLORS.textPrimary,
    marginBottom: SPACE.s,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: STAMP_COLORS.textSecondary,
    marginBottom: SPACE.l,
  },

  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACE.m,
  },
  dateText: {
    fontSize: 16,
    color: STAMP_COLORS.textPrimary,
    ...weight(600),
    marginRight: SPACE.s,
  },
  todayPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 11,
    backgroundColor: 'rgba(216,90,61,0.10)',
  },
  todayText: {
    fontSize: 13,
    color: STAMP_COLORS.accent,
    fontStyle: 'italic',
    ...weight(600),
  },

  // -- stamp stage ---------------------------------------------------------
  stage: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: SPACE.s,
  },
  ringWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: STAMP_COLORS.accent,
  },
  castShadow: {
    position: 'absolute',
    height: 14,
    borderRadius: 7,
    backgroundColor: '#000',
  },
  sparkle: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: 14,
    height: 14,
  },
  sparkleBar: {
    position: 'absolute',
    backgroundColor: STAMP_COLORS.accent,
    borderRadius: 1,
  },
  sparkleBarV: {},

  noteText: {
    marginTop: SPACE.m,
    fontSize: 16,
    fontStyle: 'italic',
    color: STAMP_COLORS.textSecondary,
    textAlign: 'center',
  },

  footerRow: {
    marginTop: SPACE.l,
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerDash: {
    width: 22,
    height: 1,
    backgroundColor: STAMP_COLORS.border,
    marginHorizontal: SPACE.s,
  },
  footerText: {
    fontSize: 15,
    ...weight(600),
    color: STAMP_COLORS.textSecondary,
  },

  spacer: { flex: 1, minHeight: SPACE.l },

  buttonWrap: { width: '100%' },
  button: {
    width: '100%',
    backgroundColor: STAMP_COLORS.dark,
    paddingVertical: 18,
    borderRadius: 30,
    alignItems: 'center',
    overflow: 'hidden',
    // Soft lift, kept low so it does not read as a hard box.
    shadowColor: '#000',
    elevation: 4,
  },
  buttonText: { color: '#fff', fontSize: 17, ...weight(600) },
  sweep: {
    position: 'absolute',
    top: -30,
    bottom: -30,
    width: 70,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
});

export default SavedStampScreen;
