/**
 * TabBar.js
 *
 * The floating pill navigation from the reference: a rounded white bar with a
 * cream "pill" behind the active tab.
 *
 * All four tabs route: Capture, Collection, Calendar, Account. The Editor is
 * reached from a stamp (select -> Edit, or the viewer's pencil), not from the
 * bar -- it always needs a stamp to act on, so a bare tab had nothing to open.
 *
 * Android: uses elevation via shadow(). The bar clears the system navigation
 * using the MEASURED inset (useBottomInset), which differs between gesture
 * navigation (~16dp) and 3-button navigation (~48dp).
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

import {
  shadow,
  weight,
  ACTIVE_OPACITY,
  useBottomInset,
} from '../styles/platform';

const INK = '#2F233B';
const MUTED = '#8C8198';
const PILL = '#F1E9F8';

export const TABS = [
  { key: 'Capture', label: 'Capture', icon: 'camera', route: 'Capture' },
  { key: 'Collection', label: 'Collection', icon: 'book-open', route: 'Collections' },
  { key: 'Calendar', label: 'Calendar', icon: 'calendar', route: 'Calendar' },
  { key: 'Account', label: 'Account', icon: 'user', route: 'Account' },
];

/**
 * @param {boolean} translucent  place over a live camera: frosted bar with
 *                               light-on-dark contrast instead of the solid
 *                               cream one used on the calendar.
 */
function TabBar({ active = 'Calendar', onTabPress, translucent = false }) {
  const inactiveColor = translucent ? 'rgba(255,255,255,0.82)' : MUTED;

  /**
   * Measured, not assumed. 3-button navigation is ~48dp tall vs ~16dp for the
   * gesture pill -- a fixed inset put the bar underneath the Back/Home/Recents
   * buttons on 3-button devices.
   */
  const bottomInset = useBottomInset();

  return (
    <View
      style={[styles.wrap, { paddingBottom: 10 + bottomInset }]}
      pointerEvents="box-none"
    >
      <View
        style={[
          styles.bar,
          translucent ? styles.barTranslucent : shadow(3),
        ]}
      >
        {TABS.map((t) => {
          const isActive = t.key === active;
          return (
            <TouchableOpacity
              key={t.key}
              style={[
                styles.tab,
                isActive && (translucent ? styles.tabActiveGlass : styles.tabActive),
              ]}
              activeOpacity={ACTIVE_OPACITY}
              onPress={() => onTabPress && onTabPress(t)}
            >
              <Feather
                name={t.icon}
                size={21}
                color={isActive ? INK : inactiveColor}
              />
              <Text
                style={[
                  styles.label,
                  { color: inactiveColor },
                  isActive && styles.labelActive,
                ]}
              >
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    // paddingBottom is applied inline from useBottomInset() -- it is
    // per-device and cannot be a static style.
    alignItems: 'center',
  },
  barTranslucent: {
    // Android has no cross-platform blur; a light scrim reads the same and
    // costs nothing. (BlurView would need expo-blur + a native rebuild.)
    backgroundColor: 'rgba(232,226,220,0.68)',
  },
  bar: {
    flexDirection: 'row',
    backgroundColor: '#FEFCFF',
    borderRadius: 30,
    paddingVertical: 8,
    paddingHorizontal: 8,
    width: '100%',
    justifyContent: 'space-between',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 22,
  },
  tabActive: { backgroundColor: PILL },
  /* Over the camera the pill is a soft light wash, not cream. */
  tabActiveGlass: { backgroundColor: 'rgba(255,255,255,0.55)' },
  label: {
    marginTop: 5,
    fontSize: 11.5,
    includeFontPadding: false,
    color: MUTED,
  },
  labelActive: { color: INK, ...weight(600) },
});

export default React.memo(TabBar);
