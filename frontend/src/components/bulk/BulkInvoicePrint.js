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
      font-weight: 400 800;
      font-display: swap;
    }

    .${INVOICE_PRINT_ROOT_CLASS} {
      position: fixed;
      top: 0;
      left: 0;
      width: 210mm;
      opacity: 0;
      pointer-events: none;
      z-index: -1;
    }

    .${INVOICE_PRINT_ROOT_CLASS} .invoice-print-sheet {
      font-family: "ERP Invoice Cairo", "Cairo", "Tajawal", sans-serif;
      direction: rtl;
    }

    .${INVOICE_PRINT_ROOT_CLASS} .invoice-print-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }

    .${INVOICE_PRINT_ROOT_CLASS} .invoice-print-table th,
    .${INVOICE_PRINT_ROOT_CLASS} .invoice-print-table td {
      border-bottom: 1px solid #e2e8f0;
      padding: 0.75rem;
      vertical-align: top;
    }

    .${INVOICE_PRINT_ROOT_CLASS} .invoice-print-table th {
      color: #475569;
      font-size: 0.8rem;
      font-weight: 700;
      background: #f8fafc;
    }

    .${INVOICE_PRINT_ROOT_CLASS} .invoice-print-table tbody tr:last-child td {
      border-bottom: 0;
    }

    @media print {
      @page {
        size: A4;
        margin: 14mm;
      }

      body {
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
      }

      body * {
        visibility: hidden !important;
      }

      .${INVOICE_PRINT_ROOT_CLASS},
      .${INVOICE_PRINT_ROOT_CLASS} * {
        visibility: visible !important;
      }

      .${INVOICE_PRINT_ROOT_CLASS} {
        position: absolute;
        inset: 0;
        width: auto;
        opacity: 1;
        pointer-events: auto;
        z-index: auto;
      }

      .${INVOICE_PRINT_ROOT_CLASS} .invoice-print-sheet {
        max-width: none !important;
        margin: 0 !important;
        border: 0 !important;
        border-radius: 0 !important;
        box-shadow: none !important;
        background: #ffffff !important;
        color: #000000 !important;
      }

      .${INVOICE_PRINT_ROOT_CLASS} .invoice-print-card,
      .${INVOICE_PRINT_ROOT_CLASS} .invoice-print-table-wrap,
      .${INVOICE_PRINT_ROOT_CLASS} .invoice-print-summary {
        break-inside: avoid;
        page-break-inside: avoid;
      }

      .${INVOICE_PRINT_ROOT_CLASS} thead {
        display: table-header-group;
      }

      .${INVOICE_PRINT_ROOT_CLASS} tr {
        break-inside: avoid;
        page-break-inside: avoid;
      }

      .${INVOICE_PRINT_ROOT_CLASS} .invoice-print-muted {
        color: #475569 !important;
      }
    }
  `;
}

function compact(children) {
  return children.filter(Boolean);
}

function createCard(title, children, key) {
  return h(
    "section",
    {
      key,
      className:
        "invoice-print-card rounded-2xl border border-slate-200 bg-slate-50/80 p-4",
    },
    [
      h(
        "div",
        {
          key: "title",
          className: "invoice-print-muted mb-2 text-xs font-semibold tracking-wide",
        },
        title
      ),
      h("div", { key: "content", className: "space-y-1 text-sm text-slate-900" }, children),
    ]
  );
}

function createSummaryRow(label, value, key, bold = false) {
  return h(
    "div",
    {
      key,
      className: `flex items-center justify-between gap-4 border-b border-slate-200 py-2 text-sm ${
        bold ? "font-bold text-slate-900" : "text-slate-700"
      }`,
    },
    [
      h("span", { key: "label" }, label),
      h("span", { key: "value", className: "text-left" }, value),
    ]
  );
}

function createTableCell(tagName, className, content, key) {
  return h(tagName, { key, className }, content);
}

function createItemsTable(items) {
  return h(
    "section",
    {
      className:
        "invoice-print-table-wrap overflow-hidden rounded-2xl border border-slate-200 bg-white",
    },
    [
      h(
        "div",
        {
          key: "header",
          className: "border-b border-slate-200 bg-slate-50 px-4 py-3",
        },
        h("h2", { className: "text-sm font-bold text-slate-900" }, "الأصناف")
      ),
      h(
        "table",
        { key: "table", className: "invoice-print-table text-sm text-slate-900" },
        [
          h("thead", { key: "head" }, [
            h("tr", { key: "row" }, [
              createTableCell("th", "w-[40%] text-right", "الصنف", "name"),
              createTableCell("th", "w-[20%] text-right", "الكمية", "qty"),
              createTableCell("th", "w-[20%] text-right", "سعر الوحدة", "unitPrice"),
              createTableCell("th", "w-[20%] text-right", "الإجمالي", "lineTotal"),
            ]),
          ]),
          h(
            "tbody",
            { key: "body" },
            (items || []).map((line, index) =>
              h(
                "tr",
                {
                  key: line.id ?? index,
                  className: index % 2 === 1 ? "bg-slate-50/60" : undefined,
                },
                [
                  createTableCell(
                    "td",
                    "text-right font-medium",
                    line.item?.name || "—",
                    "name"
                  ),
                  createTableCell(
                    "td",
                    "text-right",
                    `${formatNumber(line.quantity)} ${line.item?.unit || ""}`.trim(),
                    "qty"
                  ),
                  createTableCell(
                    "td",
                    "whitespace-nowrap text-right",
                    formatEGP(line.unitPrice),
                    "unitPrice"
                  ),
                  createTableCell(
                    "td",
                    "whitespace-nowrap text-right",
                    formatEGP(line.lineTotal),
                    "lineTotal"
                  ),
                ]
              )
            )
          ),
        ]
      ),
    ]
  );
}

export default function BulkInvoicePrint({ order, doc }) {
  const title = getBulkInvoicePrintTitle(doc?.type);
  const issueDate = formatBulkInvoicePrintDate(order?.confirmedAt || order?.createdAt);
  const taxRate = Math.round((Number(order?.taxRate) || 0.14) * 100);

  return h(React.Fragment, null, [
    h("style", { key: "styles" }, buildBulkInvoicePrintStyles()),
    h(
      "div",
      {
        key: "root",
        className: INVOICE_PRINT_ROOT_CLASS,
        dir: "rtl",
        lang: "ar",
      },
      h(
        "article",
        {
          className:
            "invoice-print-sheet mx-auto max-w-5xl rounded-[28px] border border-slate-200 bg-white p-8 text-slate-900 shadow-2xl sm:p-10",
        },
        compact([
          h(
            "header",
            {
              key: "header",
              className:
                "mb-6 flex flex-col gap-4 border-b-2 border-slate-900 pb-5 sm:flex-row sm:items-start sm:justify-between",
            },
            [
              h("div", { key: "title-block", className: "space-y-2" }, [
                h(
                  "div",
                  {
                    key: "eyebrow",
                    className:
                      "text-xs font-semibold uppercase tracking-[0.35em] text-slate-500",
                  },
                  "Bulk POS"
                ),
                h(
                  "h1",
                  { key: "title", className: "text-3xl font-black text-slate-900" },
                  title
                ),
                doc?.documentNumber
                  ? h(
                      "div",
                      {
                        key: "doc-number",
                        className: "invoice-print-muted text-sm font-medium",
                      },
                      `رقم المستند: ${doc.documentNumber}`
                    )
                  : null,
              ]),
              h("div", { key: "meta", className: "space-y-2 text-sm text-slate-700" }, [
                h(
                  "div",
                  {
                    key: "order-number",
                    className: "font-semibold text-slate-900",
                  },
                  `رقم الطلب: ${order?.orderNumber || `#${order?.id}`}`
                ),
                h(
                  "div",
                  { key: "issue-date", className: "invoice-print-muted" },
                  `التاريخ: ${issueDate}`
                ),
              ]),
            ]
          ),
          h(
            "section",
            {
              key: "info-grid",
              className: "mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3",
            },
            [
              createCard(
                "العميل",
                compact([
                  h(
                    "div",
                    { key: "company", className: "font-bold text-slate-900" },
                    order?.customer?.companyName || "—"
                  ),
                  order?.customer?.taxNumber
                    ? h(
                        "div",
                        { key: "tax", className: "invoice-print-muted text-xs" },
                        `الرقم الضريبي: ${order.customer.taxNumber}`
                      )
                    : null,
                  order?.customer?.primaryContactPhone
                    ? h(
                        "div",
                        { key: "phone", className: "invoice-print-muted text-xs" },
                        `الهاتف: ${order.customer.primaryContactPhone}`
                      )
                    : null,
                ]),
                "customer"
              ),
              createCard(
                "المخزن",
                [h("div", { key: "warehouse" }, order?.warehouse?.name || "—")],
                "warehouse"
              ),
              createCard(
                "أُنشئ بواسطة",
                [h("div", { key: "createdBy" }, order?.createdBy?.name || "—")],
                "createdBy"
              ),
            ]
          ),
          h("div", { key: "items", className: "mb-6" }, createItemsTable(order?.items)),
          h(
            "section",
            {
              key: "summary-wrap",
              className:
                "invoice-print-summary ms-auto max-w-xl rounded-2xl border border-slate-200 bg-slate-50/70 p-5",
            },
            [
              h(
                "h2",
                { key: "summary-title", className: "mb-3 text-sm font-bold text-slate-900" },
                "الإجماليات"
              ),
              createSummaryRow("الصافي قبل الضريبة", formatEGP(order?.netAmount), "net"),
              createSummaryRow(`الضريبة (${taxRate}%)`, formatEGP(order?.taxAmount), "tax"),
              createSummaryRow(
                "الإجمالي شامل الضريبة",
                formatEGP(order?.total),
                "total",
                true
              ),
              createSummaryRow("المدفوع", formatEGP(order?.paidAmount), "paid"),
              createSummaryRow("المتبقي", formatEGP(order?.balanceDue), "balance", true),
            ]
          ),
          h(
            "footer",
            {
              key: "footer",
              className:
                "mt-8 border-t border-slate-200 pt-4 text-center text-xs text-slate-500",
            },
            "شكرًا لتعاملكم معنا"
          ),
        ])
      )
    ),
  ]);
}
