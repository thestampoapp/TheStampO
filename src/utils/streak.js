/**
 * streak.js
 *
 * Streak + habit statistics, derived from the stamp list.
 *
 * PURE FUNCTIONS ONLY. No React, no storage, no Date.now() hidden inside --
 * `today` is always passed in. That is what makes the awkward cases
 * (month boundaries, leap days, "today isn't stamped yet") testable instead
 * of hoping they work.
 *
 * THE RULE THAT MATTERS
 * ---------------------
 * A streak must NOT break the moment midnight passes. If the user stamped
 * yesterday but hasn't stamped today, the streak is still alive -- they have
 * the rest of today to keep it. It only breaks once a full day is skipped.
 *
 * Getting this wrong is the classic streak bug: users open the app in the
 * morning and see their 30-day run reset to zero.
 *
 * All day keys are local 'YYYY-MM-DD' (from stampStore.localDayKey), so a
 * stamp punched at 11pm counts for that calendar day, not UTC's.
 */

/** 'YYYY-MM-DD' for a Date, in LOCAL time. */
export function dayKeyOf(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse 'YYYY-MM-DD' into a local Date at midnight. */
export function dateOfKey(key) {
  const [y, m, d] = String(key).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/**
 * Shift a day key by n days.
 * Uses Date arithmetic rather than adding 86400000, so DST changes (where a
 * day is 23 or 25 hours) cannot drift the result.
 */
export function shiftKey(key, n) {
  const d = dateOfKey(key);
  d.setDate(d.getDate() + n);
  return dayKeyOf(d);
}

/** Whole days between two keys (b - a). */
export function daysBetween(a, b) {
  const ms = dateOfKey(b).getTime() - dateOfKey(a).getTime();
  return Math.round(ms / 86400000);
}

/**
 * Compute every stat the streak panel needs, in one pass over the stamps.
 *
 * @param {object[]} stamps  each needs `day` ('YYYY-MM-DD') and `createdAt`
 * @param {Date}     today   injected for testability
 * @returns {{
 *   current: number,        consecutive days up to today (or yesterday)
 *   longest: number,        best run ever
 *   total: number,          total stamps
 *   activeDays: number,     distinct days stamped
 *   stampedToday: boolean,
 *   lastStampedAt: number|null,
 *   week: Array<{key,label,day,done,isToday,isFuture}>,
 *   thisMonth: number
 * }}
 */
export function computeStreak(stamps, today = new Date()) {
  const list = Array.isArray(stamps) ? stamps : [];
  const todayKey = dayKeyOf(today);

  // Distinct days, so several stamps in one day count once.
  const days = new Set();
  let lastStampedAt = null;
  for (const s of list) {
    if (!s || !s.day) continue;
    days.add(s.day);
    if (s.createdAt && (!lastStampedAt || s.createdAt > lastStampedAt)) {
      lastStampedAt = s.createdAt;
    }
  }

  const stampedToday = days.has(todayKey);

  // --- current streak -----------------------------------------------------
  // Start at today if stamped, else yesterday -- today being unstamped does
  // NOT break a run that was alive yesterday.
  let current = 0;
  let cursor = stampedToday ? todayKey : shiftKey(todayKey, -1);
  while (days.has(cursor)) {
    current += 1;
    cursor = shiftKey(cursor, -1);
  }

  // --- longest streak -----------------------------------------------------
  const sorted = [...days].sort();
  let longest = 0;
  let run = 0;
  let prev = null;
  for (const key of sorted) {
    run = prev && daysBetween(prev, key) === 1 ? run + 1 : 1;
    if (run > longest) longest = run;
    prev = key;
  }

  // --- this week (Mon..Sun, matching the reference) -----------------------
  // getDay(): 0=Sun. Convert so Monday is index 0.
  const dow = (today.getDay() + 6) % 7;
  const monday = shiftKey(todayKey, -dow);
  const LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const week = LABELS.map((label, i) => {
    const key = shiftKey(monday, i);
    return {
      key,
      label,
      day: dateOfKey(key).getDate(),
      done: days.has(key),
      isToday: key === todayKey,
      isFuture: daysBetween(todayKey, key) > 0,
    };
  });

  // --- this month ---------------------------------------------------------
  const prefix = todayKey.slice(0, 7); // YYYY-MM
  let thisMonth = 0;
  for (const s of list) {
    if (s && typeof s.day === 'string' && s.day.startsWith(prefix)) thisMonth += 1;
  }

  return {
    current,
    longest,
    total: list.length,
    activeDays: days.size,
    stampedToday,
    lastStampedAt,
    week,
    thisMonth,
  };
}

/** "Today, 9:14 AM" / "Yesterday, 6:02 PM" / "12 Aug, 6:02 PM" / null. */
export function formatLastStamped(ts, today = new Date()) {
  if (!ts) return null;
  const d = new Date(ts);
  const key = dayKeyOf(d);
  const todayKey = dayKeyOf(today);

  let time;
  try {
    time = d.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch (e) {
    time = '';
  }

  if (key === todayKey) return `Today, ${time}`;
  if (key === shiftKey(todayKey, -1)) return `Yesterday, ${time}`;

  let date;
  try {
    date = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  } catch (e) {
    date = key;
  }
  return `${date}, ${time}`;
}
