/**
 * CollectionScreen.js
 *
 * "All Stamps" — the full grid of everything the user has punched.
 *
 * Reached from the Collection tab. Supports a Select mode for bulk actions.
 *
 * The reference mock is iOS; Android adaptations:
 *   - SafeAreaView is a no-op on Android, so STATUS_BAR_HEIGHT is reserved
 *     manually and the StatusBar is made translucent
 *   - tile size is derived from screen width (never hardcoded), so 320dp
 *     phones do not overflow and tablets do not stretch
 *   - hardware BACK button exits Select mode before leaving the screen,
 *     which is the expected Android behaviour
 *   - elevation via shadow() so cards are visible (shadow* alone renders
 *     nothing on Android)
 *   - the grid clears the floating tab bar AND the gesture bar
 *   - FlatList with removeClippedSubviews + windowing, since a large
 *     collection on a mid-range Android device must not drop frames
 *
 * Measured from the reference (853px wide): side margin 7.03%, tile 25.28%,
 * gutter 5.16%. Tile aspect 0.731 ~= the stamp's 212/292, so StampRenderer
 * is used directly rather than a second thumbnail renderer.
 */

import React, {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
  StatusBar,
  Animated,
  Easing,
  BackHandler,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

import StampRenderer, { STAMP } from '../components/StampRenderer';
import TabBar from '../components/TabBar';
import { useStamps, moveStamps } from '../data/stampStore';
import CollectionPicker from '../components/CollectionPicker';
import { collectionName } from '../data/collectionStore';
import { useAuth } from '../data/authStore';
import StampActionSheet from '../components/StampActionSheet';
import SaveStampSheet from '../components/SaveStampSheet';
import { useAppDialog } from '../components/AppDialog';
import { printWithPrompt } from '../utils/print';
import { useTrashSound } from '../utils/useTrashSound';
import {
  STATUS_BAR_HEIGHT,
  useBottomInset,
  weight,
  ACTIVE_OPACITY,
  HAIRLINE,
} from '../styles/platform';

const BG = '#FAF8FC';
const INK = '#2F233B';
const MUTED = '#786D82';
const ACCENT = '#5B2B8A';

/** Grid metrics as fractions of screen width, measured from the reference. */
const SIDE_MARGIN_RATIO = 0.0703;
const GUTTER_RATIO = 0.0516;
const COLUMNS = 3;
const STAMP_ASPECT = STAMP.OUTER_HEIGHT / STAMP.OUTER_WIDTH;

/**
 * One stamp tile. Memoized: in a long collection this is the difference
 * between a smooth and a janky scroll on Android.
 */
const StampTile = React.memo(function StampTile({
  item,
  width,
  gutter,
  selectMode,
  selected,
  onPress,
  onLongPress,
  index,
  deleting,
}) {
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 320,
      delay: Math.min(index, 11) * 45,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [enter, index]);

  /**
   * Crumple-and-drop: the tile shrinks, tips over and falls away, which reads
   * as being thrown out rather than simply vanishing.
   */
  const bin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!deleting) return;
    Animated.timing(bin, {
      toValue: 1,
      duration: 420,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [deleting, bin]);

  const style = deleting
    ? {
        opacity: bin.interpolate({
          inputRange: [0, 0.55, 1],
          outputRange: [1, 0.7, 0],
        }),
        transform: [
          { scale: bin.interpolate({ inputRange: [0, 1], outputRange: [1, 0.35] }) },
          {
            translateY: bin.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 90],
            }),
          },
          {
            rotate: bin.interpolate({
              inputRange: [0, 1],
              outputRange: ['0deg', '24deg'],
            }),
          },
        ],
      }
    : {
        opacity: enter,
        transform: [
          { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) },
          {
            translateY: enter.interpolate({
              inputRange: [0, 1],
              outputRange: [14, 0],
            }),
          },
        ],
      };

  return (
    <Animated.View style={[{ marginBottom: gutter }, style]}>
      <TouchableOpacity
        activeOpacity={0.82}
        onPress={() => onPress(item)}
        onLongPress={() => onLongPress(item)}
        delayLongPress={280}
      >
        <View
          style={[
            selected && styles.tileSelected,
            { width, height: Math.round(width * STAMP_ASPECT), overflow: 'hidden' },
          ]}
        >
          {/*
            Skia draws a canvas larger than the tile (shadow padding), which
            gets clipped inside FlatList on iOS and leaves blank/faint tiles.
            SVG matches the tile size exactly.
          */}
          <StampRenderer uri={item.uri} width={width} rotation={0} forceSvg />
        </View>

        {selectMode ? (
          <View style={[styles.check, selected && styles.checkOn]}>
            {selected ? <Feather name="check" size={13} color="#fff" /> : null}
          </View>
        ) : null}
      </TouchableOpacity>
    </Animated.View>
  );
});

