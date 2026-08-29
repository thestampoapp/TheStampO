/**
 * AdInterstitial.js
 *
 * Shown after a free-tier user saves a stamp.
 *
 * Two states in ONE modal, so the upsell is a continuation of the ad rather
 * than a second popup stacked on the first (two sequential modals on Android
 * race each other and the second often fails to appear):
 *
 *   'ad'     the placeholder ad + a countdown before it can be dismissed
 *   'offer'  "Want to capture without ad interruptions? Subscribe."
 *
 * THE AD IS A PLACEHOLDER. Real ads need react-native-google-mobile-ads, which
 * is a native module and cannot run in Expo Go -- and wiring AdMob before the
 * app has an ad unit ID would just be dead code. The surface, timing and
 * dismissal flow are all real, so dropping the SDK in later means replacing
 * one <View>.
 *
 * Android specifics:
 *   - statusBarTranslucent so the scrim covers the status bar
 *   - onRequestClose maps hardware back to the same rules as the X button
 *     (blocked during the countdown, so back can't skip the ad)
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Easing,
  BackHandler,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

import { STAMP_COLORS } from '../styles/stampTheme';
import {
  weight,
  shadow,
  HAIRLINE,
  ACTIVE_OPACITY,
  useBottomInset,
} from '../styles/platform';

/** Seconds before the ad can be closed. */
const COUNTDOWN = 4;

const GOLD = STAMP_COLORS.secondary;

/**
 * @param {'ad'|'offer'} startPhase  'offer' when a REAL AdMob interstitial has
 *        already played, so the in-app placeholder card is skipped and only
 *        the subscribe offer is shown.
 */
