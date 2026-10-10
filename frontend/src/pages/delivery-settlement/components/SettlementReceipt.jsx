import React, { forwardRef } from 'react';

const R = 'settlement-receipt-80mm-root';

const PRINT_STYLES = `
  @page { size: 78mm auto; margin: 2mm 2mm; }

  body {
    margin: 0 !important;
    padding: 0 !important;
    background: #ffffff !important;
  }

  @media print {
    body * { visibility: hidden !important; }
    .${R}, .${R} * { visibility: visible !important; }
  }

  .${R} {
    width: 74mm;
    margin: 0 auto;
    font-family: "Cairo", "Tajawal", sans-serif;
    font-size: 10px;
    line-height: 1.35;
    direction: rtl;
    text-align: right;
    color: #000;
    background: #fff;
  }

  .${R}, .${R} * {
    color: #000 !important;
    font-weight: 700 !important;
  }

  .${R} .sr-meta {
    font-weight: 500 !important;
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

  .${R} .sr-sig {
    margin-top: 14px;
    text-align: center;
  }

  .${R} .sr-sig-line {
    border-bottom: 1px solid #000;
    width: 50mm;
    margin: 18px auto 4px;
  }

  .${R} img {
    max-width: 42mm;
    margin: 0 auto 4px auto;
    display: block;
    filter: grayscale(100%) contrast(180%);
  }
`;

const money = (n) => (parseFloat(n) || 0).toFixed(2);

