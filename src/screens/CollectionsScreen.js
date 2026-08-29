/**
 * CollectionsScreen.js
 *
 * The Collection tab's new landing screen: a grid of ALBUM cards.
 * Tapping one opens CollectionScreen (the stamp grid) filtered to it.
 *
 * Why a separate screen rather than filter chips on the existing grid: with
 * more than a handful of albums a chip row becomes an unreadable horizontal
 * scroll, and an album needs a cover + count to be recognisable at a glance.
 *
 * The cover is the newest stamp in the album -- computed from the live stamp
 * list rather than stored, so it stays correct after deletes with no extra
 * bookkeeping.
 */

import { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Image,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

import TabBar from '../components/TabBar';
import CollectionPicker from '../components/CollectionPicker';
import { useAppDialog } from '../components/AppDialog';
import StreakPanel from '../components/StreakPanel';
import { useStamps, moveStamps } from '../data/stampStore';
import { useCollections } from '../data/collectionStore';
import {
  STATUS_BAR_HEIGHT,
  shadow,
  weight,
  ACTIVE_OPACITY,
  HAIRLINE,
  useBottomInset,
} from '../styles/platform';

const BG = '#FAF8FC';
const INK = '#2F233B';
const MUTED = '#786D82';

const SIDE = 0.0703;
const GUTTER = 0.0516;
const TAB_SPACE = 120;

const CollectionsScreen = ({ navigation }) => {
  const { showDialog } = useAppDialog();
  const { width } = useWindowDimensions();
  const { stamps } = useStamps();
  const { collections, rename, remove } = useCollections();
  const bottomInset = useBottomInset();

  const [picker, setPicker] = useState(null); // collection pending deletion

  const metrics = useMemo(() => {
    const side = Math.round(width * SIDE);
    const gutter = Math.round(width * GUTTER);
    const tile = Math.floor((width - side * 2 - gutter) / 2);
    return { side, gutter, tile };
  }, [width]);

  /**
   * Cover + count per album, derived in ONE pass.
   * Stamps are already newest-first from the store, so the first match is the
   * newest -- no sorting needed here.
   */
  const summary = useMemo(() => {
    const map = {};
    collections.forEach((c) => {
      map[c.id] = { count: 0, cover: null };
    });
    stamps.forEach((s) => {
      const key = s.collection;
      if (!map[key]) return; // stamp points at a deleted album
      map[key].count += 1;
      if (!map[key].cover) map[key].cover = s.uri;
    });
    return map;
  }, [collections, stamps]);

  /** Stamps whose album no longer exists -- surfaced so they aren't lost. */
  const orphanCount = useMemo(() => {
    const ids = new Set(collections.map((c) => c.id));
    return stamps.filter((s) => !ids.has(s.collection)).length;
  }, [collections, stamps]);

  const counts = useMemo(() => {
    const c = {};
    Object.keys(summary).forEach((k) => {
      c[k] = summary[k].count;
    });
    return c;
  }, [summary]);

  const handleOpen = useCallback(
    (collection) => {
      navigation.navigate('Collection', {
        collectionId: collection.id,
        collectionName: collection.name,
      });
    },
    [navigation]
  );

  const handleLongPress = useCallback(
    (collection) => {
      showDialog({
        title: collection.name,
        message: 'Choose what you want to do with this collection.',
        showClose: true,
        accent: 'secondary',
        actions: [
        {
          label: 'Delete collection',
          variant: 'secondary',
          onPress: () => setPicker(collection),
        },
        {
          label: 'Rename',
          variant: 'primary',
          onPress: () => showDialog({
            title: 'Rename collection',
            input: { value: collection.name, placeholder: 'Collection name', maxLength: 40 },
            actions: [
              { label: 'Cancel', variant: 'secondary' },
              {
                label: 'Save',
                variant: 'primary',
                onPress: async (text) => {
                  const res = await rename(collection.id, text);
                  if (!res.ok) showDialog({ title: 'Could not rename', message: res.error });
                },
              },
            ],
          }),
        },
        ],
      });
    },
    [rename, showDialog]
  );

  /**
   * Deleting an album must never delete photos. The stamps inside are moved
   * to whichever album the user picks next.
   */
  const handleDeleteInto = useCallback(
    async (targetId) => {
      const doomed = picker;
      setPicker(null);
      if (!doomed) return;

      const ids = stamps
        .filter((s) => s.collection === doomed.id)
        .map((s) => s.id);
      if (ids.length) await moveStamps(ids, targetId);

      const res = await remove(doomed.id);
      if (!res.ok) showDialog({ title: 'Could not delete', message: res.error });
    },
    [picker, stamps, remove, showDialog]
  );

  const renderItem = useCallback(
    ({ item, index }) => {
      const info = summary[item.id] || { count: 0, cover: null };
      const isRight = index % 2 === 1;
      return (
        <TouchableOpacity
          style={[
            styles.card,
            shadow(1),
            {
              width: metrics.tile,
              marginLeft: isRight ? metrics.gutter : 0,
              marginBottom: metrics.gutter,
            },
          ]}
          onPress={() => handleOpen(item)}
          onLongPress={() => handleLongPress(item)}
          delayLongPress={320}
          activeOpacity={ACTIVE_OPACITY}
        >
          <View style={[styles.cover, { height: metrics.tile * 0.86 }]}>
            {info.cover ? (
              <Image source={{ uri: info.cover }} style={styles.coverImg} />
            ) : (
              <View style={styles.coverEmpty}>
                <Feather name="image" size={22} color="#B9AFC4" />
              </View>
            )}
          </View>

          <View style={styles.cardText}>
            <Text style={styles.cardName} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.cardCount}>
              {info.count} {info.count === 1 ? 'stamp' : 'stamps'}
            </Text>
          </View>
        </TouchableOpacity>
      );
    },
    [summary, metrics, handleOpen, handleLongPress]
  );

  const handleTab = useCallback(
    (tab) => {
      if (tab.route && tab.route !== 'Collection') navigation.navigate(tab.route);
    },
    [navigation]
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <View style={{ height: STATUS_BAR_HEIGHT }} />

      <View style={[styles.header, { paddingHorizontal: metrics.side }]}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Collections</Text>
          <Text style={styles.subtitle}>
            {collections.length}{' '}
            {collections.length === 1 ? 'collection' : 'collections'}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.allBtn}
          onPress={() => navigation.navigate('Collection', {})}
          activeOpacity={ACTIVE_OPACITY}
        >
          <Text style={styles.allText}>All</Text>
        </TouchableOpacity>
      </View>

      {orphanCount > 0 ? (
        <TouchableOpacity
          style={[styles.orphan, { marginHorizontal: metrics.side }]}
          onPress={() => navigation.navigate('Collection', {})}
          activeOpacity={ACTIVE_OPACITY}
        >
          <Feather name="alert-circle" size={15} color="#B24659" />
          <Text style={styles.orphanText}>
            {orphanCount} {orphanCount === 1 ? 'stamp is' : 'stamps are'} not in a
            collection
          </Text>
        </TouchableOpacity>
      ) : null}

      <FlatList
        data={collections}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        // The streak panel scrolls WITH the albums rather than sitting in a
        // fixed header -- on a small phone a pinned panel would leave almost
        // no room for the grid.
        ListHeaderComponent={
          <>
            <StreakPanel
              stamps={stamps}
              onCapture={() => navigation.navigate('Capture')}
            />
            <Text style={styles.sectionTitle}>Your collections</Text>
          </>
        }
        contentContainerStyle={[
          { paddingHorizontal: metrics.side, paddingTop: 6 },
          { paddingBottom: TAB_SPACE + bottomInset },
        ]}
        showsVerticalScrollIndicator={false}
      />

      {/* Deleting an album: choose where its stamps go. */}
      <CollectionPicker
        visible={!!picker}
        selectedId={null}
        title={`Move stamps from "${picker?.name || ''}" to`}
        counts={counts}
        onSelect={handleDeleteInto}
        onClose={() => setPicker(null)}
      />

      <TabBar active="Collection" onTabPress={handleTab} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 16,
  },
  headerText: { flex: 1 },
  title: {
    fontSize: 27,
    includeFontPadding: false,
    color: INK,
    ...weight(600),
  },
  subtitle: {
    marginTop: 3,
    fontSize: 13.5,
    includeFontPadding: false,
    color: MUTED,
  },
  allBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: HAIRLINE,
    borderColor: '#E5DDEC',
    backgroundColor: '#FEFCFF',
  },
  allText: {
    fontSize: 14,
    includeFontPadding: false,
    color: INK,
    ...weight(600),
  },

  orphan: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FCEFF2',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  orphanText: {
    marginLeft: 8,
    fontSize: 13,
    includeFontPadding: false,
    color: '#B24659',
  },

  sectionTitle: {
    fontSize: 16,
    includeFontPadding: false,
    color: INK,
    ...weight(600),
    marginBottom: 12,
    marginTop: 4,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    overflow: 'hidden',
  },
  cover: { backgroundColor: '#F2EEF6' },
  coverImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  coverEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cardText: { paddingHorizontal: 11, paddingVertical: 10 },
  cardName: {
    fontSize: 14.5,
    includeFontPadding: false,
    color: INK,
    ...weight(600),
  },
  cardCount: {
    marginTop: 2,
    fontSize: 12,
    includeFontPadding: false,
    color: MUTED,
  },
});

export default CollectionsScreen;
