/**
 * CalendarScreen.js
 *
 * The month calendar: every day that has a stamp shows it in-cell, with a
 * gold star badge on favourites.
 *
 * The reference is an iOS mock; this is built Android-first:
 *   - status bar height reserved manually (SafeAreaView is a no-op on Android)
 *   - the floating tab bar clears the system nav via the measured inset
 *   - elevation used alongside shadow* so cards are visible on Android
 *   - cell sizes derive from screen width, so 320dp phones do not overflow
 *   - grid scrolls, so short screens / large system fonts never clip
 *
 * Stamps are rendered by the shared <StampRenderer/>, so calendar thumbnails
 * have the exact same scalloped silhouette as every other screen.
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
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

import StampRenderer from '../components/StampRenderer';
import TabBar from '../components/TabBar';
import { useStamps, byDay, countByDay } from '../data/stampStore';
import {
  STATUS_BAR_HEIGHT,
  shadow,
  weight,
  italic,
  ACTIVE_OPACITY,
  useBottomInset,
} from '../styles/platform';
import {
  WEEKDAYS,
  MONTHS,
  buildMonthGrid,
  chunkWeeks,
  shiftMonth,
  dayKey,
} from '../utils/calendar';

const BG = '#FAF8FC';
const CELL_BG = '#F2EEF6';
const INK = '#2F233B';
const MUTED = '#8C8198';
const GOLD = '#E4943A';

const H_PADDING = 14;
const GRID_GAP = 6;

/** One day cell: empty slot, or a stamp with an optional favourite badge. */
const DayCell = React.memo(function DayCell({
  cell,
  size,
  stamp,
  count = 0,
  onPress,
  index,
  reveal,
}) {
  const stampWidth = size - 14;

  // Stamps fade + rise in on a stagger across the grid.
  const seg = useMemo(() => {
    const start = Math.min((index % 21) * 0.03, 0.6);
    return reveal.interpolate({
      inputRange: [0, start, Math.min(start + 0.35, 1), 1],
      outputRange: [0, 0, 1, 1],
      extrapolate: 'clamp',
    });
  }, [reveal, index]);

  const animStyle = stamp
    ? {
        opacity: seg,
        transform: [
          { scale: seg.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }) },
        ],
      }
    : null;

  return (
    <TouchableOpacity
      style={[
        styles.cell,
        { width: size, height: size * 1.24 },
        !stamp && styles.cellEmpty,
      ]}
      activeOpacity={stamp ? 0.75 : 1}
      disabled={!stamp}
      onPress={() => onPress && onPress(cell)}
    >
      <Text
        style={[
          styles.dayNumber,
          !cell.inMonth && styles.dayNumberMuted,
          stamp && styles.dayNumberOnStamp,
        ]}
      >
        {cell.day}
      </Text>

      {stamp ? (
        <Animated.View style={[styles.stampWrap, animStyle]}>
          <StampRenderer uri={stamp.uri} width={stampWidth} rotation={0} />

          {/* Only shown when a day holds MORE than one stamp -- a "1" on
              every stamped day would be noise. */}
          {count > 1 ? (
            <View style={[styles.countBadge, shadow(1)]}>
              <Text style={styles.countText}>{count > 9 ? '9+' : count}</Text>
            </View>
          ) : null}

          {stamp.favourite ? (
            <View style={[styles.badge, shadow(1)]}>
              <Feather name="star" size={10} color="#fff" />
            </View>
          ) : null}
        </Animated.View>
      ) : null}
    </TouchableOpacity>
  );
});

