/**
 * index.js — crash-safe entry point
 *
 * THE PROBLEM THIS SOLVES
 * -----------------------
 * ErrorBoundary (inside App.js) can only catch errors once React is mounting.
 * A crash while MODULES ARE LOADING -- a missing asset, a native module that
 * throws on import, a bad top-level constant -- happens strictly earlier, so
 * the app dies before any React code runs. On Android that looks like the app
 * "just closing", with no message and nothing to go on.
 *
 * So this file:
 *   1. installs a global JS error handler BEFORE anything else is imported
 *   2. requires App.js lazily, inside try/catch
 *   3. if that throws, registers a fallback screen that PRINTS THE ERROR
 *
 * The result: instead of closing, the app shows the exact exception and
 * stack on the device. That removes the need for adb to diagnose a JS crash.
 *
 * It still cannot catch a genuinely NATIVE crash (a Java/Kotlin exception).
 * If the app closes even with this in place, the cause is native and adb (or
 * the Play Console crash log) is required.
 */

import 'react-native-gesture-handler';
import { View, Text, ScrollView, StyleSheet, StatusBar } from 'react-native';
import { registerRootComponent } from 'expo';

/** Filled in if anything below throws. */
let bootError = null;

// ---------------------------------------------------------------------------
// 1. Global handler — catches unhandled JS errors anywhere, including async
// ---------------------------------------------------------------------------
try {
  const g =
    typeof global !== 'undefined' && global.ErrorUtils
      ? global.ErrorUtils
      : null;
  if (g && typeof g.setGlobalHandler === 'function') {
    const previous = g.getGlobalHandler ? g.getGlobalHandler() : null;
    g.setGlobalHandler((error, isFatal) => {
      // Always log: visible via `npx expo start` or the Play Console.
      console.error('[stampa] global error', isFatal ? '(fatal)' : '', error);
      if (previous) {
        try {
          previous(error, isFatal);
        } catch (e) {
          /* the default handler failing must not loop */
        }
      }
    });
  }
} catch (e) {
  /* never let instrumentation itself break startup */
}

// ---------------------------------------------------------------------------
// 2. Load the app inside try/catch
// ---------------------------------------------------------------------------
let App = null;
try {
  // require, NOT import: an `import` is hoisted and would run before the
  // try/catch is established, defeating the entire purpose of this file.
  // eslint-disable-next-line global-require
  const mod = require('./App');
  App = mod.default || mod;
  if (typeof App !== 'function') {
    throw new Error('App.js did not export a component as its default export');
  }
} catch (err) {
  bootError = err;
  console.error('[stampa] FAILED TO LOAD APP:', err);
}

// ---------------------------------------------------------------------------
// 3. Fallback screen
// ---------------------------------------------------------------------------
function BootFailure() {
  const message = String(bootError?.message || bootError || 'Unknown error');
  const stack = String(bootError?.stack || '').slice(0, 2500);

  return (
    <View style={styles.wrap}>
      <StatusBar barStyle="light-content" backgroundColor="#2A1642" />
      <Text style={styles.title}>TheStampO could not start</Text>
      <Text style={styles.sub}>
        Screenshot this and send it to the developer. It names the exact cause.
      </Text>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.body}>
        <Text style={styles.label}>ERROR</Text>
        <Text style={styles.mono}>{message}</Text>

        {stack ? (
          <>
            <Text style={styles.label}>STACK</Text>
            <Text style={styles.mono}>{stack}</Text>
          </>
        ) : null}

        <Text style={styles.label}>LIKELY CAUSES</Text>
        <Text style={styles.mono}>
          {'\u2022'} a missing file in the project root{'\n'}
          {'\u2022'} a native module not included in this build{'\n'}
          {'\u2022'} an import that throws at module load
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#2A1642', paddingTop: 54, paddingHorizontal: 18 },
  title: { color: '#fff', fontSize: 20, fontWeight: '700', includeFontPadding: false },
  sub: { color: '#E4D6F1', fontSize: 13, marginTop: 6, lineHeight: 18 },
  scroll: { marginTop: 16, marginBottom: 20 },
  body: { paddingBottom: 40 },
  label: {
    color: '#E4943A',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 14,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  mono: { color: '#F1EAF7', fontSize: 11.5, lineHeight: 17, fontFamily: 'monospace' },
});

registerRootComponent(bootError ? BootFailure : App);
