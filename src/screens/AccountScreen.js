/**
 * AccountScreen.js
 *
 * The Account tab: profile, stamp count, plan (free/Pro), and account actions
 * (change password / change email / sign out / delete account).
 *
 * Destructive and credential-changing actions all route through one reusable
 * prompt sheet rather than four near-identical modals -- Firebase requires a
 * recent login for every one of them, so they share the same shape.
 *
 * The profile picture is Google's photoURL when present, otherwise initials.
 * No upload: that would need Storage, and this app is deliberately local-only
 * for content.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Modal,
  StatusBar,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

import TabBar from '../components/TabBar';
import { useAppDialog } from '../components/AppDialog';
import { useAuth } from '../data/authStore';
import { useStamps } from '../data/stampStore';
import { isPro, subscribe as subscribeTier } from '../data/subscriptionStore';
import { MONETIZATION_ENABLED } from '../data/monetization';
import { STAMP_COLORS } from '../styles/stampTheme';
import {
  weight,
  STATUS_BAR_HEIGHT,
  shadow,
  useBottomInset,
  HAIRLINE,
  ACTIVE_OPACITY,
} from '../styles/platform';

const DANGER = '#D84343';
const TAB_SPACE = 104;

const initialsOf = (user) => {
  const src = user?.name || user?.email || '';
  const parts = String(src).replace(/@.*$/, '').split(/[\s._-]+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
};

function Row({ icon, label, value, danger, onPress, chevron = true }) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={onPress ? ACTIVE_OPACITY : 1}
      disabled={!onPress}
    >
      <View style={[styles.rowIcon, danger && styles.rowIconDanger]}>
        <Feather name={icon} size={17} color={danger ? DANGER : STAMP_COLORS.textPrimary} />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]}>{label}</Text>
        {value ? (
          <Text style={styles.rowValue} numberOfLines={1}>
            {value}
          </Text>
        ) : null}
      </View>
      {onPress && chevron ? (
        <Feather name="chevron-right" size={18} color="#B9AFC4" />
      ) : null}
    </TouchableOpacity>
  );
}

/**
 * One prompt sheet reused by every credential action.
 * `fields` is a list of { key, placeholder, secure }.
 */
