/**
 * CaptureSaveScreen.js
 *
 * Save screen for stamps punched from the CAPTURE tab (i.e. every stamp after
 * the first). StampDetailScreen is kept exclusively for the onboarding flight,
 * because that screen must not animate its stamp in -- it receives one
 * mid-flight from the camera at a pixel-exact position, and reusing it here
 * would mean two incompatible entry behaviours in one file.
 *
 * Differences from StampDetailScreen:
 *   - the note is optional
 *   - an optional location tag
 *   - saving goes to Collection, not the SavedStamp celebration
 *   - back (gesture or hardware) always returns to Capture, never into the
 *     onboarding stack
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
  Easing,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

import StampRenderer from '../components/StampRenderer';
import AdInterstitial from '../components/AdInterstitial';
import { addStamp } from '../data/stampStore';
import { useAuth } from '../data/authStore';
import { isPro } from '../data/subscriptionStore';
import { showInterstitial, isAdsAvailable } from '../data/ads';
import { MONETIZATION_ENABLED } from '../data/monetization';
import { captureLocation, isLocationAvailable } from '../utils/location';
import CollectionPicker from '../components/CollectionPicker';
import { loadCollections, collectionName } from '../data/collectionStore';
import { getLastCollection, setLastCollection, loadLastCollection } from '../data/appState';
import { STAMP_COLORS } from '../styles/stampTheme';
import {
  weight,
  STATUS_BAR_HEIGHT,
  useBottomInset,
  shadow,
  HAIRLINE,
  ACTIVE_OPACITY,
} from '../styles/platform';

const STAMP_WIDTH = 168;
const NOTE_MAX = 140;

const CaptureSaveScreen = ({ navigation, route }) => {
  const photoUri = route?.params?.photoUri ?? null;
  const { user } = useAuth();
  const bottomInset = useBottomInset();

  const [note, setNote] = useState('');
  const [location, setLocation] = useState(null);
  const [locBusy, setLocBusy] = useState(false);
  const [locError, setLocError] = useState(null);
  const [saving, setSaving] = useState(false);
  /** Free tier: the ad stands between saving and the collection. */
  const [showAd, setShowAd] = useState(false);

  /** REQUIRED, like the note. Pre-filled with the last-used collection. */
  const [collectionId, setCollectionId] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  /** 'ad' = show the in-app card first; 'offer' = a real ad already played. */
  const [adPhase, setAdPhase] = useState('ad');

  const enter = useRef(new Animated.Value(0)).current;

  /**
   * Seed the picker: last-used if it still exists, else the first collection.
   * Never leaves the selection empty -- saving requires a valid target.
   */
  useEffect(() => {
    let alive = true;
    (async () => {
      const [list] = await Promise.all([loadCollections(), loadLastCollection()]);
      if (!alive) return;
      const last = getLastCollection();
      const valid = list.find((c) => c.id === last);
      setCollectionId(valid ? valid.id : list[0]?.id ?? null);
    })();
    return () => {
      alive = false;
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
   * Back ALWAYS returns to the camera. Using goBack() would pop into whatever
   * happens to be underneath -- which, after a save, is the Collection screen.
   */
  const goBackToCapture = useCallback(() => {
    navigation.navigate('Capture');
  }, [navigation]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      goBackToCapture();
      return true;
    });
    return () => sub.remove();
  }, [goBackToCapture]);

  const collectionValid = !!collectionId;
  const canSave = collectionValid;

  const handleLocation = useCallback(async () => {
    if (locBusy) return;
    // Tapping an existing tag clears it.
    if (location) {
      setLocation(null);
      setLocError(null);
      return;
    }
    setLocBusy(true);
    setLocError(null);
    const res = await captureLocation();
    setLocBusy(false);
    if (res.ok) setLocation(res.location);
    else setLocError(res.error);
  }, [locBusy, location]);

  /**
   * Leave for the collection. Split out because both the ad dismissal and the
   * Pro path end here, and duplicating the reset invited them to drift.
   *
   * reset, not navigate: Collection becomes the root, so back from there
   * exits cleanly rather than returning to this save screen.
   */
  const goToCollection = useCallback(() => {
    navigation.reset({ index: 0, routes: [{ name: 'Collections' }] });
  }, [navigation]);

  const handleSave = useCallback(async () => {
    if (saving) return;
    if (!canSave) return;

    setSaving(true);
    try {
      await addStamp({
        uri: photoUri,
        note: note.trim(),
        location,
        collection: collectionId,
      });
      // Remember for the next stamp in this outing.
      await setLastCollection(collectionId);
    } catch (e) {
      // A storage hiccup must not trap the user on this screen.
    }

    // The stamp is SAVED before the ad shows. Ads must never be able to cost
    // someone their capture -- if they force-quit on the ad, the stamp is
    // already on disk.
    //
    // v1 ships completely free: while MONETIZATION_ENABLED is false, every
    // save goes straight to the collection. The interstitial, the in-app ad
    // card and the subscribe offer below all stay wired but dormant --
    // flipping the flag in src/data/monetization.js restores them as-is.
    if (!MONETIZATION_ENABLED || isPro(user?.uid)) {
      setSaving(false);
      goToCollection();
      return;
    }

    /**
     * Try a REAL AdMob interstitial first. It resolves true once dismissed,
     * or false immediately when none is warm (no network, not installed, no
     * unit id). Either way the user then sees the subscribe offer, so the
     * upsell does not depend on ad fill.
     */
    let shown = false;
    if (isAdsAvailable()) {
      try {
        shown = await showInterstitial();
      } catch (e) {
        shown = false;
      }
    }

    setSaving(false);

    if (shown) {
      // Real ad already played: skip the placeholder, go straight to the offer.
      setAdPhase('offer');
    } else {
      // No ad available: the in-app card stands in for it.
      setAdPhase('ad');
    }
    setShowAd(true);
  }, [
    saving,
    canSave,
    photoUri,
    note,
    location,
    collectionId,
    user,
    goToCollection,
  ]);

  const enterStyle = {
    opacity: enter,
    transform: [
      {
        translateY: enter.interpolate({
          inputRange: [0, 1],
          outputRange: [14, 0],
        }),
      },
    ],
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <View style={{ height: STATUS_BAR_HEIGHT }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={goBackToCapture}
          activeOpacity={ACTIVE_OPACITY}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="arrow-left" size={20} color={STAMP_COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Save your stamp</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={enterStyle}>
          {/* The stamp */}
          <View style={styles.stampWrap}>
            <StampRenderer uri={photoUri} width={STAMP_WIDTH} />
          </View>

          {/* Collection -- REQUIRED */}
          <View style={styles.labelRow}>
            <Text style={styles.label}>Collection</Text>
            <Text style={styles.required}>Required</Text>
          </View>

          <TouchableOpacity
            style={styles.collectionBtn}
            onPress={() => setPickerOpen(true)}
            activeOpacity={ACTIVE_OPACITY}
          >
            <Feather name="folder" size={17} color={STAMP_COLORS.accent} />
            <Text style={styles.collectionText} numberOfLines={1}>
              {collectionId ? collectionName(collectionId) : 'Choose a collection'}
            </Text>
            <Feather name="chevron-down" size={17} color={STAMP_COLORS.textMuted} />
          </TouchableOpacity>

          {/* Note -- optional */}
          <View style={[styles.labelRow, styles.labelSpacedTop]}>
            <Text style={styles.label}>A note for this stamp</Text>
            <Text style={styles.optional}>Optional</Text>
          </View>

          <Animated.View>
            <TextInput
              style={styles.input}
              value={note}
              onChangeText={(v) => {
                setNote(v.slice(0, NOTE_MAX));
              }}
              placeholder="What made this moment worth keeping?"
              placeholderTextColor={STAMP_COLORS.textMuted}
              multiline
              maxLength={NOTE_MAX}
              textAlignVertical="top"
            />
          </Animated.View>

          <View style={styles.metaRow}>
            <View />
            <Text style={styles.counter}>
              {note.length}/{NOTE_MAX}
            </Text>
          </View>

          {/* Location tag -- optional */}
          <Text style={[styles.label, styles.labelSpaced]}>Location</Text>

          <TouchableOpacity
            style={[styles.locBtn, location && styles.locBtnActive]}
            onPress={handleLocation}
            activeOpacity={ACTIVE_OPACITY}
            disabled={locBusy}
          >
            {locBusy ? (
              <ActivityIndicator size="small" color={STAMP_COLORS.accent} />
            ) : (
              <Feather
                name={location ? 'map-pin' : 'plus-circle'}
                size={17}
                color={location ? STAMP_COLORS.accent : STAMP_COLORS.textSecondary}
              />
            )}
            <Text
              style={[styles.locText, location && styles.locTextActive]}
              numberOfLines={1}
            >
              {locBusy
                ? 'Finding you…'
                : location
                ? location.label
                : 'Tag this place'}
            </Text>
            {location ? (
              <Feather name="x" size={16} color={STAMP_COLORS.textMuted} />
            ) : null}
          </TouchableOpacity>

          {locError ? <Text style={styles.locError}>{locError}</Text> : null}
          {!isLocationAvailable() ? (
            <Text style={styles.locError}>
              Install expo-location to enable place tags.
            </Text>
          ) : null}
        </Animated.View>
      </ScrollView>

      {/* Save */}
      <View style={[styles.footer, { paddingBottom: 12 + bottomInset }]}>
        <TouchableOpacity
          style={[styles.save, !canSave && styles.saveDisabled]}
          onPress={handleSave}
          activeOpacity={ACTIVE_OPACITY}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveText}>Save to collection</Text>
          )}
        </TouchableOpacity>
      </View>
      <CollectionPicker
        visible={pickerOpen}
        selectedId={collectionId}
        onSelect={setCollectionId}
        onClose={() => setPickerOpen(false)}
      />

      <AdInterstitial
        visible={showAd}
        startPhase={adPhase}
        onClose={goToCollection}
        onSubscribe={() => {
          setShowAd(false);
          navigation.navigate('Subscribe');
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: STAMP_COLORS.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 10,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    includeFontPadding: false,
    color: STAMP_COLORS.textPrimary,
    ...weight(600),
  },

  scroll: { paddingHorizontal: 24, paddingBottom: 24 },

  stampWrap: { alignItems: 'center', paddingTop: 6, paddingBottom: 26 },

  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {
    fontSize: 15,
    includeFontPadding: false,
    color: STAMP_COLORS.textPrimary,
    ...weight(600),
  },
  labelSpaced: { marginTop: 22, marginBottom: 8 },
  required: {
    fontSize: 11.5,
    includeFontPadding: false,
    color: STAMP_COLORS.accent,
    letterSpacing: 0.4,
    ...weight(600),
  },
  optional: {
    fontSize: 11.5,
    includeFontPadding: false,
    color: STAMP_COLORS.textMuted,
    letterSpacing: 0.4,
    ...weight(600),
  },

  collectionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: HAIRLINE,
    borderColor: '#DED1EA',
    borderRadius: 12,
    backgroundColor: '#F8F3FC',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  collectionText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    includeFontPadding: false,
    color: STAMP_COLORS.textPrimary,
    ...weight(500),
  },
  labelSpacedTop: { marginTop: 22 },

  input: {
    minHeight: 96,
    borderWidth: HAIRLINE,
    borderColor: '#E5DDEC',
    borderRadius: 14,
    backgroundColor: '#FEFCFF',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 15,
    lineHeight: 21,
    includeFontPadding: false,
    color: STAMP_COLORS.textPrimary,
  },
  inputError: { borderColor: '#D84343', backgroundColor: '#FEF5F7' },

  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    minHeight: 16,
  },
  errorText: {
    fontSize: 12.5,
    includeFontPadding: false,
    color: '#D84343',
  },
  counter: {
    fontSize: 12,
    includeFontPadding: false,
    color: STAMP_COLORS.textMuted,
  },

  locBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: HAIRLINE,
    borderColor: '#E5DDEC',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: '#FEFCFF',
  },
  locBtnActive: {
    borderStyle: 'solid',
    borderColor: '#DED1EA',
    backgroundColor: '#F8F3FC',
  },
  locText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14.5,
    includeFontPadding: false,
    color: STAMP_COLORS.textSecondary,
  },
  locTextActive: { color: STAMP_COLORS.textPrimary, ...weight(500) },
  locError: {
    marginTop: 7,
    fontSize: 12.5,
    includeFontPadding: false,
    color: '#B24659',
  },

  footer: {
    paddingHorizontal: 24,
    paddingTop: 10,
    borderTopWidth: HAIRLINE,
    borderTopColor: '#EEE8F3',
    backgroundColor: STAMP_COLORS.background,
  },
  save: {
    height: 54,
    borderRadius: 27,
    backgroundColor: STAMP_COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow(2),
  },
  saveDisabled: { backgroundColor: '#D9D1E0', ...shadow(0) },
  saveText: {
    color: '#fff',
    fontSize: 16,
    includeFontPadding: false,
    ...weight(600),
  },
});

export default CaptureSaveScreen;
