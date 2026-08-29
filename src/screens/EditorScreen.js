/**
 * EditorScreen.js
 *
 * SCAFFOLD. The chrome is real and Android-correct; the tools are not built
 * yet.
 *
 * What exists: header (back / title / share / rename), the canvas with the
 * stamp placed on it, the five-tool bar and the category chip row.
 * What does not: dragging, tape, text, stickers and cut.
 *
 * Sizes derive from the measured window rather than the 853x1844 mock, so the
 * toolbar keeps its proportions on any Android screen.
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Animated,
  Easing,
  useWindowDimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAppDialog } from '../components/AppDialog';

import StampRenderer from '../components/StampRenderer';
import { printWithPrompt } from '../utils/print';
import {
  STATUS_BAR_HEIGHT,
  useBottomInset,
  shadow,
  weight,
  HAIRLINE,
  ACTIVE_OPACITY,
} from '../styles/platform';

const PAPER = '#F3EFF7';
const INK = '#2F233B';
const MUTED = '#786D82';

/** Toolbar height as a fraction of the screen, measured from the reference. */
const TOOLBAR_RATIO = 0.105;
const CHIPS_RATIO = 0.062;

const TOOLS = [
  { key: 'stamp', label: 'Stamp', icon: 'image' },
  { key: 'tape', label: 'Tape', icon: 'bookmark' },
  { key: 'text', label: 'Text', icon: 'type' },
  { key: 'sticker', label: 'Sticker', icon: 'smile' },
  { key: 'cut', label: 'Cut', icon: 'scissors' },
];

const CATEGORIES = ['All', 'Favourites', 'Faces', 'Nature', 'Party', 'Travel'];

/** Emoji stand in for the photographic sticker pack. */
const EMOJI = {
  All: ['🌼','🌹','🦋','☁️','⭐','✨','🌿','🍃','💐','🌸','🌻','🕊️','❤️','📎','🎀','🧡'],
  Favourites: ['❤️','⭐','✨','🌸','🎀','🦋'],
  Faces: ['😊','🥰','😎','🤩','😌','🙃','😇','🥳'],
  Nature: ['🌼','🌿','🍃','🌸','🌻','🌊','⛰️','🌙'],
  Party: ['🎉','🎈','🥳','✨','🎁','🍰'],
  Travel: ['✈️','🗺️','🧳','📷','🚐','⛺'],
};

