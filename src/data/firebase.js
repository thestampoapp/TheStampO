/**
 * firebase.js
 *
 * The ONLY file that talks to Firebase directly.
 *
 * REACT NATIVE FIREBASE v26 — MODULAR API ONLY
 * --------------------------------------------
 * v26 REMOVED the namespaced JavaScript API. There is no default export from
 * '@react-native-firebase/auth' any more, which is why the old code produced:
 *
 *     Firebase failed to initialise: Object is not a function
 *
 * `require('@react-native-firebase/auth').default` resolved to `undefined`
 * (or to the module object), and calling it as `authModule()` threw. Every
 * call now goes through the modular functions instead:
 *
 *     OLD (v21 and earlier, REMOVED)     NEW (v26)
 *     auth()                             getAuth(getApp())
 *     auth().signInAnonymously()         signInAnonymously(auth)
 *     auth().currentUser.linkWith...     linkWithCredential(user, cred)
 *     auth.EmailAuthProvider             EmailAuthProvider  (named import)
 *
 * Verified against the real @react-native-firebase/auth@26.1.0 package: it
 * exports getAuth, signInAnonymously, createUserWithEmailAndPassword,
 * linkWithCredential, signInWithCredential, signInWithPhoneNumber,
 * updateProfile, reauthenticateWithCredential, updatePassword,
 * verifyBeforeUpdateEmail, deleteUser, signOut, onAuthStateChanged,
 * sendEmailVerification, and the *AuthProvider classes as NAMED exports.
 * It has NO default export.
 *
 * Everything is still resolved through a guarded require: a bare import of an
 * uninstalled package is a BUNDLER error, and the app must keep running (on
 * mock auth) in Expo Go where the native module cannot exist.
 *
 * ACCOUNT MODEL
 * -------------
 * The app signs in ANONYMOUSLY on first launch so a real UID exists before
 * onboarding. When the user later signs up, the permanent credential is
 * LINKED onto that same UID -- no second Firebase user is created, and every
 * stamp captured before signup stays attached.
 *
 * Setup: see FIREBASE_SETUP.md
 */

/**
 * Google WEB client id for project thestampo-83f29.
 *
 * From google-services.json -> oauth_client with "client_type": 3
 * (3 = web, 1 = android). It MUST be the web id; the android one fails with
 * DEVELOPER_ERROR and no other explanation.
 */
export const GOOGLE_WEB_CLIENT_ID =
  '235053798731-3fe9tt566knrj5ddbo2vtevc2au3q4ee.apps.googleusercontent.com';

// ---------------------------------------------------------------------------
// Guarded module resolution (v26 modular)
// ---------------------------------------------------------------------------

/** Named exports from @react-native-firebase/auth, or null when unavailable. */
let A = null;
/** getApp from @react-native-firebase/app. */
let getAppFn = null;

let googleSignin = null;
let statusCodes = {};

/** Human-readable reason auth is unavailable, or null when it works. */
let unavailableReason = null;

try {
  // eslint-disable-next-line global-require
  const appMod = require('@react-native-firebase/app');
  getAppFn = appMod.getApp;
  if (typeof getAppFn !== 'function') {
    getAppFn = null;
    unavailableReason =
      '@react-native-firebase/app has no getApp export. Expected v22+; ' +
      'check the installed version.';
  }
} catch (e) {
  getAppFn = null;
  unavailableReason =
    '@react-native-firebase/app is not installed ' +
    '(npx expo install @react-native-firebase/app)';
}

try {
  // eslint-disable-next-line global-require
  const authMod = require('@react-native-firebase/auth');
  // v26 is modular-only: the functions live on the module object itself.
  if (typeof authMod.getAuth === 'function') {
    A = authMod;
  } else {
    A = null;
    unavailableReason =
      '@react-native-firebase/auth has no getAuth export. v26 is ' +
      'modular-only -- upgrade the package (npx expo install ' +
      '@react-native-firebase/auth).';
  }
} catch (e) {
  A = null;
  if (!unavailableReason) {
    unavailableReason =
      '@react-native-firebase/auth is not installed ' +
      '(npx expo install @react-native-firebase/auth)';
  }
}

