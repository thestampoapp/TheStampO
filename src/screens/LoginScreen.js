/**
 * LoginScreen.js
 *
 * Returning users. Single non-scrolling screen, same adaptive sizing approach
 * as SignupScreen so it fits from 592dp upward without a ScrollView.
 *
 * Includes password reset, which is the piece most signup flows forget.
 */

import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  StatusBar,
  Animated,
  Easing,
  BackHandler,
  Keyboard,
  useWindowDimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAppDialog } from '../components/AppDialog';

import StampHero from '../components/StampHero';
import { useAuth } from '../data/authStore';
import { setOnboarded } from '../data/appState';
import {
  STATUS_BAR_HEIGHT,
  useBottomInset,
  shadow,
  weight,
  HAIRLINE,
  ACTIVE_OPACITY,
} from '../styles/platform';

const ACCENT = '#5B2B8A';
const BG = '#FAF8FC';
const INK = '#2F233B';
const MUTED = '#786D82';
const FIELD_BORDER = '#E3DDEA';

const NEXT_ROUTE = 'Collections';
const CONTENT_RATIO = 0.873;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const HERO_MIN = 96;
const HERO_MAX = 190;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const Field = React.forwardRef(function Field(
  { icon, error, trailing, height, ...inputProps },
  ref
) {
  const [focused, setFocused] = useState(false);
  return (
    <View
      style={[
        styles.field,
        { height },
        focused && styles.fieldFocused,
        !!error && styles.fieldError,
      ]}
    >
      <Feather name={icon} size={18} color={error ? ACCENT : '#665B70'} />
      <TextInput
        ref={ref}
        style={styles.input}
        placeholderTextColor="#A9A49D"
        underlineColorAndroid="transparent"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...inputProps}
      />
      {trailing}
    </View>
  );
});

