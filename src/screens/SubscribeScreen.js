/**
 * SubscribeScreen.js
 *
 * The paywall, reached from the ad's "Subscribe" or the Account tab.
 *
 * BILLING IS NOT WIRED UP. Purchasing flips a local flag via
 * subscriptionStore.setPro() so the whole ad-free experience can be tested
 * end to end -- but it takes no money and verifies nothing.
 *
 * To make it real: react-native-google-mobile-ads is NOT what you need here;
 * you need react-native-iap or expo-in-app-purchases wired to a Play Console
 * subscription, and `setPro` should then be driven by the entitlement rather
 * than by this button. That is a single function to swap.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Animated,
  Easing,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAppDialog } from '../components/AppDialog';

import { useAuth } from '../data/authStore';
import { setPro, isPro } from '../data/subscriptionStore';
import { STAMP_COLORS } from '../styles/stampTheme';
import {
  weight,
  STATUS_BAR_HEIGHT,
  useBottomInset,
  shadow,
  HAIRLINE,
  ACTIVE_OPACITY,
} from '../styles/platform';

const GOLD = '#E4943A';
const CREAM = '#FFF3E5';

const PLANS = [
  {
    id: 'yearly',
    label: 'Yearly',
    price: '₹899',
    per: '/year',
    note: 'Just ₹75 a month',
    badge: 'Best value',
  },
  {
    id: 'monthly',
    label: 'Monthly',
    price: '₹99',
    per: '/month',
    note: 'Cancel anytime',
    badge: null,
  },
];

const PERKS = [
  { icon: 'slash', title: 'No ads', body: 'Save a stamp, go straight back to your collection.' },
  { icon: 'image', title: 'Unlimited stamps', body: 'Punch as many as you like, forever.' },
  { icon: 'printer', title: 'Print anytime', body: 'Send any stamp sheet to print in a tap.' },
  { icon: 'heart', title: 'Support the makers', body: 'Two people build this. You keep it alive.' },
];

const SubscribeScreen = ({ navigation }) => {
  const { showDialog } = useAppDialog();
  const { user } = useAuth();
  const [plan, setPlan] = useState('yearly');
  const [busy, setBusy] = useState(false);
  const bottomInset = useBottomInset();

  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [enter]);

  const alreadyPro = isPro(user?.uid);

  const handleSubscribe = useCallback(async () => {
    if (busy) return;
    setBusy(true);

    // Placeholder for the real purchase flow.
    await new Promise((r) => setTimeout(r, 700));
    await setPro(user?.uid, true);

    setBusy(false);
    showDialog({
      title: 'You are subscribed',
      message: 'Ads are off. Note: this is a local placeholder — no payment was taken and Play Billing is not connected yet.',
      actions: [{ label: 'Nice', variant: 'primary', onPress: () => navigation.goBack() }],
    });
  }, [busy, user, navigation, showDialog]);

  const enterStyle = {
    opacity: enter,
    transform: [
      {
        translateY: enter.interpolate({
          inputRange: [0, 1],
          outputRange: [16, 0],
        }),
      },
    ],
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <View style={{ height: STATUS_BAR_HEIGHT }} />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={ACTIVE_OPACITY}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="x" size={20} color={STAMP_COLORS.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={enterStyle}>
          <View style={styles.crest}>
            <Feather name="zap" size={26} color={GOLD} />
          </View>

          <Text style={styles.title}>Capture without interruptions</Text>
          <Text style={styles.subtitle}>
            No ads after saving. Just you and your collection.
          </Text>

          {alreadyPro ? (
            <View style={styles.proBadge}>
              <Feather name="check-circle" size={16} color="#3E8E5A" />
              <Text style={styles.proText}>You are already subscribed</Text>
            </View>
          ) : null}

          {/* Perks */}
          <View style={styles.perks}>
            {PERKS.map((p) => (
              <View key={p.title} style={styles.perkRow}>
                <View style={styles.perkIcon}>
                  <Feather name={p.icon} size={16} color={GOLD} />
                </View>
                <View style={styles.perkText}>
                  <Text style={styles.perkTitle}>{p.title}</Text>
                  <Text style={styles.perkBody}>{p.body}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Plans */}
          {PLANS.map((p) => {
            const active = plan === p.id;
            return (
              <TouchableOpacity
                key={p.id}
                style={[styles.plan, active && styles.planActive]}
                onPress={() => setPlan(p.id)}
                activeOpacity={ACTIVE_OPACITY}
              >
                <View style={[styles.radio, active && styles.radioActive]}>
                  {active ? <View style={styles.radioDot} /> : null}
                </View>

                <View style={styles.planText}>
                  <View style={styles.planTop}>
                    <Text style={styles.planLabel}>{p.label}</Text>
                    {p.badge ? (
                      <View style={styles.planBadge}>
                        <Text style={styles.planBadgeText}>{p.badge}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.planNote}>{p.note}</Text>
                </View>

                <View style={styles.planPriceWrap}>
                  <Text style={styles.planPrice}>{p.price}</Text>
                  <Text style={styles.planPer}>{p.per}</Text>
                </View>
              </TouchableOpacity>
            );
          })}

          <Text style={styles.disclaimer}>
            Placeholder pricing — Play Billing is not connected yet, so nothing
            is charged.
          </Text>
        </Animated.View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: 8 + bottomInset }]}>
        <TouchableOpacity
          style={styles.cta}
          onPress={handleSubscribe}
          activeOpacity={ACTIVE_OPACITY}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.ctaText}>
              {alreadyPro ? 'Subscribed' : 'Subscribe'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.laterBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={ACTIVE_OPACITY}
        >
          <Text style={styles.laterText}>Not now</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: STAMP_COLORS.background },

  header: { paddingHorizontal: 14, paddingTop: 4 },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },

  scroll: { paddingHorizontal: 24, paddingBottom: 16 },

  crest: {
    alignSelf: 'center',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: CREAM,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    lineHeight: 33,
    includeFontPadding: false,
    color: STAMP_COLORS.textPrimary,
    textAlign: 'center',
    ...weight(600),
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14.5,
    lineHeight: 20,
    includeFontPadding: false,
    color: STAMP_COLORS.textSecondary,
    textAlign: 'center',
  },

  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: 14,
    backgroundColor: '#EDF7F0',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  proText: {
    marginLeft: 7,
    fontSize: 13.5,
    includeFontPadding: false,
    color: '#3E8E5A',
    ...weight(600),
  },

  perks: { marginTop: 24, marginBottom: 22 },
  perkRow: { flexDirection: 'row', marginBottom: 16 },
  perkIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: CREAM,
    alignItems: 'center',
    justifyContent: 'center',
  },
  perkText: { flex: 1, marginLeft: 13 },
  perkTitle: {
    fontSize: 15,
    includeFontPadding: false,
    color: STAMP_COLORS.textPrimary,
    ...weight(600),
  },
  perkBody: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 18,
    includeFontPadding: false,
    color: STAMP_COLORS.textSecondary,
  },

  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E6DEED',
    borderRadius: 16,
    padding: 15,
    marginBottom: 11,
    backgroundColor: '#FEFCFF',
  },
  planActive: { borderColor: GOLD, backgroundColor: '#FFF7EA' },
  radio: {
    width: 21,
    height: 21,
    borderRadius: 10.5,
    borderWidth: 1.5,
    borderColor: '#DCD3E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: GOLD },
  radioDot: { width: 11, height: 11, borderRadius: 5.5, backgroundColor: GOLD },
  planText: { flex: 1, marginLeft: 13 },
  planTop: { flexDirection: 'row', alignItems: 'center' },
  planLabel: {
    fontSize: 15.5,
    includeFontPadding: false,
    color: STAMP_COLORS.textPrimary,
    ...weight(600),
  },
  planBadge: {
    marginLeft: 8,
    backgroundColor: GOLD,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  planBadgeText: {
    fontSize: 10.5,
    includeFontPadding: false,
    color: '#fff',
    letterSpacing: 0.3,
    ...weight(700),
  },
  planNote: {
    marginTop: 2,
    fontSize: 12.5,
    includeFontPadding: false,
    color: STAMP_COLORS.textSecondary,
  },
  planPriceWrap: { alignItems: 'flex-end' },
  planPrice: {
    fontSize: 18,
    includeFontPadding: false,
    color: STAMP_COLORS.textPrimary,
    ...weight(700),
  },
  planPer: {
    fontSize: 11.5,
    includeFontPadding: false,
    color: STAMP_COLORS.textMuted,
  },

  disclaimer: {
    marginTop: 6,
    fontSize: 11.5,
    lineHeight: 16,
    includeFontPadding: false,
    color: STAMP_COLORS.textMuted,
    textAlign: 'center',
  },

  footer: {
    paddingHorizontal: 24,
    paddingTop: 10,
    borderTopWidth: HAIRLINE,
    borderTopColor: '#EEE8F3',
    backgroundColor: STAMP_COLORS.background,
  },
  cta: {
    height: 54,
    borderRadius: 27,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow(2),
  },
  ctaText: {
    fontSize: 16,
    includeFontPadding: false,
    color: '#fff',
    ...weight(600),
  },
  laterBtn: { height: 44, alignItems: 'center', justifyContent: 'center' },
  laterText: {
    fontSize: 14.5,
    includeFontPadding: false,
    color: STAMP_COLORS.textSecondary,
    ...weight(500),
  },
});

export default SubscribeScreen;
