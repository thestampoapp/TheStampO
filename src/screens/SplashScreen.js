/**
 * SplashScreen.js
 *
 * The launch router. It plays the logo animation and, in parallel, resolves
 * who the user is -- then sends them to exactly one of three places:
 *
 *   permanent account            -> Collection   (dashboard; skip onboarding)
 *   onboarded but signed out     -> Login        (the gate closed behind them)
 *   anyone else (first run)      -> Welcome      (full onboarding)
 *
 * The animation and the auth bootstrap run CONCURRENTLY and we wait for both,
 * so a slow network never shows a frozen logo and a fast one never flashes
 * past the branding.
 */

import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, StatusBar } from 'react-native';

import { bootstrapAuth, getCurrentUser, isPermanentUser } from '../data/authStore';
import { loadAppState } from '../data/appState';
import { loadSubscription } from '../data/subscriptionStore';
import { MONETIZATION_ENABLED } from '../data/monetization';

/** Minimum time the logo stays up, so the brand registers. */
const MIN_SPLASH_MS = 1400;

const SplashScreen = ({ navigation }) => {
  // useRef, not bare Animated.Value: a re-render must not reset the animation.
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const navigated = useRef(false);

  useEffect(() => {
    let cancelled = false;

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    (async () => {
      const minimum = new Promise((r) => setTimeout(r, MIN_SPLASH_MS));

      // Never let a hung network hold the splash forever.
      const work = Promise.all([
        bootstrapAuth().catch(() => null),
        loadAppState().catch(() => ({ onboarded: false })),
      ]);
      const guarded = Promise.race([
        work,
        new Promise((r) => setTimeout(() => r([null, { onboarded: false }]), 8000)),
      ]);

      const [, state] = await guarded;
      await minimum;

      if (cancelled || navigated.current) return;
      navigated.current = true;

      const user = getCurrentUser();

      let dest = 'Welcome';
      if (isPermanentUser(user)) {
        // The tier cache only matters once monetization is switched on;
        // while the app is free the subscription store stays dormant.
        if (MONETIZATION_ENABLED) {
          await loadSubscription(user.uid).catch(() => {});
        }
        dest = 'Collections';
      } else if (state?.onboarded) {
        dest = 'Login';
      }

      navigation.replace(dest);
    })();

    return () => {
      cancelled = true;
    };
  }, [fadeAnim, scaleAnim, navigation]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <Text style={styles.logoText}>TheStampo</Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
  },
  logoText: {
    fontSize: 42,
    includeFontPadding: false,
    fontWeight: '700',
    color: '#222',
    letterSpacing: 2,
  },
});

export default SplashScreen;
