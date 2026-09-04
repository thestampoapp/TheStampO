/**
 * StampViewerScreen.js
 *
 * Full-screen view of one stamp, opened by tapping a tile in Collection.
 *
 * Swipe left/right pages through the whole collection and STOPS at both ends
 * -- FlatList's natural bounds do this for free, which is why the pager is a
 * horizontal paged FlatList rather than a gesture-driven carousel.
 *
 * "Add a note" edits the note in place and writes straight to the store, so
 * Collection and Calendar update with no navigation params.
 *
 * Rendering note: only the visible page (and its neighbours) mount their
 * StampRenderer. A 200-stamp collection would otherwise build 200 SVG/Skia
 * paths on first render.
 */

import {
  useState,
  useCallback,
  useRef,
  useMemo,
  useEffect,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  TextInput,
  StatusBar,
  Modal,
  Animated,
  Easing,
  ActivityIndicator,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import StampRenderer from '../components/StampRenderer';
import SaveStampSheet from '../components/SaveStampSheet';
import { useAppDialog } from '../components/AppDialog';
import { useStamps, updateStamp } from '../data/stampStore';
import { formatLocation } from '../utils/location';
import {
  CAPTURE_WIDTH,
  CAPTURE_HEIGHT,
  hasCachedFramedShare,
  shareFramedStampView,
  createImageReadyGate,
} from '../utils/saveToDevice';
import { STAMP_COLORS } from '../styles/stampTheme';
import {
  weight,
  STATUS_BAR_HEIGHT,
  useBottomInset,
  shadow,
  HAIRLINE,
  ACTIVE_OPACITY,
} from '../styles/platform';

const NOTE_MAX = 140;
/** Pages kept mounted either side of the current one. */
const WINDOW = 1;

const formatDate = (ts) => {
  try {
    return new Date(ts).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch (e) {
    return '';
  }
};

const StampViewerScreen = ({ navigation, route }) => {
  const { showDialog } = useAppDialog();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { stamps } = useStamps();
  const bottomInset = useBottomInset();

  const startId = route?.params?.stampId ?? null;

  /**
   * Resolve the starting page ONCE. Recomputing it from `stamps` on every
   * render would yank the pager back to the start after a note edit.
   */
  const initialIndex = useRef(
    Math.max(
      0,
      stamps.findIndex((s) => s.id === startId)
    )
  ).current;

  const [index, setIndex] = useState(initialIndex);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);

  const listRef = useRef(null);
  const shareStageRef = useRef(null);
  const shareInFlight = useRef(false);
  const shareReadyGate = useRef(createImageReadyGate());
  const sheet = useRef(new Animated.Value(0)).current;

  const current = stamps[index] || null;

  useEffect(() => {
    shareReadyGate.current.reset();
  }, [current?.id, current?.uri]);

  useEffect(() => {
    if (!editing) {
      setKeyboardInset(0);
      return;
    }

    const updateInset = (e) => {
      setKeyboardInset(e.endCoordinates?.height ?? 0);
    };
    const clearInset = () => setKeyboardInset(0);

    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillChangeFrame' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, updateInset);
    const hideSub = Keyboard.addListener(hideEvent, clearInset);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [editing]);

  useEffect(() => {
    Animated.timing(sheet, {
      toValue: editing ? 1 : 0,
      duration: editing ? 220 : 150,
      easing: editing ? Easing.out(Easing.cubic) : Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [editing, sheet]);

  const stampWidth = useMemo(() => Math.min(width * 0.62, 250), [width]);

  const onViewRef = useRef(({ viewableItems }) => {
    if (viewableItems && viewableItems.length) {
      const i = viewableItems[0].index;
      if (typeof i === 'number') setIndex(i);
    }
  });
  const viewConfigRef = useRef({ itemVisiblePercentThreshold: 60 });

  const openEditor = useCallback(() => {
    setDraft(current?.note || '');
    setEditing(true);
  }, [current]);

  const saveNote = useCallback(async () => {
    if (!current || savingNote) return;
    const value = draft.trim();
    setSavingNote(true);
    try {
      const updated = await updateStamp(current.id, { note: value });
      if (!updated) {
        showDialog({
          title: 'Could not save note',
          message: 'This stamp may have been removed. Try again.',
        });
        return;
      }
      setEditing(false);
    } catch (e) {
      showDialog({
        title: 'Could not save note',
        message: 'Something went wrong while saving. Please try again.',
      });
    } finally {
      setSavingNote(false);
    }
  }, [current, draft, savingNote, showDialog]);

  const handleShare = useCallback(async () => {
    if (!current || shareInFlight.current) return;
    shareInFlight.current = true;
    const shareCacheKey = `${current.id}:${current.uri}`;
    const needsCapture = !hasCachedFramedShare(shareCacheKey);
    if (needsCapture) setSharing(true);

    try {
      const result = await shareFramedStampView(
        shareStageRef,
        shareCacheKey,
        current.uri,
        needsCapture ? shareReadyGate.current : null
      );

      if (!result.ok) {
        showDialog({ title: 'Could not share', message: result.error });
      }
    } finally {
      if (needsCapture) setSharing(false);
      shareInFlight.current = false;
    }
  }, [current, showDialog]);

  const renderItem = useCallback(
    ({ item, index: i }) => {
      const near = Math.abs(i - index) <= WINDOW;
      return (
        <View style={[styles.page, { width }]}>
          {near ? (
            <StampRenderer uri={item.uri} width={stampWidth} />
          ) : (
            // Placeholder keeps paging geometry identical without building
            // a full stamp path for an off-screen page.
            <View
              style={{
                width: stampWidth,
                height: stampWidth * 1.377,
                borderRadius: 8,
                backgroundColor: '#EEE8F3',
              }}
            />
          )}
        </View>
      );
    },
    [index, width, stampWidth]
  );

  const keyExtractor = useCallback((item) => item.id, []);

  const getItemLayout = useCallback(
    (_, i) => ({ length: width, offset: width * i, index: i }),
    [width]
  );

  if (!stamps.length) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ height: STATUS_BAR_HEIGHT }} />
        <View style={styles.empty}>
          <Feather name="inbox" size={28} color={STAMP_COLORS.textMuted} />
          <Text style={styles.emptyText}>No stamps yet</Text>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.emptyLink}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const place = formatLocation(current?.location);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <View style={{ height: STATUS_BAR_HEIGHT }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={ACTIVE_OPACITY}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="arrow-left" size={20} color={STAMP_COLORS.textPrimary} />
        </TouchableOpacity>

        <Text style={styles.counter}>
          {index + 1} of {stamps.length}
        </Text>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => setSaving(true)}
            activeOpacity={ACTIVE_OPACITY}
            hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
          >
            <Feather name="download" size={18} color={STAMP_COLORS.textPrimary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.iconBtn, styles.iconBtnSpaced]}
            onPress={handleShare}
            activeOpacity={ACTIVE_OPACITY}
            disabled={sharing}
            hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
            accessibilityLabel="Share stamp"
          >
            {sharing ? (
              <ActivityIndicator size="small" color={STAMP_COLORS.accent} />
            ) : (
              <Feather name="share-2" size={18} color={STAMP_COLORS.textPrimary} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.iconBtn, styles.iconBtnSpaced]}
            onPress={() => navigation.navigate('Editor', { stamp: current })}
            activeOpacity={ACTIVE_OPACITY}
            hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
          >
            <Feather name="edit-2" size={18} color={STAMP_COLORS.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Pager -- stops naturally at both ends */}
      <FlatList
        ref={listRef}
        data={stamps}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemLayout={getItemLayout}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={initialIndex}
        onViewableItemsChanged={onViewRef.current}
        viewabilityConfig={viewConfigRef.current}
        style={styles.pager}
      />

      {/* Meta + note */}
      <View style={[styles.meta, { paddingBottom: 16 + bottomInset }]}>
        <Text style={styles.date}>{formatDate(current?.createdAt)}</Text>

        {place ? (
          <View style={styles.placeRow}>
            <Feather name="map-pin" size={13} color={STAMP_COLORS.accent} />
            <Text style={styles.placeText} numberOfLines={1}>
              {place}
            </Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={styles.noteBox}
          onPress={openEditor}
          activeOpacity={ACTIVE_OPACITY}
        >
          {current?.note ? (
            <>
              <Text style={styles.noteText}>{current.note}</Text>
              <Feather name="edit-2" size={15} color={STAMP_COLORS.textMuted} />
            </>
          ) : (
            <>
              <Feather name="plus-circle" size={16} color={STAMP_COLORS.accent} />
              <Text style={styles.addNote}>Add a note</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Dots: only for a small collection, otherwise they turn to mush */}
        {stamps.length <= 12 ? (
          <View style={styles.dots}>
            {stamps.map((s, i) => (
              <View
                key={s.id}
                style={[styles.dot, i === index && styles.dotActive]}
              />
            ))}
          </View>
        ) : null}
      </View>

      <SaveStampSheet
        visible={saving}
        stamp={current}
        onClose={() => setSaving(false)}
      />

      {/* Full-resolution, off-screen stage for share/save framed PNG captures. */}
      {current ? (
        <View style={styles.shareStageWrap} pointerEvents="none">
          <View
            ref={shareStageRef}
            collapsable={false}
            style={[styles.shareStage, styles.shareStageSized]}
          >
            <StampRenderer
              uri={current.uri}
              width={CAPTURE_WIDTH}
              rotation={0}
              framed
              forceSvg
              onImageReady={() => shareReadyGate.current.notify()}
            />
          </View>
        </View>
      ) : null}

      {/* Note editor */}
      <Modal
        visible={editing}
        transparent
        animationType="fade"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setEditing(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalWrap}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
        >
          <TouchableOpacity
            style={styles.scrim}
            activeOpacity={1}
            onPress={() => setEditing(false)}
          />
          <Animated.View
            style={[
              styles.sheet,
              {
                paddingBottom: 18 + bottomInset + keyboardInset,
              },
              {
                opacity: sheet,
                transform: [
                  {
                    translateY: sheet.interpolate({
                      inputRange: [0, 1],
                      outputRange: [40, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.grabber} />
            <Text style={styles.sheetTitle}>Note</Text>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              bounces={false}
              showsVerticalScrollIndicator={false}
            >
              <TextInput
                style={[
                  styles.sheetInput,
                  keyboardInset > 0 && styles.sheetInputCompact,
                ]}
                value={draft}
                onChangeText={(v) => setDraft(v.slice(0, NOTE_MAX))}
                placeholder="What made this moment worth keeping?"
                placeholderTextColor={STAMP_COLORS.textMuted}
                multiline
                autoFocus
                maxLength={NOTE_MAX}
                textAlignVertical="top"
              />

              <Text style={styles.sheetCounter}>
                {draft.length}/{NOTE_MAX}
              </Text>

              <View style={styles.sheetActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setEditing(false)}
                  activeOpacity={ACTIVE_OPACITY}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.saveBtn}
                  onPress={saveNote}
                  activeOpacity={ACTIVE_OPACITY}
                  disabled={savingNote}
                >
                  <Text style={styles.saveText}>
                    {savingNote ? 'Saving…' : 'Save note'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: STAMP_COLORS.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: HAIRLINE,
    borderColor: '#E5DDEC',
    backgroundColor: '#FEFCFF',
  },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  iconBtnSpaced: { marginLeft: 8 },
  shareStageWrap: {
    position: 'absolute',
    left: -10000,
    top: 0,
  },
  shareStage: { backgroundColor: '#FFFFFF' },
  shareStageSized: {
    width: CAPTURE_WIDTH,
    height: CAPTURE_HEIGHT,
  },
  counter: {
    fontSize: 14,
    includeFontPadding: false,
    color: STAMP_COLORS.textSecondary,
    ...weight(500),
  },

  pager: { flexGrow: 0 },
  page: { alignItems: 'center', justifyContent: 'center', paddingVertical: 18 },

  meta: {
    flex: 1,
    paddingHorizontal: 26,
  },
  date: {
    fontSize: 13.5,
    includeFontPadding: false,
    color: STAMP_COLORS.textSecondary,
    textAlign: 'center',
  },
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  placeText: {
    marginLeft: 5,
    fontSize: 13.5,
    includeFontPadding: false,
    color: STAMP_COLORS.textPrimary,
    maxWidth: '80%',
  },

  noteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    borderWidth: HAIRLINE,
    borderColor: '#E6DEED',
    borderRadius: 14,
    backgroundColor: '#FEFCFF',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 54,
  },
  noteText: {
    flex: 1,
    fontSize: 14.5,
    lineHeight: 20,
    includeFontPadding: false,
    color: STAMP_COLORS.textPrimary,
  },
  addNote: {
    marginLeft: 8,
    fontSize: 14.5,
    includeFontPadding: false,
    color: STAMP_COLORS.accent,
    ...weight(600),
  },

  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginHorizontal: 3,
    backgroundColor: '#D8D0E1',
  },
  dotActive: { backgroundColor: STAMP_COLORS.accent, width: 18 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: {
    marginTop: 10,
    fontSize: 15,
    includeFontPadding: false,
    color: STAMP_COLORS.textSecondary,
  },
  emptyLink: {
    marginTop: 12,
    fontSize: 15,
    includeFontPadding: false,
    color: STAMP_COLORS.accent,
    ...weight(600),
  },

  modalWrap: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(20,17,15,0.42)' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 22,
    paddingTop: 10,
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
    fontSize: 17,
    includeFontPadding: false,
    color: STAMP_COLORS.textPrimary,
    ...weight(600),
    marginBottom: 10,
  },
  sheetInput: {
    minHeight: 92,
    maxHeight: 160,
    borderWidth: HAIRLINE,
    borderColor: '#E5DDEC',
    borderRadius: 12,
    backgroundColor: '#FEFCFF',
    paddingHorizontal: 13,
    paddingTop: 11,
    paddingBottom: 11,
    fontSize: 15,
    lineHeight: 21,
    includeFontPadding: false,
    color: STAMP_COLORS.textPrimary,
  },
  sheetInputCompact: {
    minHeight: 72,
    maxHeight: 120,
  },
  sheetCounter: {
    alignSelf: 'flex-end',
    marginTop: 6,
    fontSize: 12,
    includeFontPadding: false,
    color: STAMP_COLORS.textMuted,
  },
  sheetActions: { flexDirection: 'row', marginTop: 14 },
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
  saveBtn: {
    flex: 1.4,
    height: 50,
    borderRadius: 25,
    backgroundColor: STAMP_COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: {
    fontSize: 15,
    includeFontPadding: false,
    color: '#fff',
    ...weight(600),
  },
});

export default StampViewerScreen;