try {
  // eslint-disable-next-line global-require
  const g = require('@react-native-google-signin/google-signin');
  googleSignin = g.GoogleSignin;
  statusCodes = g.statusCodes || {};
} catch (e) {
  googleSignin = null;
}

// ---------------------------------------------------------------------------
// Single initialisation
//
// getApp() and getAuth() are both idempotent -- the native layer creates the
// [DEFAULT] app from google-services.json exactly once -- but the instance is
// cached here anyway so a probe failure is not retried on every call.
// ---------------------------------------------------------------------------

/** null = not probed yet, true/false = result. */
let nativeOk = null;
/** The cached Auth instance. */
let authInstance = null;

function probeNative() {
  if (nativeOk !== null) return nativeOk;

  if (!A || !getAppFn) {
    nativeOk = false;
    return nativeOk;
  }

  try {
    const app = getAppFn();
    const instance = A.getAuth(app);

    // A working instance exposes currentUser (may be null) and is an object,
    // never a function. This is precisely what the old code got wrong.
    if (!instance || typeof instance !== 'object') {
      nativeOk = false;
      unavailableReason =
        'getAuth() did not return an Auth instance. The native module is ' +
        'probably missing -- Expo Go cannot load it; use an EAS dev build ' +
        'and `npx expo start --dev-client`.';
      return nativeOk;
    }

    authInstance = instance;
    nativeOk = true;
    unavailableReason = null;
  } catch (err) {
    nativeOk = false;
    const msg = String(err?.message || err);
    if (msg.includes('No Firebase App') || msg.includes('default app')) {
      unavailableReason =
        'No default Firebase app. google-services.json is missing from the ' +
        'build, or android.googleServicesFile is not set in app.json.';
    } else if (
      msg.includes('native module') ||
      msg.includes('NativeModule') ||
      msg.includes('not been registered')
    ) {
      unavailableReason =
        'The native Firebase module is not linked. Rebuild with EAS and run ' +
        '`npx expo start --dev-client` (Expo Go cannot load it).';
    } else {
      unavailableReason = `Firebase failed to initialise: ${msg}`;
    }
  }
  return nativeOk;
}

/** Why auth is unavailable, or null if it is fine. */
export function authUnavailableReason() {
  probeNative();
  return unavailableReason;
}

/** True when Firebase Auth is installed, linked and initialised. */
export function isAuthAvailable() {
  return probeNative();
}

/** The Auth instance, or null. Replaces the old `auth()` call. */
export function getAuthInstance() {
  if (!probeNative()) return null;
  return authInstance;
}

/**
 * Kept for backwards compatibility with existing imports.
 * Returns the Auth INSTANCE (not a callable) -- see the header note.
 */
export function getAuth() {
  return getAuthInstance();
}

/** True when Google Sign-In can actually run. */
export function isGoogleAvailable() {
  return !!googleSignin && !!GOOGLE_WEB_CLIENT_ID;
}

let googleConfigured = false;

function ensureGoogleConfigured() {
  if (googleConfigured || !isGoogleAvailable()) return;
  googleConfigured = true;
  try {
    googleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
  } catch (e) {
    googleConfigured = false;
  }
}

export { googleSignin, statusCodes };

// ---------------------------------------------------------------------------
// Error translation
// ---------------------------------------------------------------------------

