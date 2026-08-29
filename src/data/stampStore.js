/**
 * stampStore.js
 *
 * THE SINGLE SOURCE OF TRUTH FOR SAVED STAMPS.
 *
 * LOCAL ONLY -- no backend, no account, no network. Stamps live on the device
 * exactly like the real STAMPA. Every read is instant and works offline, and
 * there is no sync state to reason about.
 *
 * Durability comes from two things:
 *   1. images are copied into documentDirectory (see persistImage below)
 *   2. the index is a plain JSON blob in AsyncStorage
 * Both are included in the OS backup (Android autoBackup / iCloud), so a
 * device restore brings the collection back.
 *
 * Why files are COPIED on save
 * ----------------------------
 * expo-image-manipulator writes its output to the CACHE directory, which
 * Android reclaims under storage pressure and iOS may purge too. A stamp
 * saved straight from that path silently loses its image days later.
 * `persistImage()` copies the bitmap into documentDirectory, which is backed
 * up and never auto-cleared.
 *
 * Screens must never touch AsyncStorage or the filesystem directly -- they go
 * through useStamps() / the exported functions here.
 */

import { useCallback, useEffect, useState } from 'react';
import * as FileSystem from 'expo-file-system';

/**
 * AsyncStorage is resolved lazily.
 *
 * A bare `import` of a package that is not installed is a BUNDLER error: the
 * whole app fails to build with "Unable to resolve ...", which is a brutal
 * failure mode for one optional-feeling dependency. Requiring it in a try
 * lets the app boot and simply run without persistence until the package is
 * installed -- and logs exactly what to run.
 *
 * Install it with:
 *   npx expo install @react-native-async-storage/async-storage
 */
let AsyncStorage = null;
try {
  // eslint-disable-next-line global-require
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
} catch (e) {
  AsyncStorage = null;
}

let warned = false;
function warnOnce() {
  if (warned) return;
  warned = true;
  console.warn(
    '[stampa] Stamps will not persist across restarts.\n' +
      'Run:  npx expo install @react-native-async-storage/async-storage'
  );
}

const INDEX_KEY = '@stampa/stamps/v1';
const STAMP_DIR = `${FileSystem.documentDirectory}stamps/`;

/** In-memory cache + subscribers, so every mounted screen stays in step. */
let cache = null;
const listeners = new Set();

const notify = () => {
  listeners.forEach((fn) => {
    try {
      fn(cache);
    } catch (e) {
      /* a broken listener must not break the others */
    }
  });
};

