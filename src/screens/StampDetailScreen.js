/**
 * StampDetailScreen.js
 *
 * SafeArea -> centered StampRenderer -> note label -> note textbox ->
 * collection button -> save button -> retake. Nothing else.
 *
 * The stamp already contains scallops, border, shadow and rotation. This
 * screen does not rebuild any of them.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  Animated,
  KeyboardAvoidingView,
  StatusBar,
  ScrollView,
} from 'react-native';

import StampRenderer from '../components/StampRenderer';
import { addStamp } from '../data/stampStore';
import { loadCollections } from '../data/collectionStore';
import { setLastCollection } from '../data/appState';
import { STAMP_COLORS, SPACE } from '../styles/stampTheme';
import { weight, HAIRLINE } from '../styles/platform';
import {
  DETAIL_STAMP_WIDTH,
  DETAIL_STAMP_TOP,
  TOP_INSET,
} from '../utils/stampTransition';

const StampDetailScreen = ({ navigation, route }) => {
  const [note, setNote] = useState('');
  const photoUri = route?.params?.photoUri ?? null;

  /**
   * The stamp is handed over from the camera's "match and move" flight, so it
   * must NOT animate in -- it is already sitting in this exact position. Only
   * the surrounding controls fade up beneath it.
   */
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 260,
      delay: 60,
      useNativeDriver: true,
    }).start();
  }, [enter]);

  const [saving, setSaving] = useState(false);
  /** Notes are optional when saving a captured stamp. */

  /**
   * Persist, then continue. The image is copied out of the cache directory
   * inside addStamp(), so the stamp survives an app restart.
   *
   * We navigate even if the write fails -- losing the celebration screen on a
   * storage hiccup would be worse than a missing row.
   *
   * NO AD HERE, deliberately. This is the onboarding save, and the user has
   * not even signed up yet -- interrupting their first stamp with an ad
   * before they know what the app does would be the worst possible moment.
   * Ads start on the SECOND stamp onwards (CaptureSaveScreen).
   */
  const handleSave = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    let saved = null;
    try {
      // First stamp: goes to the default collection automatically. The
      // picker appears from the SECOND stamp on (CaptureSaveScreen), once
      // the user has seen what a collection is.
      const cols = await loadCollections();
      const target = cols[0]?.id ?? null;
      saved = await addStamp({
        uri: photoUri,
        note: note.trim(),
        collection: target,
      });
      await setLastCollection(target);
    } catch (e) {
      saved = null;
    }
    navigation.navigate('SavedStamp', {
      photoUri: saved?.uri || photoUri,
      note: note.trim(),
    });
  }, [navigation, photoUri, note, saving]);

  const handleRetake = useCallback(() => {
    navigation.navigate('Camera');
  }, [navigation]);

  // Controls only. The stamp itself is static.
  const controlsStyle = {
    opacity: enter,
    transform: [
      {
        translateY: enter.interpolate({
          inputRange: [0, 1],
          outputRange: [12, 0],
        }),
      },
    ],
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <KeyboardAvoidingView
        style={styles.flex}
        // Android resizes the window itself; 'padding' would double-inset.
        behavior={undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.stampSlot}>
            <StampRenderer uri={photoUri} width={DETAIL_STAMP_WIDTH} />
          </View>

          <Animated.View style={[styles.controls, controlsStyle]}>
          <View style={styles.noteLabelRow}>
            <Text style={styles.noteLabel}>A note for this stamp</Text>
            <Text style={styles.noteRequired}>Optional</Text>
          </View>

          <TextInput
            style={styles.noteInput}
            value={note}
            onChangeText={setNote}
            placeholder="What made this moment?"
            placeholderTextColor={STAMP_COLORS.textMuted}
            maxLength={120}
          />

          <TouchableOpacity style={styles.collectionButton} activeOpacity={0.8}>
            <Text style={styles.collectionText}>Collection</Text>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.9}
          >
            <Text style={styles.saveText}>
              {saving ? 'Saving…' : 'Save to Book'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleRetake} activeOpacity={0.7}>
            <Text style={styles.retakeText}>Retake</Text>
          </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: STAMP_COLORS.background },
  flex: { flex: 1 },
  content: {
    alignItems: 'center',
    paddingHorizontal: SPACE.l,
    paddingTop: TOP_INSET + DETAIL_STAMP_TOP,
    paddingBottom: SPACE.xl,
  },

  // Must match getDetailStampRect() -- the flight lands here.
  stampSlot: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACE.xl,
  },
  controls: { width: '100%', alignItems: 'center' },

  noteLabelRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACE.xs,
  },
  noteLabel: {
    fontSize: 15,
    color: STAMP_COLORS.textSecondary,
  },
  noteRequired: {
    fontSize: 11.5,
    includeFontPadding: false,
    color: STAMP_COLORS.accent,
    letterSpacing: 0.4,
    ...weight(600),
  },
  noteInputError: {
    borderColor: '#D84343',
    borderWidth: HAIRLINE,
    backgroundColor: '#FEF5F7',
  },
  noteError: {
    width: '100%',
    marginTop: 6,
    fontSize: 12.5,
    includeFontPadding: false,
    color: '#D84343',
  },
  saveButtonDisabled: {
    backgroundColor: '#D9D1E0',
  },
  noteInput: {
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: STAMP_COLORS.border,
    paddingVertical: 12,
    fontSize: 16,
    color: STAMP_COLORS.textPrimary,
    marginBottom: SPACE.l,
  },

  collectionButton: {
    width: '100%',
    backgroundColor: STAMP_COLORS.surface,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACE.l,
    borderWidth: 1,
    borderColor: STAMP_COLORS.border,
  },
  collectionText: { fontSize: 16, color: STAMP_COLORS.textPrimary },
  arrow: { fontSize: 22, color: STAMP_COLORS.textMuted },

  saveButton: {
    width: '100%',
    backgroundColor: STAMP_COLORS.dark,
    paddingVertical: 18,
    borderRadius: 30,
    alignItems: 'center',
  },
  saveText: { color: '#fff', fontSize: 17, ...weight(600) },

  retakeText: {
    marginTop: SPACE.m,
    fontSize: 16,
    color: STAMP_COLORS.textSecondary,
  },
});

export default StampDetailScreen;