function PromptSheet({ visible, title, subtitle, fields, confirmLabel, danger, busy, error, onCancel, onConfirm }) {
  const [values, setValues] = useState({});
  const bottomInset = useBottomInset();

  useEffect(() => {
    if (visible) setValues({});
  }, [visible]);

  // Confirm stays disabled until every required field has content.
  const missing = fields.some(
    (f) => f.required && !(values[f.key] || '').trim()
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onCancel}
    >
      <KeyboardAvoidingView style={styles.modalWrap} behavior="height">
        <TouchableOpacity style={styles.scrim} activeOpacity={1} onPress={onCancel} />
        <View style={[styles.sheet, { paddingBottom: 14 + bottomInset }]}>
          <View style={styles.grabber} />
          <Text style={styles.sheetTitle}>{title}</Text>
          {subtitle ? <Text style={styles.sheetSub}>{subtitle}</Text> : null}

          {fields.map((f) => (
            <TextInput
              key={f.key}
              style={styles.sheetInput}
              placeholder={f.placeholder}
              placeholderTextColor={STAMP_COLORS.textMuted}
              secureTextEntry={f.secure}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType={f.keyboard || 'default'}
              value={values[f.key] || ''}
              onChangeText={(v) => setValues((p) => ({ ...p, [f.key]: v }))}
            />
          ))}

          {error ? <Text style={styles.sheetError}>{error}</Text> : null}

          <View style={styles.sheetActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={ACTIVE_OPACITY}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, danger && styles.confirmDanger]}
              onPress={() => onConfirm(values)}
              activeOpacity={ACTIVE_OPACITY}
              disabled={busy || missing}
            >
              {busy ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.confirmText}>{confirmLabel}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const AccountScreen = ({ navigation }) => {
  const { showDialog } = useAppDialog();
  const { user, signOut, changePassword, changeEmail, deleteAccount, isMock, mockReason } = useAuth();
  const bottomInset = useBottomInset();
  const { stamps } = useStamps();

  const [prompt, setPrompt] = useState(null); // 'password' | 'email' | 'delete'
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  /** Re-render when the tier changes (e.g. returning from Subscribe). */
  const [tierTick, setTierTick] = useState(0);

  useEffect(() => subscribeTier(() => setTierTick((n) => n + 1)), []);

  // While the app ships free the tier is forced to "free" so no Pro surface
  // can appear; flipping MONETIZATION_ENABLED restores the real check.
  const pro = useMemo(
    () => MONETIZATION_ENABLED && isPro(user?.uid),
    [user, tierTick]
  );

  const closePrompt = useCallback(() => {
    setPrompt(null);
    setError(null);
  }, []);

  const handleTab = useCallback(
    (tab) => {
      if (tab.route && tab.route !== 'Account') navigation.navigate(tab.route);
    },
    [navigation]
  );

  const handleSignOut = useCallback(() => {
    showDialog({
      title: 'Sign out?',
      message: 'Your stamps stay on this device.',
      actions: [
      { label: 'Cancel', variant: 'secondary' },
      {
        label: 'Sign out',
        variant: 'danger',
        onPress: async () => {
          await signOut();
          navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        },
      },
      ],
    });
  }, [showDialog, signOut, navigation]);

  const submit = useCallback(
    async (values) => {
      setBusy(true);
      setError(null);
      let res;

      if (prompt === 'password') {
        if (!values.next || values.next.length < 8) {
          setBusy(false);
          setError('New password must be at least 8 characters');
          return;
        }
        res = await changePassword({
          currentPassword: values.current,
          newPassword: values.next,
        });
      } else if (prompt === 'email') {
        res = await changeEmail({
          currentPassword: values.current,
          newEmail: values.email,
        });
      } else if (prompt === 'delete') {
        if (!(values.current || '').trim()) {
          setBusy(false);
          setError('Enter your password to confirm deletion.');
          return;
        }
        res = await deleteAccount(values.current);
      }

      setBusy(false);

      if (res?.ok) {
        closePrompt();
        if (prompt === 'delete') {
          navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
        } else if (prompt === 'email') {
          if (res.verificationSent) {
            showDialog({
              title: 'Check your inbox',
              message: `We sent a confirmation link to ${values.email.trim()}. Your email changes once you open it - check spam if it is not there.`,
            });
          } else {
            showDialog({
              title: 'Email updated (mock)',
              message:
                'MOCK AUTH changed it locally only. No verification email is sent until you build with Firebase installed.',
            });
          }
        } else {
          showDialog({ title: 'Done', message: 'Your password has been changed.' });
        }
      } else {
        setError(res?.error || 'That did not work. Try again.');
      }
    },
    [prompt, changePassword, changeEmail, deleteAccount, closePrompt, navigation, showDialog]
  );

  const promptConfig = {
    password: {
      title: 'Change password',
      subtitle: 'Confirm your current password first.',
      confirmLabel: 'Update',
      fields: [
        { key: 'current', placeholder: 'Current password', secure: true },
        { key: 'next', placeholder: 'New password (8+ characters)', secure: true },
      ],
    },
    email: {
      title: 'Change email',
      subtitle: 'We will send a confirmation link to the new address.',
      confirmLabel: 'Update',
      fields: [
        { key: 'current', placeholder: 'Current password', secure: true },
        { key: 'email', placeholder: 'New email address', keyboard: 'email-address' },
      ],
    },
    delete: {
      title: 'Delete account',
      subtitle:
        'This permanently deletes your account. Stamps on this device are not removed.',
      confirmLabel: 'Delete forever',
      danger: true,
      fields: [
        { key: 'current', placeholder: 'Password', secure: true, required: true },
      ],
    },
  }[prompt] || { fields: [] };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <View style={{ height: STATUS_BAR_HEIGHT }} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>Account</Text>

        {isMock ? (
          <View style={styles.mockBanner}>
            <Text style={styles.mockTitle}>MOCK AUTH</Text>
            {mockReason ? <Text style={styles.mockReason}>{mockReason}</Text> : null}
          </View>
        ) : null}

        {/* Profile */}
        <View style={[styles.card, shadow(1)]}>
          <View style={styles.profileRow}>
            {user?.photo ? (
              <Image source={{ uri: user.photo }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarText}>{initialsOf(user)}</Text>
              </View>
            )}
            <View style={styles.profileText}>
              <Text style={styles.name} numberOfLines={1}>
                {user?.name || 'Your account'}
              </Text>
              <Text style={styles.contact} numberOfLines={1}>
                {user?.email || user?.phone || 'Not signed in'}
              </Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statNum}>{stamps.length}</Text>
              <Text style={styles.statLabel}>
                {stamps.length === 1 ? 'Stamp' : 'Stamps'}
              </Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statNum}>{pro ? 'Pro' : 'Free'}</Text>
              <Text style={styles.statLabel}>
                {MONETIZATION_ENABLED ? (pro ? 'No ads' : 'With ads') : 'Forever'}
              </Text>
            </View>
          </View>
        </View>

        {/* Plan */}
        <View style={[styles.tierCard, pro ? styles.tierPro : styles.tierFree]}>
          <Feather
            name={pro ? 'zap' : 'play-circle'}
            size={18}
            color={pro ? '#A7641C' : STAMP_COLORS.textSecondary}
          />
          <View style={styles.tierText}>
            <Text style={styles.tierTitle}>
              {pro ? 'Subscribed — no ads' : 'Free plan'}
            </Text>
            <Text style={styles.tierSub}>
              {pro
                ? 'Save as many stamps as you like, uninterrupted.'
                : MONETIZATION_ENABLED
                ? 'An ad plays after each stamp you save.'
                : 'TheStampO is completely free for everyone.'}
            </Text>
          </View>
        </View>

        {/* Paywall entry: wired, but dormant while the app ships free. */}
        {MONETIZATION_ENABLED && !pro ? (
          <TouchableOpacity
            style={styles.subscribeBtn}
            activeOpacity={ACTIVE_OPACITY}
            onPress={() => navigation.navigate('Subscribe')}
          >
            <Text style={styles.subscribeText}>Remove ads</Text>
          </TouchableOpacity>
        ) : null}

        {/* Account actions */}
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={[styles.card, shadow(1)]}>
          <Row
            icon="lock"
            label="Change password"
            onPress={() => setPrompt('password')}
          />
          <View style={styles.divider} />
          <Row
            icon="mail"
            label="Change email"
            value={user?.email || undefined}
            onPress={() => setPrompt('email')}
          />
          <View style={styles.divider} />
          <Row icon="log-out" label="Sign out" onPress={handleSignOut} />
        </View>

        <Text style={styles.sectionTitle}>Danger zone</Text>
        <View style={[styles.card, shadow(1)]}>
          <Row
            icon="trash-2"
            label="Delete account"
            danger
            onPress={() => setPrompt('delete')}
          />
        </View>

        <View style={{ height: TAB_SPACE + bottomInset }} />
      </ScrollView>

      <PromptSheet
        visible={!!prompt}
        {...promptConfig}
        busy={busy}
        error={error}
        onCancel={closePrompt}
        onConfirm={submit}
      />

      <TabBar active="Account" onTabPress={handleTab} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF8FC' },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },

  pageTitle: {
    fontSize: 27,
    includeFontPadding: false,
    color: STAMP_COLORS.textPrimary,
    ...weight(600),
    marginBottom: 16,
  },

  mockBanner: {
    backgroundColor: '#FCEEEF',
    borderWidth: 1,
    borderColor: '#E6AEB8',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
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

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 4,
    marginBottom: 18,
  },

  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
  },
  avatar: { width: 58, height: 58, borderRadius: 29 },
  avatarFallback: {
    backgroundColor: '#F1E9F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 21,
    includeFontPadding: false,
    color: '#A7641C',
    ...weight(700),
  },
  profileText: { flex: 1, marginLeft: 14 },
  name: {
    fontSize: 18,
    includeFontPadding: false,
    color: STAMP_COLORS.textPrimary,
    ...weight(600),
  },
  contact: {
    marginTop: 3,
    fontSize: 13.5,
    includeFontPadding: false,
    color: STAMP_COLORS.textSecondary,
  },

  statsRow: {
    flexDirection: 'row',
    borderTopWidth: HAIRLINE,
    borderTopColor: '#EEE8F3',
    paddingVertical: 14,
  },
  stat: { flex: 1, alignItems: 'center' },
  statDivider: { width: HAIRLINE, backgroundColor: '#EEE8F3' },
  statNum: {
    fontSize: 21,
    includeFontPadding: false,
    color: STAMP_COLORS.textPrimary,
    ...weight(700),
  },
  statLabel: {
    marginTop: 2,
    fontSize: 12.5,
    includeFontPadding: false,
    color: STAMP_COLORS.textSecondary,
  },

  tierCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: HAIRLINE,
  },
  tierFree: { backgroundColor: '#F5F1F8', borderColor: '#E6DEED' },
  tierPro: { backgroundColor: '#FFF7E9', borderColor: '#F1D8B1' },
  tierText: { flex: 1, marginLeft: 12 },
  tierTitle: {
    fontSize: 14.5,
    includeFontPadding: false,
    color: STAMP_COLORS.textPrimary,
    ...weight(600),
  },
  tierSub: {
    marginTop: 2,
    fontSize: 12.5,
    includeFontPadding: false,
    color: STAMP_COLORS.textSecondary,
  },

  subscribeBtn: {
    height: 52,
    borderRadius: 26,
    backgroundColor: '#E4943A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  subscribeText: {
    color: '#fff',
    fontSize: 16,
    includeFontPadding: false,
    ...weight(600),
  },

  sectionTitle: {
    fontSize: 13,
    includeFontPadding: false,
    color: STAMP_COLORS.textSecondary,
    letterSpacing: 0.6,
    ...weight(600),
    marginBottom: 8,
    marginLeft: 4,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F1F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconDanger: { backgroundColor: '#FCEDED' },
  rowText: { flex: 1, marginLeft: 13 },
  rowLabel: {
    fontSize: 15.5,
    includeFontPadding: false,
    color: STAMP_COLORS.textPrimary,
  },
  rowLabelDanger: { color: DANGER },
  rowValue: {
    marginTop: 2,
    fontSize: 12.5,
    includeFontPadding: false,
    color: STAMP_COLORS.textSecondary,
  },
  divider: {
    height: HAIRLINE,
    backgroundColor: '#EEE8F3',
    marginLeft: 65,
  },

  modalWrap: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(20,17,15,0.42)' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 22,
    ...shadow(4),
  },
  grabber: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#DED6E6',
    marginBottom: 14,
  },
  sheetTitle: {
    fontSize: 18,
    includeFontPadding: false,
    color: STAMP_COLORS.textPrimary,
    ...weight(600),
  },
  sheetSub: {
    marginTop: 4,
    marginBottom: 12,
    fontSize: 13,
    lineHeight: 18,
    includeFontPadding: false,
    color: STAMP_COLORS.textSecondary,
  },
  sheetInput: {
    height: 50,
    borderWidth: HAIRLINE,
    borderColor: '#E5DDEC',
    borderRadius: 12,
    backgroundColor: '#FEFCFF',
    paddingHorizontal: 14,
    fontSize: 15,
    includeFontPadding: false,
    color: STAMP_COLORS.textPrimary,
    marginTop: 10,
  },
  sheetError: {
    marginTop: 10,
    fontSize: 13,
    includeFontPadding: false,
    color: DANGER,
  },
  sheetActions: { flexDirection: 'row', marginTop: 16 },
  cancelBtn: {
    flex: 1,
    height: 50,
    borderRadius: 25,
    borderWidth: HAIRLINE,
    borderColor: '#E5DDEC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  cancelText: {
    fontSize: 15,
    includeFontPadding: false,
    color: STAMP_COLORS.textSecondary,
    ...weight(500),
  },
  confirmBtn: {
    flex: 1.4,
    height: 50,
    borderRadius: 25,
    backgroundColor: STAMP_COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmDanger: { backgroundColor: DANGER },
  confirmText: {
    fontSize: 15,
    includeFontPadding: false,
    color: '#fff',
    ...weight(600),
  },
});

export default AccountScreen;
