import test from "node:test";
import assert from "node:assert/strict";

import {
  formatBulkInvoiceDate,
  formatBulkInvoiceMoney,
  formatBulkInvoiceQty,
} from "./BulkInvoicePDF.js";

test("formatBulkInvoiceMoney formats EGP values and preserves blanks", () => {
  assert.equal(formatBulkInvoiceMoney(12.5), "12.50 ج.م");
  assert.equal(formatBulkInvoiceMoney(""), "—");
  assert.equal(formatBulkInvoiceMoney(null), "—");
});

test("formatBulkInvoiceQty trims trailing zeroes and keeps units", () => {
  assert.equal(formatBulkInvoiceQty(3, "كجم"), "3 كجم");
  assert.equal(formatBulkInvoiceQty(1.25, "كجم"), "1.25 كجم");
  assert.equal(formatBulkInvoiceQty(1.2, undefined), "1.2");
});

test("formatBulkInvoiceDate returns Arabic locale dates and ignores empty values", () => {
  assert.equal(formatBulkInvoiceDate(""), "");
  assert.match(formatBulkInvoiceDate("2026-04-23T00:00:00.000Z"), /\p{N}/u);
});
