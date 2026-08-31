/**
 * authStore.js
 *
 * useAuth() -- the single interface screens use for authentication.
 *
 * Screens never import ./firebase directly, so swapping providers later
 * touches one file. Every method resolves to { ok, error } rather than
 * throwing, because a rejected promise in an onPress handler is an unhandled
 * rejection waiting to happen.
 *
 * ACCOUNT LIFECYCLE
 * -----------------
 *   launch      -> bootstrapAuth() signs in ANONYMOUSLY (real Firebase UID)
 *   onboarding  -> stamps are saved; they belong to that UID
 *   signup      -> the permanent credential is LINKED onto the same UID, so
 *                  nothing captured before signup is lost
 *   relaunch    -> a permanent user skips onboarding entirely
 *   sign out    -> back to Login; a fresh anonymous session is NOT created,
 *                  because the gate must stay closed until they log back in
 *
 * `isPermanent` (not merely "signed in") is what gates the dashboard: an
 * anonymous user is signed in, but has no account.
 *
 * MOCK MODE
 * ---------
 * Native Firebase cannot run in Expo Go. Rather than block the whole flow
 * during development, this file falls back to an in-memory mock whenever
 * @react-native-firebase/auth is absent:
 *
 *   - every call succeeds and returns a fake user
 *   - anonymous -> linked transitions are simulated faithfully
 *   - a one-time console warning makes it obvious it is not real
 *
 * The moment you build with Firebase installed, the real implementation takes
 * over automatically. No screen changes, no flag to remember to flip.
 */

import { useCallback, useEffect, useState } from 'react';

import {
  isAuthAvailable,
  authUnavailableReason,
  isGoogleAvailable,
  onAuthChanged,
  ensureAnonymousUser,
  signUpWithEmail,
  signInWithEmail,
  signInWithGoogle,
  reloadUser,
  resendEmailVerification,
  startPhoneSignIn,
  confirmPhoneCode,
  sendReset,
  changePassword as fbChangePassword,
  changeEmail as fbChangeEmail,
  updateDisplayName as fbUpdateDisplayName,
  deleteAccount as fbDeleteAccount,
  signOut as fbSignOut,
  friendlyError,
} from './firebase';
import { setStampOwner } from './stampStore';

/** Set true to demo the flow without hitting Firebase at all. */
export const FORCE_MOCK_AUTH = false;

/** Mock is used when Firebase is unavailable (Expo Go) or forced. */
let mockMode = null;
function isMockAuth() {
  if (mockMode === null) mockMode = FORCE_MOCK_AUTH || !isAuthAvailable();
  return mockMode;
}

/**
 * Why we are mocked. Screens can surface this, and it prints once at startup
 * so the reason is in the Metro log without anyone having to reproduce a bug.
 */
function getMockReason() {
  return FORCE_MOCK_AUTH
    ? 'FORCE_MOCK_AUTH is true in src/data/authStore.js'
    : authUnavailableReason();
}

let mockWarned = false;
function warnMockOnce() {
  if (mockWarned) return;
  mockWarned = true;
  console.warn(
    '\n' +
      '========================================================\n' +
      '  [stampa] AUTH IS MOCKED — NO REAL ACCOUNTS ARE CREATED\n' +
      '========================================================\n' +
      `  Reason: ${getMockReason() || 'unknown'}\n` +
      '  Nothing will appear in the Firebase console until this\n' +
      '  is fixed. See FIREBASE_SETUP.md.\n' +
      '========================================================\n'
  );
}

// Mock reason is logged from bootstrapAuth(), not at import time.

/** Small delay so buttons show their loading state, as they will in prod. */
const settle = (ms = 450) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Shared snapshot -- every mounted screen agrees on who is signed in
// ---------------------------------------------------------------------------

let currentUser = null;
let resolved = false;
const listeners = new Set();

/**
 * Normalise a Firebase user into the shape screens consume.
 *
 * `isAnonymous` is carried through explicitly: it is the difference between
 * "has a session" and "has an account", and the whole gate depends on it.
 */
const shape = (u) =>
  u
    ? {
        uid: u.uid,
        email: u.email || null,
        name: u.displayName || null,
        phone: u.phoneNumber || null,
        photo: u.photoURL || null,
        isAnonymous: !!u.isAnonymous,
        // This is a security state, not display-only metadata: Login,
        // Splash, and VerifyEmail all use it to decide where users go.
        emailVerified: !!u.emailVerified,
      }
    : null;

function setUserEverywhere(u) {
  currentUser = u;
  resolved = true;
  // The stamp index is per-account: switching users switches collections.
  setStampOwner(u ? u.uid : null);
  listeners.forEach((fn) => {
    try {
      fn(currentUser);
    } catch (e) {}
  });
}

// Firebase is probed lazily on first bootstrap — not at import time, which
// could crash a release APK before React paints anything.
let authListenerStarted = false;

function ensureAuthListener() {
  if (authListenerStarted || isMockAuth()) return;
  authListenerStarted = true;
  onAuthChanged((u) => setUserEverywhere(shape(u)));
}

