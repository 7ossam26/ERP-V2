import React, { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { bulkService } from "../../services/bulkService";
import { settingsService } from "../../services/settingsService";
import { formatEGP, formatNumber } from "../../utils/bulkMoney";
import BulkPaymentModal from "../../components/bulk/BulkPaymentModal";
import BulkReturnModal from "../../components/bulk/BulkReturnModal";
import BulkConfirmOrderModal from "../../components/bulk/BulkConfirmOrderModal";
import StatusChip from "../../components/bulk/StatusChip";
import { generateAndOpenOrderPdf } from "../../utils/pdfGenerate";
import { usePrompt } from "../../hooks/usePrompt";

const ERROR_LABELS = {
  INSUFFICIENT_STOCK: "الكمية غير متاحة في المخزون",
  CREDIT_LIMIT_EXCEEDED: "تم تجاوز حد الائتمان",
};

const METHOD_LABELS = {
  CASH: "نقدي",
  BANK_TRANSFER: "تحويل بنكي",
  CHEQUE: "شيك",
  CREDIT: "آجل",
};

const DOC_TYPE_LABELS = {
  SALES_RECEIPT: "إيصال بيع",
  TAX_INVOICE: "فاتورة ضريبية",
  PROFORMA: "عرض سعر",
  CREDIT_NOTE: "إشعار دائن",
};

// Legal status transitions: maps current status → [{label, icon, tone?, action}]
// Actions are resolved at render time by passing the opener functions.
function buildStatusActions({ canConfirm, canCancel, canPay, canReturn, openConfirm, openCancel, openPay, openReturn }) {
  const actions = [];
  if (canConfirm) actions.push({ label: "تأكيد الطلب",  icon: "check_circle", action: openConfirm });
  if (canPay)     actions.push({ label: "سجّل دفعة",    icon: "payments",     action: openPay });
  if (canReturn)  actions.push({ label: "إرجاع",         icon: "undo",         action: openReturn });
  if (canCancel)  actions.push({ label: "إلغاء الطلب",  icon: "cancel",       tone: "danger", action: openCancel });
  return actions;
}

export default function BulkOrderDetailPage() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [settingsTaxRate, setSettingsTaxRate] = useState(0.14);
  const statusMenuRef = useRef(null);

  const [prompt, PromptDialog] = usePrompt();

  // Close status dropdown when clicking outside
  useEffect(() => {
    const handle = (e) => {
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target)) {
        setShowStatusMenu(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [ord, cfg] = await Promise.all([bulkService.getOrder(id), settingsService.get()]);
      setOrder(ord);
      if (cfg?.taxRate != null) setSettingsTaxRate(Number(cfg.taxRate) / 100);
    } catch (err) {
      toast.error(err?.data?.error || "تعذر تحميل الطلب");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const onConfirm = async (confirmBody) => {
    if (!order) return;
    setWorking(true);
    try {
      const updated = await bulkService.confirmOrder(order.id, confirmBody);
      toast.success(`تم التأكيد ${updated.orderNumber || ""}`);
      setOrder(updated);
      setShowConfirmModal(false);
    } finally {
      setWorking(false);
    }
  };

  const onCancel = async () => {
    if (!order) return;
    const reason = await prompt({
      title: "إلغاء الطلب",
      label: "سبب الإلغاء",
      placeholder: "اكتب سبب الإلغاء...",
    });
    if (!reason) return;
    setWorking(true);
    try {
      const updated = await bulkService.cancelOrder(order.id, reason);
      toast.success("تم الإلغاء");
      setOrder(updated);
    } catch (err) {
      toast.error(ERROR_LABELS[err?.data?.error] || err?.data?.error || "تعذر الإلغاء");
    } finally {
      setWorking(false);
    }
  };

  const onVoidPayment = async (paymentId) => {
    const reason = await prompt({
      title: "إلغاء الدفعة",
      label: "سبب الإلغاء",
      placeholder: "اكتب سبب الإلغاء...",
    });
    if (!reason) return;
    try {
      const result = await bulkService.voidPayment(paymentId, reason);
      toast.success("تم إلغاء الدفعة");
      setOrder((prev) => ({
        ...prev,
        paidAmount: result.order.paidAmount,
        balanceDue: result.order.balanceDue,
        status: result.order.status,
        payments: (prev.payments || []).map((p) =>
          p.id === paymentId ? { ...p, voidedAt: new Date().toISOString(), voidReason: reason } : p
        ),
      }));
    } catch (err) {
      toast.error(ERROR_LABELS[err?.data?.error] || err?.data?.error || "تعذر الإلغاء");
    }
  };

  const openPdf = async (doc) => {
    if (!order) return;
    setGenerating(true);
    try {
      await generateAndOpenOrderPdf(order, doc || null);
    } catch {
      toast.error("تعذر إنشاء PDF — تحقق من الاتصال بالإنترنت");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <div className="p-6 text-center text-text-light/60 dark:text-text-dark/60">جارٍ التحميل...</div>;
  if (!order) return <div className="p-6 text-center text-text-light/60 dark:text-text-dark/60">الطلب غير موجود.</div>;

  const canConfirm = order.status === "DRAFT" || order.status === "QUOTED";
  const canCancel  = order.status === "DRAFT" || order.status === "QUOTED";
  const canPay     = order.status === "CONFIRMED" || order.status === "PARTIALLY_PAID";
  const canReturn  = ["CONFIRMED", "PARTIALLY_PAID", "PAID"].includes(order.status);
  const receipt    = order.documents?.find((d) => d.type === "SALES_RECEIPT");
  const taxInvoice = order.documents?.find((d) => d.type === "TAX_INVOICE");
  const printDoc   = taxInvoice || receipt;

  const closeMenu = () => setShowStatusMenu(false);
  const statusActions = buildStatusActions({
    canConfirm, canCancel, canPay, canReturn,
    openConfirm: () => { closeMenu(); setShowConfirmModal(true); },
    openCancel:  () => { closeMenu(); onCancel(); },
    openPay:     () => { closeMenu(); setShowPayModal(true); },
    openReturn:  () => { closeMenu(); setShowReturnModal(true); },
  });

  return (
    <div className="p-4 sm:p-6" dir="rtl">
      {PromptDialog}

      {showPayModal && (
        <BulkPaymentModal
          order={order}
          onSuccess={() => { setShowPayModal(false); load(); }}
          onClose={() => setShowPayModal(false)}
        />
      )}
      {showReturnModal && (
        <BulkReturnModal
          order={order}
          onSuccess={(updated) => { setShowReturnModal(false); setOrder(updated); }}
          onClose={() => setShowReturnModal(false)}
        />
      )}
      {showConfirmModal && (
        <BulkConfirmOrderModal
          totalAmount={Number(order.total)}
          customerName={order.customer?.companyName || ""}
          orderRef={order.orderNumber || `#${order.id}`}
          onConfirm={onConfirm}
          onClose={() => setShowConfirmModal(false)}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-5 no-print flex-wrap gap-3">
        <div>
          <Link to="/bulk/orders" className="text-primary hover:text-primary-hover text-sm transition-colors">
            ← الرجوع للقائمة
          </Link>
          <h1 className="text-2xl font-bold text-text-light dark:text-text-dark mt-1">
            {order.orderNumber || `طلب #${order.id}`}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <StatusChip status={order.status} />
            <span className="text-sm text-text-light/60 dark:text-text-dark/60">
              {new Date(order.createdAt).toLocaleString("ar-EG")}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* تغيير الحالة dropdown — only shown when there are legal transitions */}
          {statusActions.length > 0 && (
            <div className="relative" ref={statusMenuRef}>
              <button
                disabled={working}
                onClick={() => setShowStatusMenu((v) => !v)}
                className="flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-xl text-sm disabled:opacity-60 transition-colors duration-200"
              >
                <span className="material-icons-round text-sm">sync_alt</span>
                تغيير الحالة
                <span className="material-icons-round text-sm">
                  {showStatusMenu ? "expand_less" : "expand_more"}
                </span>
              </button>
              {showStatusMenu && (
                <div className="absolute start-0 mt-1 w-44 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl shadow-lg z-20 overflow-hidden">
                  {statusActions.map((a) => (
                    <button
                      key={a.label}
                      onClick={a.action}
                      className={`flex items-center gap-2 w-full px-3 py-2.5 text-sm text-right hover:bg-accent/30 dark:hover:bg-primary/10 transition-colors ${
                        a.tone === "danger"
                          ? "text-red-600 dark:text-red-400"
                          : "text-text-light dark:text-text-dark"
                      }`}
                    >
                      <span className="material-icons-round text-sm">{a.icon}</span>
                      {a.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {printDoc && (
            <button
              disabled={generating}
              onClick={() => openPdf(printDoc)}
              className="bg-primary/90 hover:bg-primary text-white px-4 py-2 rounded-xl text-sm disabled:opacity-60 transition-colors duration-200"
            >
              {generating ? "جارٍ الإنشاء…" : "PDF طباعة / تحميل"}
            </button>
          )}
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 no-print">
        <InfoCard title="العميل">
          <div className="font-semibold text-text-light dark:text-text-dark">{order.customer?.companyName}</div>
          <div className="text-xs text-text-light/50 dark:text-text-dark/50">
            {order.customer?.taxNumber ? `رقم ضريبي ${order.customer.taxNumber}` : "بدون رقم ضريبي"}
          </div>
        </InfoCard>
        <InfoCard title="المخزن">
          <span className="text-text-light dark:text-text-dark">{order.warehouse?.name}</span>
        </InfoCard>
        <InfoCard title="أنشأ بواسطة">
          <span className="text-text-light dark:text-text-dark">{order.createdBy?.name}</span>
        </InfoCard>
      </div>

      {/* Lines */}
      <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl shadow-soft dark:shadow-soft-dark p-4 mb-4 no-print">
        <h3 className="font-bold mb-2 text-text-light dark:text-text-dark">السطور</h3>
        <table className="w-full text-sm">
          <thead className="bg-accent/30 dark:bg-primary/10">
            <tr>
              <th className="text-right p-2 text-text-light/80 dark:text-text-dark/70 font-semibold">الصنف</th>
              <th className="text-right p-2 text-text-light/80 dark:text-text-dark/70 font-semibold">الكمية</th>
              <th className="text-right p-2 text-text-light/80 dark:text-text-dark/70 font-semibold">السعر</th>
              <th className="text-right p-2 text-text-light/80 dark:text-text-dark/70 font-semibold">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {order.items?.map((l) => (
              <tr key={l.id} className="border-t border-border-light dark:border-border-dark hover:bg-accent/20 dark:hover:bg-primary/10">
                <td className="p-2 text-text-light dark:text-text-dark">{l.item?.name}</td>
                <td className="p-2 ltr-numbers text-text-light dark:text-text-dark">{formatNumber(l.quantity)} {l.item?.unit || ""}</td>
                <td className="p-2 text-text-light dark:text-text-dark">{formatEGP(l.unitPrice)}</td>
                <td className="p-2 text-text-light dark:text-text-dark">{formatEGP(l.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="bg-accent/20 dark:bg-primary/10 border border-border-light dark:border-border-dark rounded-xl p-4 mb-4 no-print">
        <h3 className="font-bold mb-2 text-text-light dark:text-text-dark">الإجماليات</h3>
        <div className="space-y-1 text-sm">
          <Row label="الصافي قبل الضريبة" value={formatEGP(order.netAmount)} />
          <Row label={`الضريبة (${((Number(order.taxRate) || settingsTaxRate) * 100).toFixed(0)}%)`} value={formatEGP(order.taxAmount)} />
          <Row label="الإجمالي شامل الضريبة" value={formatEGP(order.total)} bold />
          <Row label="المدفوع" value={formatEGP(order.paidAmount)} />
          <Row label="المتبقي" value={formatEGP(order.balanceDue)} bold />
        </div>
      </div>

      {/* Payments */}
      {order.payments?.length > 0 && (
        <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl shadow-soft dark:shadow-soft-dark p-4 mb-4 no-print">
          <h3 className="font-bold mb-2 text-text-light dark:text-text-dark">الدفعات</h3>
          <table className="w-full text-sm">
            <thead className="bg-accent/30 dark:bg-primary/10">
              <tr>
                <th className="text-right p-2 text-text-light/80 dark:text-text-dark/70 font-semibold">التاريخ</th>
                <th className="text-right p-2 text-text-light/80 dark:text-text-dark/70 font-semibold">الطريقة</th>
                <th className="text-right p-2 text-text-light/80 dark:text-text-dark/70 font-semibold">المبلغ</th>
                <th className="text-right p-2 text-text-light/80 dark:text-text-dark/70 font-semibold">الخزينة</th>
                <th className="text-right p-2 text-text-light/80 dark:text-text-dark/70 font-semibold">الحالة</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {order.payments.map((p) => (
                <tr
                  key={p.id}
                  className={`border-t border-border-light dark:border-border-dark hover:bg-accent/20 dark:hover:bg-primary/10 ${p.voidedAt ? "opacity-50 line-through" : ""}`}
                >
                  <td className="p-2 ltr-numbers text-text-light/70 dark:text-text-dark/70">
                    {new Date(p.receivedAt).toLocaleDateString("ar-EG")}
                  </td>
                  <td className="p-2 text-text-light dark:text-text-dark">{METHOD_LABELS[p.method] || p.method}</td>
                  <td className="p-2 font-medium text-text-light dark:text-text-dark">{formatEGP(p.amount)}</td>
                  <td className="p-2 text-text-light dark:text-text-dark">{p.treasury?.name || "—"}</td>
                  <td className="p-2">
                    {p.voidedAt
                      ? <span className="text-red-600 text-xs">ملغاة</span>
                      : <span className="text-emerald-700 text-xs">مسجلة</span>
                    }
                  </td>
                  <td className="p-2">
                    {!p.voidedAt && (
                      <button
                        onClick={() => onVoidPayment(p.id)}
                        className="text-red-600 hover:text-red-700 text-xs transition-colors"
                      >
                        إلغاء
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Documents */}
      {order.documents?.length > 0 && (
        <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl shadow-soft dark:shadow-soft-dark p-4 no-print">
          <h3 className="font-bold mb-3 text-text-light dark:text-text-dark">المستندات</h3>
          <div className="space-y-2">
            {order.documents.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between bg-accent/20 dark:bg-primary/10 rounded-lg px-3 py-2"
              >
                <div>
                  <span className="font-medium text-sm text-text-light dark:text-text-dark">
                    {DOC_TYPE_LABELS[d.type] || d.type}
                  </span>
                  <span className="mx-2 text-text-light/40 dark:text-text-dark/40 text-xs">·</span>
                  <span className="text-sm text-primary dark:text-accent">{d.documentNumber}</span>
                  <span className="ms-2 text-xs text-text-light/40 dark:text-text-dark/40">
                    {new Date(d.issuedAt).toLocaleDateString("ar-EG")}
                  </span>
                </div>
                <button
                  disabled={generating}
                  onClick={() => openPdf(d)}
                  className="flex items-center gap-1 text-xs text-primary hover:text-primary-hover disabled:opacity-50 transition-colors"
                >
                  <span className="material-icons-round text-sm">picture_as_pdf</span>
                  عرض / تحميل
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function InfoCard({ title, children }) {
  return (
    <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl shadow-soft dark:shadow-soft-dark p-3">
      <div className="text-xs text-text-light/50 dark:text-text-dark/50 mb-1">{title}</div>
      <div>{children}</div>
    </div>
  );
}

function Row({ label, value, bold }) {
  return (
    <div className={`flex justify-between ${bold ? "font-bold text-primary dark:text-accent" : "text-text-light/70 dark:text-text-dark/70"}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
