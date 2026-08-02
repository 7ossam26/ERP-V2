// Date-window helpers for the branch sales filter.
//
// The backend interprets from/to as Africa/Cairo wall-clock dates, so presets
// must be computed on the Cairo calendar too — using the browser's local date
// made "اليوم" resolve to the wrong day for any client clock outside Cairo.

export const cairoTodayISO = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(
    new Date(),
  );

// Day arithmetic on an ISO date, done in UTC space so it can't be skewed by
// the browser's timezone or DST.
export const isoAddDays = (iso, delta) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
};

export const computePresetRange = (preset) => {
  const today = cairoTodayISO();
  if (preset === "yesterday") {
    const y = isoAddDays(today, -1);
    return { from: y, to: y };
  }
  if (preset === "last7") {
    return { from: isoAddDays(today, -6), to: today };
  }
  // "today" and any unknown preset
  return { from: today, to: today };
};