// ---------------------------------------------------------------------------
// Mock implementation -- mirrors the real API, including linking semantics
// ---------------------------------------------------------------------------

function mockUser(overrides = {}) {
  return {
    uid: `mock_${Math.random().toString(36).slice(2, 10)}`,
    email: null,
    name: null,
    phone: null,
    photo: null,
    isAnonymous: false,
    emailVerified: true,
    ...overrides,
  };
}

/**
 * Upgrade the anonymous mock user in place, exactly as linking does: same
 * uid, now permanent. If there is no anonymous session, make a new user.
 */
function mockLink(fields) {
  const base = currentUser;
  const u =
    base && base.isAnonymous
      ? { ...base, ...fields, isAnonymous: false }
      : mockUser(fields);
  setUserEverywhere(u);
  return u;
}

const mockApi = {
  async bootstrap() {
    warnMockOnce();
    await settle(120);
    if (!currentUser) {
      setUserEverywhere(mockUser({ isAnonymous: true }));
    }
    resolved = true;
    return { ok: true, user: currentUser };
  },
  async signUp({ name, email }) {
    warnMockOnce();
    await settle();
    const u = mockLink({
      email: email?.trim() || null,
      name: name?.trim() || null,
    });
    return { ok: true, user: u, linked: true };
  },
  async signIn({ email }) {
    warnMockOnce();
    await settle();
    const u = mockUser({ email: email?.trim() || null });
    setUserEverywhere(u);
    return { ok: true, user: u };
  },
  async google() {
    warnMockOnce();
    await settle(600);
    const u = mockLink({ email: 'demo@gmail.com', name: 'Demo User' });
    return { ok: true, user: u, linked: true };
  },
  async requestCode(phone) {
    warnMockOnce();
    await settle();
    // Any 6 digits are accepted in mock mode.
    return { ok: true, confirmation: { __mock: true, phone } };
  },
  async confirmCode(confirmation, code) {
    warnMockOnce();
    await settle();
    if (!code || String(code).length !== 6) {
      return { ok: false, error: 'Enter the 6-digit code' };
    }
    const u = mockLink({ phone: confirmation?.phone || null });
    return { ok: true, user: u, linked: true };
  },
  async resetPassword() {
    warnMockOnce();
    await settle();
    return { ok: true };
  },
  async signOut() {
    warnMockOnce();
    setUserEverywhere(null);
    return { ok: true };
  },
  async changePassword() {
    warnMockOnce();
    await settle();
    return { ok: true };
  },
  async changeEmail({ newEmail }) {
    warnMockOnce();
    await settle();
    if (currentUser) setUserEverywhere({ ...currentUser, email: newEmail });
    return { ok: true, verificationSent: false };
  },
  async updateName(name) {
    warnMockOnce();
    await settle(200);
    if (currentUser) setUserEverywhere({ ...currentUser, name });
    return { ok: true };
  },
  async deleteAccount(password) {
    warnMockOnce();
    await settle();
    if (!password) {
      return { ok: false, error: 'Enter your password to confirm deletion.' };
    }
    setUserEverywhere(null);
    return { ok: true };
  },
};

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

let bootstrapped = null;

/**
 * Call once from App.js before rendering the navigator.
 *
 * Resolves when we know who the user is. Guarantees a session exists (an
 * anonymous one if they've never signed up) so stamps captured during
 * onboarding already have a UID. Never rejects -- a failure here must not
 * brick a local-first app.
 */
export function bootstrapAuth() {
  if (bootstrapped) return bootstrapped;

  bootstrapped = (async () => {
    ensureAuthListener();
    if (isMockAuth()) {
      warnMockOnce();
      return mockApi.bootstrap();
    }

    try {
      // Wait for Firebase to restore any persisted session before deciding
      // whether a new anonymous user is needed; otherwise a returning user
      // briefly looks signed-out and we'd create a stray account.
      const restored = await new Promise((resolve) => {
        let done = false;
        const unsub = onAuthChanged((u) => {
          if (done) return;
          done = true;
          setTimeout(() => unsub && unsub(), 0);
          resolve(u);
        });
      });

      if (!restored) await ensureAnonymousUser();
      resolved = true;
      return { ok: true, user: currentUser };
    } catch (err) {
      // Anonymous sign-in disabled, no network, whatever: carry on signed-out.
      resolved = true;
      setUserEverywhere(currentUser);
      return { ok: false, error: friendlyError(err) };
    }
  })();

  return bootstrapped;
}

/** True once we know the auth state (used by the splash screen). */
export function isAuthResolved() {
  return resolved;
}

/** Synchronous peek, for navigation decisions outside React. */
export function getCurrentUser() {
  return currentUser;
}

/** Has a real account (not the throwaway anonymous session)? */
export function isPermanentUser(u = currentUser) {
  return !!u && !u.isAnonymous;
}

// ---------------------------------------------------------------------------
// useAuth()
// ---------------------------------------------------------------------------

/**
 * Wrap an async auth call so callers get a plain result object.
 * `error: null` with `ok: false` means the user cancelled -- show nothing.
 */
