#!/usr/bin/env node
/**
 * check-firebase.js
 *
 * Run from your PROJECT ROOT:   node check-firebase.js
 *
 * Answers one question: is this project actually configured for real Firebase
 * auth, or will it silently fall back to mock? Checks only what can be
 * verified from disk -- console settings (Anonymous enabled, SHA fingerprints)
 * cannot be seen from here and are listed at the end as manual checks.
 */

const fs = require('fs');
const path = require('path');

const root = process.cwd();
let fail = 0;
let warn = 0;

const ok = (m) => console.log(`  \x1b[32mOK\x1b[0m    ${m}`);
const bad = (m, fix) => {
  fail++;
  console.log(`  \x1b[31mFAIL\x1b[0m  ${m}`);
  if (fix) console.log(`        -> ${fix}`);
};
const caution = (m, fix) => {
  warn++;
  console.log(`  \x1b[33mWARN\x1b[0m  ${m}`);
  if (fix) console.log(`        -> ${fix}`);
};

const readJson = (p) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
  } catch (e) {
    return null;
  }
};

console.log('\n=== TheStampO / Firebase preflight ===\n');

// 1. packages installed --------------------------------------------------
console.log('1. Packages');
const pkg = readJson('package.json');
if (!pkg) {
  bad('no package.json here', 'run this from your project root');
} else {
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const need = [
    '@react-native-firebase/app',
    '@react-native-firebase/auth',
    '@react-native-google-signin/google-signin',
    'expo-dev-client',
  ];
  need.forEach((d) => {
    if (deps[d]) ok(`${d} ${deps[d]}`);
    else bad(`${d} MISSING`, `npx expo install ${d}`);
  });

  // installed on disk, not just declared
  need.slice(0, 2).forEach((d) => {
    if (!fs.existsSync(path.join(root, 'node_modules', d))) {
      bad(`${d} not in node_modules`, 'npm install');
    }
  });
}

// 2. google-services.json ------------------------------------------------
console.log('\n2. google-services.json');
const gs = readJson('google-services.json');
if (!gs) {
  bad('missing from project root', 'download it from the Firebase console');
} else {
  const client = (gs.client || [])[0];
  const pkgName = client?.client_info?.android_client_info?.package_name;
  ok(`project ${gs.project_info?.project_id}`);
  ok(`package  ${pkgName}`);

  const oauth = client?.oauth_client || [];
  const web = oauth.find((o) => o.client_type === 3);
  const android = oauth.filter((o) => o.client_type === 1);

  if (web) ok(`web client id present (${web.client_id.slice(0, 24)}...)`);
  else {
    bad(
      'no client_type:3 (web) entry',
      'enable Google sign-in in the console, then re-download'
    );
  }

  if (android.length) {
    ok(`${android.length} android oauth client(s) / SHA-1 registered`);
    android.forEach((a) =>
      console.log(`        sha1 ${a.android_info?.certificate_hash}`)
    );
  } else {
    caution(
      'no client_type:1 entry -- no SHA-1 registered',
      'Google Sign-In will fail with DEVELOPER_ERROR. Add SHA-1 in the console.'
    );
  }

  // cross-check with app.json + firebase.js
  const appJson = readJson('app.json');
  const appPkg = appJson?.expo?.android?.package;
  if (appPkg && pkgName && appPkg !== pkgName) {
    bad(
      `package mismatch: app.json "${appPkg}" vs google-services "${pkgName}"`,
      'they must be identical'
    );
  } else if (appPkg) ok('package matches app.json');

  try {
    const fbSrc = fs.readFileSync(
      path.join(root, 'src', 'data', 'firebase.js'),
      'utf8'
    );
    const m = fbSrc.match(/GOOGLE_WEB_CLIENT_ID\s*=\s*\n?\s*'([^']*)'/);
    const pasted = m && m[1];
    if (!pasted) {
      bad('GOOGLE_WEB_CLIENT_ID is empty in src/data/firebase.js');
    } else if (web && pasted === web.client_id) {
      ok('GOOGLE_WEB_CLIENT_ID matches the web client');
    } else if (android.some((a) => a.client_id === pasted)) {
      bad(
        'GOOGLE_WEB_CLIENT_ID is the ANDROID id',
        'use the client_type:3 id or Google fails with DEVELOPER_ERROR'
      );
    } else {
      caution('GOOGLE_WEB_CLIENT_ID does not match this google-services.json');
    }
  } catch (e) {
    bad('src/data/firebase.js not found');
  }
}

// 3. app.json ------------------------------------------------------------
console.log('\n3. app.json');
const app = readJson('app.json');
if (!app) bad('missing');
else {
  const e = app.expo || {};
  if (e.android?.googleServicesFile) ok(`googleServicesFile: ${e.android.googleServicesFile}`);
  else bad('android.googleServicesFile not set', '"./google-services.json"');

  const plugins = (e.plugins || []).map((p) => (Array.isArray(p) ? p[0] : p));
  ['@react-native-firebase/app', '@react-native-firebase/auth'].forEach((p) => {
    if (plugins.includes(p)) ok(`plugin ${p}`);
    else bad(`plugin ${p} MISSING`, 'without it the native module is never linked');
  });
  if (plugins.includes('expo-build-properties')) ok('plugin expo-build-properties');
  else caution('expo-build-properties not listed');
}

// 4. summary -------------------------------------------------------------
console.log('\n=== Result ===');
if (fail === 0) {
  console.log('  No blocking problems found on disk.\n');
  console.log('  If auth is STILL mocked at runtime, the cause is one of:');
  console.log('   a) you are running in Expo Go       -> npx expo start --dev-client');
  console.log('   b) you did not reinstall the APK    -> config changes need a NEW build');
  console.log('   c) Metro served a stale bundle      -> npx expo start -c --dev-client');
} else {
  console.log(`  ${fail} blocking problem(s), ${warn} warning(s). Fix, then REBUILD.`);
}

console.log('\n  Cannot be checked from here (do in the console):');
console.log('   - Authentication > Sign-in method > Anonymous ENABLED');
console.log('   - Email/Password, Google, Phone enabled');
console.log('   - SHA-256 added (needed for Phone auth)\n');

process.exit(fail ? 1 : 0);
