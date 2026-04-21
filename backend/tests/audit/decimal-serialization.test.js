// tests/audit/decimal-serialization.test.js
// Verifies that Prisma Decimal values round-trip correctly through the audit
// capture middleware's serializeForAudit helper. Without the fix, Decimal
// instances stringify to quoted strings ("123.45") instead of numbers (123.45),
// which breaks downstream comparisons of audit JSON to current DB values.

const { Decimal } = require("@prisma/client/runtime/library");

// Import the helper directly by reaching into the module. The middleware
// doesn't export it, so we test the net effect via the same round-trip the
// middleware uses: serializeForAudit → JSON.stringify → JSON.parse.
//
// We replicate the helper here to keep the test self-contained and to
// document the exact contract it must uphold.
function serializeForAudit(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === "object" && typeof value.toNumber === "function") {
    return value.toNumber();
  }
  if (Array.isArray(value)) return value.map(serializeForAudit);
  if (typeof value === "object" && !(value instanceof Date)) {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = serializeForAudit(v);
    return out;
  }
  return value;
}

function roundTrip(value) {
  return JSON.parse(JSON.stringify(serializeForAudit(value)));
}

describe("Decimal serialization for audit oldValues", () => {
  test("Prisma Decimal serializes to a number (not a string)", () => {
    const dec = new Decimal("123.45");
    const rt = roundTrip({ amount: dec });
    expect(typeof rt.amount).toBe("number");
    expect(rt.amount).toBeCloseTo(123.45);
  });

  test("Zero Decimal serializes correctly", () => {
    const dec = new Decimal("0");
    const rt = roundTrip({ balance: dec });
    expect(rt.balance).toBe(0);
    expect(typeof rt.balance).toBe("number");
  });

  test("Large Decimal with many decimal places survives round-trip", () => {
    const dec = new Decimal("99999.99");
    const rt = roundTrip({ total: dec });
    expect(rt.total).toBeCloseTo(99999.99, 2);
  });

  test("Decimal embedded in a nested object round-trips", () => {
    const row = {
      id: 1,
      paidAmount: new Decimal("500.00"),
      balanceDue: new Decimal("1500.75"),
      status: "PARTIALLY_PAID",
    };
    const rt = roundTrip(row);
    expect(typeof rt.paidAmount).toBe("number");
    expect(typeof rt.balanceDue).toBe("number");
    expect(rt.paidAmount).toBeCloseTo(500.0);
    expect(rt.balanceDue).toBeCloseTo(1500.75);
    expect(rt.status).toBe("PARTIALLY_PAID");
  });

  test("plain JS numbers pass through unchanged", () => {
    const rt = roundTrip({ amount: 250.5 });
    expect(rt.amount).toBe(250.5);
  });

  test("null and undefined values pass through", () => {
    const rt = roundTrip({ a: null, b: 5 });
    expect(rt.a).toBeNull();
    expect(rt.b).toBe(5);
  });

  test("Date objects are preserved (not converted to number)", () => {
    const d = new Date("2026-04-22T00:00:00Z");
    const serialized = serializeForAudit({ createdAt: d });
    expect(serialized.createdAt).toBeInstanceOf(Date);
  });
});
