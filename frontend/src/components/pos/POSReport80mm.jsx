import React from "react";

export const POS_REPORT_ROOT_CLASS = "pos-report-80mm-root";

const R = POS_REPORT_ROOT_CLASS;

const REASON_LABELS = {
  STAFF_DISCOUNT: "خصم موظف",
  LOYAL_CUSTOMER: "عميل مميز",
  DAMAGED_ITEM: "منتج تالف",
  MANAGER_COMP: "مجاملة إدارة",
  PROMO: "عرض ترويجي",
  OTHER: "أخرى",
};

const fmt = (n) =>
  Number(n || 0).toLocaleString("ar-EG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtDate = (iso) => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("ar-EG");
  } catch {
    return "";
  }
};

const fmtClock = (iso) => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString("ar-EG", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
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
    @page { size: 78mm auto; margin: 2mm 2mm; }
    body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
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

    .${R} .pr-meta {
      font-weight: 800 !important;
      font-style: italic;
    }

    .${R} .pr-row {
      display: flex;
      justify-content: space-between;
      gap: 6px;
    }

    .${R} .pr-num {
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }

    .${R} .pr-divider-dashed {
      border-top: 1.5px dashed #000;
      margin: 3px 0;
    }

    .${R} .pr-divider-solid {
      border-top: 1.5px solid #000;
      margin: 3px 0;
    }

    .${R} .pr-section-title {
      font-size: 11px;
      text-align: center;
      margin: 3px 0 2px;
    }

    .${R} img {
      max-width: 42mm;
      margin: 0 auto 4px auto;
      display: block;
      filter: grayscale(100%) contrast(180%);
    }
  }
