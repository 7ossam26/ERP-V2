/**
 * @deprecated Bulk order printing now uses `BulkInvoicePrint` plus the browser print
 * engine to preserve Arabic rendering. Keep this for rollback only.
 */
import React from "react";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";

const c = {
  primary: "#7B3F2D",
  text: "#1a1a1a",
  muted: "#6b7280",
  border: "#e5e7eb",
  headerBg: "#f9f5f3",
  accent: "#fef3ee",
  white: "#ffffff",
};

const s = StyleSheet.create({
  page: {
    fontFamily: "Cairo",
    fontSize: 10,
    color: c.text,
    paddingTop: 34,
    paddingBottom: 50,
    paddingHorizontal: 34,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: c.primary,
  },
  titleBlock: { flex: 1 },
  docTitle: { fontSize: 20, fontWeight: "bold", color: c.primary },
  docNumber: { fontSize: 9, color: c.muted, marginTop: 3 },
  metaBlock: { alignItems: "flex-end" },
  metaLine: { fontSize: 9, color: c.muted, marginBottom: 2 },
  infoRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  infoBox: {
    flex: 1,
    backgroundColor: c.headerBg,
    padding: 8,
    borderRadius: 4,
  },
  infoLabel: { fontSize: 8, color: c.muted, marginBottom: 2 },
  infoValue: { fontSize: 10 },
  tableWrap: { marginBottom: 14 },
  tableHead: {
    flexDirection: "row",
    backgroundColor: c.primary,
    borderRadius: 3,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  thName: {
    flex: 3,
    color: c.white,
    fontSize: 9,
    fontWeight: "bold",
    textAlign: "right",
  },
  thCell: {
    flex: 1,
    color: c.white,
    fontSize: 9,
    fontWeight: "bold",
    textAlign: "center",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: c.border,
  },
  tableRowAlt: { backgroundColor: c.accent },
  tdName: { flex: 3, fontSize: 9, textAlign: "right" },
  tdCell: { flex: 1, fontSize: 9, textAlign: "center" },
  totalsSection: { alignItems: "flex-end", marginBottom: 20 },
  totalsBox: {
    width: "48%",
    borderTopWidth: 1.5,
    borderTopColor: c.border,
    paddingTop: 8,
  },
  totRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  totLabel: { fontSize: 9, color: c.muted },
  totValue: { fontSize: 9 },
  totBoldRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 5,
    marginTop: 2,
    borderTopWidth: 1,
    borderTopColor: c.primary,
    marginBottom: 6,
  },
  totBoldLabel: { fontSize: 10, fontWeight: "bold", color: c.primary },
  totBoldValue: { fontSize: 10, fontWeight: "bold", color: c.primary },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 34,
    right: 34,
    textAlign: "center",
    fontSize: 8,
    color: c.muted,
    borderTopWidth: 0.5,
    borderTopColor: c.border,
    paddingTop: 6,
  },
});

const DOC_TITLES = {
  SALES_RECEIPT: "إيصال بيع",
  TAX_INVOICE: "فاتورة ضريبية",
  PROFORMA: "عرض سعر",
};

export function formatBulkInvoiceMoney(value) {
  if (value == null || value === "") return "—";

  return (
    Number(value).toLocaleString("en", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " ج.م"
  );
}

export function formatBulkInvoiceQty(value, unit) {
  const quantity = Number(value);
  const formatted = Number.isInteger(quantity)
    ? String(quantity)
    : quantity.toFixed(3).replace(/\.?0+$/, "");

  return unit ? `${formatted} ${unit}` : formatted;
}

export function formatBulkInvoiceDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("ar-EG");
}

const h = React.createElement;

function createText(style, children, key) {
  const props = { style };
  if (key !== undefined) props.key = key;
  return h(Text, props, children);
}

function createView(style, children, key) {
  const props = { style };
  if (key !== undefined) props.key = key;
  return h(View, props, children);
}

function compact(children) {
  return children.filter(Boolean);
}

