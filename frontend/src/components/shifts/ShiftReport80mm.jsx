import React from "react";

export const SHIFT_REPORT_ROOT_CLASS = "shift-report-80mm-root";

const R = SHIFT_REPORT_ROOT_CLASS;

const paymentLabelAr = (m) =>
  m === "CASH" ? "نقدي" : m === "VISA" ? "فيزا" : "انستاباي";

const fmt = (n) => Number(n || 0).toFixed(2);

const fmtTime = (iso) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString("ar-EG", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
};

const fmtDateTime = (iso) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("ar-EG");
  } catch {
    return "—";
  }
};

const PRINT_STYLES = `
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
    @page {
      size: 78mm auto;
      margin: 2mm 2mm;
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
      width: 74mm;
      margin: 0 auto;
      opacity: 1;
      pointer-events: auto;
      z-index: auto;
      font-family: "Cairo", sans-serif;
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

    .${R} .sr-meta {
      font-weight: 800 !important;
      font-style: italic;
    }

    .${R} .sr-row {
      display: flex;
      justify-content: space-between;
      gap: 6px;
    }

    .${R} .sr-num {
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }

    .${R} .sr-divider-dashed {
      border-top: 1.5px dashed #000;
      margin: 3px 0;
    }

    .${R} .sr-divider-solid {
      border-top: 1.5px solid #000;
      margin: 3px 0;
    }

    .${R} .sr-section-title {
      font-size: 11px;
      text-align: center;
      margin: 3px 0 2px;
    }

    .${R} table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
    }

    .${R} th {
      padding: 2px 1px;
      border-bottom: 1.5px solid #000;
      text-align: right;
    }

    .${R} td {
      padding: 2px 1px;
      border-bottom: 1px dashed #000;
      vertical-align: top;
    }

    .${R} td.sr-num,
    .${R} th.sr-num {
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      text-align: left;
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

const ShiftReport80mm = ({ report, settings = {} }) => {
  if (!report) return null;

  const companyName = settings.companyName || report.branchName || "Elghonemy ERP";

  const expectedVisa = Number(report.expectedVisa ?? report.visaPayments ?? 0);
  const expectedInstapay = Number(
    report.expectedInstapay ?? report.instapayPayments ?? 0,
  );
  const codDelivered = Number(
    report.cashBreakdown?.codDeliveredThisShift || 0,
  );

  const orders = Array.isArray(report.orders) ? report.orders : [];
  const expenses = Array.isArray(report.expenses) ? report.expenses : [];
  const advances = Array.isArray(report.advances) ? report.advances : [];
  const totalAdvances = Number(report.totalAdvances || 0);
  // Cash expenses only — matches what systemExpectedCash actually subtracts.
  const cashExpenseTotal = Number(report.expenseBreakdown?.total || 0);
  const pilotSettlementDifference = Number(report.pilotSettlementDifference || 0);

  const shortageLabel =
    report.shortage > 0
      ? "زيادة"
      : report.shortage < 0
        ? "عجز"
        : "متطابق";

  return (
    <div className={R}>
      <style>{PRINT_STYLES}</style>

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 4 }}>
        <img src="/assets/logo.png" alt="Logo" />
        <h2 style={{ fontSize: 14, margin: "2px 0" }}>{companyName}</h2>
        <p style={{ fontSize: 11, margin: "1px 0" }}>
          تقرير وردية #{report.shiftId ?? ""}
        </p>
        <p className="sr-meta" style={{ fontSize: 9, margin: "1px 0" }}>
          طُبع في {fmtDateTime(new Date().toISOString())}
        </p>
      </div>

      <div className="sr-divider-solid" />

      {/* Meta */}
      <div style={{ fontSize: 10 }}>
        <div className="sr-row">
          <span>الموظف:</span>
          <span>{report.employeeName || "—"}</span>
        </div>
        <div className="sr-row">
          <span>الفرع:</span>
          <span>{report.branchName || "—"}</span>
        </div>
        <div className="sr-row">
          <span>نوع الوردية:</span>
          <span>{report.shiftName || "—"}</span>
        </div>
        <div className="sr-row">
          <span>بداية الوردية:</span>
          <span className="sr-num">{fmtDateTime(report.startTime)}</span>
        </div>
        <div className="sr-row">
          <span>نهاية الوردية:</span>
          <span className="sr-num">
            {report.endTime ? fmtDateTime(report.endTime) : "مفتوحة"}
          </span>
        </div>
      </div>

      <div className="sr-divider-dashed" />

      {/* Money summary */}
      <div className="sr-section-title">ملخص الحركة</div>
      <div style={{ fontSize: 10 }}>
        <div className="sr-row">
          <span>إجمالي المبيعات</span>
          <span className="sr-num">{fmt(report.totalSales)} ج.م</span>
        </div>
        <div className="sr-row">
          <span>مبيعات كاش</span>
          <span className="sr-num">{fmt(report.cashReceived)} ج.م</span>
        </div>
        <div className="sr-row">
          <span>مبيعات فيزا</span>
          <span className="sr-num">{fmt(expectedVisa)} ج.م</span>
        </div>
        <div className="sr-row">
          <span>مبيعات انستاباي</span>
          <span className="sr-num">{fmt(expectedInstapay)} ج.م</span>
        </div>
        <div className="sr-row">
          <span>المصروفات</span>
          <span className="sr-num">{fmt(report.totalExpenses)} ج.م</span>
        </div>
        {totalAdvances > 0 && (
          <div className="sr-row">
            <span>سلف الموظفين</span>
            <span className="sr-num">{fmt(totalAdvances)} ج.م</span>
          </div>
        )}
      </div>

      <div className="sr-divider-solid" />

      {/* Cash settlement */}
      <div className="sr-section-title">تسوية العهدة</div>
      <div style={{ fontSize: 10 }}>
        <div className="sr-row">
          <span>رصيد البداية</span>
          <span className="sr-num">{fmt(report.startCash)} ج.م</span>
        </div>
        <div className="sr-row">
          <span>+ مبيعات الكاش</span>
          <span className="sr-num">{fmt(report.cashReceived)} ج.م</span>
        </div>
        {codDelivered > 0 && (
          <div
            className="sr-row sr-meta"
            style={{ paddingRight: 8, fontSize: 9 }}>
            <span>• تسويات الدليفري</span>
            <span className="sr-num">{fmt(codDelivered)} ج.م</span>
          </div>
        )}
        <div className="sr-row">
          <span>− المصروفات (كاش)</span>
          <span className="sr-num">{fmt(cashExpenseTotal)} ج.م</span>
        </div>
        {totalAdvances > 0 && (
          <div className="sr-row">
            <span>− سلف الموظفين (كاش)</span>
            <span className="sr-num">{fmt(totalAdvances)} ج.م</span>
          </div>
        )}
        {pilotSettlementDifference > 0 && (
          <div className="sr-row">
            <span>− فرق تسوية الطيارين (كاش)</span>
            <span className="sr-num">{fmt(pilotSettlementDifference)} ج.م</span>
          </div>
        )}
        <div
          className="sr-row"
          style={{ fontSize: 12, marginTop: 2, paddingTop: 2, borderTop: "1px dashed #000" }}>
          <span>= المتوقع في الدرج</span>
          <span className="sr-num">{fmt(report.systemExpectedCash)} ج.م</span>
        </div>
        <div className="sr-row" style={{ marginTop: 2 }}>
          <span>العد الفعلي</span>
          <span className="sr-num">{fmt(report.actualCash)} ج.م</span>
        </div>
        <div
          className="sr-row"
          style={{ fontSize: 12, marginTop: 2 }}>
          <span>{shortageLabel} (كاش)</span>
          <span className="sr-num">{fmt(report.shortage)} ج.م</span>
        </div>
      </div>

      <div className="sr-divider-dashed" />

      {/* Digital reconciliation */}
      <div className="sr-meta" style={{ fontSize: 9, textAlign: "center" }}>
        مبيعات رقمية — موثوقة تلقائياً (لا تحتاج عد)
      </div>
      <div style={{ fontSize: 10, marginTop: 2 }}>
        <div className="sr-row">
          <span>فيزا</span>
          <span className="sr-num">{fmt(expectedVisa)} ج.م</span>
        </div>
        <div className="sr-row">
          <span>انستاباي</span>
          <span className="sr-num">{fmt(expectedInstapay)} ج.م</span>
        </div>
      </div>

      <div className="sr-divider-solid" />

      {/* Order history */}
      <div className="sr-section-title">سجل الطلبات ({orders.length})</div>
      {orders.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th>الفاتورة</th>
              <th>الدفع</th>
              <th className="sr-num">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td>{o.saleNumber || `#${o.id}`}</td>
                <td>{paymentLabelAr(o.paymentMethod)}</td>
                <td className="sr-num">{fmt(o.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div
          className="sr-meta"
          style={{ textAlign: "center", fontSize: 9, padding: "4px 0" }}>
          لا توجد طلبات في هذه الوردية
        </div>
      )}

      {expenses.length > 0 && (
        <>
          <div className="sr-divider-solid" />
          <div className="sr-section-title">
            تفاصيل المصروفات ({expenses.length})
          </div>
          <table>
            <thead>
              <tr>
                <th>الوصف</th>
                <th>الدفع</th>
                <th className="sr-num">المبلغ</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e, i) => (
                <tr key={i}>
                  <td>{e.description || "—"}</td>
                  <td>{paymentLabelAr(e.paymentMethod)}</td>
                  <td className="sr-num">{fmt(e.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2} style={{ borderTop: "1.5px solid #000" }}>
                  الإجمالي
                </td>
                <td
                  className="sr-num"
                  style={{ borderTop: "1.5px solid #000" }}>
                  {fmt(report.totalExpenses)}
                </td>
              </tr>
            </tfoot>
          </table>
        </>
      )}

      {advances.length > 0 && (
        <>
          <div className="sr-divider-solid" />
          <div className="sr-section-title">
            تفاصيل سلف الموظفين ({advances.length})
          </div>
          <table>
            <thead>
              <tr>
                <th>الموظف</th>
                <th className="sr-num">المبلغ</th>
              </tr>
            </thead>
            <tbody>
              {advances.map((a, i) => (
                <tr key={i}>
                  <td>{a.employeeName || "—"}</td>
                  <td className="sr-num">{fmt(a.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td style={{ borderTop: "1.5px solid #000" }}>الإجمالي</td>
                <td
                  className="sr-num"
                  style={{ borderTop: "1.5px solid #000" }}>
                  {fmt(totalAdvances)}
                </td>
              </tr>
            </tfoot>
          </table>
        </>
      )}

      <div className="sr-divider-dashed" />

      {/* Footer */}
      <div style={{ textAlign: "center", fontSize: 10, marginTop: 4 }}>
        <p style={{ margin: "1px 0" }}>{companyName}</p>
        <p className="sr-meta" style={{ fontSize: 9, margin: "1px 0" }}>
          نهاية التقرير
        </p>
      </div>
    </div>
  );
};

export default ShiftReport80mm;