const MESSAGES = {
  'auth/email-already-in-use': 'That email is already registered. Try logging in.',
  'auth/invalid-email': 'That email address looks wrong.',
  'auth/weak-password': 'Pick a stronger password (8+ characters).',
  'auth/user-not-found': 'No account found for that email.',
  'auth/wrong-password': 'Incorrect email or password.',
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/too-many-requests': 'Too many attempts. Wait a moment and try again.',
  'auth/network-request-failed': 'No connection. Check your internet.',
  'auth/operation-not-allowed': 'That sign-in method is not enabled yet.',
  'auth/invalid-verification-code': 'That code is not right. Check and retry.',
  'auth/invalid-phone-number': 'That phone number looks wrong.',
  'auth/missing-phone-number': 'Enter your phone number.',
  'auth/quota-exceeded': 'Too many codes requested today. Try again tomorrow.',
  'auth/session-expired': 'The code expired. Request a new one.',
  'auth/requires-recent-login': 'Please log in again to continue.',
  'auth/credential-already-in-use':
    'That account already exists. Signing you into it instead.',
  'auth/email-already-in-use-link':
    'That email already has an account. Log in instead.',
  'auth/provider-already-linked': 'That sign-in method is already connected.',
  'auth/account-exists-with-different-credential':
    'This email is already registered with a different sign-in method.',
  'auth/admin-restricted-operation':
    'Anonymous sign-in is disabled in your Firebase console.',

  'app/no-firebase': 'Accounts are not set up yet. See FIREBASE_SETUP.md.',
  'app/no-google': 'Google Sign-In is not configured yet.',
  'app/no-token': 'Google did not return a token. Try again.',
  'app/no-confirmation': 'Request a code first.',
  'app/no-password-account':
    'This account signs in with Google or phone, so there is no password to change.',
};

export function friendlyError(err) {
  if (!err) return 'Something went wrong. Please try again.';
  const code = err.code || '';
  if (MESSAGES[code]) return MESSAGES[code];

  if (code === statusCodes.SIGN_IN_CANCELLED || code === '-5') return null;
  if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
    return 'Google Play Services is unavailable on this device.';
  }
  if (code === statusCodes.DEVELOPER_ERROR || code === '10') {
    return 'Google Sign-In is misconfigured (check the SHA-1 fingerprint).';
  }
  if (String(err.message || '').includes('No Firebase App')) {
    return 'Firebase is not configured yet. See FIREBASE_SETUP.md.';
  }
  return 'Something went wrong. Please try again.';
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function requireAuth() {
  const instance = getAuthInstance();
  if (!instance) {
    const e = new Error(
      unavailableReason || 'Firebase is not set up yet. See FIREBASE_SETUP.md.'
    );
    e.code = 'app/no-firebase';
    throw e;
  }
  return instance;
}

/** The signed-in user, or null. */
export function currentFirebaseUser() {
  const instance = getAuthInstance();
  return instance ? instance.currentUser : null;
}

/** True when the session is the throwaway anonymous one. */
export function isAnonymousUser() {
  const u = currentFirebaseUser();
  return !!u && u.isAnonymous;
}

/**
 * Link `credential` onto the current anonymous user, preserving the UID.
 *
 * Falls back to a plain sign-in when the credential already belongs to
 * another account, flagging `mergedIntoExisting` so callers can react.
 */
async function linkOrSignIn(credential) {
  const instance = requireAuth();
  const existing = instance.currentUser;

  if (existing && existing.isAnonymous) {
    try {
      const cred = await A.linkWithCredential(existing, credential);
      return { user: cred.user, linked: true, mergedIntoExisting: false };
    } catch (err) {
      const code = err?.code;
      const collides =
        code === 'auth/credential-already-in-use' ||
        code === 'auth/email-already-in-use' ||
        code === 'auth/account-exists-with-different-credential';
      if (!collides) throw err;
      const cred = await A.signInWithCredential(instance, credential);
      return { user: cred.user, linked: false, mergedIntoExisting: true };
    }
  }

  const cred = await A.signInWithCredential(instance, credential);
  return { user: cred.user, linked: false, mergedIntoExisting: false };
}

// ---------------------------------------------------------------------------
// Auth operations
// ---------------------------------------------------------------------------

/**
 * Ensure SOME session exists. Called once at startup so stamps saved during
 * onboarding already have a stable UID behind them.
 */
export async function ensureAnonymousUser() {
  const instance = requireAuth();
  if (instance.currentUser) return instance.currentUser;
  const cred = await A.signInAnonymously(instance);
  return cred.user;
}

