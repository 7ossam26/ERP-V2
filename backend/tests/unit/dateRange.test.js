const {
  parseDateStart,
  parseDateEnd,
  cairoDayKey,
  cairoHourKey,
  cairoTodayISO,
} = require("../../utils/dateRange");

// The whole point of these helpers is that the window does not depend on where
// the process runs. The general report used to build its range with
// `new Date(str)` + setHours(), which resolves in the server's local zone, so it
// disagreed with the branches page on the boundaries of the same month.
describe("Cairo date range helpers", () => {
  const withTZ = (tz, fn) => {
    const previous = process.env.TZ;
    process.env.TZ = tz;
    try {
      return fn();
    } finally {
      if (previous === undefined) delete process.env.TZ;
      else process.env.TZ = previous;
    }
  };

  test("start of day is Cairo midnight expressed in UTC", () => {
    // Cairo is UTC+2, so 2026-08-01 00:00 Cairo == 2026-07-31 22:00 UTC.
    expect(parseDateStart("2026-08-01").toISOString()).toBe(
      "2026-07-31T22:00:00.000Z",
    );
  });

  test("end of day is Cairo 23:59:59.999 expressed in UTC", () => {
    expect(parseDateEnd("2026-08-31").toISOString()).toBe(
      "2026-08-31T21:59:59.999Z",
    );
  });

  test("boundaries are identical regardless of the server timezone", () => {
    const zones = ["UTC", "Africa/Cairo", "America/New_York", "Asia/Tokyo"];
    const starts = zones.map((tz) =>
      withTZ(tz, () => parseDateStart("2026-08-01").toISOString()),
    );
    const ends = zones.map((tz) =>
      withTZ(tz, () => parseDateEnd("2026-08-31").toISOString()),
    );

    expect(new Set(starts).size).toBe(1);
    expect(new Set(ends).size).toBe(1);
  });

  test("a whole month is a contiguous window with no gap or overlap", () => {
    const augEnd = parseDateEnd("2026-08-31").getTime();
    const sepStart = parseDateStart("2026-09-01").getTime();
    expect(sepStart - augEnd).toBe(1); // exactly 1ms apart
  });

  test("malformed or missing input falls back to Cairo today", () => {
    const today = cairoTodayISO();
    for (const bad of [undefined, null, "", "01/08/2026", "2026-8-1", "nonsense"]) {
      expect(parseDateStart(bad).toISOString()).toBe(
        parseDateStart(today).toISOString(),
      );
    }
  });

  describe("chart bucket keys", () => {
    // The bug this guards: a sale at 00:30 Cairo is 22:30 UTC the PREVIOUS day.
    // Keying buckets with toISOString() put it on a day that was never seeded,
    // so the chart silently dropped it and totalled less than the summary card.
    test("just after Cairo midnight keys to the new Cairo day, not the UTC one", () => {
      const justAfterCairoMidnight = new Date("2026-08-01T22:30:00.000Z");
      expect(justAfterCairoMidnight.toISOString().slice(0, 10)).toBe("2026-08-01");
      expect(cairoDayKey(justAfterCairoMidnight)).toBe("2026-08-02");
    });

    test("every seeded day key round-trips from the range start", () => {
      const start = parseDateStart("2026-08-01");
      const DAY_MS = 24 * 60 * 60 * 1000;
      const keys = [];
      for (let i = 0; i < 3; i++) {
        keys.push(cairoDayKey(new Date(start.getTime() + i * DAY_MS)));
      }
      expect(keys).toEqual(["2026-08-01", "2026-08-02", "2026-08-03"]);
    });

    test("hour key is the Cairo hour", () => {
      expect(cairoHourKey(new Date("2026-08-01T22:30:00.000Z"))).toBe("00:00");
      expect(cairoHourKey(new Date("2026-08-01T10:05:00.000Z"))).toBe("12:00");
    });

    test("bucket keys are timezone-independent too", () => {
      const instant = new Date("2026-08-01T22:30:00.000Z");
      const dayKeys = ["UTC", "America/New_York", "Asia/Tokyo"].map((tz) =>
        withTZ(tz, () => cairoDayKey(instant)),
      );
      const hourKeys = ["UTC", "America/New_York", "Asia/Tokyo"].map((tz) =>
        withTZ(tz, () => cairoHourKey(instant)),
      );
      expect(new Set(dayKeys).size).toBe(1);
      expect(new Set(hourKeys).size).toBe(1);
    });
  });
});
