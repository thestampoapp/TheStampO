/**
 * RatingScreen.js
 *
 * Premium rating moment. Rating a star triggers a "magical" transition:
 * the stars burst, the screen blooms outward, and we drift into Collection.
 *
 * Android notes:
 *   - SafeAreaView is a no-op here, so STATUS_BAR_HEIGHT is reserved manually.
 *   - Every animation is transform/opacity only => runs on the native driver.
 *   - Modal needs statusBarTranslucent so the overlay covers the status bar.
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Modal,
  StatusBar,
  Animated,
  Easing,
  useWindowDimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

import { COLORS, SPACING } from '../styles/theme';
import {
  STATUS_BAR_HEIGHT,
  shadow,
  weight,
  HAIRLINE,
  ACTIVE_OPACITY,
} from '../styles/platform';

/**
 * The screen this hands off to. MUST match a <Stack.Screen name="..."> in
 * App.js, or React Navigation throws:
 *   "The action 'NAVIGATE' with payload {...} was not handled by any navigator"
 */
/**
 * Everything up to here is the anonymous trial. Signup is the next beat --
 * it is skippable, and the locally-saved stamps carry through.
 */
const NEXT_ROUTE = 'Signup';

const GOLD = '#E4943A';
const CREAM = '#F1E9F8';
const INK = '#2F233B';

const TESTIMONIALS = [
  {
    name: 'Sophia',
    emoji: '👩',
    text:
      "I made a scrapbook page of our trip and sent it to my best friend. She cried. That's all you need to know.",
  },
];

/** A single tappable star that scales + spins when selected. */
const RatingStar = ({ index, filled, onPress, progress }) => {
  const pop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(pop, {
      toValue: filled ? 1 : 0,
      damping: 9,
      stiffness: 220,
      mass: 0.6,
      useNativeDriver: true,
    }).start();
  }, [filled, pop]);

  const style = {
    transform: [
      { scale: pop.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] }) },
      {
        rotate: pop.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '72deg'],
        }),
      },
    ],
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
      style={styles.starTouch}
    >
      <Animated.View style={style}>
        <Feather
          name="star"
          size={38}
          color={filled ? GOLD : '#D8D0E1'}
          style={filled ? styles.starFilled : null}
        />
      </Animated.View>
    </TouchableOpacity>
  );
};

/** Radiating sparkles emitted from the star row on selection. */
const Burst = ({ progress, count = 10 }) => {
  const seeds = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = (Math.PI * 2 * i) / count + 0.4;
        return {
          dx: Math.cos(angle) * (70 + (i % 3) * 22),
          dy: Math.sin(angle) * (52 + (i % 4) * 16),
          size: 5 + (i % 3) * 3,
          delay: (i % 5) * 0.05,
        };
      }),
    [count]
  );

  return (
    <View pointerEvents="none" style={styles.burstLayer}>
      {seeds.map((s, i) => {
        const seg = progress.interpolate({
          inputRange: [0, s.delay, Math.min(s.delay + 0.6, 1), 1],
          outputRange: [0, 0, 1, 1],
          extrapolate: 'clamp',
        });
        return (
          <Animated.View
            key={i}
            style={[
              styles.spark,
              {
                width: s.size,
                height: s.size,
                borderRadius: s.size / 2,
                opacity: seg.interpolate({
                  inputRange: [0, 0.25, 1],
                  outputRange: [0, 1, 0],
                }),
                transform: [
                  {
                    translateX: seg.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, s.dx],
                    }),
                  },
                  {
                    translateY: seg.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, s.dy],
                    }),
                  },
                  {
                    scale: seg.interpolate({
                      inputRange: [0, 0.4, 1],
                      outputRange: [0.3, 1.1, 0.4],
                    }),
                  },
                ],
              },
            ]}
          />
        );
      })}
    </View>
  );
};