/**
 * Create the permanent email account.
 *
 * When the session is anonymous this LINKS, keeping the UID (and therefore
 * every stamp punched during onboarding). No second user is created.
 */
export async function signUpWithEmail({ name, email, password }) {
  const instance = requireAuth();
  const mail = email.trim();
  const existing = instance.currentUser;

  let user;
  let linked = false;

  if (existing && existing.isAnonymous) {
    const credential = A.EmailAuthProvider.credential(mail, password);
    try {
      const cred = await A.linkWithCredential(existing, credential);
      user = cred.user;
      linked = true;
    } catch (err) {
      // Firebase reports a taken email credential as email-already-in-use,
      // but some SDK paths surface the generic credential-already-in-use.
      // Treat both as "this email already has an account".
      if (
        err?.code === 'auth/email-already-in-use' ||
        err?.code === 'auth/credential-already-in-use'
      ) {
        const e = new Error('That email already has an account.');
        e.code = 'auth/email-already-in-use-link';
        throw e;
      }
      throw err;
    }
  } else {
    const cred = await A.createUserWithEmailAndPassword(instance, mail, password);
    user = cred.user;
  }

  if (name && user) {
    try {
      await A.updateProfile(user, { displayName: name.trim() });
      await A.reload(user);
      user = instance.currentUser || user;
    } catch (e) {
      /* the account exists; a missing display name is not worth failing on */
    }
  }

  // Fire-and-forget: a failed verification email must not fail the signup.
  try {
    if (user && !user.emailVerified) await A.sendEmailVerification(user);
  } catch (e) {
    /* ignore */
  }

  return { user, linked, mergedIntoExisting: false };
}

export async function signInWithEmail({ email, password }) {
  const instance = requireAuth();
  const cred = await A.signInWithEmailAndPassword(instance, email.trim(), password);
  return cred.user;
}

export async function sendReset(email) {
  const instance = requireAuth();
  await A.sendPasswordResetEmail(instance, email.trim());
}

/** Reload the user from Firebase so emailVerified is fresh. */
export async function reloadUser() {
  const instance = requireAuth();
  const user = instance.currentUser;
  if (!user) return null;
  await A.reload(user);
  return instance.currentUser || user;
}

/** (Re-)send the account verification email. */
export async function sendVerification() {
  const instance = requireAuth();
  const user = instance.currentUser;
  if (!user || !user.email) return null;
  await A.sendEmailVerification(user);
  return user;
}

/** Re-send the verification email to the signed-in user. */
export async function resendEmailVerification() {
  const instance = requireAuth();
  const user = instance.currentUser;
  if (!user) {
    const e = new Error('Not signed in.');
    e.code = 'app/no-firebase';
    throw e;
  }
  await A.sendEmailVerification(user);
  return true;
}

/** Refresh from the server and report whether the email is verified yet. */
export async function checkEmailVerified() {
  const instance = requireAuth();
  const user = instance.currentUser;
  if (!user) return false;
  await A.reload(user);
  return !!(instance.currentUser && instance.currentUser.emailVerified);
}

/** Google: links onto the anonymous user when there is one. */
export async function signInWithGoogle() {
  requireAuth();
  if (!isGoogleAvailable()) {
    const e = new Error('Google Sign-In is not configured.');
    e.code = 'app/no-google';
    throw e;
  }
  ensureGoogleConfigured();

  await googleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

  // Force the account chooser instead of silently reusing the last account.
  try {
    await googleSignin.signOut();
  } catch (e) {
    /* nothing was signed in */
  }

  const result = await googleSignin.signIn();

  // The token location moved between library versions.
  const idToken = result?.idToken || result?.data?.idToken;
  if (!idToken) {
    const e = new Error('Google did not return a token.');
    e.code = 'app/no-token';
    throw e;
  }

  const credential = A.GoogleAuthProvider.credential(idToken);
  return linkOrSignIn(credential);
}

