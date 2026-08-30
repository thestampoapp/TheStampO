/**
 * VerifyEmailScreen.js
 *
 * Gate between signup/login and the dashboard for email accounts that have
 * not proven inbox ownership yet. The verification email already went out at
 * signup (signUpWithEmail sends it), so this screen just waits for the user
 * to open it. Random/mistyped addresses simply never verify, so they never
 * reach the collection.
 *
 * Google and phone accounts skip this gate entirely: Google verifies the
 * inbox itself, and phone accounts have no email.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  Animated,
  Easing,
  BackHandler,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

import StampHero from '../components/StampHero';
import { useAuth } from '../data/authStore';
import { setOnboarded } from '../data/appState';
import {
  STATUS_BAR_HEIGHT,
  shadow,
  weight,
  ACTIVE_OPACITY,
} from '../styles/platform';

const ACCENT = '#5B2B8A';
const BG = '#FAF8FC';
const INK = '#2F233B';
const MUTED = '#786D82';

const VerifyEmailScreen = ({ navigation }) => {
  const { user, refreshUser, resendVerification, signOut, busy } = useAuth();
  const [error, setError] = useState(null);
  const [note, setNote] = useState(null);
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 480,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [enter]);

  // This screen is a gate: hardware back must not sneak past it.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  const handleContinue = useCallback(async () => {
    setError(null);
    setNote(null);
    const res = await refreshUser();
    const u = res?.user || user;
    if (u?.emailVerified) {
      await setOnboarded(true);
      navigation.reset({ index: 0, routes: [{ name: 'Collections' }] });
    } else {
      setError(
        'Not verified yet. Open the link from your inbox (check spam too) and try again - it can take a minute.'
      );
    }
  }, [refreshUser, user, navigation]);

  const handleResend = useCallback(async () => {
    setError(null);
    const res = await resendVerification();
    if (res?.ok) setNote(`Sent again to ${user?.email}.`);
    else if (res?.error) setError(res.error);
  }, [resendVerification, user]);

  const handleSwitch = useCallback(async () => {
    await signOut();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  }, [signOut, navigation]);

  const enterStyle = {
    opacity: enter,
    transform: [
      { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
    ],
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <View style={{ height: STATUS_BAR_HEIGHT }} />
      <Animated.View style={[styles.page, enterStyle]}>
        <View style={styles.heroWrap}>
          <StampHero width={170} />
        </View>

        <Text style={styles.title}>Verify your email</Text>
        <Text style={styles.subtitle}>
          We sent a verification link to{' '}
          <Text style={styles.email}>{user?.email}</Text>
          {'\n'}
          Your account activates once you open it.
        </Text>

        <View style={styles.infoCard}>
          <Feather name="mail" size={18} color={ACCENT} />
          <Text style={styles.infoText}>
            Nothing arriving? Check spam, or tap Resend below. Addresses you
            don't own simply never verify, so the collection stays locked.
          </Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {note ? <Text style={styles.note}>{note}</Text> : null}

        <TouchableOpacity
          style={[styles.cta, shadow(3)]}
          onPress={handleContinue}
          activeOpacity={0.9}
          disabled={busy}
        >
          <Text style={styles.ctaText}>I've verified it - continue</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondary}
          onPress={handleResend}
          activeOpacity={ACTIVE_OPACITY}
          disabled={busy}
        >
          <Text style={styles.secondaryText}>Resend email</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleSwitch} activeOpacity={ACTIVE_OPACITY}>
          <Text style={styles.switchText}>Use a different account</Text>
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  page: { flex: 1, paddingHorizontal: 24, paddingTop: 12 },
  heroWrap: { alignItems: 'center', marginTop: 8, marginBottom: 18 },
  title: {
    fontSize: 27,
    includeFontPadding: false,
    textAlign: 'center',
    color: INK,
    ...weight(700),
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    includeFontPadding: false,
    textAlign: 'center',
    color: MUTED,
    marginTop: 10,
  },
  email: { color: ACCENT, ...weight(600) },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F3EDF9',
    borderRadius: 12,
    padding: 14,
    marginTop: 22,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    includeFontPadding: false,
    color: '#4A3B5C',
    marginLeft: 10,
  },
  error: {
    marginTop: 14,
    fontSize: 13,
    includeFontPadding: false,
    color: '#B33E50',
    textAlign: 'center',
  },
  note: {
    marginTop: 14,
    fontSize: 13,
    includeFontPadding: false,
    color: '#3B7A3B',
    textAlign: 'center',
  },
  cta: {
    marginTop: 26,
    height: 54,
    borderRadius: 13,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { color: '#fff', fontSize: 16, includeFontPadding: false, ...weight(700) },
  secondary: {
    marginTop: 12,
    height: 50,
    borderRadius: 13,
    borderWidth: 1.4,
    borderColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { color: ACCENT, fontSize: 15, includeFontPadding: false, ...weight(600) },
  switchText: {
    alignSelf: 'center',
    marginTop: 18,
    fontSize: 14,
    includeFontPadding: false,
    color: MUTED,
    ...weight(600),
  },
});

export default VerifyEmailScreen;
