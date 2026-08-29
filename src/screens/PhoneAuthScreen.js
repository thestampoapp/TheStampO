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
const RESEND_SECONDS = 30;
const CODE_LENGTH = 6;

/** Default dial code. India, matching the app's primary audience. */
const DEFAULT_DIAL = '+91';

const PhoneAuthScreen = ({ navigation }) => {
  const { height: winH } = useWindowDimensions();
  const { requestCode, confirmCode, busy } = useAuth();

  const [step, setStep] = useState('phone');
  const [dial, setDial] = useState(DEFAULT_DIAL);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [cooldown, setCooldown] = useState(0);
  const [keyboardUp, setKeyboardUp] = useState(false);
  const bottomInset = useBottomInset();

  const confirmationRef = useRef(null);
  const codeRef = useRef(null);
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

  /** Resend countdown. */
  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  /** Hardware back steps back through the flow before leaving. */
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step === 'code') {
        setStep('phone');
        setCode('');
        setError(null);
        return true;
      }
      navigation.goBack();
      return true;
    });
    return () => sub.remove();
  }, [step, navigation]);

  const fullNumber = useMemo(
    () => `${dial}${phone.replace(/[^\d]/g, '')}`,
    [dial, phone]
  );

  const showHero = !keyboardUp && winH > 700;

  const handleSend = useCallback(async () => {
    const digits = phone.replace(/[^\d]/g, '');
    if (digits.length < 6) {
      setError('Enter a valid phone number');
      return;
    }
    setError(null);
    const res = await requestCode(fullNumber);
    if (res.ok) {
      confirmationRef.current = res.confirmation;
      setStep('code');
      setCooldown(RESEND_SECONDS);
      setTimeout(() => codeRef.current?.focus(), 250);
    } else if (res.error) {
      setError(res.error);
    }
  }, [phone, fullNumber, requestCode]);

  const handleConfirm = useCallback(
    async (value) => {
      const c = (value ?? code).replace(/[^\d]/g, '');
      if (c.length !== CODE_LENGTH) {
        setError(`Enter the ${CODE_LENGTH}-digit code`);
        return;
      }
      setError(null);
      const res = await confirmCode(confirmationRef.current, c);
      if (res.ok) {
        // Phone verified => permanent account => onboarding is finished.
        await setOnboarded(true);
        navigation.reset({ index: 0, routes: [{ name: NEXT_ROUTE }] });
      } else if (res.error) setError(res.error);
    },
    [code, confirmCode, navigation]
  );

  /** Auto-submit once all six digits are in -- saves a tap. */
  const onCodeChange = useCallback(
    (v) => {
      const digits = v.replace(/[^\d]/g, '').slice(0, CODE_LENGTH);
      setCode(digits);
      if (digits.length === CODE_LENGTH) {
        Keyboard.dismiss();
        handleConfirm(digits);
      }
    },
    [handleConfirm]
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
                  onChangeText={(v) => setDial(v.startsWith('+') ? v : `+${v}`)}
                  keyboardType="phone-pad"
                  maxLength={5}
                  underlineColorAndroid="transparent"
                />
              </View>
              <View style={{ width: 10 }} />
              <View style={[styles.field, styles.phoneField, !!error && styles.fieldError]}>
                <Feather name="smartphone" size={18} color={error ? ACCENT : '#665B70'} />
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="98765 43210"
                  placeholderTextColor="#A9A49D"
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  textContentType="telephoneNumber"
                  maxLength={15}
                  returnKeyType="done"
                  underlineColorAndroid="transparent"
                  onSubmitEditing={handleSend}
                />
              </View>
            </View>

            <View style={styles.errorSlot}>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
            </View>

            <TouchableOpacity
              style={[styles.cta, shadow(3)]}
              onPress={handleSend}
              activeOpacity={0.9}
              disabled={busy}
            >
              <Text style={styles.ctaText}>{busy ? 'Sending…' : 'Send code'}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {/* Visual boxes over one hidden input: keeps SMS autofill working,
                which per-digit inputs famously break on Android. */}
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => codeRef.current?.focus()}
              style={styles.codeRow}
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
              autoComplete="sms-otp"
              textContentType="oneTimeCode"
              maxLength={CODE_LENGTH}
              autoFocus
              caretHidden
            />

            <View style={styles.errorSlot}>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
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
              onPress={handleSend}
              disabled={cooldown > 0 || busy}
              activeOpacity={ACTIVE_OPACITY}
            >
              <Text style={[styles.resendText, cooldown > 0 && styles.resendOff]}>
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
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
