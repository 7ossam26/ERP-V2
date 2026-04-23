import React from "react";
import { Document, Page, View, Text, StyleSheet, Font } from "@react-pdf/renderer";

Font.register({
  family: "Cairo",
  fonts: [
    { src: "/fonts/Cairo-Regular.woff2" },
    { src: "/fonts/Cairo-Latin-Regular.woff2" },
  ],
});

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
  thName: { flex: 3, color: c.white, fontSize: 9, fontWeight: "bold", textAlign: "right" },
  thCell: { flex: 1, color: c.white, fontSize: 9, fontWeight: "bold", textAlign: "center" },
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
  CREDIT_NOTE: "إشعار دائن",
};

function fmtMoney(n) {
  if (n == null || n === "") return "—";
  return (
    Number(n).toLocaleString("en", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " ج.م"
  );
}

function fmtQty(n, unit) {
  const q = Number(n);
  const formatted = Number.isInteger(q) ? String(q) : q.toFixed(3).replace(/\.?0+$/, "");
  return unit ? `${formatted} ${unit}` : formatted;
}

function fmtDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("ar-EG");
}

export default function BulkInvoicePDF({ order, doc }) {
  const title = DOC_TITLES[doc?.type] || "مستند";
  const taxPct = Math.round((Number(order?.taxRate) || 0.14) * 100);
  const dateStr = fmtDate(order?.confirmedAt || order?.createdAt);

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <View style={s.titleBlock}>
            <Text style={s.docTitle}>{title}</Text>
            {doc?.documentNumber && (
              <Text style={s.docNumber}>{doc.documentNumber}</Text>
            )}
          </View>
          <View style={s.metaBlock}>
            <Text style={s.metaLine}>
              رقم الطلب: {order?.orderNumber || `#${order?.id}`}
            </Text>
            {dateStr ? <Text style={s.metaLine}>التاريخ: {dateStr}</Text> : null}
          </View>
        </View>

        {/* Info boxes */}
        <View style={s.infoRow}>
          <View style={s.infoBox}>
            <Text style={s.infoLabel}>العميل</Text>
            <Text style={s.infoValue}>{order?.customer?.companyName || "—"}</Text>
            {order?.customer?.taxNumber ? (
              <Text style={[s.infoLabel, { marginTop: 3 }]}>
                الرقم الضريبي: {order.customer.taxNumber}
              </Text>
            ) : null}
            {order?.customer?.primaryContactPhone ? (
              <Text style={s.infoLabel}>{order.customer.primaryContactPhone}</Text>
            ) : null}
          </View>
          <View style={s.infoBox}>
            <Text style={s.infoLabel}>المخزن</Text>
            <Text style={s.infoValue}>{order?.warehouse?.name || "—"}</Text>
            <Text style={[s.infoLabel, { marginTop: 6 }]}>أنشئ بواسطة</Text>
            <Text style={s.infoValue}>{order?.createdBy?.name || "—"}</Text>
          </View>
        </View>

        {/* Items table */}
        <View style={s.tableWrap}>
          <View style={s.tableHead}>
            <Text style={s.thName}>الصنف</Text>
            <Text style={s.thCell}>الكمية</Text>
            <Text style={s.thCell}>سعر الوحدة</Text>
            <Text style={s.thCell}>الإجمالي</Text>
          </View>
          {(order?.items || []).map((l, i) => (
            <View
              key={l.id ?? i}
              style={[s.tableRow, i % 2 === 1 && s.tableRowAlt]}
            >
              <Text style={s.tdName}>{l.item?.name || "—"}</Text>
              <Text style={s.tdCell}>{fmtQty(l.quantity, l.item?.unit)}</Text>
              <Text style={s.tdCell}>{fmtMoney(l.unitPrice)}</Text>
              <Text style={s.tdCell}>{fmtMoney(l.lineTotal)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={s.totalsSection}>
          <View style={s.totalsBox}>
            <View style={s.totRow}>
              <Text style={s.totLabel}>الصافي قبل الضريبة</Text>
              <Text style={s.totValue}>{fmtMoney(order?.netAmount)}</Text>
            </View>
            <View style={s.totRow}>
              <Text style={s.totLabel}>ضريبة القيمة المضافة ({taxPct}%)</Text>
              <Text style={s.totValue}>{fmtMoney(order?.taxAmount)}</Text>
            </View>
            <View style={s.totBoldRow}>
              <Text style={s.totBoldLabel}>الإجمالي شامل الضريبة</Text>
              <Text style={s.totBoldValue}>{fmtMoney(order?.total)}</Text>
            </View>
            <View style={s.totRow}>
              <Text style={s.totLabel}>المدفوع</Text>
              <Text style={s.totValue}>{fmtMoney(order?.paidAmount)}</Text>
            </View>
            <View style={s.totRow}>
              <Text style={s.totLabel}>المتبقي</Text>
              <Text style={s.totValue}>{fmtMoney(order?.balanceDue)}</Text>
            </View>
          </View>
        </View>

        <View style={s.footer}>
          <Text>شكرًا لتعاملكم معنا</Text>
        </View>
      </Page>
    </Document>
  );
}