const CollectionScreen = ({ navigation, route }) => {
  const { showDialog } = useAppDialog();
  const { width } = useWindowDimensions();

  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState({});
  const [sheetFor, setSheetFor] = useState(null);   // ids the sheet acts on
  const [deletingIds, setDeletingIds] = useState({});

  const playTrash = useTrashSound();

  /**
   * Live from the persistent store: saving on StampDetail updates this screen
   * with no navigation params and no manual refresh.
   */
  const { stamps: allStamps, remove } = useStamps();

  /**
   * When opened from CollectionsScreen this shows ONE album; opened via the
   * "All" button it shows everything. Both use the same grid.
   */
  const collectionId = route?.params?.collectionId ?? null;
  const stamps = useMemo(
    () => (collectionId ? allStamps.filter((s) => s.collection === collectionId) : allStamps),
    [allStamps, collectionId]
  );

  /** Stamps queued to be moved into another collection. */
  const [moveIds, setMoveIds] = useState(null);
  const { signOut, user } = useAuth();
  const bottomInset = useBottomInset();
  /** Stamp queued for "Save to device", or null. */
  const [saveFor, setSaveFor] = useState(null);

  // -- grid metrics --------------------------------------------------------
  const metrics = useMemo(() => {
    const side = Math.round(width * SIDE_MARGIN_RATIO);
    const gutter = Math.round(width * GUTTER_RATIO);
    const tile = Math.floor(
      (width - side * 2 - gutter * (COLUMNS - 1)) / COLUMNS
    );
    return { side, gutter, tile };
  }, [width]);

  // -- select mode ---------------------------------------------------------
  const selectedCount = useMemo(
    () => Object.values(selected).filter(Boolean).length,
    [selected]
  );

  const exitSelect = useCallback(() => {
    setSelectMode(false);
    setSelected({});
  }, []);

  const toggleSelect = useCallback((item) => {
    setSelected((prev) => ({ ...prev, [item.id]: !prev[item.id] }));
  }, []);

  /**
   * Android hardware back: leave Select mode first rather than popping the
   * screen. Returning false lets the default navigation happen otherwise.
   */
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (selectMode) {
        exitSelect();
        return true;
      }
      // At the stack root, let Android exit the app -- never fall back into
      // the onboarding funnel, which is no longer on the stack anyway.
      return false;
    });
    return () => sub.remove();
  }, [selectMode, exitSelect]);

  const handlePress = useCallback(
    (item) => {
      if (selectMode) {
        toggleSelect(item);
        return;
      }
      // Plain tap OPENS the stamp. The Edit/Print/Delete sheet is reached by
      // long-press (or Select mode) -- a tap that popped a menu instead of
      // showing the thing you tapped was the wrong default.
      navigation.navigate('StampViewer', { stampId: item.id });
    },
    [selectMode, toggleSelect, navigation]
  );

  /** Stamps the sheet is currently acting on. */
  const sheetStamps = useMemo(
    () => (sheetFor ? stamps.filter((s) => sheetFor.includes(s.id)) : []),
    [sheetFor, stamps]
  );

  const closeSheet = useCallback(() => setSheetFor(null), []);

  /** Hand the single selected stamp to the save sheet. */
  const handleSaveToDevice = useCallback(() => {
    const one = sheetStamps[0];
    setSheetFor(null);
    exitSelect();
    if (one) setSaveFor(one);
  }, [sheetStamps, exitSelect, showDialog]);

  /** Move the selected stamps into another collection. */
  const handleMove = useCallback(() => {
    const ids = sheetFor || [];
    setSheetFor(null);
    exitSelect();
    if (ids.length) setMoveIds(ids);
  }, [sheetFor, exitSelect]);

  const handleEdit = useCallback(() => {
    const one = sheetStamps[0];
    setSheetFor(null);
    if (one) navigation.navigate('Editor', { stamp: one });
  }, [sheetStamps, navigation]);

  const handlePrint = useCallback(async () => {
    const list = sheetStamps;
    setSheetFor(null);
    exitSelect();
    await printWithPrompt(list, showDialog);
  }, [sheetStamps, exitSelect, showDialog]);

  /**
   * Delete: sound + animation first, then remove from the store once the
   * tiles have finished falling. Removing immediately would unmount them
   * mid-animation and the effect would never be seen.
   */
  const handleDelete = useCallback(() => {
    const ids = sheetFor || [];
    if (!ids.length) return;
    setSheetFor(null);

    playTrash();
    setDeletingIds(ids.reduce((m, id) => ({ ...m, [id]: true }), {}));

    setTimeout(() => {
      remove(ids);
      setDeletingIds({});
      exitSelect();
    }, 430);
  }, [sheetFor, playTrash, remove, exitSelect]);

  /**
   * Long-press enters Select mode with this stamp chosen and immediately
   * offers the actions, so the common "one stamp, one action" path is a single
   * gesture rather than long-press -> tap Options.
   */
  const handleLongPress = useCallback(
    (item) => {
      if (selectMode) return;
      setSelectMode(true);
      setSelected({ [item.id]: true });
      setSheetFor([item.id]);
    },
    [selectMode]
  );

  const handleTab = useCallback(
    (tab) => {
      if (tab.route) navigation.navigate(tab.route);
    },
    [navigation]
  );

  /**
   * Sign out => the gate closes again. `reset` to Login rather than navigate,
   * so the dashboard is gone from the stack and back cannot return to it.
   */
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

  const renderItem = useCallback(
    ({ item, index }) => (
      <StampTile
        item={item}
        index={index}
        width={metrics.tile}
        gutter={metrics.gutter}
        selectMode={selectMode}
        selected={!!selected[item.id]}
        deleting={!!deletingIds[item.id]}
        onPress={handlePress}
        onLongPress={handleLongPress}
      />
    ),
    [metrics, selectMode, selected, deletingIds, handlePress, handleLongPress]
  );

  const keyExtractor = useCallback((item) => item.id, []);

  const countLabel = selectMode
    ? `${selectedCount} selected`
    : `${stamps.length} ${stamps.length === 1 ? 'stamp' : 'stamps'}`;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <View style={styles.statusSpacer} />

      {/* Header */}
      <View style={[styles.header, { paddingHorizontal: metrics.side }]}>
        {/* Collection is the dashboard ROOT after login, so there is usually
            nothing to go back to. The slot becomes sign-out in that case. */}
        <TouchableOpacity
          style={styles.backBtn}
          activeOpacity={ACTIVE_OPACITY}
          onPress={() => {
            if (selectMode) return exitSelect();
            if (navigation.canGoBack()) return navigation.goBack();
            return handleSignOut();
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather
            name={
              selectMode ? 'x' : navigation.canGoBack() ? 'arrow-left' : 'log-out'
            }
            size={20}
            color={INK}
          />
        </TouchableOpacity>

        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={1}>
            {selectMode
              ? 'Select stamps'
              : collectionId
              ? route?.params?.collectionName || collectionName(collectionId)
              : 'All Stamps'}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {countLabel}
            {user && !user.isAnonymous && (user.name || user.email || user.phone)
              ? ` · ${user.name || user.email || user.phone}`
              : ''}
          </Text>
        </View>

        <TouchableOpacity
          activeOpacity={ACTIVE_OPACITY}
          onPress={() => {
            if (!selectMode) return setSelectMode(true);
            const ids = Object.keys(selected).filter((k) => selected[k]);
            if (ids.length) setSheetFor(ids);
            else exitSelect();
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.selectBtn}
        >
          <Text style={[styles.selectText, selectMode && styles.selectTextActive]}>
            {selectMode
              ? selectedCount > 0
                ? `Options (${selectedCount})`
                : 'Done'
              : 'Select'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Grid */}
      {stamps.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="inbox" size={30} color={MUTED} />
          <Text style={styles.emptyTitle}>No stamps yet</Text>
          <Text style={styles.emptyBody}>
            Punch your first one and it will land here.
          </Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            activeOpacity={ACTIVE_OPACITY}
            onPress={() => navigation.navigate('Capture')}
          >
            <Text style={styles.emptyBtnText}>Punch a stamp</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={stamps}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          numColumns={COLUMNS}
          columnWrapperStyle={[
            styles.row,
            { paddingHorizontal: metrics.side, gap: metrics.gutter },
          ]}
          contentContainerStyle={[
            styles.grid,
            { paddingBottom: 120 + bottomInset },
          ]}
          showsVerticalScrollIndicator={false}
          overScrollMode="never"
          // Skia/SVG stamps mis-render when aggressively clipped on iOS.
          removeClippedSubviews={Platform.OS === 'android'}
          initialNumToRender={12}
          maxToRenderPerBatch={9}
          windowSize={7}
        />
      )}

      <CollectionPicker
        visible={!!moveIds}
        selectedId={collectionId}
        title="Move to collection"
        onSelect={async (id) => {
          const ids = moveIds || [];
          setMoveIds(null);
          if (ids.length) await moveStamps(ids, id);
        }}
        onClose={() => setMoveIds(null)}
      />

      <SaveStampSheet
        visible={!!saveFor}
        stamp={saveFor}
        onClose={() => setSaveFor(null)}
      />


      <TabBar active="Collection" onTabPress={handleTab} />

      <StampActionSheet
        visible={!!sheetFor}
        count={sheetFor ? sheetFor.length : 0}
        onSave={handleSaveToDevice}
        onMove={handleMove}
        onEdit={handleEdit}
        onPrint={handlePrint}
        onDelete={handleDelete}
        onClose={closeSheet}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  statusSpacer: { height: STATUS_BAR_HEIGHT },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 18,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: HAIRLINE,
    borderColor: '#E5DDEC',
    backgroundColor: '#FEFCFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, marginLeft: 14 },
  title: {
    fontSize: 23,
    includeFontPadding: false,
    color: INK,
    ...weight(600),
  },
  subtitle: {
    marginTop: 2,
    fontSize: 14,
    includeFontPadding: false,
    color: MUTED,
  },
  selectBtn: { paddingVertical: 8, paddingLeft: 12 },
  selectText: {
    fontSize: 16,
    includeFontPadding: false,
    color: INK,
  },
  selectTextActive: { color: ACCENT, ...weight(600) },

  grid: { paddingTop: 2 },
  // Pack tiles left-to-right. `space-between` leaves a huge gap when a row
  // isn't full (e.g. only 2 stamps in a 3-column grid).
  row: { justifyContent: 'flex-start' },

  tileSelected: {
    opacity: 0.62,
    borderRadius: 6,
  },
  check: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(0,0,0,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: ACCENT, borderColor: '#FFFFFF' },

  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingBottom: 90,
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 18,
    includeFontPadding: false,
    color: INK,
    ...weight(600),
  },
  emptyBody: {
    marginTop: 6,
    fontSize: 14,
    includeFontPadding: false,
    color: MUTED,
    textAlign: 'center',
  },
  emptyBtn: {
    marginTop: 18,
    backgroundColor: INK,
    paddingHorizontal: 24,
    paddingVertical: 13,
    borderRadius: 24,
  },
  emptyBtnText: {
    color: '#fff',
    fontSize: 15,
    includeFontPadding: false,
    ...weight(600),
  },
});

export default CollectionScreen;
