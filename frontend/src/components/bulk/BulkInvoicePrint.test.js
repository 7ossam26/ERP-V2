import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import BulkInvoicePrint, {
  INVOICE_PRINT_ROOT_CLASS,
  getBulkInvoicePrintTitle,
} from "./BulkInvoicePrint.js";

const order = {
  id: 9,
  orderNumber: "BULK-0009",
  createdAt: "2026-04-23T08:30:00.000Z",
  netAmount: 100,
  taxRate: 0.14,
  taxAmount: 14,
  total: 114,
  paidAmount: 40,
  balanceDue: 74,
  customer: {
    companyName: "شركة الاختبار",
    taxNumber: "123456789",
    primaryContactPhone: "01000000000",
  },
  warehouse: {
    name: "مخزن الجيزة",
  },
  createdBy: {
    name: "أحمد",
  },
  items: [
    {
      id: 1,
      quantity: 2,
      unitPrice: 25,
      lineTotal: 50,
      item: {
        name: "سكر فاخر",
        unit: "كجم",
      },
    },
  ],
};

test("getBulkInvoicePrintTitle returns the Arabic document title with a safe fallback", () => {
  assert.equal(getBulkInvoicePrintTitle("TAX_INVOICE"), "فاتورة ضريبية");
  assert.equal(getBulkInvoicePrintTitle("UNKNOWN"), "مستند");
});

test("BulkInvoicePrint renders the printable invoice shell and core order details", () => {
  const html = renderToStaticMarkup(
    React.createElement(BulkInvoicePrint, {
      order,
      doc: {
        type: "TAX_INVOICE",
        documentNumber: "INV-0009",
      },
    })
  );

  assert.match(html, new RegExp(INVOICE_PRINT_ROOT_CLASS));
  assert.match(html, /فاتورة ضريبية/);
  assert.match(html, /INV-0009/);
  assert.match(html, /شركة الاختبار/);
  assert.match(html, /سكر فاخر/);
  assert.match(html, /شكرًا لتعاملكم معنا/);
});
