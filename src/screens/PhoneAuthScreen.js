/**
 * PhoneAuthScreen.js
 *
 * Two-step phone sign-in in one screen:
 *   step 'phone' -> enter number, request an SMS code
 *   step 'code'  -> enter the 6 digits
 *
 * Kept as one screen so "wrong number, go back" is a state change rather than
 * a navigation pop, and the confirmation handle from step 1 stays in scope.
 *
 * Includes a resend cooldown: SMS is metered, and Firebase rate-limits
 * aggressively, so an un-throttled resend button is a real cost bug.
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
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
const RESEND_SECONDS = 60;
const CODE_LENGTH = 6;

/** Default dial code. India, matching the app's primary audience. */
const DEFAULT_DIAL = '+91';

/**
 * Firebase phone authentication accepts E.164 numbers only. Keep the country
 * code and local number separate in the UI, then validate the final value
 * before asking Firebase to send a chargeable SMS.
 */
function normalisePhoneNumber(dial, localNumber) {
  const countryCode = String(dial || '').replace(/\D/g, '');
  const subscriber = String(localNumber || '').replace(/\D/g, '');
  const fullNumber = countryCode && subscriber ? `+${countryCode}${subscriber}` : '';

  if (countryCode.length < 1 || countryCode.length > 3 || countryCode.startsWith('0')) {
    return { error: 'Enter a valid country code.' };
  }
  if (subscriber.length < 6) {
    return { error: 'Enter a valid mobile number.' };
  }
  if (fullNumber.length > 16) {
    return { error: 'That phone number is too long.' };
  }
  return { phoneNumber: fullNumber };
}

