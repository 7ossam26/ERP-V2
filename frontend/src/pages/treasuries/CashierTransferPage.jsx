import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { treasuryService } from "../../services/domainServices";
import AuthService from "../../services/authService";
import toast from "react-hot-toast";

const CashierTransferPage = () => {
  const navigate = useNavigate();
  const currentUser = AuthService.getCurrentUser();
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [treasuries, setTreasuries] = useState([]);
  const [sourceTreasuryId, setSourceTreasuryId] = useState("");
  const [toTreasuryId, setToTreasuryId] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchTreasuries = async () => {
      try {
        // Fetch every treasury so destinations are unrestricted; source dropdown
        // is still narrowed to the user's branches via allowedBranchIds below.
        let data = await treasuryService.getAllUnfiltered();
        // Set treasuries
        setTreasuries(data);

        // Auto-select preference:
        // 1. User's branch treasury
        // 2. First available treasury
        const userBranchTreasury = data.find(
          (t) => t.branchId === currentUser?.branchId,
        );
        if (userBranchTreasury) {
          setSourceTreasuryId(userBranchTreasury.id.toString());
        } else if (data.length > 0) {
          setSourceTreasuryId(data[0].id.toString());
        }
      } catch (error) {
        toast.error(error.message || "فشل في تحميل بيانات الخزائن");
      }
    };
    fetchTreasuries();
  }, [currentUser?.id, currentUser?.branch?.id]);

  const selectedSource = treasuries.find(
    (t) => t.id === parseInt(sourceTreasuryId),
  );
  const currentBalance = selectedSource ? Number(selectedSource.balance) : 0;

  const allowedBranchIds = (() => {
    const ids = new Set();
    if (currentUser?.branchId) ids.add(Number(currentUser.branchId));
    if (currentUser?.branch?.id) ids.add(Number(currentUser.branch.id));
    if (Array.isArray(currentUser?.accessibleBranches)) {
      currentUser.accessibleBranches.forEach((b) => ids.add(Number(b.id)));
    }
    return ids;
  })();

  const handleTransfer = async () => {
    if (!amount || Number(amount) <= 0) {
      toast.error("يرجى إدخال مبلغ صحيح");
      return;
    }
    if (Number(amount) > currentBalance) {
      toast.error("رصيد الخزينة غير كافٍ");
      return;
    }
    if (!sourceTreasuryId) {
      toast.error("يرجى تحديد الخزينة المحول منها");
      return;
    }
    if (!toTreasuryId) {
      toast.error("يرجى تحديد الخزينة المحول إليها");
      return;
    }

    if (parseInt(sourceTreasuryId) === parseInt(toTreasuryId)) {
      toast.error("لا يمكن التحويل لنفس الخزينة");
      return;
    }

    setLoading(true);
    try {
      await treasuryService.transfer({
        fromTreasuryId: parseInt(sourceTreasuryId),
        toTreasuryId: parseInt(toTreasuryId),
        amount: Number(amount),
        notes,
      });
      toast.success("تم إرسال طلب التحويل بنجاح");
      navigate("/dashboard");
    } catch (error) {
      console.error(error);
      toast.error(error.message || "فشل في عملية التحويل");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] overflow-hidden bg-background-light dark:bg-background-dark text-text-primary dark:text-text-dark">
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-12 pb-24">
        <div className="max-w-3xl mx-auto space-y-8">
          {/* Header Section */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-black text-text-primary dark:text-text-dark mb-2">
                تورد نقدية
              </h1>
              <p className="text-text-secondary dark:text-gray-400 text-lg">
                إرسال النقدية بين الخزائن (تحت المراجعة)
              </p>
            </div>
            <div className="bg-surface-light dark:bg-surface-dark border border-primary/20 rounded-xl p-5 shadow-sm min-w-[280px] flex items-center justify-between">
              <div>
                <p className="text-sm text-text-secondary dark:text-gray-400 mb-1 font-medium">
                  الرصيد الحالي المتاح
                </p>
                <p className="text-2xl font-bold text-text-primary dark:text-text-dark dir-ltr text-right">
                  {currentBalance.toLocaleString()}
                  <span className="text-sm font-normal text-text-secondary dark:text-gray-400 mr-1">
                    ج.م
                  </span>
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined">
                  account_balance_wallet
                </span>
              </div>
            </div>
          </div>

          {/* Transfer Form Card */}
          <div className="space-y-6">
            <div className="bg-surface-light dark:bg-surface-dark rounded-2xl shadow-sm border border-border-light dark:border-border-dark p-6 md:p-8">
              {/* Route Visualizer */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-10 relative">
                {/* Source Select */}
                <div className="flex-1 w-full bg-background-light dark:bg-background-dark/50 rounded-xl p-4 border border-border-light dark:border-border-dark relative group hover:border-primary/30 transition-colors">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-white dark:bg-surface-dark rounded-lg text-primary shadow-sm">
                      <span className="material-symbols-outlined">
                        storefront
                      </span>
                    </div>
                    <p className="text-sm font-bold text-text-secondary dark:text-gray-400">
                      من
                    </p>
                  </div>
                  <select
                    className="w-full bg-transparent font-bold text-lg text-text-primary dark:text-text-dark focus:outline-none cursor-pointer"
                    value={sourceTreasuryId}
                    onChange={(e) => setSourceTreasuryId(e.target.value)}>
                    <option value="" disabled>
                      اختر الخزينة
                    </option>
                    {treasuries
                      .filter((t) => {
                        // Global treasuries (Visa / Instapay / Main) are always
                        // available as a source — they aren't bound to a branch.
                        if (
                          t.scope === "GLOBAL_VISA" ||
                          t.scope === "GLOBAL_INSTAPAY" ||
                          t.scope === "MAIN"
                        ) {
                          return true;
                        }

                        // If user has a primary or accessible branch, show only treasuries linked to those branches.
                        if (allowedBranchIds.size > 0) {
                          return allowedBranchIds.has(Number(t.branch?.id));
                        }

                        // If no user branch (Superadmin?), show branch-cash too
                        return t.scope === "BRANCH_CASH";
                      })
                      .map((t) => (
                        <option key={t.id} value={t.id} className="text-black">
                          {t.name}
                          {t.scope === "GLOBAL_VISA"
                            ? " — خزينة فيزا"
                            : t.scope === "GLOBAL_INSTAPAY"
                              ? " — خزينة انستاباي"
                              : t.scope === "MAIN"
                                ? " — الخزينة الرئيسية"
                                : ""}
                        </option>
                      ))}
                  </select>
                  <p className="text-sm text-text-secondary dark:text-gray-400 mt-1">
                    {selectedSource
                      ? `${Number(selectedSource.balance).toLocaleString()} ج.م`
                      : "حدد المصدر"}
                  </p>
                </div>

                <div className="shrink-0 flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary z-10 sm:rotate-180 rotate-90 my-2 sm:my-0">
                  <span className="material-symbols-outlined">
                    arrow_right_alt
                  </span>
                </div>

                {/* Destination Treasury Select */}
                <div className="flex-1 w-full bg-background-light dark:bg-background-dark/50 rounded-xl p-4 border border-border-light dark:border-border-dark relative group hover:border-primary/30 transition-colors">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-white dark:bg-surface-dark rounded-lg text-primary shadow-sm">
                      <span className="material-symbols-outlined">
                        account_balance
                      </span>
                    </div>
                    <p className="text-sm font-bold text-text-secondary dark:text-gray-400">
                      إلى
                    </p>
                  </div>
                  <select
                    className="w-full bg-transparent font-bold text-lg text-text-primary dark:text-text-dark focus:outline-none cursor-pointer"
                    value={toTreasuryId}
                    onChange={(e) => setToTreasuryId(e.target.value)}>
                    <option value="" disabled>
                      اختر الوجهة
                    </option>
                    {treasuries
                      .filter((t) => {
                        // Exclude the chosen source from destination list.
                        if (
                          sourceTreasuryId &&
                          Number(t.id) === Number(sourceTreasuryId)
                        ) {
                          return false;
                        }
                        // If source is already a digital global treasury (shouldn't
                        // happen given source filter above), the backend will reject;
                        // but guard here so we don't present invalid pairings.
                        return true;
                      })
                      .map((t) => (
                        <option key={t.id} value={t.id} className="text-black">
                          {t.name}
                          {t.scope === "GLOBAL_VISA"
                            ? " — خزينة فيزا"
                            : t.scope === "GLOBAL_INSTAPAY"
                              ? " — خزينة انستاباي"
                              : t.scope === "MAIN"
                                ? " — الخزينة الرئيسية"
                                : ""}
                        </option>
                      ))}
                  </select>
                  <p className="text-sm text-text-secondary dark:text-gray-400 mt-1">
                    يتم التحويل كطلب معلق
                  </p>
                </div>
              </div>

              {/* Inputs */}
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-text-primary dark:text-text-dark mb-2">
                    المبلغ المراد توريده
                  </label>
                  <div className="relative">
                    <input
                      className="w-full text-left ltr bg-white dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl pl-4 pr-16 py-4 text-3xl font-bold text-text-primary dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all placeholder:text-gray-300 dark:placeholder:text-gray-600"
                      placeholder="0.00"
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      max={currentBalance}
                      disabled={loading}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary dark:text-gray-400 font-medium text-lg pointer-events-none">
                      ج.م
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-text-primary dark:text-text-dark mb-2">
                    ملاحظات (اختياري)
                  </label>
                  <textarea
                    className="w-full bg-white dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-4 py-3 text-base text-text-primary dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all resize-none"
                    placeholder="أضف أي تفاصيل إضافية عن عملية التوريد..."
                    rows="3"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    disabled={loading}></textarea>
                </div>

                <div className="pt-4 flex items-center gap-4">
                  <button
                    onClick={handleTransfer}
                    disabled={loading}
                    className="flex-1 bg-primary hover:bg-primary-hover text-white py-4 px-6 rounded-xl text-lg font-bold shadow-lg shadow-primary/20 transition-all hover:translate-y-[-2px] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                    {loading ? (
                      <span className="material-symbols-outlined animate-spin">
                        progress_activity
                      </span>
                    ) : (
                      <>
                        <span className="material-symbols-outlined">send</span>
                        إرسال طلب التوريد
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => navigate(-1)}
                    disabled={loading}
                    className="px-6 py-4 rounded-xl text-text-secondary dark:text-gray-400 font-bold hover:bg-background-light dark:hover:bg-background-dark transition-colors">
                    إلغاء
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CashierTransferPage;
