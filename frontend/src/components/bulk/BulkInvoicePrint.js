import React from "react";
import { formatEGP, formatNumber } from "../../utils/bulkMoney.js";

export const INVOICE_PRINT_ROOT_CLASS = "bulk-invoice-print-root";

const DOC_TITLES = {
  SALES_RECEIPT: "إيصال بيع",
  TAX_INVOICE: "فاتورة ضريبية",
  PROFORMA: "عرض سعر",
  CREDIT_NOTE: "إشعار دائن",
};

const h = React.createElement;
const R = INVOICE_PRINT_ROOT_CLASS;

export function getBulkInvoicePrintTitle(type) {
  return DOC_TITLES[type] || "مستند";
}

export function formatBulkInvoicePrintDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("ar-EG");
}

function buildBulkInvoicePrintStyles() {
  return `
    @font-face {
      font-family: "ERP Invoice Cairo";
      src: local("Cairo"), url("/fonts/Cairo-Regular.woff2") format("woff2");
      font-style: normal;
      font-weight: 400 900;
      font-display: swap;
    }

    .${R} {
      position: fixed;
      top: 0;
      left: 0;
      width: 210mm;
      opacity: 0;
      pointer-events: none;
      z-index: -1;
    }

    @media print {
      @page {
        size: A4;
        margin: 16mm 14mm 18mm 14mm;
      }

      body {
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
      }

      body * { visibility: hidden !important; }
      .${R}, .${R} * { visibility: visible !important; }

      .${R} {
        position: absolute;
        inset: 0;
        width: auto;
        opacity: 1;
        pointer-events: auto;
        z-index: auto;
      }

      .${R} .sheet {
        font-family: "ERP Invoice Cairo", "Cairo", "Segoe UI", sans-serif;
        direction: rtl;
        color: #0c0706;
        background: #ffffff;
        padding: 0;
        margin: 0;
        font-feature-settings: "kern", "liga", "calt";
      }

      .${R} .eyebrow {
        font-size: 8.5px;
        font-weight: 700;
        letter-spacing: 0.32em;
        text-transform: uppercase;
        color: #6b4423;
      }

      .${R} .display {
        font-weight: 900;
        font-size: 34px;
        line-height: 1.05;
        color: #0c0706;
        letter-spacing: -0.01em;
        margin: 6px 0 4px;
      }

      .${R} .caption {
        font-size: 10px;
        color: #6b4423;
        letter-spacing: 0.02em;
      }

      .${R} .label {
        font-size: 8.5px;
        font-weight: 700;
        letter-spacing: 0.28em;
        text-transform: uppercase;
        color: #6b4423;
        margin-bottom: 4px;
      }

      .${R} .num {
        font-variant-numeric: tabular-nums;
        direction: ltr;
        unicode-bidi: isolate;
      }

      .${R} .masthead {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 24px;
        padding-bottom: 14px;
        border-bottom: 3px solid #0c0706;
      }

      .${R} .masthead-accent {
        height: 1px;
        background: #0c0706;
        margin-top: 3px;
        margin-bottom: 20px;
      }

      .${R} .masthead-left {
        flex: 1;
      }

      .${R} .masthead-right {
        display: flex;
        gap: 14px;
        align-items: flex-start;
      }

      .${R} .brand-logo {
        width: 56px;
        height: 56px;
        object-fit: contain;
        flex-shrink: 0;
        image-rendering: -webkit-optimize-contrast;
      }

      .${R} .meta {
        text-align: start;
        min-width: 120px;
      }

      .${R} .meta-value {
        font-size: 12px;
        font-weight: 600;
        color: #0c0706;
        margin-bottom: 8px;
      }

      .${R} .info-band {
        display: grid;
        grid-template-columns: 1.4fr 1fr 1fr;
        gap: 0;
        border-bottom: 1px solid rgba(12, 7, 6, 0.18);
        padding: 0 0 18px;
        margin-bottom: 20px;
      }

      .${R} .info-cell {
        padding: 0 18px;
        border-inline-start: 1px solid rgba(12, 7, 6, 0.18);
      }

      .${R} .info-cell:first-child {
        border-inline-start: 0;
        padding-inline-start: 0;
      }

      .${R} .info-cell:last-child {
        padding-inline-end: 0;
      }

      .${R} .info-cell .primary {
        font-size: 13px;
        font-weight: 700;
        color: #0c0706;
        line-height: 1.3;
      }

      .${R} .info-cell .secondary {
        font-size: 10px;
        color: #6b4423;
        margin-top: 2px;
      }

      .${R} .items {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 22px;
      }

      .${R} .items thead th {
        font-size: 8.5px;
        font-weight: 700;
        letter-spacing: 0.25em;
        text-transform: uppercase;
        color: #6b4423;
        padding: 10px 6px;
        border-bottom: 2px solid #0c0706;
      }

      .${R} .items thead th.col-name { text-align: right; width: 44%; }
      .${R} .items thead th.col-qty  { text-align: right; width: 18%; }
      .${R} .items thead th.col-rate { text-align: right; width: 19%; }
      .${R} .items thead th.col-sum  { text-align: right; width: 19%; }

      .${R} .items tbody td {
        padding: 10px 6px;
        border-bottom: 1px solid rgba(12, 7, 6, 0.10);
        font-size: 11px;
        vertical-align: top;
      }

      .${R} .items tbody tr:last-child td {
        border-bottom: 2px solid #0c0706;
      }

      .${R} .items .item-name {
        font-weight: 600;
        color: #0c0706;
      }

      .${R} .items .item-unit {
        color: #6b4423;
        font-size: 9.5px;
        margin-inline-start: 4px;
      }

      .${R} .totals-wrap {
        display: flex;
        justify-content: flex-start;
        position: relative;
        margin-bottom: 26px;
      }

      .${R} .totals {
        width: 58%;
        min-width: 260px;
      }

      .${R} .totals .row {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        padding: 6px 0;
        font-size: 11px;
        color: #2a1a12;
      }

      .${R} .totals .row.muted {
        color: #6b4423;
      }

      .${R} .totals .grand {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        padding: 11px 0 8px;
        border-top: 2px solid #0c0706;
        border-bottom: 0.5px solid #0c0706;
        margin-top: 6px;
        margin-bottom: 4px;
      }

      .${R} .totals .grand-label {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.28em;
        text-transform: uppercase;
        color: #0c0706;
      }

      .${R} .totals .grand-value {
        font-size: 22px;
        font-weight: 900;
        color: #7B2D1F;
        font-variant-numeric: tabular-nums;
        direction: ltr;
      }

      .${R} .stamp {
        position: absolute;
        top: -6px;
        inset-inline-end: 12mm;
        transform: rotate(-14deg);
        border: 3px double #7B2D1F;
        color: #7B2D1F;
        padding: 7px 22px;
        font-size: 20px;
        font-weight: 900;
        letter-spacing: 0.2em;
        opacity: 0.82;
        pointer-events: none;
        background: rgba(255, 255, 255, 0.4);
      }

      .${R} .stamp::after {
        content: "";
        position: absolute;
        inset: 2px;
        border: 1px solid rgba(123, 45, 31, 0.6);
      }

      .${R} .footer {
        margin-top: 10px;
        text-align: center;
      }

      .${R} .perforation {
        height: 12px;
        background-image: radial-gradient(
          circle at center,
          rgba(12, 7, 6, 0.45) 1.3px,
          transparent 1.5px
        );
        background-size: 9px 12px;
        background-repeat: repeat-x;
        background-position: 0 50%;
        margin-bottom: 12px;
      }

      .${R} .footer-note {
        font-size: 10px;
        color: #6b4423;
        letter-spacing: 0.08em;
        margin-bottom: 6px;
      }

      .${R} .footer-mark {
        font-size: 8.5px;
        font-weight: 700;
        letter-spacing: 0.4em;
        text-transform: uppercase;
        color: #0c0706;
      }

      .${R} thead { display: table-header-group; }
      .${R} tr,
      .${R} .info-band,
      .${R} .totals-wrap,
      .${R} .footer {
        page-break-inside: avoid;
        break-inside: avoid;
      }
    }
  `;
}