const SettlementReceipt = forwardRef(({ data }, ref) => {
    if (!data) return null;

    const {
        driverName,
        settlementId,
        date,
        notes,
        user,
        treasury,
    } = data;

    // Back-compat: older callers passed { orders, totalAmount }.
    const cashOrders = data.cashOrders || data.orders || [];
    const cashTotal =
        data.cashTotal != null
            ? parseFloat(data.cashTotal) || 0
            : parseFloat(data.totalAmount) || 0;
    const instapayOrders = data.instapayOrders || [];
    const dues = data.dues || { total: 0, paidNow: 0 };

    const instapayTotal = instapayOrders.reduce(
        (s, o) => s + (parseFloat(o.total) || 0),
        0,
    );
    const instapaySharesTotal = instapayOrders.reduce(
        (s, o) => s + (parseFloat(o.share ?? o.deliveryDriverShare) || 0),
        0,
    );
    const duesTotal = parseFloat(dues.total) || 0;
    const duesPaidNow = parseFloat(dues.paidNow) || 0;
    const duesCarried = Math.max(0, duesTotal - duesPaidNow);
    const orderCount = cashOrders.length + instapayOrders.length;

    return (
        <>
            <style>{PRINT_STYLES}</style>
            <div ref={ref} className={R}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: 4 }}>
                    <img src="/assets/berrymoda-logo.svg" alt="Logo" />
                    <div style={{ fontSize: 12, margin: '2px 0' }}>
                        إيصال تسوية طيار
                    </div>
                    <div style={{ fontSize: 10, margin: '1px 0' }}>توريد نقدي / تحويلات أنستاباي</div>
                    <div className="sr-meta" style={{ fontSize: 9, margin: '1px 0' }}>
                        رقم العملية: #{settlementId}
                    </div>
                    <div className="sr-meta" style={{ fontSize: 9, margin: '1px 0' }}>
                        {new Date(date).toLocaleString('ar-EG')}
                    </div>
                </div>

                <div className="sr-divider-solid" />

                {/* Meta */}
                <div style={{ fontSize: 10 }}>
                    <div className="sr-row">
                        <span>الطيار:</span>
                        <span>{driverName}</span>
                    </div>
                    <div className="sr-row">
                        <span>المستلم:</span>
                        <span>{user?.name || 'مدير النظام'}</span>
                    </div>
                    {treasury && (
                        <div className="sr-row">
                            <span>الخزنة:</span>
                            <span>{treasury.name}</span>
                        </div>
                    )}
                    <div className="sr-row">
                        <span>عدد الطلبات:</span>
                        <span>{orderCount}</span>
                    </div>
                </div>

                {/* Section A — cash deposit */}
                {cashOrders.length > 0 && (
                    <>
                        <div className="sr-divider-solid" />
                        <div className="sr-section-title">توريد نقدي</div>
                        <table>
                            <thead>
                                <tr>
                                    <th>الطلب</th>
                                    <th className="sr-num">الإجمالي</th>
                                    <th className="sr-num">حصة</th>
                                    <th className="sr-num">صافي</th>
                                </tr>
                            </thead>
                            <tbody>
                                {cashOrders.map((order, index) => {
                                    const total = parseFloat(order.total) || 0;
                                    const share = parseFloat(order.deliveryDriverShare) || 0;
                                    const netDebt = total - share;
                                    return (
                                        <tr key={index}>
                                            <td>#{order.saleNumber}</td>
                                            <td className="sr-num">{total.toFixed(2)}</td>
                                            <td className="sr-num">-{share.toFixed(2)}</td>
                                            <td className="sr-num">{netDebt.toFixed(2)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colSpan={3} style={{ borderTop: '1.5px solid #000', fontSize: 11 }}>
                                        إجمالي التوريد النقدي
                                    </td>
                                    <td className="sr-num" style={{ borderTop: '1.5px solid #000', fontSize: 12 }}>
                                        {cashTotal.toFixed(2)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                        <div className="sr-meta" style={{ fontSize: 9, textAlign: 'center', marginTop: 2 }}>
                            صافي الدين = إجمالي الطلب − حصة الطيار · إلى خزنة الفرع
                        </div>
                    </>
                )}

                {/* Section B — InstaPay conversions */}
                {instapayOrders.length > 0 && (
                    <>
                        <div className="sr-divider-solid" />
                        <div className="sr-section-title">تحويلات أنستاباي</div>
                        <table>
                            <thead>
                                <tr>
                                    <th>الطلب</th>
                                    <th className="sr-num">→ أنستاباي</th>
                                    <th className="sr-num">حصة الطيار</th>
                                </tr>
                            </thead>
                            <tbody>
                                {instapayOrders.map((order, index) => (
                                    <tr key={index}>
                                        <td>#{order.saleNumber}</td>
                                        <td className="sr-num">{money(order.total)}</td>
                                        <td className="sr-num">{money(order.share ?? order.deliveryDriverShare)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td style={{ borderTop: '1.5px solid #000', fontSize: 11 }}>
                                        إجمالي محوّل لأنستاباي
                                    </td>
                                    <td className="sr-num" style={{ borderTop: '1.5px solid #000', fontSize: 12 }}>
                                        {instapayTotal.toFixed(2)}
                                    </td>
                                    <td className="sr-num" style={{ borderTop: '1.5px solid #000', fontSize: 11 }}>
                                        {instapaySharesTotal.toFixed(2)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                        <div className="sr-meta" style={{ fontSize: 9, textAlign: 'center', marginTop: 2 }}>
                            كامل المبلغ إلى خزنة أنستاباي · الحصة مستحقة للطيار
                        </div>
                    </>
                )}

                {/* Section C — rider dues */}
                {duesTotal > 0 && (
                    <>
                        <div className="sr-divider-solid" />
                        <div className="sr-section-title">مستحق الطيار (حصص أونلاين)</div>
                        <div style={{ fontSize: 10 }}>
                            <div className="sr-row">
                                <span>إجمالي المستحق:</span>
                                <span className="sr-num">{duesTotal.toFixed(2)}</span>
                            </div>
                            {duesPaidNow > 0 && (
                                <div className="sr-row">
                                    <span>مدفوع نقداً الآن:</span>
                                    <span className="sr-num">-{duesPaidNow.toFixed(2)}</span>
                                </div>
                            )}
                            <div className="sr-row" style={{ borderTop: '1px dashed #000', marginTop: 2, paddingTop: 2 }}>
                                <span>مُرحّل للتسوية القادمة:</span>
                                <span className="sr-num">{duesCarried.toFixed(2)}</span>
                            </div>
                        </div>
                    </>
                )}

                {notes && (
                    <>
                        <div className="sr-divider-dashed" />
                        <div style={{ fontSize: 10 }}>
                            <div style={{ marginBottom: 2 }}>ملاحظات:</div>
                            <div className="sr-meta" style={{ fontSize: 9 }}>{notes}</div>
                        </div>
                    </>
                )}

                <div className="sr-divider-solid" />

                {/* Signatures — stacked, not side-by-side */}
                <div className="sr-sig">
                    <div style={{ fontSize: 10 }}>توقيع المستلم (الكاشير)</div>
                    <div className="sr-sig-line" />
                    <div className="sr-meta" style={{ fontSize: 9 }}>{user?.name || ''}</div>
                </div>
                <div className="sr-sig">
                    <div style={{ fontSize: 10 }}>توقيع الطيار (المسلم)</div>
                    <div className="sr-sig-line" />
                    <div className="sr-meta" style={{ fontSize: 9 }}>{driverName}</div>
                </div>

                <div className="sr-divider-dashed" />

                <div style={{ textAlign: 'center', fontSize: 9, marginTop: 4 }}>
                    <div className="sr-meta">إيصال رسمي صادر من نظام ERP</div>
                    <div className="sr-meta">
                        طُبع في {new Date().toLocaleString('ar-EG')}
                    </div>
                </div>
            </div>
        </>
    );
});

SettlementReceipt.displayName = 'SettlementReceipt';

export default SettlementReceipt;