function createItemsTable(orderItems) {
  return createView(
    s.tableWrap,
    [
      createView(
        s.tableHead,
        [
          createText(s.thName, "الصنف", "name"),
          createText(s.thCell, "الكمية", "qty"),
          createText(s.thCell, "سعر الوحدة", "unitPrice"),
          createText(s.thCell, "الإجمالي", "lineTotal"),
        ],
        "head"
      ),
      ...(orderItems || []).map((line, index) =>
        createView(
          index % 2 === 1 ? [s.tableRow, s.tableRowAlt] : s.tableRow,
          [
            createText(s.tdName, line.item?.name || "—", "name"),
            createText(
              s.tdCell,
              formatBulkInvoiceQty(line.quantity, line.item?.unit),
              "qty"
            ),
            createText(s.tdCell, formatBulkInvoiceMoney(line.unitPrice), "unitPrice"),
            createText(s.tdCell, formatBulkInvoiceMoney(line.lineTotal), "lineTotal"),
          ],
          line.id ?? index
        )
      ),
    ]
  );
}

function createTotalsSection(order, taxPct) {
  return createView(
    s.totalsSection,
    createView(
      s.totalsBox,
      [
        createView(
          s.totRow,
          [
            createText(s.totLabel, "الصافي قبل الضريبة", "label"),
            createText(s.totValue, formatBulkInvoiceMoney(order?.netAmount), "value"),
          ],
          "net"
        ),
        createView(
          s.totRow,
          [
            createText(s.totLabel, `ضريبة القيمة المضافة (${taxPct}%)`, "label"),
            createText(s.totValue, formatBulkInvoiceMoney(order?.taxAmount), "value"),
          ],
          "tax"
        ),
        createView(
          s.totBoldRow,
          [
            createText(s.totBoldLabel, "الإجمالي شامل الضريبة", "label"),
            createText(s.totBoldValue, formatBulkInvoiceMoney(order?.total), "value"),
          ],
          "total"
        ),
        createView(
          s.totRow,
          [
            createText(s.totLabel, "المدفوع", "label"),
            createText(s.totValue, formatBulkInvoiceMoney(order?.paidAmount), "value"),
          ],
          "paid"
        ),
        createView(
          s.totRow,
          [
            createText(s.totLabel, "المتبقي", "label"),
            createText(s.totValue, formatBulkInvoiceMoney(order?.balanceDue), "value"),
          ],
          "balance"
        ),
      ]
    )
  );
}

export default function BulkInvoicePDF({ order, doc }) {
  const title = DOC_TITLES[doc?.type] || "مستند";
  const taxPct = Math.round((Number(order?.taxRate) || 0.14) * 100);
  const dateStr = formatBulkInvoiceDate(order?.confirmedAt || order?.createdAt);

  return h(
    Document,
    null,
    h(
      Page,
      { size: "A4", style: s.page },
      createView(
        s.header,
        [
          createView(
            s.titleBlock,
            compact([
              createText(s.docTitle, title, "title"),
              doc?.documentNumber
                ? createText(s.docNumber, doc.documentNumber, "docNumber")
                : null,
            ]),
            "titleBlock"
          ),
          createView(
            s.metaBlock,
            compact([
              createText(
                s.metaLine,
                `رقم الطلب: ${order?.orderNumber || `#${order?.id}`}`,
                "orderNumber"
              ),
              dateStr ? createText(s.metaLine, `التاريخ: ${dateStr}`, "date") : null,
            ]),
            "metaBlock"
          ),
        ]
      ),
      createView(
        s.infoRow,
        [
          createView(
            s.infoBox,
            compact([
              createText(s.infoLabel, "العميل", "label"),
              createText(
                s.infoValue,
                order?.customer?.companyName || "—",
                "companyName"
              ),
              order?.customer?.taxNumber
                ? createText(
                    [s.infoLabel, { marginTop: 3 }],
                    `الرقم الضريبي: ${order.customer.taxNumber}`,
                    "taxNumber"
                  )
                : null,
              order?.customer?.primaryContactPhone
                ? createText(
                    s.infoLabel,
                    order.customer.primaryContactPhone,
                    "phone"
                  )
                : null,
            ]),
            "customerInfo"
          ),
          createView(
            s.infoBox,
            compact([
              createText(s.infoLabel, "المخزن", "warehouseLabel"),
              createText(s.infoValue, order?.warehouse?.name || "—", "warehouseName"),
              createText(
                [s.infoLabel, { marginTop: 6 }],
                "أُنشئ بواسطة",
                "createdByLabel"
              ),
              createText(s.infoValue, order?.createdBy?.name || "—", "createdByName"),
            ]),
            "warehouseInfo"
          ),
        ]
      ),
      createItemsTable(order?.items),
      createTotalsSection(order, taxPct),
      createView(
        s.footer,
        createText(undefined, "شكراً لتعاملكم معنا"),
        "footer"
      )
    )
  );
}