const LoginScreen = ({ navigation }) => {
  const { showDialog } = useAppDialog();
  const { height: winH } = useWindowDimensions();
  const bottomInset = useBottomInset();
  const { signIn, google, resetPassword, googleAvailable, busy } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState({});
  const [keyboardUp, setKeyboardUp] = useState(false);

  const pwRef = useRef(null);
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const s = Keyboard.addListener('keyboardDidShow', () => setKeyboardUp(true));
    const h = Keyboard.addListener('keyboardDidHide', () => setKeyboardUp(false));
    return () => {
      s.remove();
      h.remove();
    };
  }, []);

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 460,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [enter]);

  const L = useMemo(() => {
    const usable = winH - STATUS_BAR_HEIGHT - bottomInset;
    const comfy = {
      pad: 14, back: 34, title: 34, subtitle: 40, field: 54, fieldGap: 11,
      forgot: 30, cta: 56, orRow: 40, social: 52, login: 26,
    };
    const tight = {
      pad: 8, back: 30, title: 30, subtitle: 22, field: 48, fieldGap: 8,
      forgot: 26, cta: 50, orRow: 30, social: 46, login: 22,
    };
    const measure = (m) =>
      m.pad * 2 + m.back + m.title + m.subtitle + m.field * 2 + m.fieldGap +
      m.forgot + 12 + m.cta + m.orRow + m.social + 10 + m.login;

    let m = comfy;
    let used = measure(m);
    if (used > usable) {
      m = tight;
      used = measure(m);
    }
    const leftover = usable - used;
    const heroH = leftover >= HERO_MIN ? clamp(leftover, HERO_MIN, HERO_MAX) : 0;
    return { ...m, heroH };
  }, [winH, bottomInset]);

  const showHero = L.heroH > 0 && !keyboardUp;

  /**
   * Reaching the dashboard with a real account means onboarding is complete
   * for good. `reset` clears the auth stack so back cannot return to Login.
   */
  const goNext = useCallback(async () => {
    await setOnboarded(true);
    navigation.reset({ index: 0, routes: [{ name: NEXT_ROUTE }] });
  }, [navigation]);

  /**
   * Back only makes sense if there IS somewhere to go back to. When Login is
   * the root (signed out, or relaunched past onboarding) it is the gate, so
   * back must not escape it.
   */
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (navigation.canGoBack()) navigation.goBack();
      return true;
    });
    return () => sub.remove();
  }, [navigation]);

  const handleLogin = useCallback(async () => {
    const next = {};
    if (!email.trim()) next.email = 'Enter your email';
    else if (!EMAIL_RE.test(email.trim())) next.email = 'That email looks off';
    if (!password) next.password = 'Enter your password';
    setErrors(next);
    if (Object.keys(next).length) return;

    const res = await signIn({ email, password });
    if (res.ok) {
      if (res.user?.email && !res.user.emailVerified) {
        navigation.reset({ index: 0, routes: [{ name: 'VerifyEmail' }] });
      } else {
        await goNext();
      }
    } else if (res.error) {
      setErrors({ form: res.error });
    }
  }, [email, password, signIn, goNext]);

  const handleGoogle = useCallback(async () => {
    const res = await google();
    if (res.ok) await goNext();
    else if (res.error) setErrors({ form: res.error });
  }, [google, goNext]);

  const handleForgot = useCallback(async () => {
    if (!email.trim() || !EMAIL_RE.test(email.trim())) {
      setErrors({ email: 'Enter your email first, then tap reset' });
      return;
    }
    const res = await resetPassword(email);
    if (res.ok) {
      showDialog({ title: 'Check your inbox', message: `We sent a reset link to ${email.trim()}.` });
    } else if (res.error) {
      setErrors({ form: res.error });
    }
  }, [email, resetPassword, showDialog]);

  const enterStyle = {
    opacity: enter,
    transform: [
      { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
    ],
  };

  const firstError = errors.form || errors.email || errors.password;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <View style={{ height: STATUS_BAR_HEIGHT }} />

      <Animated.View
        style={[
          styles.page,
          { paddingVertical: L.pad, paddingBottom: L.pad + bottomInset },
          enterStyle,
        ]}
      >
        <TouchableOpacity
          style={[styles.back, { height: L.back }]}
          onPress={() => navigation.goBack()}
          activeOpacity={ACTIVE_OPACITY}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Feather name="arrow-left" size={23} color={INK} />
        </TouchableOpacity>

        {showHero ? (
          <View style={[styles.heroWrap, { height: L.heroH }]}>
            <StampHero width={Math.min(200, L.heroH * 1.18)} />
          </View>
        ) : null}

        <Text style={[styles.title, { height: L.title }]} numberOfLines={1}>
          Welcome back
        </Text>
        <Text style={styles.subtitle} numberOfLines={2}>
          Log in to reach your collection.
        </Text>

        <Field
          height={L.field}
          icon="mail"
          value={email}
          onChangeText={setEmail}
          placeholder="Email address"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
          error={errors.email}
          onSubmitEditing={() => pwRef.current?.focus()}
        />
        <View style={{ height: L.fieldGap }} />

        <Field
          ref={pwRef}
          height={L.field}
          icon="lock"
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          secureTextEntry={!showPw}
          autoCapitalize="none"
          autoComplete="password"
          textContentType="password"
          returnKeyType="done"
          error={errors.password}
          onSubmitEditing={handleLogin}
          trailing={
            <TouchableOpacity
              onPress={() => setShowPw((v) => !v)}
              hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
              activeOpacity={ACTIVE_OPACITY}
            >
              <Feather name={showPw ? 'eye-off' : 'eye'} size={18} color="#665B70" />
            </TouchableOpacity>
          }
        />

        <View style={[styles.forgotRow, { height: L.forgot }]}>
          {firstError ? (
            <Text style={styles.errorText} numberOfLines={1}>
              {firstError}
            </Text>
          ) : (
            <View />
          )}
          <TouchableOpacity onPress={handleForgot} activeOpacity={ACTIVE_OPACITY}>
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.cta, { height: L.cta }, shadow(3)]}
          onPress={handleLogin}
          activeOpacity={0.9}
          disabled={busy}
        >
          <Text style={styles.ctaText}>{busy ? 'Logging in…' : 'Log In'}</Text>
        </TouchableOpacity>

        <View style={[styles.orRow, { height: L.orRow }]}>
          <View style={styles.rule} />
          <Text style={styles.orText}>OR</Text>
          <View style={styles.rule} />
        </View>

        <View style={styles.socialRow}>
          <TouchableOpacity
            style={[styles.socialBtn, { height: L.social }]}
            activeOpacity={ACTIVE_OPACITY}
            onPress={handleGoogle}
            disabled={busy}
          >
            <Text style={styles.googleG}>G</Text>
            <Text style={styles.socialText}>Google</Text>
          </TouchableOpacity>

          <View style={{ width: 12 }} />

          <TouchableOpacity
            style={[styles.socialBtn, { height: L.social }]}
            activeOpacity={ACTIVE_OPACITY}
            onPress={() => navigation.navigate('PhoneAuth')}
          >
            <Feather name="smartphone" size={18} color={INK} />
            <Text style={styles.socialText}>Phone</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.spacer} />

        <View style={[styles.loginRow, { height: L.login }]}>
          <Text style={styles.loginMuted}>New here? </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('Signup')}
            activeOpacity={ACTIVE_OPACITY}
          >
            <Text style={styles.loginLink}>Create an account</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  page: { flex: 1, paddingHorizontal: `${((1 - CONTENT_RATIO) / 2) * 100}%` },
  back: { alignSelf: 'flex-start', justifyContent: 'center', paddingRight: 12 },
  heroWrap: { alignItems: 'center', justifyContent: 'center' },
  title: {
    fontSize: 27,
    includeFontPadding: false,
    textAlign: 'center',
    color: INK,
    textAlignVertical: 'center',
    ...weight(700),
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 21,
    includeFontPadding: false,
    textAlign: 'center',
    color: MUTED,
    marginBottom: 14,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 13,
    borderWidth: HAIRLINE,
    borderColor: FIELD_BORDER,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 15,
  },
  fieldFocused: { borderColor: ACCENT, borderWidth: 1.4 },
  fieldError: { borderColor: ACCENT, borderWidth: 1.4 },
  input: {
    flex: 1,
    marginLeft: 11,
    fontSize: 15.5,
    color: INK,
    includeFontPadding: false,
    paddingVertical: 0,
  },
  forgotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorText: {
    flex: 1,
    fontSize: 12.5,
    includeFontPadding: false,
    color: ACCENT,
    marginRight: 8,
  },
  forgotText: {
    fontSize: 13.5,
    includeFontPadding: false,
    color: ACCENT,
    ...weight(600),
  },
  cta: {
    borderRadius: 13,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  ctaText: { color: '#fff', fontSize: 17, includeFontPadding: false, ...weight(700) },
  orRow: { flexDirection: 'row', alignItems: 'center' },
  rule: { flex: 1, height: HAIRLINE, backgroundColor: '#E6DEED' },
  orText: {
    marginHorizontal: 12,
    fontSize: 13,
    includeFontPadding: false,
    color: '#786D82',
  },
  socialRow: { flexDirection: 'row' },
  socialBtn: {
    flex: 1,
    borderRadius: 13,
    borderWidth: HAIRLINE,
    borderColor: FIELD_BORDER,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialText: {
    marginLeft: 9,
    fontSize: 15,
    includeFontPadding: false,
    color: INK,
    ...weight(600),
  },
  googleG: {
    fontSize: 18,
    includeFontPadding: false,
    color: '#4285F4',
    ...weight(700),
  },
  spacer: { flex: 1, minHeight: 8 },
  loginRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  loginMuted: { fontSize: 14, includeFontPadding: false, color: '#6F6478' },
  loginLink: { fontSize: 14, includeFontPadding: false, color: ACCENT, ...weight(700) },
});

export default LoginScreen;
