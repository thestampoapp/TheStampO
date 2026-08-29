/**
 * CollectionPicker.js
 *
 * Bottom sheet: pick an existing collection, or create one by name.
 *
 * Used in two places, which is why it is a component rather than inline UI:
 *   - CaptureSaveScreen  (required choice before a stamp can be saved)
 *   - CollectionsScreen / action sheet (moving stamps between collections)
 *
 * Creating and picking live in ONE sheet on purpose. Splitting them into
 * "pick" and "create" flows means a user with no suitable album has to back
 * out and start again -- the inline "New collection" row avoids that dead end.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Animated,
  Easing,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

import { useCollections, NAME_MAX } from '../data/collectionStore';
import { STAMP_COLORS } from '../styles/stampTheme';
import {
  weight,
  shadow,
  HAIRLINE,
  ACTIVE_OPACITY,
  useBottomInset,
} from '../styles/platform';

/**
 * @param {boolean}  visible
 * @param {string}   selectedId   currently chosen collection
 * @param {function} onSelect     (id) => void
 * @param {function} onClose
 * @param {string}   title
 * @param {object}   counts       optional { [id]: number } to show stamp counts
 */
function CollectionPicker({
  visible,
  selectedId,
  onSelect,
  onClose,
  title = 'Choose a collection',
  counts = null,
}) {
  const { collections, create } = useCollections();

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const slide = useRef(new Animated.Value(0)).current;
  const bottomInset = useBottomInset();

  useEffect(() => {
    if (visible) {
      setCreating(false);
      setName('');
      setError(null);
    }
    Animated.timing(slide, {
      toValue: visible ? 1 : 0,
      duration: visible ? 220 : 150,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [visible, slide]);

  const handleCreate = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);

    const res = await create(name);
    setBusy(false);

    if (!res.ok) {
      setError(res.error);
      return;
    }
    // Creating implies choosing it -- otherwise the user has to tap twice.
    setCreating(false);
    setName('');
    onSelect(res.collection.id);
    onClose();
  }, [busy, create, name, onSelect, onClose]);

  const sheetStyle = {
    opacity: slide,
    transform: [
      {
        translateY: slide.interpolate({
          inputRange: [0, 1],
          outputRange: [40, 0],
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
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView style={styles.wrap} behavior="height">
        <TouchableOpacity style={styles.scrim} activeOpacity={1} onPress={onClose} />

        <Animated.View
          style={[
            styles.sheet,
            shadow(4),
            { paddingBottom: 14 + bottomInset },
            sheetStyle,
          ]}
        >
          <View style={styles.grabber} />
          <Text style={styles.title}>{title}</Text>

          {creating ? (
            <View style={styles.createBox}>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={(v) => {
                  setName(v.slice(0, NAME_MAX));
                  if (error) setError(null);
                }}
                placeholder="Collection name"
                placeholderTextColor={STAMP_COLORS.textMuted}
                autoFocus
                maxLength={NAME_MAX}
                returnKeyType="done"
                onSubmitEditing={handleCreate}
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}

              <View style={styles.createActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => {
                    setCreating(false);
                    setError(null);
                  }}
                  activeOpacity={ACTIVE_OPACITY}
                >
                  <Text style={styles.cancelText}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.confirmBtn}
                  onPress={handleCreate}
                  activeOpacity={ACTIVE_OPACITY}
                  disabled={busy}
                >
                  {busy ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.confirmText}>Create</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              <ScrollView
                style={styles.list}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {collections.map((c) => {
                  const active = c.id === selectedId;
                  const n = counts ? counts[c.id] || 0 : null;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.row, active && styles.rowActive]}
                      onPress={() => {
                        onSelect(c.id);
                        onClose();
                      }}
                      activeOpacity={ACTIVE_OPACITY}
                    >
                      <View style={[styles.dot, active && styles.dotActive]}>
                        {active ? <Feather name="check" size={13} color="#fff" /> : null}
                      </View>
                      <Text
                        style={[styles.rowName, active && styles.rowNameActive]}
                        numberOfLines={1}
                      >
                        {c.name}
                      </Text>
                      {n !== null ? (
                        <Text style={styles.rowCount}>
                          {n} {n === 1 ? 'stamp' : 'stamps'}
                        </Text>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <TouchableOpacity
                style={styles.newRow}
                onPress={() => setCreating(true)}
                activeOpacity={ACTIVE_OPACITY}
              >
                <View style={styles.newIcon}>
                  <Feather name="plus" size={17} color={STAMP_COLORS.accent} />
                </View>
                <Text style={styles.newText}>New collection</Text>
              </TouchableOpacity>
            </>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'flex-end' },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20,17,15,0.45)',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 10,
    maxHeight: '72%',
  },
  grabber: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#DED6E6',
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    includeFontPadding: false,
    color: STAMP_COLORS.textPrimary,
    ...weight(600),
    marginBottom: 10,
    marginLeft: 2,
  },

  list: { flexGrow: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 4,
  },
  rowActive: { backgroundColor: STAMP_COLORS.accentSoft },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#DCD3E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotActive: {
    backgroundColor: STAMP_COLORS.accent,
    borderColor: STAMP_COLORS.accent,
  },
  rowName: {
    flex: 1,
    marginLeft: 12,
    fontSize: 15.5,
    includeFontPadding: false,
    color: STAMP_COLORS.textPrimary,
  },
  rowNameActive: { ...weight(600) },
  rowCount: {
    fontSize: 12.5,
    includeFontPadding: false,
    color: STAMP_COLORS.textSecondary,
  },

  newRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginTop: 4,
    borderTopWidth: HAIRLINE,
    borderTopColor: '#EEE8F3',
  },
  newIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: STAMP_COLORS.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newText: {
    marginLeft: 12,
    fontSize: 15.5,
    includeFontPadding: false,
    color: STAMP_COLORS.accent,
    ...weight(600),
  },

  createBox: { paddingHorizontal: 2 },
  input: {
    height: 52,
    borderWidth: HAIRLINE,
    borderColor: '#E5DDEC',
    borderRadius: 12,
    backgroundColor: '#FEFCFF',
    paddingHorizontal: 14,
    fontSize: 15.5,
    includeFontPadding: false,
    color: STAMP_COLORS.textPrimary,
  },
  error: {
    marginTop: 8,
    fontSize: 13,
    includeFontPadding: false,
    color: '#D84343',
  },
  createActions: { flexDirection: 'row', marginTop: 14 },
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
  confirmText: {
    fontSize: 15,
    includeFontPadding: false,
    color: '#fff',
    ...weight(600),
  },
});

export default React.memo(CollectionPicker);