/** Step 1 of phone auth: returns a confirmation handle. */
export async function startPhoneSignIn(phoneNumber) {
  const instance = requireAuth();
  return A.signInWithPhoneNumber(instance, phoneNumber);
}

/**
 * Step 2: confirm the SMS code.
 *
 * Builds a PhoneAuthProvider credential from the confirmation's
 * verificationId so the result can be LINKED to the anonymous user --
 * confirmation.confirm() alone always creates/uses a separate user.
 */
export async function confirmPhoneCode(confirmation, code) {
  if (!confirmation) {
    const e = new Error('Request a code first.');
    e.code = 'app/no-confirmation';
    throw e;
  }
  requireAuth();

  const verificationId = confirmation.verificationId;
  if (verificationId && A.PhoneAuthProvider) {
    const credential = A.PhoneAuthProvider.credential(verificationId, code);
    return linkOrSignIn(credential);
  }

  const cred = await confirmation.confirm(code);
  return { user: cred?.user ?? null, linked: false, mergedIntoExisting: false };
}

/**
 * Change the password. Firebase requires a RECENT login, so the current
 * password is re-authenticated first.
 */
export async function changePassword({ currentPassword, newPassword }) {
  const instance = requireAuth();
  const user = instance.currentUser;
  if (!user) {
    const e = new Error('Not signed in.');
    e.code = 'app/no-firebase';
    throw e;
  }
  if (!user.email) {
    const e = new Error('This account has no password to change.');
    e.code = 'app/no-password-account';
    throw e;
  }

  const credential = A.EmailAuthProvider.credential(user.email, currentPassword);
  await A.reauthenticateWithCredential(user, credential);
  await A.updatePassword(user, newPassword);
  return true;
}

/** Change the account email (also needs a recent login). */
export async function changeEmail({ currentPassword, newEmail }) {
  const instance = requireAuth();
  const user = instance.currentUser;
  if (!user) {
    const e = new Error('Not signed in.');
    e.code = 'app/no-firebase';
    throw e;
  }
  if (!user.email) {
    const e = new Error('This account has no email to change.');
    e.code = 'app/no-password-account';
    throw e;
  }

  const credential = A.EmailAuthProvider.credential(user.email, currentPassword);
  await A.reauthenticateWithCredential(user, credential);

  // v26 requires the verify-then-change round trip.
  await A.verifyBeforeUpdateEmail(user, newEmail.trim());
  return { verificationSent: true };
}

/** Update the display name. */
export async function updateDisplayName(name) {
  const instance = requireAuth();
  const user = instance.currentUser;
  if (!user) return false;
  await A.updateProfile(user, { displayName: name.trim() });
  await A.reload(user);
  return true;
}

/** Delete the account permanently. */
export async function deleteAccount(password) {
  const instance = requireAuth();
  const user = instance.currentUser;
  if (!user) return false;

  // Password accounts must PROVE the password before deletion: reauth with
  // a wrong password throws, so deleteUser never runs on a bad guess.
  const hasPassword = (user.providerData || []).some(
    (p) => p.providerId === 'password'
  );
  if (hasPassword) {
    if (!password) {
      const e = new Error('Enter your password to confirm deletion.');
      e.code = 'auth/wrong-password';
      throw e;
    }
    const credential = A.EmailAuthProvider.credential(user.email, password);
    await A.reauthenticateWithCredential(user, credential);
  }
  await A.deleteUser(user);
  return true;
}

export async function signOut() {
  const instance = getAuthInstance();
  if (!instance) return;
  try {
    if (isGoogleAvailable()) {
      ensureGoogleConfigured();
      await googleSignin.signOut().catch(() => {});
    }
  } catch (e) {
    /* ignore */
  }
  await A.signOut(instance);
}

/** Subscribe to auth state. Returns an unsubscribe fn (no-op if unavailable). */
export function onAuthChanged(cb) {
  const instance = getAuthInstance();
  if (!instance) {
    cb(null);
    return () => {};
  }
  return A.onAuthStateChanged(instance, cb);
}