const PhoneAuthScreen = ({ navigation }) => {
  const { height: winH } = useWindowDimensions();
  const { requestCode, confirmCode, busy } = useAuth();

  const [step, setStep] = useState('phone');
  const [dial, setDial] = useState(DEFAULT_DIAL);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [resendAt, setResendAt] = useState(null);
  const [clock, setClock] = useState(Date.now());
  const [notice, setNotice] = useState(null);
  const [keyboardUp, setKeyboardUp] = useState(false);
  const bottomInset = useBottomInset();

  const confirmationRef = useRef(null);
  const codeRef = useRef(null);
  const requestInFlight = useRef(false);
  const confirmInFlight = useRef(false);
  const focusTimer = useRef(null);
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
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [enter]);

  /**
   * Derive the countdown from a deadline rather than decrementing a counter.
   * This stays correct if the app is briefly backgrounded or the JS timer is
   * delayed by the operating system.
   */
  useEffect(() => {
    if (!resendAt || resendAt <= Date.now()) return undefined;
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [resendAt]);

  useEffect(
    () => () => {
      if (focusTimer.current) clearTimeout(focusTimer.current);
    },
    []
  );

  /** Hardware back steps back through the flow before leaving. */
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step === 'code') {
        setStep('phone');
        setCode('');
        setError(null);
        setNotice(null);
        confirmationRef.current = null;
        return true;
      }
      navigation.goBack();
      return true;
    });
    return () => sub.remove();
  }, [step, navigation]);

  const phoneDetails = useMemo(() => normalisePhoneNumber(dial, phone), [dial, phone]);
  const fullNumber = phoneDetails.phoneNumber || '';
  const resendSeconds = resendAt
    ? Math.max(0, Math.ceil((resendAt - clock) / 1000))
    : 0;

  const showHero = !keyboardUp && winH > 700;

  const sendCode = useCallback(async (isResend = false) => {
    if (busy || requestInFlight.current) return;
    if (isResend && resendSeconds > 0) return;
    if (!phoneDetails.phoneNumber) {
      setError(phoneDetails.error || 'Enter a valid phone number.');
      return;
    }

    requestInFlight.current = true;
    setError(null);
    setNotice(null);
    try {
      const res = await requestCode(phoneDetails.phoneNumber);
      if (res.ok && res.confirmation) {
        confirmationRef.current = res.confirmation;
        setCode('');
        setStep('code');
        setResendAt(Date.now() + RESEND_SECONDS * 1000);
        if (isResend) setNotice('A new code has been sent.');
        if (focusTimer.current) clearTimeout(focusTimer.current);
        focusTimer.current = setTimeout(() => codeRef.current?.focus(), 250);
      } else {
        setError(res.error || 'Unable to send a code. Please try again.');
      }
    } finally {
      requestInFlight.current = false;
    }
  }, [busy, phoneDetails, requestCode, resendSeconds]);

  const handleConfirm = useCallback(
    async (value) => {
      if (busy || confirmInFlight.current) return;
      const c = (value ?? code).replace(/[^\d]/g, '');
      if (c.length !== CODE_LENGTH) {
        setError(`Enter the ${CODE_LENGTH}-digit code`);
        return;
      }
      if (!confirmationRef.current) {
        setError('Request a new code and try again.');
        return;
      }
      confirmInFlight.current = true;
      setError(null);
      setNotice(null);
      try {
        const res = await confirmCode(confirmationRef.current, c);
        if (res.ok) {
          // Phone verified => permanent account => onboarding is finished.
          await setOnboarded(true);
          navigation.reset({ index: 0, routes: [{ name: NEXT_ROUTE }] });
        } else {
          setError(res.error || 'Unable to verify that code. Try again.');
          if (res.code === 'auth/invalid-verification-code') {
            setCode('');
            codeRef.current?.focus();
          }
          if (res.code === 'auth/session-expired') {
            confirmationRef.current = null;
          }
        }
      } finally {
        confirmInFlight.current = false;
      }
    },
    [code, confirmCode, navigation]
  );

  /** Manual code entry only. The user chooses when to submit it. */
  const onCodeChange = useCallback(
    (v) => {
      const digits = v.replace(/[^\d]/g, '').slice(0, CODE_LENGTH);
      setCode(digits);
      if (error) setError(null);
    },
    [error]
  );

  const enterStyle = {
    opacity: enter,
    transform: [
      { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
    ],
  };

  const boxes = useMemo(() => Array.from({ length: CODE_LENGTH }), []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <View style={{ height: STATUS_BAR_HEIGHT }} />

      <Animated.View style={[styles.page, { paddingBottom: 14 + bottomInset }, enterStyle]}>
        <TouchableOpacity
          style={styles.back}
          onPress={() => {
            if (step === 'code') {
              setStep('phone');
              setCode('');
              setError(null);
              setNotice(null);
              confirmationRef.current = null;
            } else {
              navigation.goBack();
            }
          }}
          activeOpacity={ACTIVE_OPACITY}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Feather name="arrow-left" size={23} color={INK} />
        </TouchableOpacity>

        {showHero ? (
          <View style={styles.heroWrap}>
            <StampHero width={170} />
          </View>
        ) : null}

        <Text style={styles.title}>
          {step === 'phone' ? 'Sign in with phone' : 'Enter the code'}
        </Text>
        <Text style={styles.subtitle}>
          {step === 'phone'
            ? 'We’ll text you a six-digit code.'
            : `Sent to ${fullNumber}`}
        </Text>

        {step === 'phone' ? (
          <>
            <View style={styles.phoneRow}>
              <View style={styles.dialBox}>
                <TextInput
                  style={styles.dialInput}
                  value={dial}
                  onChangeText={(v) => {
                    setDial(`+${v.replace(/\D/g, '').slice(0, 3)}`);
                    if (error) setError(null);
                  }}
                  keyboardType="phone-pad"
                  maxLength={4}
                  accessibilityLabel="Country calling code"
                  underlineColorAndroid="transparent"
                />
              </View>
              <View style={{ width: 10 }} />
              <View style={[styles.field, styles.phoneField, !!error && styles.fieldError]}>
                <Feather name="smartphone" size={18} color={error ? ACCENT : '#665B70'} />
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={(v) => {
                    setPhone(v);
                    if (error) setError(null);
                  }}
                  placeholder="98765 43210"
                  placeholderTextColor="#A9A49D"
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  textContentType="telephoneNumber"
                  maxLength={15}
                  returnKeyType="done"
                  underlineColorAndroid="transparent"
                  onSubmitEditing={() => sendCode(false)}
                />
              </View>
            </View>

            <View style={styles.errorSlot}>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
            </View>

            <TouchableOpacity
              style={[styles.cta, shadow(3)]}
              onPress={() => sendCode(false)}
              activeOpacity={0.9}
              disabled={busy}
            >
              <Text style={styles.ctaText}>{busy ? 'Sending…' : 'Send code'}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => codeRef.current?.focus()}
              style={styles.codeRow}
              accessibilityLabel="Six digit verification code"
            >
              {boxes.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.codeBox,
                    i === code.length && styles.codeBoxActive,
                    !!error && styles.codeBoxError,
                  ]}
                >
                  <Text style={styles.codeDigit}>{code[i] || ''}</Text>
                </View>
              ))}
            </TouchableOpacity>

            <TextInput
              ref={codeRef}
              style={styles.hiddenInput}
              value={code}
              onChangeText={onCodeChange}
              keyboardType="number-pad"
              autoComplete="off"
              maxLength={CODE_LENGTH}
              autoFocus
              caretHidden
            />

            <View style={styles.errorSlot}>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}
            </View>

            <TouchableOpacity
              style={[styles.cta, shadow(3)]}
              onPress={() => handleConfirm()}
              activeOpacity={0.9}
              disabled={busy}
            >
              <Text style={styles.ctaText}>{busy ? 'Verifying…' : 'Verify'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.resend}
              onPress={() => sendCode(true)}
              disabled={resendSeconds > 0 || busy}
              activeOpacity={ACTIVE_OPACITY}
            >
              <Text style={[styles.resendText, resendSeconds > 0 && styles.resendOff]}>
                {resendSeconds > 0 ? `Resend code in ${resendSeconds}s` : 'Resend code'}
              </Text>
            </TouchableOpacity>
          </>
        )}

        <View style={styles.spacer} />
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  page: {
    flex: 1,
    paddingHorizontal: `${((1 - CONTENT_RATIO) / 2) * 100}%`,
    paddingVertical: 14,
  },
  back: { alignSelf: 'flex-start', height: 34, justifyContent: 'center', paddingRight: 12 },
  heroWrap: { alignItems: 'center', justifyContent: 'center', marginVertical: 6 },
  title: {
    fontSize: 27,
    includeFontPadding: false,
    textAlign: 'center',
    color: INK,
    marginTop: 8,
    ...weight(700),
  },
  subtitle: {
    marginTop: 8,
    fontSize: 15,
    includeFontPadding: false,
    textAlign: 'center',
    color: MUTED,
    marginBottom: 20,
  },

  phoneRow: { flexDirection: 'row' },
  dialBox: {
    width: 78,
    height: 54,
    borderRadius: 13,
    borderWidth: HAIRLINE,
    borderColor: FIELD_BORDER,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  dialInput: {
    fontSize: 15.5,
    color: INK,
    includeFontPadding: false,
    paddingVertical: 0,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 54,
    borderRadius: 13,
    borderWidth: HAIRLINE,
    borderColor: FIELD_BORDER,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 15,
  },
  phoneField: { flex: 1 },
  fieldError: { borderColor: ACCENT, borderWidth: 1.4 },
  input: {
    flex: 1,
    marginLeft: 11,
    fontSize: 15.5,
    color: INK,
    includeFontPadding: false,
    paddingVertical: 0,
  },

  codeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  codeBox: {
    flex: 1,
    height: 58,
    marginHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1.4,
    borderColor: FIELD_BORDER,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeBoxActive: { borderColor: ACCENT },
  codeBoxError: { borderColor: ACCENT },
  codeDigit: {
    fontSize: 22,
    includeFontPadding: false,
    color: INK,
    ...weight(700),
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    height: 1,
    width: 1,
  },

  errorSlot: { minHeight: 22, justifyContent: 'center' },
  errorText: {
    fontSize: 13,
    includeFontPadding: false,
    color: ACCENT,
    textAlign: 'center',
  },
  noticeText: {
    fontSize: 13,
    includeFontPadding: false,
    color: MUTED,
    textAlign: 'center',
  },

  cta: {
    height: 56,
    borderRadius: 13,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  ctaText: { color: '#fff', fontSize: 17, includeFontPadding: false, ...weight(700) },

  resend: { alignSelf: 'center', padding: 14 },
  resendText: {
    fontSize: 14.5,
    includeFontPadding: false,
    color: ACCENT,
    ...weight(600),
  },
  resendOff: { color: '#A9A49D' },

  spacer: { flex: 1 },
});

export default PhoneAuthScreen;