function AdInterstitial({ visible, onClose, onSubscribe, startPhase = 'ad' }) {
  const [phase, setPhase] = useState(startPhase);
  const [left, setLeft] = useState(COUNTDOWN);

  const enter = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;
  const timerRef = useRef(null);
  const bottomInset = useBottomInset();

  // Reset every time it opens, or the second ad would start already-closable.
  useEffect(() => {
    if (!visible) return undefined;

    setPhase(startPhase);
    // Only the placeholder card needs a countdown; a real ad enforced its own.
    setLeft(startPhase === 'offer' ? 0 : COUNTDOWN);

    enter.setValue(0);
    Animated.timing(enter, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    // Placeholder "loading" shimmer so the surface isn't visually dead.
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();

    timerRef.current = setInterval(() => {
      setLeft((n) => {
        if (n <= 1) {
          clearInterval(timerRef.current);
          timerRef.current = null;
          return 0;
        }
        return n - 1;
      });
    }, 1000);

    return () => {
      loop.stop();
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [visible, enter, shimmer, startPhase]);

  const canClose = left <= 0;

  /** Ad -> offer -> gone. The offer is where the modal actually closes. */
  const handleAdClose = useCallback(() => {
    if (!canClose) return;
    setPhase('offer');
  }, [canClose]);

  // Hardware back obeys the same rules, so it can't be used to skip the ad.
  useEffect(() => {
    if (!visible) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (phase === 'ad') {
        if (canClose) setPhase('offer');
        return true;
      }
      onClose && onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, phase, canClose, onClose]);

  const cardStyle = {
    opacity: enter,
    transform: [
      {
        translateY: enter.interpolate({
          inputRange: [0, 1],
          outputRange: [26, 0],
        }),
      },
      {
        scale: enter.interpolate({
          inputRange: [0, 1],
          outputRange: [0.96, 1],
        }),
      },
    ],
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        if (phase === 'ad') {
          if (canClose) setPhase('offer');
        } else if (onClose) onClose();
      }}
    >
      <View style={styles.wrap}>
        <View style={styles.scrim} />

        <Animated.View style={[styles.card, shadow(5), { paddingBottom: 18 + Math.min(bottomInset, 8) }, cardStyle]}>
          {phase === 'ad' ? (
            <>
              <View style={styles.adHeader}>
                <Text style={styles.adTag}>AD</Text>
                <TouchableOpacity
                  style={[styles.closeBtn, !canClose && styles.closeBtnDim]}
                  onPress={handleAdClose}
                  disabled={!canClose}
                  activeOpacity={ACTIVE_OPACITY}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  {canClose ? (
                    <Feather name="x" size={17} color={STAMP_COLORS.textPrimary} />
                  ) : (
                    <Text style={styles.countdown}>{left}</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Placeholder ad surface. Replace with a real AdMob view. */}
              <Animated.View
                style={[
                  styles.adSurface,
                  {
                    opacity: shimmer.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.55, 0.9],
                    }),
                  },
                ]}
              >
                <Feather name="image" size={34} color="#ACA1B8" />
                <Text style={styles.adPlaceholder}>Advertisement</Text>
              </Animated.View>

              <Text style={styles.adFoot}>
                Your stamp is saved. Ads keep the free tier free.
              </Text>
            </>
          ) : (
            <>
              <View style={styles.offerIcon}>
                <Feather name="zap" size={24} color={GOLD} />
              </View>

              <Text style={styles.offerTitle}>
                Want to capture without ad interruptions?
              </Text>
              <Text style={styles.offerBody}>
                Subscribe for an uninterrupted collection — no ads after
                saving, ever.
              </Text>

              <View style={styles.perks}>
                {[
                  'No ads, ever',
                  'Unlimited stamps',
                  'Support two indie makers',
                ].map((p) => (
                  <View key={p} style={styles.perkRow}>
                    <Feather name="check" size={15} color={GOLD} />
                    <Text style={styles.perkText}>{p}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity
                style={styles.subscribeBtn}
                onPress={onSubscribe}
                activeOpacity={ACTIVE_OPACITY}
              >
                <Text style={styles.subscribeText}>Subscribe</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.laterBtn}
                onPress={onClose}
                activeOpacity={ACTIVE_OPACITY}
              >
                <Text style={styles.laterText}>Maybe later</Text>
              </TouchableOpacity>
            </>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(18,15,13,0.62)' },

  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
  },

  adHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  adTag: {
    fontSize: 10.5,
    letterSpacing: 1.1,
    includeFontPadding: false,
    color: STAMP_COLORS.textMuted,
    borderWidth: HAIRLINE,
    borderColor: '#E5DDEC',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    ...weight(700),
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3EFF7',
  },
  closeBtnDim: { backgroundColor: '#F7F4FA' },
  countdown: {
    fontSize: 13,
    includeFontPadding: false,
    color: STAMP_COLORS.textSecondary,
    ...weight(600),
  },

  adSurface: {
    height: 210,
    borderRadius: 14,
    backgroundColor: '#F2EDF6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adPlaceholder: {
    marginTop: 8,
    fontSize: 13,
    includeFontPadding: false,
    color: '#998FA4',
    ...weight(500),
  },
  adFoot: {
    marginTop: 12,
    fontSize: 12.5,
    lineHeight: 17,
    includeFontPadding: false,
    color: STAMP_COLORS.textSecondary,
    textAlign: 'center',
  },

  offerIcon: {
    alignSelf: 'center',
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFF3E5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  offerTitle: {
    fontSize: 20,
    lineHeight: 27,
    includeFontPadding: false,
    color: STAMP_COLORS.textPrimary,
    textAlign: 'center',
    ...weight(600),
  },
  offerBody: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    includeFontPadding: false,
    color: STAMP_COLORS.textSecondary,
    textAlign: 'center',
  },

  perks: { marginTop: 16, marginBottom: 18, alignSelf: 'center' },
  perkRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  perkText: {
    marginLeft: 9,
    fontSize: 14,
    includeFontPadding: false,
    color: STAMP_COLORS.textPrimary,
  },

  subscribeBtn: {
    height: 54,
    borderRadius: 27,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subscribeText: {
    fontSize: 16,
    includeFontPadding: false,
    color: '#FFFFFF',
    ...weight(600),
  },
  laterBtn: { height: 46, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  laterText: {
    fontSize: 14.5,
    includeFontPadding: false,
    color: STAMP_COLORS.textSecondary,
    ...weight(500),
  },
});

export default React.memo(AdInterstitial);
