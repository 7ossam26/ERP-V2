import React from "react";
import { formatEGP, formatNumber } from "../../utils/bulkMoney.js";

export const INVOICE_PRINT_ROOT_CLASS = "bulk-invoice-print-root";

const DOC_TITLES = {
  SALES_RECEIPT: "إيصال بيع",
  TAX_INVOICE: "فاتورة ضريبية",
  PROFORMA: "عرض سعر",
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
    .${R} {
      position: fixed;
      top: 0;
      left: 0;
      width: 74mm;
      opacity: 0;
      pointer-events: none;
      z-index: -1;
    }

    @media print {
      @page { size: 78mm auto; margin: 2mm 2mm; }

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
        width: 74mm;
        margin: 0 auto;
        opacity: 1;
        pointer-events: auto;
        z-index: auto;
        font-family: "Cairo", "Segoe UI", sans-serif;
        font-size: 10px;
        line-height: 1.35;
        direction: rtl;
        text-align: right;
        color: #000 !important;
      }

      .${R}, .${R} * {
        color: #000 !important;
        font-weight: 800 !important;
        -webkit-text-stroke: 0.2px #000;
        text-stroke: 0.2px #000;
      }

      .${R} .bi-meta {
        font-weight: 800 !important;
        font-style: italic;
      }

      .${R} .bi-row {
        display: flex;
        justify-content: space-between;
        gap: 6px;
      }

      .${R} .bi-num {
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }

      .${R} .bi-divider-dashed {
        border-top: 1.5px dashed #000;
        margin: 3px 0;
      }

      .${R} .bi-divider-solid {
        border-top: 1.5px solid #000;
        margin: 3px 0;
      }

      .${R} .bi-section-title {
        font-size: 11px;
        text-align: center;
        margin: 3px 0 2px;
      }

      .${R} .bi-header {
        text-align: center;
        margin-bottom: 4px;
      }

      .${R} .bi-header .bi-co {
        font-size: 13px;
        margin: 2px 0;
      }

      .${R} .bi-header .bi-title {
        font-size: 12px;
        margin: 2px 0;
      }

      .${R} table.bi-items {
        width: 100%;
        border-collapse: collapse;
        font-size: 10px;
      }

      .${R} table.bi-items th {
        padding: 2px 1px;
        border-bottom: 1.5px solid #000;
      }

      .${R} table.bi-items td {
        padding: 2px 1px;
        border-bottom: 1px dashed #000;
        vertical-align: top;
      }

      .${R} table.bi-items td.bi-num,
      .${R} table.bi-items th.bi-num {
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
        text-align: left;
      }

      .${R} .bi-stamp {
        display: inline-block;
        border: 2px solid #000;
        padding: 2px 10px;
        font-size: 13px;
        letter-spacing: 0.2em;
        margin: 4px auto;
      }

      .${R} img {
        max-width: 42mm;
        margin: 0 auto 4px auto;
        display: block;
        filter: grayscale(100%) contrast(180%);
        -webkit-text-stroke: 0 !important;
        text-stroke: 0 !important;
        color: unset !important;
        font-weight: unset !important;
      }
    }
  `;
}

function itemRow(line, index) {
  const quantity = formatNumber(line?.quantity);
  const unit = line?.item?.unit;
  const qtyText = unit ? `${quantity} ${unit}` : quantity;

  return h(
    "tr",
    { key: line?.id ?? index },
    [
      h(
        "td",
        { key: "name", style: { textAlign: "right" } },
        line?.item?.name || "—"
      ),
      h(
        "td",
        { key: "qty", className: "bi-num", style: { textAlign: "center" } },
        qtyText
      ),
      h(
        "td",
        { key: "sum", className: "bi-num", style: { textAlign: "left" } },
        formatEGP(line?.lineTotal)
      ),
    ]
  );
}

function infoRow(label, value, key) {
  return h(
    "div",
    { key, className: "bi-row" },
    [
      h("span", { key: "l" }, label),
      h("span", { key: "v" }, value),
    ]
  );
}

function totalsRow(label, value, key, opts = {}) {
  const style = opts.bold
    ? { fontSize: 12, marginTop: 2, paddingTop: 2, borderTop: "1.5px solid #000" }
    : undefined;
  return h(
    "div",
    { key, className: "bi-row", style },
    [
      h("span", { key: "l" }, label),
      h("span", { key: "v", className: "bi-num" }, value),
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

  const companyName = settings?.companyName?.trim() || "BerryModa";
  const companyTaxNumber = settings?.taxNumber?.trim() || "";
  const logoSrc = "/assets/berrymoda-logo.svg";

  return h(React.Fragment, null, [
    h("style", { key: "styles" }, buildBulkInvoicePrintStyles()),
    h(
      "div",
      { key: "root", className: R, dir: "rtl", lang: "ar" },
      [
        // Header
        h("div", { key: "header", className: "bi-header" }, [
          h("img", { key: "logo", src: logoSrc, alt: companyName }),
          h("div", { key: "co", className: "bi-co" }, companyName),
          h("div", { key: "title", className: "bi-title" }, title),
          docNumber
            ? h("div", { key: "doc", className: "bi-meta", style: { fontSize: 9 } }, `رقم المستند: ${docNumber}`)
            : null,
          companyTaxNumber
            ? h("div", { key: "co-tax", className: "bi-meta", style: { fontSize: 9 } }, `الر. الضريبي: ${companyTaxNumber}`)
            : null,
        ].filter(Boolean)),

        h("div", { key: "div1", className: "bi-divider-solid" }),

        // Meta
        h("div", { key: "meta", style: { fontSize: 10 } }, [
          infoRow("رقم الطلب:", orderRef, "ord"),
          infoRow("التاريخ:", issueDate, "date"),
          infoRow("المخزن:", warehouseName, "wh"),
          infoRow("أصدر بواسطة:", createdByName, "by"),
        ]),

        h("div", { key: "div2", className: "bi-divider-dashed" }),

        // Customer
        h("div", { key: "cust", style: { fontSize: 10 } }, [
          h("div", { key: "l", className: "bi-section-title" }, "العميل"),
          h("div", { key: "n", style: { fontSize: 11 } }, customerName),
          customerTaxNumber
            ? h("div", { key: "t", className: "bi-meta", style: { fontSize: 9 } }, `الر. الضريبي: ${customerTaxNumber}`)
            : null,
          phone
            ? h("div", { key: "p", style: { fontSize: 9 } }, `الهاتف: ${phone}`)
            : null,
        ].filter(Boolean)),

        h("div", { key: "div3", className: "bi-divider-solid" }),

        // Items
        h("table", { key: "items", className: "bi-items" }, [
          h("thead", { key: "head" },
            h("tr", null, [
              h("th", { key: "n", style: { textAlign: "right" } }, "الصنف"),
              h("th", { key: "q", className: "bi-num", style: { textAlign: "center" } }, "الكمية"),
              h("th", { key: "s", className: "bi-num", style: { textAlign: "left" } }, "الإجمالي"),
            ])
          ),
          h("tbody", { key: "body" }, (order?.items || []).map(itemRow)),
        ]),

        // Totals
        h("div", { key: "totals", style: { marginTop: 4, fontSize: 10 } }, [
          totalsRow("الصافي قبل الضريبة", formatEGP(order?.netAmount), "net"),
          totalsRow(`الضريبة (${taxPct}%)`, formatEGP(order?.taxAmount), "tax"),
          totalsRow("الإجمالي شامل الضريبة", formatEGP(order?.total), "grand", { bold: true }),
          totalsRow("المدفوع", formatEGP(order?.paidAmount), "paid"),
          totalsRow("المتبقي", formatEGP(order?.balanceDue), "balance"),
        ]),

        isPaid
          ? h(
              "div",
              { key: "stamp", style: { textAlign: "center", marginTop: 4 } },
              h("span", { className: "bi-stamp" }, "مدفوع")
            )
          : null,

        h("div", { key: "div4", className: "bi-divider-dashed" }),

        // Footer
        h("div", { key: "footer", style: { textAlign: "center", marginTop: 4 } }, [
          h("div", { key: "n", style: { fontSize: 10, margin: "1px 0" } }, "شكراً لتعاملكم معنا"),
          h("div", { key: "co", className: "bi-meta", style: { fontSize: 9, margin: "1px 0" } }, companyName),
        ]),
      ].filter(Boolean)
    ),
  ]);
}