`;

const POSReport80mm = ({ report, settings = {} }) => {
  if (!report) return null;

  const companyName =
    settings.companyName || report.branchName || "Elghonemy ERP";

  const takeaway = report.takeaway || { count: 0, total: 0 };
  const delivery = report.delivery || { count: 0, total: 0 };
  const returned = report.returned || { count: 0, total: 0 };
  const discounts = report.discounts || { count: 0, total: 0, byReason: [] };
  const expenseBreakdown = report.expenseBreakdown || { count: 0, total: 0 };
  const expenses = Array.isArray(report.expenses) ? report.expenses : [];
  const deliveryDetails = Array.isArray(report.deliveryDetails)
    ? report.deliveryDetails
    : [];

  const expectedVisa = Number(
    report.expectedVisa ?? report.visaPayments ?? 0,
  );
  const expectedInstapay = Number(
    report.expectedInstapay ?? report.instapayPayments ?? 0,
  );

  const shortage = Number(report.shortage || 0);
  const shortageLabel =
    shortage > 0 ? "زيادة" : shortage < 0 ? "عجز" : "متطابق";

  const startLabel = report.startTime
    ? `${fmtClock(report.startTime)} ${fmtDate(report.startTime)}`
    : "—";
  const endLabel = report.endTime
    ? `${fmtClock(report.endTime)} ${fmtDate(report.endTime)}`
    : "مفتوحة";

  return (
    <div className={R}>
      <style>{PRINT_STYLES}</style>

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 4 }}>
        <img src="/assets/logo.png" alt="Logo" />
        <h2 style={{ fontSize: 13, margin: "2px 0" }}>{companyName}</h2>
        <p style={{ fontSize: 11, margin: "1px 0" }}>
          تقرير نهاية وردية #{report.shiftId ?? ""}
        </p>
        {report.branchName && (
          <p className="pr-meta" style={{ fontSize: 9, margin: "1px 0" }}>
            {report.branchName} — {report.employeeName || ""} —{" "}
            {report.shiftName || ""}
          </p>
        )}
      </div>

      <div className="pr-divider-solid" />

      {/* Times */}
      <div style={{ fontSize: 10 }}>
        <div className="pr-row">
          <span>من:</span>
          <span className="pr-num">{startLabel}</span>
        </div>
        <div className="pr-row">
          <span>إلى:</span>
          <span className="pr-num">{endLabel}</span>
        </div>
      </div>

      <div className="pr-divider-dashed" />

      {/* Sales breakdown */}
      <div className="pr-section-title">تفاصيل المبيعات</div>
      <div style={{ fontSize: 10 }}>
        <div className="pr-row">
          <span>تيك أواى ({takeaway.count})</span>
          <span className="pr-num">{fmt(takeaway.total)}</span>
        </div>
        <div className="pr-row">
          <span>دليفرى ({delivery.count})</span>
          <span className="pr-num">{fmt(delivery.total)}</span>
        </div>
        <div className="pr-row">
          <span>مرتجع ({returned.count})</span>
          <span className="pr-num">
            {returned.total > 0 ? "-" : ""}
            {fmt(returned.total)}
          </span>
        </div>
        <div
          className="pr-row"
          style={{
            fontSize: 11,
            marginTop: 2,
            paddingTop: 2,
            borderTop: "1.5px solid #000",
          }}>
          <span>صافي المبيعات</span>
          <span className="pr-num">{fmt(report.netSales)}</span>
        </div>
      </div>

      {/* Discounts */}
      {discounts.count > 0 && (
        <>
          <div className="pr-divider-dashed" />
          <div className="pr-section-title">الخصومات ({discounts.count})</div>
          <div style={{ fontSize: 10 }}>
            <div className="pr-row">
              <span>إجمالي الخصومات</span>
              <span className="pr-num">-{fmt(discounts.total)}</span>
            </div>
            {(discounts.byReason || []).map((r) => (
              <div
                key={r.code}
                className="pr-row pr-meta"
                style={{ fontSize: 9, paddingRight: 8 }}>
                <span>
                  • {REASON_LABELS[r.code] || r.code} ({r.count})
                </span>
                <span className="pr-num">-{fmt(r.total)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="pr-divider-dashed" />

      {/* Cash movements */}
      <div className="pr-section-title">حركة النقدية</div>
      <div style={{ fontSize: 10 }}>
        <div className="pr-row">
          <span>نقدي داخل</span>
          <span className="pr-num">{fmt(report.cashReceived)}</span>
        </div>
        <div className="pr-row">
          <span>نقدي خارج ({expenseBreakdown.count})</span>
          <span className="pr-num">-{fmt(expenseBreakdown.total)}</span>
        </div>
      </div>

      <div className="pr-divider-solid" />

      {/* Totals */}
      <div className="pr-section-title">الإجمالي</div>
      <div style={{ fontSize: 10 }}>
        <div className="pr-row" style={{ fontSize: 12 }}>
          <span>إجمالي المبيعات</span>
          <span className="pr-num">{fmt(report.totalSales)}</span>
        </div>
        <div className="pr-row">
          <span>فيزا (موثوقة)</span>
          <span className="pr-num">{fmt(expectedVisa)}</span>
        </div>
        <div className="pr-row">
          <span>انستا باي (موثوقة)</span>
          <span className="pr-num">{fmt(expectedInstapay)}</span>
        </div>
        <div
          className="pr-row"
          style={{
            fontSize: 12,
            marginTop: 2,
            paddingTop: 2,
            borderTop: "1.5px solid #000",
          }}>
          <span>المبلغ في الدرج</span>
          <span className="pr-num">{fmt(report.drawerAmount)}</span>
        </div>
      </div>

      <div className="pr-divider-solid" />

      {/* Cash settlement */}
      <div className="pr-section-title">تسوية النقدية</div>
      <div style={{ fontSize: 10 }}>
        <div className="pr-row">
          <span>رصيد البداية</span>
          <span className="pr-num">{fmt(report.startCash)}</span>
        </div>
        <div className="pr-row">
          <span>+ مبيعات نقدي</span>
          <span className="pr-num">+{fmt(report.cashReceived)}</span>
        </div>
        <div className="pr-row">
          <span>− مصروفات نقدي</span>
          <span className="pr-num">-{fmt(expenseBreakdown.total)}</span>
        </div>
        <div
          className="pr-row"
          style={{
            fontSize: 12,
            marginTop: 2,
            paddingTop: 2,
            borderTop: "1px dashed #000",
          }}>
          <span>= المتوقع في الدرج</span>
          <span className="pr-num">{fmt(report.systemExpectedCash)}</span>
        </div>
        <div className="pr-row" style={{ marginTop: 2 }}>
          <span>العد الفعلي</span>
          <span className="pr-num">{fmt(report.actualCash)}</span>
        </div>
        <div className="pr-row" style={{ fontSize: 12, marginTop: 2 }}>
          <span>{shortageLabel}</span>
          <span className="pr-num">{fmt(Math.abs(shortage))}</span>
        </div>
      </div>

      {expenses.length > 0 && (
        <>
          <div className="pr-divider-dashed" />
          <div className="pr-section-title">
            تفاصيل المصروفات ({expenses.length})
          </div>
          <div style={{ fontSize: 10 }}>
            {expenses.map((exp, i) => (
              <div key={i} className="pr-row">
                <span>
                  {exp.description}{" "}
                  <span className="pr-meta" style={{ fontSize: 9 }}>
                    ({exp.paymentMethod === "CASH" ? "نقدي" : "بطاقة"})
                  </span>
                </span>
                <span className="pr-num">-{fmt(exp.amount)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {deliveryDetails.length > 0 && (
        <>
          <div className="pr-divider-dashed" />
          <div className="pr-section-title">تفاصيل التوصيل</div>
          <div style={{ fontSize: 10 }}>
            {deliveryDetails.map((d, i) => (
              <div key={i}>
                <div className="pr-row">
                  <span>{d.name}</span>
                  <span className="pr-num">{fmt(d.total)}</span>
                </div>
                <div
                  className="pr-meta"
                  style={{ fontSize: 9, paddingRight: 8 }}>
                  • {d.paidCount} مسلّم
                  {d.pendingCount > 0 ? ` — ${d.pendingCount} معلق` : ""}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="pr-divider-dashed" />

      {/* Footer */}
      <div style={{ textAlign: "center", fontSize: 10, marginTop: 4 }}>
        <p style={{ margin: "1px 0" }}>{companyName}</p>
        <p className="pr-meta" style={{ fontSize: 9, margin: "1px 0" }}>
          نهاية التقرير
        </p>
      </div>
    </div>
  );
};

export default POSReport80mm;