const CalendarScreen = ({ navigation, route }) => {
  const bottomInset = useBottomInset();
  const { width } = useWindowDimensions();

  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(() => ({
    year: today.getFullYear(),
    month: today.getMonth(),
  }));

  /** Live from the persistent store, keyed by local YYYY-MM-DD. */
  const { stamps: allStamps } = useStamps();
  const stamps = useMemo(() => byDay(allStamps), [allStamps]);
  /** How many stamps each day holds -- byDay() keeps only the cover. */
  const dayCounts = useMemo(() => countByDay(allStamps), [allStamps]);

  const cells = useMemo(
    () => buildMonthGrid(cursor.year, cursor.month),
    [cursor]
  );
  const weeks = useMemo(() => chunkWeeks(cells), [cells]);

  // Cell size derived from the screen so nothing overflows on small devices.
  const cellSize = useMemo(() => {
    const usable = width - H_PADDING * 2 - GRID_GAP * 6 - 12;
    return Math.floor(usable / 7);
  }, [width]);

  // -- animations ----------------------------------------------------------
  const reveal = useRef(new Animated.Value(0)).current;
  const header = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(0)).current;

  const runReveal = useCallback(() => {
    reveal.setValue(0);
    Animated.timing(reveal, {
      toValue: 1,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [reveal]);

  useEffect(() => {
    Animated.timing(header, {
      toValue: 1,
      duration: 560,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    runReveal();
  }, [header, runReveal]);

  const changeMonth = useCallback(
    (delta) => {
      // Slide the grid out, swap the month, slide it back.
      Animated.timing(slide, {
        toValue: delta,
        duration: 170,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start(() => {
        setCursor((c) => shiftMonth(c.year, c.month, delta));
        slide.setValue(-delta);
        Animated.timing(slide, {
          toValue: 0,
          duration: 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
        runReveal();
      });
    },
    [slide, runReveal]
  );

  const headerStyle = {
    opacity: header,
    transform: [
      { translateY: header.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) },
    ],
  };

  const gridStyle = {
    opacity: slide.interpolate({
      inputRange: [-1, 0, 1],
      outputRange: [0, 1, 0],
    }),
    transform: [
      {
        translateX: slide.interpolate({
          inputRange: [-1, 0, 1],
          outputRange: [width * 0.25, 0, -width * 0.25],
        }),
      },
    ],
  };

  const monthNumber = String(cursor.month + 1).padStart(2, '0');

  /**
   * Open the stamp the cell is showing, in the swipeable viewer.
   *
   * Previously this went to StampDetail -- the ONBOARDING save screen -- which
   * showed a Save button for an already-saved stamp. StampViewer is the right
   * destination, and swiping from there reaches the day's other stamps.
   */
  const handleDayPress = useCallback(
    (cell) => {
      const key = dayKey(cursor.year, cursor.month, cell.day);
      const stamp = stamps[key];
      if (!stamp) return;
      navigation.navigate('StampViewer', { stampId: stamp.id });
    },
    [cursor, stamps, navigation]
  );

  const handleTab = useCallback(
    (tab) => {
      if (tab.route && tab.route !== 'Calendar') navigation.navigate(tab.route);
    },
    [navigation]
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <View style={styles.androidStatusSpacer} />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 120 + bottomInset }]}
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
      >
        {/* Header */}
        <Animated.View style={[styles.header, headerStyle]}>
          <View style={styles.headerLeft}>
            <View style={styles.monthRow}>
              <Text style={styles.monthNumber}>{monthNumber}</Text>
              <Text style={styles.year}>{cursor.year}</Text>
            </View>
            <Text style={styles.monthName}>{MONTHS[cursor.month]}</Text>
          </View>

          <View style={styles.navRow}>
            <TouchableOpacity
              onPress={() => changeMonth(-1)}
              activeOpacity={ACTIVE_OPACITY}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={styles.navBtn}
            >
              <Feather name="chevron-left" size={22} color={INK} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => changeMonth(1)}
              activeOpacity={ACTIVE_OPACITY}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={styles.navBtn}
            >
              <Feather name="chevron-right" size={22} color={INK} />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Weekday labels */}
        <View style={styles.weekRow}>
          {WEEKDAYS.map((d) => (
            <Text key={d} style={[styles.weekday, { width: cellSize }]}>
              {d}
            </Text>
          ))}
        </View>

        {/* Grid */}
        <Animated.View style={[styles.gridCard, shadow(1), gridStyle]}>
          {weeks.map((week, wi) => (
            <View key={wi} style={styles.week}>
              {week.map((cell, ci) => (
                <DayCell
                  key={cell.key}
                  cell={cell}
                  size={cellSize}
                  index={wi * 7 + ci}
                  reveal={reveal}
                  stamp={
                    cell.inMonth
                      ? stamps[dayKey(cursor.year, cursor.month, cell.day)]
                      : null
                  }
                  count={
                    cell.inMonth
                      ? dayCounts[dayKey(cursor.year, cursor.month, cell.day)] || 0
                      : 0
                  }
                  onPress={handleDayPress}
                />
              ))}
            </View>
          ))}
        </Animated.View>
      </ScrollView>

      <TabBar active="Calendar" onTabPress={handleTab} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  androidStatusSpacer: { height: STATUS_BAR_HEIGHT },
  container: { flex: 1, backgroundColor: BG },

  scroll: {
    paddingHorizontal: H_PADDING,
    paddingTop: 12,
    // paddingBottom applied inline from useBottomInset(): 3-button nav is
    // ~48dp vs ~16dp for the gesture pill.
  },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    marginBottom: 18,
  },
  headerLeft: { flex: 1 },
  monthRow: { flexDirection: 'row', alignItems: 'flex-end' },
  monthNumber: {
    fontSize: 58,
    lineHeight: 64,
    includeFontPadding: false,
    color: INK,
    ...weight(300),
  },
  year: {
    marginLeft: 10,
    marginBottom: 10,
    fontSize: 17,
    includeFontPadding: false,
    color: MUTED,
  },
  monthName: {
    marginTop: 2,
    fontSize: 27,
    includeFontPadding: false,
    ...italic(),
    color: INK,
  },
  navRow: { flexDirection: 'row', marginTop: 18 },
  navBtn: { paddingHorizontal: 8, paddingVertical: 4 },

  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    marginBottom: 10,
  },
  weekday: {
    fontSize: 12,
    includeFontPadding: false,
    color: MUTED,
    textAlign: 'center',
  },

  gridCard: {
    backgroundColor: '#FEFCFF',
    borderRadius: 22,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  week: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: GRID_GAP,
  },

  cell: {
    borderRadius: 11,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 4,
    overflow: 'visible',
  },
  cellEmpty: { backgroundColor: CELL_BG },

  dayNumber: {
    fontSize: 12,
    includeFontPadding: false,
    color: INK,
    alignSelf: 'flex-start',
    marginLeft: 6,
  },
  dayNumberMuted: { color: '#C8BFCE' },
  dayNumberOnStamp: { marginBottom: 2 },

  stampWrap: { marginTop: 1 },
  countBadge: {
    position: 'absolute',
    right: -5,
    top: -5,
    minWidth: 19,
    height: 19,
    paddingHorizontal: 4,
    borderRadius: 9.5,
    backgroundColor: INK,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FEFCFF',
  },
  countText: {
    fontSize: 10.5,
    lineHeight: 13,
    includeFontPadding: false,
    color: '#FFFFFF',
    ...weight(700),
  },

  badge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FEFCFF',
  },
});

export default CalendarScreen;