function itemRow(line, index) {
  const quantity = `${formatNumber(line?.quantity)}`;
  const unit = line?.item?.unit;

  return h(
    "tr",
    { key: line?.id ?? index },
    [
      h(
        "td",
        { key: "name", className: "item-name", style: { textAlign: "right" } },
        line?.item?.name || "—"
      ),
      h(
        "td",
        { key: "qty", style: { textAlign: "right" } },
        [
          h("span", { key: "n", className: "num" }, quantity),
          unit ? h("span", { key: "u", className: "item-unit" }, unit) : null,
        ].filter(Boolean)
      ),
      h(
        "td",
        { key: "rate", className: "num", style: { textAlign: "right" } },
        formatEGP(line?.unitPrice)
      ),
      h(
        "td",
        { key: "sum", className: "num", style: { textAlign: "right" } },
        formatEGP(line?.lineTotal)
      ),
    ]
  );
}

function totalsRow(label, value, key, muted = false) {
  return h(
    "div",
    { key, className: `row${muted ? " muted" : ""}` },
    [
      h("span", { key: "l" }, label),
      h("span", { key: "v", className: "num" }, value),
    ]
  );
}

export default function BulkInvoicePrint({ order, doc, settings }) {
  const title = getBulkInvoicePrintTitle(doc?.type);
  const issueDate = formatBulkInvoicePrintDate(order?.confirmedAt || order?.createdAt);
  const settingsTaxPct = settings?.taxRate != null ? Math.round(Number(settings.taxRate)) : 14;
  const taxPct = order?.taxRate != null ? Math.round(Number(order.taxRate) * 100) : settingsTaxPct;
  const orderRef = order?.orderNumber || `#${order?.id ?? ""}`;
  const docNumber = doc?.documentNumber;
  const balanceDue = Number(order?.balanceDue) || 0;
  const total = Number(order?.total) || 0;
  const isPaid = total > 0 && balanceDue <= 0.005;

  const customerName = order?.customer?.companyName || "—";
  const customerTaxNumber = order?.customer?.taxNumber;
  const phone = order?.customer?.primaryContactPhone;
  const warehouseName = order?.warehouse?.name || "—";
  const createdByName = order?.createdBy?.name || "—";

  const companyName = settings?.companyName?.trim() || "Elghonemy · Coffee";
  const companyTaxNumber = settings?.taxNumber?.trim() || "";
  const logoSrc = "/assets/logo.png";

  return h(React.Fragment, null, [
    h("style", { key: "styles" }, buildBulkInvoicePrintStyles()),
    h(
      "div",
      { key: "root", className: R, dir: "rtl", lang: "ar" },
      h("article", { className: "sheet" }, [
        h("header", { key: "masthead", className: "masthead" }, [
          h("div", { key: "left", className: "masthead-left" }, [
            h("div", { key: "eyebrow", className: "eyebrow" }, companyName),
            h("h1", { key: "title", className: "display" }, title),
            docNumber
              ? h("div", { key: "doc", className: "caption" }, `رقم المستند · ${docNumber}`)
              : null,
            companyTaxNumber
              ? h("div", { key: "co-tax", className: "caption" }, `الرقم الضريبي للبائع · ${companyTaxNumber}`)
              : null,
          ].filter(Boolean)),
          h("div", { key: "right", className: "masthead-right" }, [
            h("div", { key: "meta", className: "meta" }, [
              h("div", { key: "l1", className: "label" }, "رقم الطلب"),
              h("div", { key: "v1", className: "meta-value num" }, orderRef),
              h("div", { key: "l2", className: "label" }, "التاريخ"),
              h("div", { key: "v2", className: "meta-value" }, issueDate),
            ]),
            h("img", {
              key: "logo",
              className: "brand-logo",
              src: logoSrc,
              alt: companyName,
            }),
          ]),
        ]),

        h("div", { key: "accent", className: "masthead-accent" }),

        h("section", { key: "info", className: "info-band" }, [
          h("div", { key: "customer", className: "info-cell" }, [
            h("div", { key: "l", className: "label" }, "العميل"),
            h("div", { key: "name", className: "primary" }, customerName),
            customerTaxNumber
              ? h("div", { key: "tax", className: "secondary" }, `ر. ضريبي · ${customerTaxNumber}`)
              : null,
            phone
              ? h("div", { key: "phone", className: "secondary num" }, phone)
              : null,
          ].filter(Boolean)),
          h("div", { key: "warehouse", className: "info-cell" }, [
            h("div", { key: "l", className: "label" }, "المخزن"),
            h("div", { key: "name", className: "primary" }, warehouseName),
          ]),
          h("div", { key: "createdBy", className: "info-cell" }, [
            h("div", { key: "l", className: "label" }, "أصدر بواسطة"),
            h("div", { key: "name", className: "primary" }, createdByName),
          ]),
        ]),

        h("table", { key: "items", className: "items" }, [
          h("thead", { key: "head" },
            h("tr", null, [
              h("th", { key: "n", className: "col-name" }, "الصنف"),
              h("th", { key: "q", className: "col-qty" }, "الكمية"),
              h("th", { key: "r", className: "col-rate" }, "سعر الوحدة"),
              h("th", { key: "s", className: "col-sum" }, "الإجمالي"),
            ])
          ),
          h("tbody", { key: "body" }, (order?.items || []).map(itemRow)),
        ]),

        h("section", { key: "totals", className: "totals-wrap" }, [
          isPaid ? h("div", { key: "stamp", className: "stamp" }, "مدفوع") : null,
          h("div", { key: "t", className: "totals" }, [
            totalsRow("الصافي قبل الضريبة", formatEGP(order?.netAmount), "net", true),
            totalsRow(`الضريبة · ${taxPct}%`, formatEGP(order?.taxAmount), "tax", true),
            h("div", { key: "grand", className: "grand" }, [
              h("span", { key: "l", className: "grand-label" }, "الإجمالي شامل الضريبة"),
              h("span", { key: "v", className: "grand-value" }, formatEGP(order?.total)),
            ]),
            totalsRow("المدفوع", formatEGP(order?.paidAmount), "paid"),
            totalsRow("المتبقي", formatEGP(order?.balanceDue), "balance"),
          ]),
        ].filter(Boolean)),

        h("footer", { key: "footer", className: "footer" }, [
          h("div", { key: "perf", className: "perforation" }),
          h("div", { key: "note", className: "footer-note" }, "شكرًا لتعاملكم معنا"),
          h("div", { key: "mark", className: "footer-mark" }, companyName),
        ]),
      ])
    ),
  ]);
}
