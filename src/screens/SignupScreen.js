/**
 * SignupScreen.js
 *
 * Shown after the trial experience ends (Rating -> "Maybe later").
 *
 * SINGLE SCREEN, NO SCROLLING.
 * ---------------------------
 * The naive layout needed ~1108dp of vertical space; a 640dp phone only
 * offers ~616dp once the status bar is gone. Three things make it fit:
 *
 *   1. labels are folded INTO the fields as placeholders  (-92dp)
 *   2. the two social buttons sit side by side as icons   (-72dp)
 *   3. the hero is elastic: it takes whatever height is left over, and
 *      disappears entirely below a threshold instead of pushing the form off
 *
 * Sizes are therefore computed from the measured window rather than being
 * constants, so the form always lands on one screen.
 *
 * Signing up is SKIPPABLE -- everything before this is an anonymous local
 * trial and those stamps are already saved.
 *
 * Android: SafeAreaView does not inset (status bar reserved manually), the
 * window resizes itself for the keyboard, hardware back continues into the
 * app, and autofill hints are set on every field.
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
  Linking,
  Keyboard,
  useWindowDimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

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

/** Where signup hands off to, whether completed or skipped. */
const NEXT_ROUTE = 'Collections';

const CONTENT_RATIO = 0.873;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Below this much leftover space the hero is dropped rather than squashed. */
const HERO_MIN = 96;
const HERO_MAX = 190;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * Compact field: the label lives inside as the placeholder, which saves 23dp
 * per field over a stacked label without losing clarity.
 */
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