const EditorScreen = ({ navigation, route }) => {
  const { showDialog } = useAppDialog();
  const { width: winW, height: winH } = useWindowDimensions();
  const bottomInset = useBottomInset();

  const stamp = route?.params?.stamp ?? null;
  const photoUri = stamp?.uri ?? route?.params?.photoUri ?? null;

  const [tool, setTool] = useState('sticker');
  const [category, setCategory] = useState('All');
  const [placed, setPlaced] = useState([]);

  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [enter]);

  const L = useMemo(() => {
    const header = 56;
    const toolbar = Math.max(84, Math.round(winH * TOOLBAR_RATIO));
    const chips = Math.max(48, Math.round(winH * CHIPS_RATIO));
    const tray = Math.round(winH * 0.16);
    const canvas =
      winH - STATUS_BAR_HEIGHT - header - toolbar - chips - tray - bottomInset;
    return { header, toolbar, chips, tray, canvas: Math.max(180, canvas) };
  }, [winH, bottomInset]);

  const stampWidth = useMemo(
    () => Math.min(winW * 0.42, L.canvas * 0.42),
    [winW, L.canvas]
  );

  const addEmoji = useCallback((e) => {
    setPlaced((p) => [
      ...p,
      {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        char: e,
        x: 0.2 + Math.random() * 0.55,
        y: 0.2 + Math.random() * 0.5,
      },
    ]);
  }, []);

  const notReady = useCallback(
    (name) =>
      showDialog({
        title: `${name} is coming next`,
        message: 'The canvas and stickers work today. Tape, text and cut are the next build.',
      }),
    [showDialog]
  );

  const handleTool = useCallback(
    (k) => {
      setTool(k);
      if (k !== 'sticker') notReady(TOOLS.find((t) => t.key === k).label);
    },
    [notReady]
  );

  const enterStyle = {
    opacity: enter,
    transform: [
      { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
    ],
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <View style={{ height: STATUS_BAR_HEIGHT }} />

      {/* Header */}
      <View style={[styles.header, { height: L.header }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={ACTIVE_OPACITY}
        >
          <Feather name="arrow-left" size={23} color={INK} />
        </TouchableOpacity>

        <Text style={styles.headerTitle} numberOfLines={1}>
          {route?.params?.title || 'Edit stamp'}
        </Text>

        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={() => printWithPrompt(stamp ? [stamp] : [], showDialog)}
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
            activeOpacity={ACTIVE_OPACITY}
          >
            <Feather name="upload" size={21} color={INK} />
          </TouchableOpacity>
          <View style={{ width: 18 }} />
          <TouchableOpacity
            onPress={() => notReady('Rename')}
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
            activeOpacity={ACTIVE_OPACITY}
          >
            <Feather name="edit-2" size={20} color={INK} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Canvas */}
      <Animated.View style={[styles.canvas, { height: L.canvas }, enterStyle]}>
        {photoUri ? (
          <View style={styles.stampSlot}>
            <StampRenderer uri={photoUri} width={stampWidth} />
          </View>
        ) : (
          <Text style={styles.empty}>No stamp selected</Text>
        )}

        {placed.map((p) => (
          <Text
            key={p.id}
            style={[
              styles.placed,
              { left: `${p.x * 100}%`, top: `${p.y * 100}%` },
            ]}
          >
            {p.char}
          </Text>
        ))}
      </Animated.View>

      {/* Tools */}
      <View style={[styles.toolbar, { height: L.toolbar }, shadow(2)]}>
        {TOOLS.map((t) => {
          const active = t.key === tool;
          return (
            <TouchableOpacity
              key={t.key}
              style={styles.tool}
              onPress={() => handleTool(t.key)}
              activeOpacity={ACTIVE_OPACITY}
            >
              <Feather name={t.icon} size={23} color={active ? INK : '#8C8198'} />
              <Text style={[styles.toolLabel, active && styles.toolLabelOn]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Categories */}
      <View style={[styles.chipsRow, { height: L.chips }]}>
        <Feather name="search" size={18} color={MUTED} style={styles.searchIcon} />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          overScrollMode="never"
          contentContainerStyle={styles.chipsContent}
        >
          {CATEGORIES.map((c) => {
            const on = c === category;
            return (
              <TouchableOpacity
                key={c}
                style={[styles.chip, on && styles.chipOn]}
                onPress={() => setCategory(c)}
                activeOpacity={ACTIVE_OPACITY}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{c}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Sticker tray */}
      <View style={[styles.tray, { height: L.tray + bottomInset }]}>
        <ScrollView
          contentContainerStyle={styles.trayContent}
          showsVerticalScrollIndicator={false}
          overScrollMode="never"
        >
          {(EMOJI[category] || EMOJI.All).map((e, i) => (
            <TouchableOpacity
              key={`${e}${i}`}
              style={styles.emojiCell}
              onPress={() => addEmoji(e)}
              activeOpacity={0.7}
            >
              <Text style={styles.emoji}>{e}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
  },
  headerTitle: {
    flex: 1,
    marginHorizontal: 14,
    fontSize: 17,
    includeFontPadding: false,
    textAlign: 'center',
    color: INK,
    ...weight(600),
  },
  headerRight: { flexDirection: 'row', alignItems: 'center' },

  canvas: {
    backgroundColor: PAPER,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  stampSlot: { alignItems: 'center', justifyContent: 'center' },
  empty: { color: MUTED, fontSize: 15, includeFontPadding: false },
  placed: { position: 'absolute', fontSize: 34, includeFontPadding: false },

  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    marginTop: -18,
  },
  tool: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  toolLabel: {
    marginTop: 6,
    fontSize: 12.5,
    includeFontPadding: false,
    color: '#8C8198',
  },
  toolLabelOn: { color: INK, ...weight(600) },

  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: HAIRLINE,
    borderTopColor: '#EEE8F3',
    paddingLeft: 16,
  },
  searchIcon: { marginRight: 10 },
  chipsContent: { alignItems: 'center', paddingRight: 16 },
  chip: {
    paddingHorizontal: 15,
    paddingVertical: 7,
    borderRadius: 18,
    marginRight: 8,
  },
  chipOn: { backgroundColor: INK },
  chipText: { fontSize: 14, includeFontPadding: false, color: '#71657D' },
  chipTextOn: { color: '#FFFFFF', ...weight(600) },

  tray: { backgroundColor: '#FFFFFF' },
  trayContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  emojiCell: {
    width: '16.66%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 30, includeFontPadding: false },
});

export default EditorScreen;
