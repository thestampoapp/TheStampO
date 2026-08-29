/**
 * calendar.js
 *
 * Pure date maths for the Collection month grid. No React, no side effects,
 * so the grid logic can be verified independently of rendering.
 */

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();

/**
 * Build a 7-column grid for the given month, padded with the trailing days of
 * the previous month and the leading days of the next, exactly like the
 * reference (which shows 29/30 before Jul 1 and 1/2 after Jul 31).
 *
 * @returns {Array<{day:number, inMonth:boolean, key:string, date:Date}>}
 */
export function buildMonthGrid(year, month) {
  const first = new Date(year, month, 1);
  const startWeekday = first.getDay(); // 0 = Sunday
  const total = daysInMonth(year, month);

  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const prevTotal = daysInMonth(prevYear, prevMonth);

  const cells = [];

  // trailing days of the previous month
  for (let i = startWeekday - 1; i >= 0; i--) {
    const day = prevTotal - i;
    cells.push({
      day,
      inMonth: false,
      key: `p-${day}`,
      date: new Date(prevYear, prevMonth, day),
    });
  }

  // this month
  for (let day = 1; day <= total; day++) {
    cells.push({
      day,
      inMonth: true,
      key: `c-${day}`,
      date: new Date(year, month, day),
    });
  }

  // leading days of the next month, to complete the final week
  const remainder = cells.length % 7;
  if (remainder !== 0) {
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    for (let day = 1; day <= 7 - remainder; day++) {
      cells.push({
        day,
        inMonth: false,
        key: `n-${day}`,
        date: new Date(nextYear, nextMonth, day),
      });
    }
  }

  return cells;
}

/** Split a flat cell list into rows of 7. */
export function chunkWeeks(cells) {
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** Step a {year, month} pair by ±1 month, rolling the year over. */
export function shiftMonth(year, month, delta) {
  const m = month + delta;
  if (m < 0) return { year: year - 1, month: 11 };
  if (m > 11) return { year: year + 1, month: 0 };
  return { year, month: m };
}

/** Key used to look a stamp up for a given day. */
export const dayKey = (year, month, day) =>
  `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
