/**
 * ErrorBoundary.js
 *
 * In a DEV build a JS crash shows the red box with a stack trace. In a
 * release/preview build there is no red box -- the app simply dies, which is
 * exactly the "it just closes" symptom with no information.
 *
 * This boundary catches render/lifecycle errors and paints the message and
 * stack ON SCREEN, so a release crash can be diagnosed from the device
 * without adb.
 *
 * It cannot catch:
 *   - errors thrown at module import time (before React mounts)
 *   - native crashes (those need `adb logcat`)
 *
 * so it narrows the problem rather than solving every case.
 */

import React from 'react';
import { View, Text, ScrollView, StyleSheet, StatusBar } from 'react-native';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    // Also emit to logcat so `adb logcat *:E ReactNativeJS:V` shows it.
    console.error('[stampa] fatal:', error?.message, info?.componentStack);
  }

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={styles.wrap}>
        <StatusBar barStyle="light-content" backgroundColor="#2A1642" />
        <Text style={styles.title}>TheStampO crashed</Text>
        <Text style={styles.sub}>
          Send this screen to the developer. It does not appear in normal use.
        </Text>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollBody}>
          <Text style={styles.label}>Error</Text>
          <Text style={styles.mono}>{String(error?.message || error)}</Text>

          {error?.stack ? (
            <>
              <Text style={styles.label}>Stack</Text>
              <Text style={styles.mono}>{String(error.stack).slice(0, 2000)}</Text>
            </>
          ) : null}

          {info?.componentStack ? (
            <>
              <Text style={styles.label}>Component</Text>
              <Text style={styles.mono}>
                {String(info.componentStack).slice(0, 1500)}
              </Text>
            </>
          ) : null}
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#2A1642', paddingTop: 54, paddingHorizontal: 18 },
  title: { color: '#fff', fontSize: 20, fontWeight: '700', includeFontPadding: false },
  sub: { color: '#E4D6F1', fontSize: 13, marginTop: 6, lineHeight: 18 },
  scroll: { marginTop: 16, marginBottom: 20 },
  scrollBody: { paddingBottom: 40 },
  label: {
    color: '#E4943A',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 14,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  mono: {
    color: '#F1EAF7',
    fontSize: 11.5,
    lineHeight: 17,
    fontFamily: 'monospace',
  },
});

export default ErrorBoundary;
