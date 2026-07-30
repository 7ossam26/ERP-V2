import React, { useState } from "react";
import Modal from "../../../components/ui/Modal";
import shiftService from "../../../services/shiftService";
import { toast } from "react-hot-toast";
import { FaLock, FaUser, FaLockOpen } from "react-icons/fa";

// Keep in sync with MIN_REOPEN_REASON_LENGTH in backend/routes/shifts.js
const MIN_REASON_LENGTH = 5;

const formatMoney = (value) =>
  value === null || value === undefined
    ? "—"
    : `${parseFloat(value).toFixed(2)} ج.م`;

/**
 * Sends a shift awaiting review back to OPEN *without* approving it, so its own
 * cashier can resume selling under the SAME shift. This is the alternative to
 * ShiftApprovalModal — the two actions offered on a PENDING_REVIEW shift — and is
 * authorized with the same manager credentials.
 *
 * The shift can then be ended again and reviewed again, as many times as needed,
 * until it is finally approved.
 */
const ShiftReopenModal = ({ isOpen, onClose, shift, onSuccess }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const handleClose = () => {
    setUsername("");
    setPassword("");
    setReason("");
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!username || !password) {
      toast.error("يرجى إدخال اسم المستخدم وكلمة المرور");
      return;
    }
    if (reason.trim().length < MIN_REASON_LENGTH) {
      toast.error(`يجب كتابة سبب إعادة الفتح (${MIN_REASON_LENGTH} أحرف على الأقل)`);
      return;
    }

    try {
      setLoading(true);
      await shiftService.reopen({
        shiftId: shift.id,
        managerUsername: username,
        managerPassword: password,
        reason: reason.trim(),
      });
      toast.success(
        `تم إعادة فتح الوردية #${shift.id} بدون اعتماد. يمكن للموظف ${shift.user?.name || ""} متابعة البيع على نفس الوردية الآن`,
      );
      if (onSuccess) onSuccess();
      handleClose();
    } catch (error) {
      console.error(error);
      toast.error(
        error.data?.message || error.message || "فشل إعادة فتح الوردية",
      );
    } finally {
      setLoading(false);
    }
  };

  if (!shift) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`إعادة فتح وردية #${shift.id}`}>
      <form onSubmit={handleSubmit} className="space-y-4 text-right" dir="rtl">
        <div className="bg-amber-50 text-amber-900 p-4 rounded-lg text-sm border border-amber-200">
          أنت على وشك إعادة فتح وردية{" "}
          <strong className="font-bold">{shift.user?.name}</strong> بفرع{" "}
          <strong className="font-bold">{shift.branch?.name}</strong>{" "}
          <strong className="font-bold">بدون اعتمادها</strong>. سيتم استئناف{" "}
          <strong>نفس الوردية</strong> وليس إنشاء وردية جديدة، وستبقى كل المبيعات
          والمصروفات السابقة مرتبطة بها. يمكن للموظف متابعة البيع، ثم إنهاء
          الوردية مرة أخرى لتعود لانتظار المراجعة.
        </div>

        <div className="bg-red-50 p-4 rounded-lg border border-red-200 text-sm">
          <h4 className="text-red-800 font-bold mb-2">
            ⚠️ سيتم إلغاء بيانات جرد النقدية المُرسلة
          </h4>
          <ul className="space-y-1 text-red-700">
            <li className="flex justify-between gap-3">
              <span>النقدية المُسلّمة (جرد الموظف)</span>
              <span className="font-mono" dir="ltr">
                {formatMoney(shift.actualCash ?? shift.endCash)}
              </span>
            </li>
            <li className="flex justify-between gap-3">
              <span>المتوقع بالنظام</span>
              <span className="font-mono" dir="ltr">
                {formatMoney(shift.systemExpectedCash)}
              </span>
            </li>
            <li className="flex justify-between gap-3">
              <span>الفرق (عجز/زيادة)</span>
              <span className="font-mono" dir="ltr">
                {formatMoney(shift.shortage)}
              </span>
            </li>
          </ul>
          <p className="mt-3 text-xs text-red-600">
            سيتم إعادة حساب هذه القيم من جديد على <strong>كامل الوردية</strong>{" "}
            عند إنهائها مرة أخرى. القيم القديمة محفوظة في سجل المراجعة (Audit
            Log) ولن تُفقد. النقدية الافتتاحية والمبيعات لن تتغير.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700">
            سبب إعادة الفتح <span className="text-red-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 bg-gray-50 focus:bg-white transition-colors resize-none"
            placeholder="مثال: تم إغلاق الوردية بالخطأ قبل تسجيل آخر الطلبات"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700">
            اسم المستخدم (المدير)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-3 text-gray-400">
              <FaUser />
            </span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full pl-3 pr-10 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 bg-gray-50 focus:bg-white transition-colors"
              placeholder="Username"
              autoComplete="off"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700">
            كلمة المرور
          </label>
          <div className="relative">
            <span className="absolute left-3 top-3 text-gray-400">
              <FaLock />
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-3 pr-10 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 bg-gray-50 focus:bg-white transition-colors"
              placeholder="••••••••"
              autoComplete="off"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
            إلغاء
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 flex items-center gap-2 text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors">
            <FaLockOpen />
            {loading ? "جاري إعادة الفتح..." : "تأكيد إعادة فتح الوردية"}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default ShiftReopenModal;
