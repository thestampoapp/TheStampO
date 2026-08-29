import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
  Keyboard,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

import { STAMP_COLORS } from '../styles/stampTheme';
import { ACTIVE_OPACITY, shadow, weight } from '../styles/platform';

const DialogContext = createContext(null);

/**
 * App-owned replacement for Android's native Alert dialog. It keeps every
 * confirmation and notice visually consistent with the violet app theme.
 */
export function AppDialogProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const [value, setValue] = useState('');

  const showDialog = useCallback((next) => {
    setValue(next?.input?.value || '');
    setDialog(next);
  }, []);

  const close = useCallback(() => {
    Keyboard.dismiss();
    setDialog(null);
  }, []);

  const dismiss = useCallback(() => {
    const onDismiss = dialog?.onDismiss;
    close();
    onDismiss?.();
  }, [dialog, close]);

  const handleAction = useCallback(
    async (action) => {
      close();
      await action?.onPress?.(value);
    },
    [close, value]
  );

  const contextValue = useMemo(() => ({ showDialog, dismiss }), [showDialog, dismiss]);
  const actions = dialog?.actions?.length ? dialog.actions : [{ label: 'Okay', variant: 'primary' }];

  return (
    <DialogContext.Provider value={contextValue}>
      {children}
      <Modal
        visible={!!dialog}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={dismiss}
      >
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
          <View style={[styles.card, shadow(3)]}>
            {dialog?.showClose ? (
              <TouchableOpacity
                style={styles.closeButton}
                onPress={dismiss}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={ACTIVE_OPACITY}
              >
                <Feather name="x" size={22} color={STAMP_COLORS.textSecondary} />
              </TouchableOpacity>
            ) : null}
            <View
              style={[
                styles.accent,
                dialog?.accent === 'secondary' && styles.secondaryAccent,
              ]}
            />
            <Text style={styles.title}>{dialog?.title}</Text>
            {dialog?.message ? <Text style={styles.message}>{dialog.message}</Text> : null}
            {dialog?.input ? (
              <TextInput
                style={styles.input}
                value={value}
                onChangeText={setValue}
                placeholder={dialog.input.placeholder}
                placeholderTextColor={STAMP_COLORS.textMuted}
                autoFocus
                autoCapitalize={dialog.input.autoCapitalize || 'sentences'}
                maxLength={dialog.input.maxLength || 80}
                returnKeyType="done"
                onSubmitEditing={() => handleAction(actions.find((action) => action.variant === 'primary') || actions[0])}
              />
            ) : null}
            <View style={styles.actions}>
              {actions.map((action, index) => {
                const variant = action.variant || (index === 0 ? 'primary' : 'secondary');
                return (
                  <TouchableOpacity
                    key={`${action.label}_${index}`}
                    style={[
                      styles.action,
                      variant === 'primary' && styles.primaryAction,
                      variant === 'danger' && styles.dangerAction,
                      variant === 'secondary' && styles.secondaryAction,
                    ]}
                    onPress={() => handleAction(action)}
                    activeOpacity={ACTIVE_OPACITY}
                  >
                    <Text
                      style={[
                        styles.actionText,
                        variant === 'primary' && styles.primaryActionText,
                        variant === 'danger' && styles.dangerActionText,
                      ]}
                    >
                      {action.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </DialogContext.Provider>
  );
}

export function useAppDialog() {
  const context = useContext(DialogContext);
  if (!context) throw new Error('useAppDialog must be used inside AppDialogProvider');
  return context;
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(36, 30, 42, 0.58)',
  },
  card: {
    width: '100%',
    maxWidth: 390,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: STAMP_COLORS.paper,
    padding: 22,
  },
  accent: {
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: STAMP_COLORS.accent,
    marginBottom: 16,
  },
  secondaryAccent: { backgroundColor: STAMP_COLORS.secondary },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F1F8',
  },
  title: {
    fontSize: 21,
    includeFontPadding: false,
    color: STAMP_COLORS.textPrimary,
    ...weight(700),
  },
  message: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    includeFontPadding: false,
    color: STAMP_COLORS.textSecondary,
  },
  input: {
    height: 48,
    marginTop: 18,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#D9CCE7',
    borderRadius: 12,
    backgroundColor: '#F8F4FB',
    color: STAMP_COLORS.textPrimary,
    fontSize: 15,
  },
  actions: { marginTop: 22, gap: 10 },
  action: {
    minHeight: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryAction: { backgroundColor: STAMP_COLORS.accent },
  secondaryAction: {
    borderWidth: 1,
    borderColor: '#D9CCE7',
    backgroundColor: '#F8F4FB',
  },
  dangerAction: { backgroundColor: STAMP_COLORS.secondary },
  actionText: {
    fontSize: 15,
    includeFontPadding: false,
    color: STAMP_COLORS.accent,
    ...weight(650),
  },
  primaryActionText: { color: '#fff' },
  dangerActionText: { color: '#fff' },
});