async function run(fn) {
  try {
    const out = await fn();
    // Linking helpers resolve { user, linked, mergedIntoExisting }; the
    // simpler calls resolve a bare user.
    const user = out && out.user !== undefined ? out.user : out;
    return {
      ok: true,
      user: shape(user),
      linked: !!(out && out.linked),
      mergedIntoExisting: !!(out && out.mergedIntoExisting),
      verificationSent: !!(out && out.verificationSent),
      error: undefined,
    };
  } catch (err) {
    return { ok: false, error: friendlyError(err), code: err?.code };
  }
}

export function useAuth() {
  const [user, setUser] = useState(currentUser);
  const [ready, setReady] = useState(resolved);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const listener = (u) => {
      setUser(u);
      setReady(true);
    };
    listeners.add(listener);
    // Sync up with anything that changed between render and subscribe.
    setUser(currentUser);
    if (resolved) setReady(true);
    return () => listeners.delete(listener);
  }, []);

  /**
   * Wrap a call so the button shows its loading state and the caller always
   * receives { ok, error }. In mock mode `mockFn` is used instead.
   */
  const guard = useCallback(
    (fn, mockFn) =>
      async (...args) => {
        setBusy(true);
        try {
          return isMockAuth() ? await mockFn(...args) : await run(() => fn(...args));
        } finally {
          setBusy(false);
        }
      },
    []
  );

  const signUp = useCallback(
    guard(
      ({ name, email, password }) => signUpWithEmail({ name, email, password }),
      mockApi.signUp
    ),
    [guard]
  );

  const signIn = useCallback(
    guard(({ email, password }) => signInWithEmail({ email, password }), mockApi.signIn),
    [guard]
  );

  const google = useCallback(guard(() => signInWithGoogle(), mockApi.google), [guard]);

  /** Phone step 1 -- resolves { ok, confirmation }. */
  const requestCode = useCallback(async (phone) => {
    setBusy(true);
    try {
      if (isMockAuth()) return await mockApi.requestCode(phone);
      const confirmation = await startPhoneSignIn(phone);
      return { ok: true, confirmation };
    } catch (err) {
      return { ok: false, error: friendlyError(err), code: err?.code };
    } finally {
      setBusy(false);
    }
  }, []);

  /** Phone step 2. */
  const confirmCode = useCallback(
    guard(
      (confirmation, code) => confirmPhoneCode(confirmation, code),
      mockApi.confirmCode
    ),
    [guard]
  );

  const resetPassword = useCallback(
    guard((email) => sendReset(email), mockApi.resetPassword),
    [guard]
  );

  /**
   * Fetch the current Firebase user again after the user opens an email
   * verification link. Firebase does not emit a normal auth-state event for
   * this field change, so update our shared snapshot explicitly.
   */
  const refreshUser = useCallback(async () => {
    setBusy(true);
    try {
      if (isMockAuth()) {
        return { ok: true, user: currentUser };
      }
      const refreshed = await reloadUser();
      const next = shape(refreshed);
      setUserEverywhere(next);
      return { ok: true, user: next };
    } catch (err) {
      return { ok: false, error: friendlyError(err), code: err?.code };
    } finally {
      setBusy(false);
    }
  }, []);

  /** Send another verification link for the email account currently signed in. */
  const resendVerification = useCallback(async () => {
    setBusy(true);
    try {
      if (isMockAuth()) return { ok: true };
      await resendEmailVerification();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: friendlyError(err), code: err?.code };
    } finally {
      setBusy(false);
    }
  }, []);

  const signOut = useCallback(guard(() => fbSignOut(), mockApi.signOut), [guard]);

  const changePassword = useCallback(
    guard(
      ({ currentPassword, newPassword }) =>
        fbChangePassword({ currentPassword, newPassword }),
      mockApi.changePassword
    ),
    [guard]
  );

  const changeEmail = useCallback(
    guard(
      ({ currentPassword, newEmail }) =>
        fbChangeEmail({ currentPassword, newEmail }),
      mockApi.changeEmail
    ),
    [guard]
  );

  const updateName = useCallback(
    guard((name) => fbUpdateDisplayName(name), mockApi.updateName),
    [guard]
  );

  const deleteAccount = useCallback(
    guard((password) => fbDeleteAccount(password), mockApi.deleteAccount),
    [guard]
  );

  return {
    user,
    ready,
    busy,
    /** Signed in with a REAL account -- this is what gates the dashboard. */
    isPermanent: isPermanentUser(user),
    /** Signed in, but only as the throwaway onboarding session. */
    isAnonymous: !!user && user.isAnonymous,
    available: isMockAuth() ? true : isAuthAvailable(),
    googleAvailable: isMockAuth() ? true : isGoogleAvailable(),
    /** True while running on fake auth -- screens can show a dev badge. */
    isMock: isMockAuth(),
    /** Why it is mocked (null when auth is real). */
    mockReason: isMockAuth() ? getMockReason() : null,
    signUp,
    signIn,
    google,
    requestCode,
    confirmCode,
    resetPassword,
    refreshUser,
    resendVerification,
    signOut,
    changePassword,
    changeEmail,
    updateName,
    deleteAccount,
  };
}