const SignupScreen = ({ navigation }) => {
  const { height: winH } = useWindowDimensions();
  const bottomInset = useBottomInset();
  const { signUp, google, busy, isMock, mockReason } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [keyboardUp, setKeyboardUp] = useState(false);

  const emailRef = useRef(null);
  const pwRef = useRef(null);
  const confirmRef = useRef(null);
  const enter = useRef(new Animated.Value(0)).current;

  /**
   * Android resizes the window when the keyboard opens, so `winH` shrinks and
   * the layout below recomputes on its own. We additionally hide the hero
   * while typing to buy back space on small devices.
   */
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardUp(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardUp(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 480,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [enter]);

  // -- adaptive vertical layout -------------------------------------------
  const L = useMemo(() => {
    const usable = winH - STATUS_BAR_HEIGHT - bottomInset;

    // Everything that is not the hero, at comfortable sizes.
    const comfortable = {
      pad: 14,
      back: 34,
      title: 34,
      subtitle: 40,
      field: 54,
      fieldGap: 11,
      terms: 30,
      cta: 56,
      orRow: 40,
      social: 52,
      login: 26,
    };

    // Tight variant for short screens.
    const tight = {
      pad: 8,
      back: 30,
      title: 30,
      subtitle: 22,
      field: 48,
      fieldGap: 8,
      terms: 26,
      cta: 50,
      orRow: 30,
      social: 46,
      login: 22,
    };

    const measure = (m) =>
      m.pad * 2 +
      m.back +
      m.title +
      m.subtitle +
      m.field * 4 +
      m.fieldGap * 3 +
      12 + m.terms +
      12 + m.cta +
      m.orRow +
      m.social +
      10 + m.login;

    let m = comfortable;
    let used = measure(m);
    if (used > usable) {
      m = tight;
      used = measure(m);
    }

    const leftover = usable - used;
    // The hero absorbs slack; it vanishes if there isn't enough for it.
    const heroH = leftover >= HERO_MIN ? clamp(leftover, HERO_MIN, HERO_MAX) : 0;

    return { ...m, heroH, fits: used <= usable };
  }, [winH, bottomInset]);

  const showHero = L.heroH > 0 && !keyboardUp;

  // -- actions -------------------------------------------------------------
  /**
   * Signup succeeded: the account is now permanent, so onboarding is done and
   * must never replay. `reset` (not navigate) wipes the onboarding stack, so
   * hardware-back from the dashboard cannot walk back into the funnel.
   */
  const goNext = useCallback(async () => {
    await setOnboarded(true);
    navigation.reset({ index: 0, routes: [{ name: NEXT_ROUTE }] });
  }, [navigation]);

  /**
   * Signup is the gate. Hardware-back used to call goNext(), which walked
   * straight into the dashboard WITHOUT an account -- swallow it instead.
   */
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  const validate = useCallback(() => {
    const next = {};
    if (!name.trim()) next.name = 'Enter your name';
    if (!email.trim()) next.email = 'Enter your email';
    else if (!EMAIL_RE.test(email.trim())) next.email = 'That email looks off';
    if (!password) next.password = 'Choose a password';
    else if (password.length < 8) next.password = 'At least 8 characters';
    if (confirm !== password) next.confirm = 'Passwords do not match';
    if (!agreed) next.agreed = 'Please accept the terms';
    setErrors(next);
    return Object.keys(next).length === 0;
  }, [name, email, password, confirm, agreed]);

  const handleCreate = useCallback(async () => {
    if (submitting || busy) return;
    if (!validate()) return;

    setSubmitting(true);
    const res = await signUp({ name, email, password });
    setSubmitting(false);

    if (res.ok) {
      await goNext();
      return;
    }
    // res.error === null means the user cancelled -- say nothing.
    if (res.error) setErrors({ form: res.error });
  }, [submitting, busy, validate, signUp, name, email, password, goNext]);

  const handleGoogle = useCallback(async () => {
    const res = await google();
    if (res.ok) await goNext();
    else if (res.error) setErrors({ form: res.error });
  }, [google, goNext]);

  const openLink = useCallback((url) => {
    Linking.openURL(url).catch(() => {});
  }, []);

  const enterStyle = {
    opacity: enter,
    transform: [
      { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
    ],
  };

  const eye = (visible, toggle) => (
    <TouchableOpacity
      onPress={toggle}
      hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
      activeOpacity={ACTIVE_OPACITY}
    >
      <Feather name={visible ? 'eye-off' : 'eye'} size={18} color="#665B70" />
    </TouchableOpacity>
  );

  /** First error to surface, shown in one shared slot to save space. */
  const firstError =
    errors.form ||
    errors.name ||
    errors.email ||
    errors.password ||
    errors.confirm ||
    errors.agreed;

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
          onPress={goNext}
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

        <Text
          style={[styles.title, { height: L.title, fontSize: L.title >= 34 ? 27 : 24 }]}
          numberOfLines={1}
        >
          Create your account
        </Text>

        {L.subtitle >= 40 ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            Save your stamps forever and{'\n'}sync them across all your devices.
          </Text>
        ) : (
          <Text style={styles.subtitleTight} numberOfLines={1}>
            Save your stamps forever.
          </Text>
        )}

        {/* DEV-ONLY: makes it impossible to mistake mock auth for the real
            thing. Nothing reaches Firebase while this is showing. */}
        {isMock ? (
          <View style={styles.mockBanner}>
            <Text style={styles.mockTitle}>MOCK AUTH — not saving to Firebase</Text>
            {mockReason ? (
              <Text style={styles.mockReason} numberOfLines={3}>
                {mockReason}
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* Fields — labels folded in as placeholders to save vertical space */}
        <Field
          height={L.field}
          icon="user"
          value={name}
          onChangeText={setName}
          placeholder="Full name"
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          returnKeyType="next"
          error={errors.name}
          onSubmitEditing={() => emailRef.current?.focus()}
        />
        <View style={{ height: L.fieldGap }} />

        <Field
          ref={emailRef}
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
          autoComplete="password-new"
          textContentType="newPassword"
          returnKeyType="next"
          error={errors.password}
          trailing={eye(showPw, () => setShowPw((v) => !v))}
          onSubmitEditing={() => confirmRef.current?.focus()}
        />
        <View style={{ height: L.fieldGap }} />

        <Field
          ref={confirmRef}
          height={L.field}
          icon="lock"
          value={confirm}
          onChangeText={setConfirm}
          placeholder="Confirm password"
          secureTextEntry={!showConfirm}
          autoCapitalize="none"
          autoComplete="password-new"
          textContentType="newPassword"
          returnKeyType="done"
          error={errors.confirm}
          trailing={eye(showConfirm, () => setShowConfirm((v) => !v))}
          onSubmitEditing={handleCreate}
        />

        {/* One shared error slot rather than four */}
        <View style={styles.errorSlot}>
          {firstError ? <Text style={styles.errorText}>{firstError}</Text> : null}
        </View>

        <TouchableOpacity
          style={[styles.termsRow, { minHeight: L.terms }]}
          onPress={() => setAgreed((v) => !v)}
          activeOpacity={ACTIVE_OPACITY}
        >
          <View style={[styles.checkbox, agreed && styles.checkboxOn]}>
            {agreed ? <Feather name="check" size={14} color="#fff" /> : null}
          </View>
          <Text style={styles.termsText} numberOfLines={2}>
            I agree to the{' '}
            <Text style={styles.link} onPress={() => openLink('https://example.com/terms')}>
              Terms
            </Text>{' '}
            and{' '}
            <Text style={styles.link} onPress={() => openLink('https://example.com/privacy')}>
              Privacy Policy
            </Text>
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.cta, { height: L.cta }, shadow(3)]}
          onPress={handleCreate}
          activeOpacity={0.9}
          disabled={submitting}
        >
          <Text style={styles.ctaText}>
            {submitting || busy ? 'Creating…' : 'Create Account'}
          </Text>
        </TouchableOpacity>

        <View style={[styles.orRow, { height: L.orRow }]}>
          <View style={styles.rule} />
          <Text style={styles.orText}>OR</Text>
          <View style={styles.rule} />
        </View>

        {/* Social options share a row: two stacked buttons cost 72dp extra */}
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

        {/* Pushes the login row to the bottom when there is spare room */}
        <View style={styles.spacer} />

        <View style={[styles.loginRow, { height: L.login }]}>
          <Text style={styles.loginMuted}>Already have an account? </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('Login')}
            activeOpacity={ACTIVE_OPACITY}
          >
            <Text style={styles.loginLink}>Log in</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  mockBanner: {
    backgroundColor: '#FCEEEF',
    borderWidth: 1,
    borderColor: '#E6AEB8',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  mockTitle: {
    fontSize: 12,
    includeFontPadding: false,
    color: '#B33E50',
    ...weight(700),
  },
  mockReason: {
    marginTop: 3,
    fontSize: 11,
    includeFontPadding: false,
    color: '#884957',
    lineHeight: 15,
  },

  container: { flex: 1, backgroundColor: BG },

  page: {
    flex: 1,
    paddingHorizontal: `${((1 - CONTENT_RATIO) / 2) * 100}%`,
  },

  back: { alignSelf: 'flex-start', justifyContent: 'center', paddingRight: 12 },

  heroWrap: { alignItems: 'center', justifyContent: 'center' },

  title: {
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
  subtitleTight: {
    fontSize: 14,
    includeFontPadding: false,
    textAlign: 'center',
    color: MUTED,
    marginBottom: 10,
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

  errorSlot: { minHeight: 18, justifyContent: 'center' },
  errorText: {
    fontSize: 12.5,
    includeFontPadding: false,
    color: ACCENT,
    marginLeft: 4,
  },

  termsRow: { flexDirection: 'row', alignItems: 'center' },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.6,
    borderColor: '#D8D0E1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  checkboxOn: { backgroundColor: ACCENT, borderColor: ACCENT },
  termsText: {
    flex: 1,
    fontSize: 13.5,
    lineHeight: 19,
    includeFontPadding: false,
    color: INK,
  },
  link: { color: ACCENT, ...weight(600) },

  cta: {
    borderRadius: 13,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 17,
    includeFontPadding: false,
    ...weight(700),
  },

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

  loginRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginMuted: { fontSize: 14, includeFontPadding: false, color: '#6F6478' },
  loginLink: { fontSize: 14, includeFontPadding: false, color: ACCENT, ...weight(700) },
});

export default SignupScreen;