const RatingScreen = ({ navigation }) => {
  const { width, height } = useWindowDimensions();
  const [showModal, setShowModal] = useState(false);
  const [rating, setRating] = useState(0);

  const enter = useRef(new Animated.Value(0)).current;
  const cardFloat = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const bloom = useRef(new Animated.Value(0)).current;
  /** 0 until a star is chosen, then springs the Continue button in. */
  const confirm = useRef(new Animated.Value(0)).current;

  const navigated = useRef(false);

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 620,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(cardFloat, {
          toValue: 1,
          duration: 2800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(cardFloat, {
          toValue: 0,
          duration: 2800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [enter, cardFloat]);

  /**
   * Tapping a star only SELECTS it: sparkles fire and the Continue button
   * appears. Navigation is deliberately not automatic -- the user should be
   * able to change their mind before committing.
   */
  const handleRate = useCallback(
    (value) => {
      if (navigated.current) return;
      setRating(value);

      // Re-run the sparkles on every change so re-rating still feels alive.
      burst.setValue(0);
      Animated.timing(burst, {
        toValue: 1,
        duration: 850,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();

      // Reveal the Continue button the first time a star is picked.
      Animated.spring(confirm, {
        toValue: 1,
        damping: 15,
        stiffness: 180,
        mass: 0.8,
        useNativeDriver: true,
      }).start();
    },
    [burst, confirm]
  );

  /**
   * Where this screen hands off to. Kept as a constant so the route name
   * exists in exactly one place -- a typo here used to surface as
   * "The action 'NAVIGATE' was not handled by any navigator".
   */
  const goNext = useCallback(() => {
    navigation.navigate(NEXT_ROUTE);
  }, [navigation]);

  /**
   * "Maybe later" -- continues straight to the next screen without rating.
   * Shared by the main screen and the modal so both behave identically.
   */
  const handleSkip = useCallback(() => {
    if (navigated.current) return;
    navigated.current = true;
    setShowModal(false);
    goNext();
  }, [goNext]);

  /**
   * "Rate now" -- currently a DUMMY. It records the rating locally and runs
   * the bloom transition into the next screen.
   *
   * When the real store flow is wanted, call requestReview() from
   * ../utils/storeReview here; nothing else needs to change.
   */
  const handleContinue = useCallback(() => {
    if (navigated.current || rating === 0) return;

    bloom.setValue(0);
    Animated.timing(bloom, {
      toValue: 1,
      duration: 780,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished || navigated.current) return;
      navigated.current = true;
      setShowModal(false);
      goNext();
    });
  }, [bloom, goNext, rating]);

  const enterStyle = (order) => {
    const start = Math.min(order * 0.14, 0.6);
    const seg = enter.interpolate({
      inputRange: [0, start, Math.min(start + 0.4, 1), 1],
      outputRange: [0, 0, 1, 1],
      extrapolate: 'clamp',
    });
    return {
      opacity: seg,
      transform: [
        { translateY: seg.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) },
      ],
    };
  };

  const cardStyle = {
    transform: [
      {
        translateY: cardFloat.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -6],
        }),
      },
    ],
  };

  // Continue button: lifts and fades in once a rating exists.
  const confirmStyle = {
    opacity: confirm.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }),
    transform: [
      { translateY: confirm.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
      { scale: confirm.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) },
    ],
  };

  // The bloom is a circle that scales past the screen diagonal.
  const diagonal = Math.sqrt(width * width + height * height);
  const bloomStyle = {
    opacity: bloom.interpolate({
      inputRange: [0, 0.15, 1],
      outputRange: [0, 1, 1],
    }),
    transform: [
      {
        scale: bloom.interpolate({
          inputRange: [0, 1],
          outputRange: [0, (diagonal / 120) * 1.1],
        }),
      },
    ],
  };

  const t = TESTIMONIALS[0];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <View style={styles.androidStatusSpacer} />

      <View style={styles.content}>
        <Animated.View style={[styles.badge, enterStyle(0)]}>
          <Feather name="heart" size={16} color={GOLD} />
          <Text style={styles.badgeText}>Made with care</Text>
        </Animated.View>

        <Animated.Text style={[styles.title, enterStyle(1)]}>
          {"We're a small team!\nA rating helps a lot"}
        </Animated.Text>

        <Animated.Text style={[styles.subtitle, enterStyle(2)]}>
          Your words keep this little studio alive.
        </Animated.Text>

        <Animated.View style={[styles.testimonialCard, shadow(2), enterStyle(3), cardStyle]}>
          <View style={styles.quoteMark}>
            <Text style={styles.quoteGlyph}>“</Text>
          </View>

          <View style={styles.userRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarEmoji}>{t.emoji}</Text>
            </View>
            <Text style={styles.userName} numberOfLines={1}>
              {t.name}
            </Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((i) => (
                <Feather key={i} name="star" size={13} color={GOLD} style={styles.miniStar} />
              ))}
            </View>
          </View>

          <Text style={styles.testimonialText}>{t.text}</Text>
        </Animated.View>

        <Animated.View style={[styles.ctaWrap, enterStyle(4)]}>
          <TouchableOpacity
            style={[styles.cta, shadow(3)]}
            activeOpacity={ACTIVE_OPACITY}
            onPress={() => setShowModal(true)}
          >
            <Text style={styles.ctaText}>Rate TheStampO</Text>
          </TouchableOpacity>

          {/* Explicit secondary action. A bordered button rather than a bare
              text link, so it reads as a real choice and gets a proper
              48dp touch target on Android. */}
          <TouchableOpacity
            onPress={handleSkip}
            activeOpacity={ACTIVE_OPACITY}
            style={styles.skipBtn}
          >
            <Text style={styles.skipText}>Maybe later</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>

      <Modal
        transparent
        visible={showModal}
        animationType="fade"
        // Android: without this the overlay stops at the status bar.
        statusBarTranslucent
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, shadow(4)]}>
            <View style={styles.appIcon}>
              <Text style={styles.appIconGlyph}>📕</Text>
            </View>

            <Text style={styles.modalTitle}>Enjoying StampO?</Text>
            <Text style={styles.modalSubtitle}>
              {rating === 0
                ? 'Tap a star - it genuinely helps us keep going.'
                : rating >= 4
                ? 'Thank you! Tap “Rate now” to send it.'
                : 'Thanks for the honesty - tell us what to fix any time.'}
            </Text>

            <View style={styles.ratingStars}>
              {[1, 2, 3, 4, 5].map((i) => (
                <RatingStar
                  key={i}
                  index={i}
                  filled={rating >= i}
                  onPress={() => handleRate(i)}
                />
              ))}
              <Burst progress={burst} />
            </View>

            {/* Continue: enabled once a star is chosen. Kept mounted (rather
                than conditionally rendered) so the modal height never jumps. */}
            <Animated.View style={[styles.confirmWrap, confirmStyle]}>
              <TouchableOpacity
                onPress={handleContinue}
                activeOpacity={ACTIVE_OPACITY}
                disabled={rating === 0}
                style={[
                  styles.confirmBtn,
                  rating === 0 ? styles.confirmDisabled : shadow(3),
                ]}
              >
                <Text
                  style={[
                    styles.confirmText,
                    rating === 0 && styles.confirmTextDisabled,
                  ]}
                >
                  Rate now
                </Text>
                <Feather
                  name="arrow-right"
                  size={18}
                  color={rating === 0 ? '#B9B2AA' : '#fff'}
                  style={styles.confirmIcon}
                />
              </TouchableOpacity>
            </Animated.View>

            <TouchableOpacity
              onPress={handleSkip}
              activeOpacity={ACTIVE_OPACITY}
              style={styles.notNow}
            >
              <Text style={styles.notNowText}>Maybe later</Text>
            </TouchableOpacity>
          </View>

          {/* Violet bloom that swallows the screen before we navigate. */}
          <View pointerEvents="none" style={styles.bloomLayer}>
            <Animated.View style={[styles.bloom, bloomStyle]} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  androidStatusSpacer: { height: STATUS_BAR_HEIGHT },
  container: { flex: 1, backgroundColor: '#FAF8FC' },

  content: {
    flex: 1,
    paddingHorizontal: SPACING.l,
    alignItems: 'center',
    justifyContent: 'center',
  },

  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CREAM,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    marginBottom: SPACING.l,
  },
  badgeText: {
    marginLeft: 7,
    fontSize: 13,
    includeFontPadding: false,
    color: '#8A6B45',
    ...weight(600),
  },

  title: {
    fontSize: 26,
    includeFontPadding: false,
    textAlign: 'center',
    color: INK,
    lineHeight: 34,
    ...weight(600),
  },
  subtitle: {
    marginTop: SPACING.s,
    fontSize: 15,
    includeFontPadding: false,
    textAlign: 'center',
    color: COLORS.textSecondary,
    marginBottom: SPACING.xl,
  },

  testimonialCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: SPACING.l,
    borderWidth: HAIRLINE,
    borderColor: '#EEE8F3',
  },
  quoteMark: { position: 'absolute', top: 4, right: 18, zIndex: 0 },
  quoteGlyph: { fontSize: 54, color: '#F1E9F8', includeFontPadding: false },
  userRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.m },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: CREAM,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.s,
  },
  avatarEmoji: { fontSize: 18, includeFontPadding: false },
  userName: {
    fontSize: 15,
    includeFontPadding: false,
    ...weight(600),
    color: INK,
    flex: 1,
  },
  // flexShrink:0 stops a long name from squeezing the stars off the card.
  starsRow: { flexDirection: 'row', flexShrink: 0, alignItems: 'center' },
  miniStar: { marginLeft: 1 },
  testimonialText: {
    fontSize: 15,
    includeFontPadding: false,
    color: '#665B70',
    lineHeight: 23,
  },

  ctaWrap: { width: '100%', marginTop: SPACING.xl },
  cta: {
    width: '100%',
    backgroundColor: INK,
    paddingVertical: 17,
    borderRadius: 28,
    alignItems: 'center',
  },
  ctaText: {
    color: '#fff',
    fontSize: 16,
    includeFontPadding: false,
    ...weight(600),
  },
  skipBtn: {
    marginTop: SPACING.m,
    width: '100%',
    paddingVertical: 15,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5DDEC',
    backgroundColor: 'transparent',
    minHeight: 48,
  },
  skipText: {
    fontSize: 15,
    includeFontPadding: false,
    color: '#71657D',
    ...weight(600),
  },

  // -- modal ---------------------------------------------------------------
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(28,24,20,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.l,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.l,
    alignItems: 'center',
  },
  appIcon: {
    width: 58,
    height: 58,
    borderRadius: 14,
    backgroundColor: CREAM,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.m,
  },
  appIconGlyph: { fontSize: 26, includeFontPadding: false },
  modalTitle: {
    fontSize: 20,
    includeFontPadding: false,
    ...weight(600),
    color: INK,
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 14,
    includeFontPadding: false,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.l,
    paddingHorizontal: SPACING.m,
  },

  ratingStars: {
    flexDirection: 'row',
    marginBottom: SPACING.l,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starTouch: { paddingHorizontal: 6 },
  starFilled: {},

  burstLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spark: { position: 'absolute', backgroundColor: GOLD },

  confirmWrap: { width: '100%' },
  confirmBtn: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: INK,
    paddingVertical: 16,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmDisabled: { backgroundColor: '#EEEAF3' },
  confirmText: {
    color: '#fff',
    fontSize: 16,
    includeFontPadding: false,
    ...weight(600),
  },
  confirmTextDisabled: { color: '#B9B2AA' },
  confirmIcon: { marginLeft: 8 },

  notNow: {
    marginTop: SPACING.s,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 44,
    justifyContent: 'center',
  },
  notNowText: {
    fontSize: 15,
    includeFontPadding: false,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },

  bloomLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bloom: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FAF8FC',
  },
});

export default RatingScreen;
