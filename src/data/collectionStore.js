/**
 * collectionStore.js
 *
 * Named collections ("albums") that stamps belong to.
 *
 * DESIGN
 * ------
 * A stamp holds `collection: <id>` -- ONE collection per stamp, so moving is a
 * reassignment rather than a set operation. The collection list itself lives
 * here, separately from the stamps, because:
 *
 *   - an EMPTY collection must still exist (derive-from-stamps cannot do that)
 *   - renaming touches one record instead of every stamp
 *
 * A DEFAULT collection is created on first use so the "required" rule at save
 * time can always be satisfied -- the user is never stuck with nothing to pick.
 *
 * AsyncStorage is behind a guarded require for the same reason as stampStore:
 * a bare import of a missing package is a bundler error, and the app must
 * still run (in-memory) without it.
 */

import { useCallback, useEffect, useState } from 'react';

let AsyncStorage = null;
try {
  // eslint-disable-next-line global-require
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
} catch (e) {
  AsyncStorage = null;
}

const KEY = '@stampa/collections/v1';

/** Seeded on first launch so saving always has a valid target. */
export const DEFAULT_COLLECTION = {
  id: 'col_default',
  name: 'My Stamps',
  createdAt: 0,
};

export const NAME_MAX = 40;

/** In-memory cache + subscribers, mirroring stampStore's pattern. */
let cache = null;
const listeners = new Set();

const notify = () => {
  listeners.forEach((fn) => {
    try {
      fn(cache);
    } catch (e) {
      /* one broken listener must not break the others */
    }
  });
};

const newId = () =>
  `col_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

/** Oldest first, so the default stays at the top and order is stable. */
const sortCollections = (list) =>
  [...list].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

async function writeIndex(list) {
  cache = sortCollections(list);
  try {
    if (AsyncStorage) await AsyncStorage.setItem(KEY, JSON.stringify(cache));
  } catch (e) {
    /* in-memory only for this session */
  }
  notify();
  return cache;
}

/**
 * Read all collections, seeding the default on first run.
 * Safe to call repeatedly -- the cache short-circuits.
 */
export async function loadCollections() {
  if (cache) return cache;

  let list = null;
  try {
    if (AsyncStorage) {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) list = JSON.parse(raw);
    }
  } catch (e) {
    // Corrupt JSON must not brick the app; fall through to the seed.
    list = null;
  }

  if (!Array.isArray(list) || list.length === 0) {
    list = [DEFAULT_COLLECTION];
    // Persist the seed so ids stay stable across launches.
    return writeIndex(list);
  }

  cache = sortCollections(list);
  return cache;
}

/** Synchronous peek; only meaningful after loadCollections() resolves. */
export function getCollections() {
  return cache || [DEFAULT_COLLECTION];
}

export function getCollection(id) {
  return getCollections().find((c) => c.id === id) || null;
}

/** Display name for a stamp's collection id, with a sensible fallback. */
export function collectionName(id) {
  const c = getCollection(id);
  return c ? c.name : 'Unsorted';
}

/**
 * Create a collection.
 *
 * Names are compared case-insensitively and trimmed: "Goa" and " goa " are
 * the same album, and silently creating a duplicate would be confusing.
 *
 * @returns {Promise<{ok: boolean, collection?: object, error?: string}>}
 */
export async function createCollection(rawName) {
  const name = String(rawName || '').trim();
  if (!name) return { ok: false, error: 'Give the collection a name' };
  if (name.length > NAME_MAX) {
    return { ok: false, error: `Keep it under ${NAME_MAX} characters` };
  }

  const list = await loadCollections();
  const clash = list.find(
    (c) => c.name.trim().toLowerCase() === name.toLowerCase()
  );
  if (clash) return { ok: false, error: 'You already have a collection with that name' };

  const collection = { id: newId(), name, createdAt: Date.now() };
  await writeIndex([...list, collection]);
  return { ok: true, collection };
}

/** Rename, with the same duplicate rule (ignoring itself). */
export async function renameCollection(id, rawName) {
  const name = String(rawName || '').trim();
  if (!name) return { ok: false, error: 'Give the collection a name' };
  if (name.length > NAME_MAX) {
    return { ok: false, error: `Keep it under ${NAME_MAX} characters` };
  }

  const list = await loadCollections();
  const clash = list.find(
    (c) => c.id !== id && c.name.trim().toLowerCase() === name.toLowerCase()
  );
  if (clash) return { ok: false, error: 'You already have a collection with that name' };

  await writeIndex(list.map((c) => (c.id === id ? { ...c, name } : c)));
  return { ok: true };
}

/**
 * Delete a collection.
 *
 * NEVER deletes the stamps inside it -- losing photos because an album was
 * removed would be unforgivable. The caller decides where they go; this
 * returns the id so stamps can be reassigned.
 *
 * The last remaining collection cannot be deleted, otherwise saving would
 * have no valid target.
 */
export async function deleteCollection(id) {
  const list = await loadCollections();
  if (list.length <= 1) {
    return { ok: false, error: 'Keep at least one collection' };
  }
  const remaining = list.filter((c) => c.id !== id);
  await writeIndex(remaining);
  return { ok: true, fallbackId: remaining[0].id };
}

/**
 * React binding. Mirrors useStamps(), so screens using both stay in step.
 */
export function useCollections() {
  const [collections, setCollections] = useState(cache || []);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    let alive = true;
    const listener = (next) => alive && setCollections(next || []);
    listeners.add(listener);

    loadCollections().then((list) => {
      if (!alive) return;
      setCollections(list);
      setLoading(false);
    });

    return () => {
      alive = false;
      listeners.delete(listener);
    };
  }, []);

  const create = useCallback((name) => createCollection(name), []);
  const rename = useCallback((id, name) => renameCollection(id, name), []);
  const remove = useCallback((id) => deleteCollection(id), []);

  return { collections, loading, create, rename, remove };
}
