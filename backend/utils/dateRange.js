/**
 * dateRange.js
 *
 * One definition of "what day is it" for every report.
 *
 * Africa/Cairo is UTC+2 with no DST. Date filters from the UI arrive as
 * "YYYY-MM-DD" and mean Cairo wall-clock dates, so they must be converted to
 * UTC instants explicitly. The naive `new Date("2026-08-01")` + `setHours(0,0,0,0)`
 * does NOT do this: the string parses as UTC midnight and setHours then mutates
 * in the *server's* local zone, so the same query returns a different window
 * depending on where the process happens to run. That is what made the general
 * report and the branches page disagree on the boundaries of the same month.
 *
 * These helpers are timezone-independent: identical results on a Cairo box, a
 * UTC container, and a developer laptop in any zone.
 */

const CAIRO_OFFSET_MS = 2 * 60 * 60 * 1000;

/** Today's date in Cairo, as "YYYY-MM-DD". */
const cairoTodayISO = () => {
  const nowCairoMs = Date.now() + CAIRO_OFFSET_MS;
  return new Date(nowCairoMs).toISOString().slice(0, 10);
};

/** Start-of-day UTC instant for a Cairo "YYYY-MM-DD". Falls back to Cairo today. */
const parseDateStart = (s) => {
  const ymd = /^\d{4}-\d{2}-\d{2}$/.test(s || "") ? s : cairoTodayISO();
  return new Date(Date.parse(`${ymd}T00:00:00.000Z`) - CAIRO_OFFSET_MS);
};

/** End-of-day UTC instant for a Cairo "YYYY-MM-DD". Falls back to Cairo today. */
const parseDateEnd = (s) => {
  const ymd = /^\d{4}-\d{2}-\d{2}$/.test(s || "") ? s : cairoTodayISO();
  return new Date(Date.parse(`${ymd}T23:59:59.999Z`) - CAIRO_OFFSET_MS);
};

/**
 * The Cairo calendar day ("YYYY-MM-DD") a UTC instant falls on.
 *
 * Chart buckets must be keyed with this, not with `toISOString().split("T")[0]`.
 * The latter keys by UTC day, so a sale at 00:30 Cairo keys to the *previous*
 * day and lands on a bucket that was never seeded — the amount is then dropped
 * and the chart silently totals less than the summary card above it.
 */
const cairoDayKey = (date) =>
  new Date(new Date(date).getTime() + CAIRO_OFFSET_MS).toISOString().slice(0, 10);

/** The Cairo hour ("HH:00") a UTC instant falls in. */
const cairoHourKey = (date) => {
  const shifted = new Date(new Date(date).getTime() + CAIRO_OFFSET_MS);
  return String(shifted.getUTCHours()).padStart(2, "0") + ":00";
};

module.exports = {
  CAIRO_OFFSET_MS,
  cairoTodayISO,
  parseDateStart,
  parseDateEnd,
  cairoDayKey,
  cairoHourKey,
};
