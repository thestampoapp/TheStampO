/**
 * StreakPanel.js
 *
 * The habit header on the Collections screen: streak ring, last-stamped line,
 * this week's Mon..Sun strip, and two stat cards.
 *
 * Adapted from the supplied dark reference to the app's soft violet palette --
 * dropping a dark card into a cream screen would look pasted in.
 *
 * All numbers come from computeStreak(), which is pure and separately tested.
 * This file only draws.
 */

import React, { useMemo, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { computeStreak, formatLastStamped } from '../utils/streak';
import { weight, shadow, ACTIVE_OPACITY } from '../styles/platform';

const INK = '#2F233B';
const MUTED = '#786D82';
const ACCENT = '#5B2B8A';
const GOLD = '#E4943A';
const CREAM = '#F1E9F8';

function StreakPanel({ stamps, onCapture }) {
  const stats = useMemo(() => computeStreak(stamps, new Date()), [stamps]);
  const lastLabel = useMemo(
    () => formatLastStamped(stats.lastStampedAt, new Date()),
    [stats.lastStampedAt]
  );

  // The ring pulses once when the streak number changes.
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    pulse.setValue(0);
    Animated.timing(pulse, {
      toValue: 1,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [stats.current, pulse]);

  const ringStyle = {
    transform: [
      { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
    ],
    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
  };

  return (
    <View style={styles.wrap}>
      {/* Streak ring */}
      <Animated.View style={[styles.ring, stats.current > 0 && styles.ringActive, ringStyle]}>
        <Text style={[styles.ringNumber, stats.current > 0 && styles.ringNumberActive]}>
          {stats.current}
        </Text>
        <Text style={styles.ringLabel}>
          {stats.current === 1 ? 'day streak' : 'day streak'}
        </Text>
      </Animated.View>

      {lastLabel ? (
        <Text style={styles.lastStamped}>
          LAST STAMPED · {lastLabel.toUpperCase()}
        </Text>
      ) : (
        <Text style={styles.lastStamped}>NO STAMPS YET</Text>
      )}

      {/* This week */}
      <View style={styles.week}>
        {stats.week.map((d) => (
          <View key={d.key} style={styles.weekCol}>
            <Text style={[styles.weekLabel, d.isToday && styles.weekLabelToday]}>
              {d.label}
            </Text>
            <View
              style={[
                styles.weekCell,
                d.done && styles.weekCellDone,
                d.isToday && !d.done && styles.weekCellToday,
                d.isFuture && styles.weekCellFuture,
              ]}
            >
              {d.done ? (
                <Feather name="check" size={15} color="#fff" />
              ) : (
                <Text
                  style={[
                    styles.weekDay,
                    d.isToday && styles.weekDayToday,
                    d.isFuture && styles.weekDayFuture,
                  ]}
                >
                  {d.day}
                </Text>
              )}
            </View>
          </View>
        ))}
      </View>

      {/* Stats */}
      <View style={styles.stats}>
        <View style={[styles.statCard, shadow(1)]}>
          <Text style={styles.statLabel}>Longest streak</Text>
          <Text style={styles.statValue}>
            {stats.longest} {stats.longest === 1 ? 'day' : 'days'}
          </Text>
        </View>
        <View style={styles.statGap} />
        <View style={[styles.statCard, shadow(1)]}>
          <Text style={styles.statLabel}>Total stamps</Text>
          <Text style={styles.statValue}>{stats.total}</Text>
        </View>
      </View>

      {/* Today's CTA -- hidden once today is done, so it never nags. */}
      {!stats.stampedToday ? (
        <TouchableOpacity
          style={[styles.cta, shadow(2)]}
          onPress={onCapture}
          activeOpacity={ACTIVE_OPACITY}
        >
          <Feather name="camera" size={18} color="#fff" />
          <Text style={styles.ctaText}>Take today's stamp</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.doneRow}>
          <Feather name="check-circle" size={16} color="#3E8E5A" />
          <Text style={styles.doneText}>Today's stamp is done</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 4, paddingBottom: 18 },

  ring: {
    alignSelf: 'center',
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 2,
    borderColor: '#E5DDEC',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEFCFF',
  },
  ringActive: { borderColor: GOLD, backgroundColor: CREAM, borderStyle: 'solid' },
  ringNumber: {
    fontSize: 46,
    lineHeight: 52,
    includeFontPadding: false,
    color: MUTED,
    ...weight(700),
  },
  ringNumberActive: { color: INK },
  ringLabel: {
    marginTop: 2,
    fontSize: 12.5,
    includeFontPadding: false,
    color: MUTED,
  },

  lastStamped: {
    marginTop: 14,
    textAlign: 'center',
    fontSize: 11,
    letterSpacing: 1.1,
    includeFontPadding: false,
    color: MUTED,
    ...weight(600),
  },

  week: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 18,
  },
  weekCol: { flex: 1, alignItems: 'center' },
  weekLabel: {
    fontSize: 12,
    includeFontPadding: false,
    color: MUTED,
    marginBottom: 7,
  },
  weekLabelToday: { color: INK, ...weight(700) },
  weekCell: {
    width: 38,
    height: 38,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#E5DDEC',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  weekCellDone: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
    borderStyle: 'solid',
  },
  weekCellToday: { borderColor: GOLD, borderStyle: 'solid' },
  weekCellFuture: { opacity: 0.5 },
  weekDay: {
    fontSize: 13,
    includeFontPadding: false,
    color: MUTED,
  },
  weekDayToday: { color: INK, ...weight(700) },
  weekDayFuture: { color: '#B9AFC4' },

  stats: { flexDirection: 'row', marginTop: 20 },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  statGap: { width: 12 },
  statLabel: {
    fontSize: 12.5,
    includeFontPadding: false,
    color: MUTED,
  },
  statValue: {
    marginTop: 5,
    fontSize: 24,
    includeFontPadding: false,
    color: INK,
    ...weight(700),
  },

  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 54,
    borderRadius: 27,
    backgroundColor: ACCENT,
    marginTop: 20,
  },
  ctaText: {
    marginLeft: 9,
    fontSize: 16,
    includeFontPadding: false,
    color: '#fff',
    ...weight(600),
  },

  doneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#EDF7F0',
  },
  doneText: {
    marginLeft: 8,
    fontSize: 14.5,
    includeFontPadding: false,
    color: '#3E8E5A',
    ...weight(600),
  },
});

export default React.memo(StreakPanel);