const newId = () =>
  `stmp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

/** YYYY-MM-DD in LOCAL time (not UTC, or late-evening stamps land a day early). */
export function localDayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function ensureDir() {
  try {
    const info = await FileSystem.getInfoAsync(STAMP_DIR);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(STAMP_DIR, { intermediates: true });
    }
  } catch (e) {
    /* best effort: a failed mkdir falls back to the original uri */
  }
}

/**
 * Copy a cache-directory image into permanent storage.
 * Returns the new uri, or the original if the copy fails (never throws).
 */
export async function persistImage(uri, id) {
  if (!uri) return null;
  // Already ours? nothing to do.
  if (uri.startsWith(STAMP_DIR)) return uri;

  try {
    await ensureDir();
    const ext = (uri.split('?')[0].match(/\.(png|jpe?g|webp)$/i) || [
      null,
      'png',
    ])[1];
    const dest = `${STAMP_DIR}${id}.${ext}`;
    await FileSystem.copyAsync({ from: uri, to: dest });
    return dest;
  } catch (e) {
    return uri;
  }
}

async function readIndex() {
  if (!AsyncStorage) {
    warnOnce();
    return [];
  }
  try {
    const raw = await AsyncStorage.getItem(INDEX_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    // Corrupt JSON must not brick the collection.
    return [];
  }
}

async function writeIndex(list) {
  // Update memory first: the session still works even with no storage module.
  cache = list;
  notify();
  if (!AsyncStorage) {
    warnOnce();
    return;
  }
  try {
    await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(list));
  } catch (e) {
    /* the in-memory copy still reflects the change */
  }
}

/** Newest first. */
const sortStamps = (list) =>
  [...list].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

/** Load all stamps (cached after the first call). */
export async function loadStamps() {
  if (cache) return cache;
  cache = sortStamps(await readIndex());
  notify();
  return cache;
}

/**
 * Save a stamp.
 *
 * @param {object} p
 * @param {string} p.uri        image (usually a cache path from cropStamp)
 * @param {string} [p.note]        required by the UI, not by the store
 * @param {string} [p.collection]
 * @param {boolean} [p.favourite]
 * @param {object} [p.location]    { label, latitude, longitude } | null
 * @returns {Promise<object>} the saved record
 */
export async function addStamp({
  uri,
  note = '',
  collection = null,
  favourite = false,
  location = null,
}) {
  const id = newId();
  const permanentUri = await persistImage(uri, id);
  const now = Date.now();

  const stamp = {
    id,
    uri: permanentUri,
    note,
    collection,
    favourite,
    /**
     * Optional place tag: { label, latitude, longitude } or null.
     * Stored verbatim so a label-only tag (no GPS) is still valid.
     */
    location,
    createdAt: now,
    day: localDayKey(new Date(now)),
  };

  const list = await loadStamps();
  await writeIndex(sortStamps([stamp, ...list]));
  return stamp;
}

export async function updateStamp(id, patch) {
  const list = await loadStamps();
  const next = list.map((s) => (s.id === id ? { ...s, ...patch } : s));
  await writeIndex(sortStamps(next));
  return next.find((s) => s.id === id) || null;
}

export async function toggleFavourite(id) {
  const list = await loadStamps();
  const found = list.find((s) => s.id === id);
  if (!found) return null;
  return updateStamp(id, { favourite: !found.favourite });
}

export async function deleteStamps(ids) {
  const kill = new Set(Array.isArray(ids) ? ids : [ids]);
  const list = await loadStamps();
  const removed = list.filter((s) => kill.has(s.id));

  await writeIndex(list.filter((s) => !kill.has(s.id)));

  // Reclaim disk; a failure here is not worth surfacing.
  removed.forEach((s) => {
    if (s.uri && s.uri.startsWith(STAMP_DIR)) {
      FileSystem.deleteAsync(s.uri, { idempotent: true }).catch(() => {});
    }
  });

  return removed.length;
}

/** Map of dayKey -> stamp, for the calendar grid. */
/**
 * Group stamps by collection id.
 * @returns {Map<string|null, object[]>}
 */
export function byCollection(list) {
  const map = new Map();
  (list || []).forEach((s) => {
    const key = s.collection || null;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(s);
  });
  return map;
}

/** Stamps belonging to one collection. */
export function inCollection(list, collectionId) {
  return (list || []).filter((s) => s.collection === collectionId);
}

/**
 * Move stamps into a collection.
 *
 * Used when assigning, and when a collection is deleted -- its stamps are
 * reassigned rather than lost.
 */
export async function moveStamps(ids, collectionId) {
  const move = new Set(Array.isArray(ids) ? ids : [ids]);
  const list = await loadStamps();
  const next = list.map((s) =>
    move.has(s.id) ? { ...s, collection: collectionId } : s
  );
  await writeIndex(sortStamps(next));
  return next;
}

export function byDay(list) {
  const map = {};
  for (const s of list) {
    // newest wins for a given day
    if (!map[s.day]) map[s.day] = s;
  }
  return map;
}

/**
 * How many stamps exist per day.
 *
 * byDay() deliberately keeps only ONE stamp per day (the cover shown in a
 * calendar cell) and throws the rest away, so the count has to be tallied
 * separately rather than derived from it.
 *
 * @returns {Object<string, number>} { 'YYYY-MM-DD': n }
 */
export function countByDay(list) {
  const counts = {};
  for (const s of list || []) {
    if (!s || !s.day) continue;
    counts[s.day] = (counts[s.day] || 0) + 1;
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Local backup
//
// No cloud, but the user should still be able to get their collection off the
// device -- and back on again after a reinstall.
// ---------------------------------------------------------------------------

const BACKUP_VERSION = 1;

/**
 * Write a manifest of the collection to documentDirectory and return its uri,
 * ready to hand to expo-sharing.
 *
 * The images already live in documentDirectory, so the manifest references
 * them by filename rather than duplicating megabytes of bitmap.
 */
export async function exportBackup() {
  const list = await loadStamps();
  const payload = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    count: list.length,
    stamps: list.map((s) => ({
      ...s,
      // store the bare filename so a restore works under a new sandbox path
      file: s.uri ? s.uri.split('/').pop() : null,
    })),
  };

  const dest = `${FileSystem.documentDirectory}stampa-backup.json`;
  await FileSystem.writeAsStringAsync(dest, JSON.stringify(payload, null, 2));
  return dest;
}

/**
 * Restore from a manifest produced by exportBackup().
 *
 * iOS and Android rewrite the app sandbox path on reinstall, so stored uris
 * are rebuilt from the filename against the CURRENT documentDirectory rather
 * than trusted verbatim. Stamps whose image is missing are skipped.
 *
 * @returns {Promise<number>} how many stamps were restored
 */
export async function importBackup(uri) {
  try {
    const raw = await FileSystem.readAsStringAsync(uri);
    const parsed = JSON.parse(raw);
    const incoming = Array.isArray(parsed?.stamps) ? parsed.stamps : [];
    if (!incoming.length) return 0;

    const list = await loadStamps();
    const known = new Set(list.map((s) => s.id));

    const restored = [];
    for (const s of incoming) {
      if (!s || known.has(s.id)) continue;
      const file = s.file || (s.uri ? s.uri.split('/').pop() : null);
      if (!file) continue;

      const rebuilt = `${STAMP_DIR}${file}`;
      // eslint-disable-next-line no-await-in-loop
      const info = await FileSystem.getInfoAsync(rebuilt).catch(() => ({
        exists: false,
      }));
      if (!info.exists) continue;

      const { file: _drop, ...rest } = s;
      restored.push({ ...rest, uri: rebuilt });
    }

    if (restored.length) await writeIndex(sortStamps([...restored, ...list]));
    return restored.length;
  } catch (e) {
    return 0;
  }
}

/**
 * React binding. Every screen using this re-renders when the collection
 * changes, so saving on StampDetail updates Collection and Calendar with no
 * navigation params and no manual refresh.
 */
export function useStamps() {
  const [stamps, setStamps] = useState(cache || []);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    let alive = true;
    const listener = (next) => alive && setStamps(next || []);
    listeners.add(listener);

    loadStamps().then((list) => {
      if (!alive) return;
      setStamps(list);
      setLoading(false);
    });

    return () => {
      alive = false;
      listeners.delete(listener);
    };
  }, []);

  const save = useCallback((payload) => addStamp(payload), []);
  const remove = useCallback((ids) => deleteStamps(ids), []);
  const favourite = useCallback((id) => toggleFavourite(id), []);
  const move = useCallback((ids, collectionId) => moveStamps(ids, collectionId), []);

  return { stamps, loading, save, remove, favourite, move };
}
