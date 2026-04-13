import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { Link, useSearchParams } from "react-router-dom";
import {
    supplierAccountService,
    treasuryService,
    purchaseService,
} from "../../services/domainServices";
import Modal from "../../components/ui/Modal";
import PurchaseDetailsModal from "../reports/history/PurchaseDetailsModal";

const SupplierAccountsPage = () => {
    const [searchParams] = useSearchParams();
    const [accounts, setAccounts] = useState([]);
    const [selectedAccount, setSelectedAccount] = useState(null);
    const [payments, setPayments] = useState([]);
    const [purchases, setPurchases] = useState([]);
    const [treasuries, setTreasuries] = useState([]);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isOldDebtModalOpen, setIsOldDebtModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);


    // Details Modal State
    const [selectedPurchase, setSelectedPurchase] = useState(null);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

    // Payment form state
    const [paymentData, setPaymentData] = useState({
        amount: "",
        treasuryId: "",
        purchaseId: "",
        notes: "",
    });

    // Old Debt form state
    const [oldDebtData, setOldDebtData] = useState({
        amount: "",
        notes: "",
        date: new Date().toISOString().split("T")[0],
    });
    const [isSubmittingDebt, setIsSubmittingDebt] = useState(false);

    useEffect(() => {
        const initPage = async () => {
            await fetchTreasuries();
            const fetchedAccounts = await fetchAccounts();

            // Check for supplierId in query params
            const supplierIdParam = searchParams.get("supplierId");
            if (supplierIdParam && fetchedAccounts.length > 0) {
                const targetAccount = fetchedAccounts.find(
                    (acc) => acc.supplierId === parseInt(supplierIdParam)
                );
                if (targetAccount) {
                    handleAccountClick(targetAccount);
                }
            }
        };

        initPage();
    }, [searchParams]);

    const fetchAccounts = async () => {
        try {
            setIsLoading(true);
            const data = await supplierAccountService.getAll();
            setAccounts(data);
            return data;
        } catch (error) {
            console.error("Failed to fetch supplier accounts:", error);
            toast.error(error.message || "فشل تحميل حسابات الموردين");
            return [];
        } finally {
            setIsLoading(false);
        }
    };

    const fetchTreasuries = async () => {
        try {
            const data = await treasuryService.getAll();
            setTreasuries(data);
            if (data.length > 0) {
                setPaymentData((prev) => ({ ...prev, treasuryId: data[0].id }));
            }
        } catch (error) {
            console.error("Failed to fetch treasuries:", error);
        }
    };

    const handleAccountClick = async (account) => {
        setSelectedAccount(account);
        try {
            const [paymentsData, purchasesData] = await Promise.all([
                supplierAccountService.getPayments(account.supplierId),
                supplierAccountService.getPurchases(account.supplierId),
            ]);
            setPayments(paymentsData);
            setPurchases(purchasesData);
        } catch (error) {
            console.error("Failed to fetch account details:", error);
            toast.error(error.message || "فشل تحميل تفاصيل الحساب");
        }
    };

    const handleMakePayment = () => {
        if (!selectedAccount) return;
        setIsPaymentModalOpen(true);
        setPaymentData({
            amount: "",
            treasuryId: treasuries.length > 0 ? treasuries[0].id : "",
            purchaseId: "",
            notes: "",
        });
    };

    const handleAddOldDebt = () => {
        if (!selectedAccount) return;
        setIsOldDebtModalOpen(true);
        setOldDebtData({
            amount: "",
            notes: "",
            date: new Date().toISOString().split("T")[0],
        });
    };

    const handleViewDetails = async (purchaseId) => {
        try {
            const purchase = await purchaseService.getById(purchaseId);
            setSelectedPurchase(purchase);
            setIsDetailsModalOpen(true);
        } catch (error) {
            console.error("Failed to fetch purchase details:", error);
            toast.error(error.message || "فشل تحميل تفاصيل الفاتورة");
        }
    };

    const handlePaymentSubmit = async (e) => {
        e.preventDefault();

        if (!paymentData.amount || Number(paymentData.amount) <= 0) {
            toast.error("يرجى إدخال مبلغ صحيح");
            return;
        }

        if (Number(paymentData.amount) > Number(selectedAccount.balance)) {
            toast.error("المبلغ المدخل أكبر من الرصيد المستحق");
            return;
        }

        try {
            await supplierAccountService.makePayment(selectedAccount.supplierId, {
                amount: Number(paymentData.amount),
                treasuryId: parseInt(paymentData.treasuryId),
                purchaseId: paymentData.purchaseId
                    ? parseInt(paymentData.purchaseId)
                    : null,
                notes: paymentData.notes,
            });

            toast.success("تم تسجيل الدفعة بنجاح");
            setIsPaymentModalOpen(false);

            const freshAccounts = await fetchAccounts();
            if (selectedAccount && freshAccounts) {
                const updatedAccount = freshAccounts.find(
                    (acc) => acc.supplierId === selectedAccount.supplierId
                );
                if (updatedAccount) {
                    handleAccountClick(updatedAccount);
                } else {
                    setSelectedAccount(null);
                }
            }
        } catch (error) {
            console.error("Failed to process payment:", error);
            toast.error(error.message || "فشل تسجيل الدفعة");
        }
    };

    const handleOldDebtSubmit = async (e) => {
        e.preventDefault();

        if (!oldDebtData.amount || Number(oldDebtData.amount) <= 0) {
            toast.error("يرجى إدخال مبلغ صحيح");
            return;
        }

        setIsSubmittingDebt(true);
        try {
            await supplierAccountService.addOldDebt(selectedAccount.supplierId, {
                amount: Number(oldDebtData.amount),
                notes: oldDebtData.notes,
                date: oldDebtData.date,
            });

            toast.success("تم تسجيل الدين القديم بنجاح");
            setIsOldDebtModalOpen(false);

            const freshAccounts = await fetchAccounts();
            if (selectedAccount && freshAccounts) {
                const updatedAccount = freshAccounts.find(
                    (acc) => acc.supplierId === selectedAccount.supplierId
                );
                if (updatedAccount) {
                    handleAccountClick(updatedAccount);
                }
            }
        } catch (error) {
            console.error("Failed to record old debt:", error);
            toast.error(error.message || "فشل تسجيل الدين القديم");
        } finally {
            setIsSubmittingDebt(false);
        }
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString("ar-EG", {
            year: "numeric",
            month: "long",
            day: "numeric",
        });
    };

    // Determine if a payment entry is an "old debt" marker (negative amounts)
    const isOldDebtEntry = (payment) => Number(payment.amount) < 0;



    return (
        <div className="space-y-6" dir="rtl">
            {/* Header */}
            <div className="flex items-center justify-between bg-surface-light dark:bg-surface-dark p-4 rounded-xl shadow-sm border border-border-light dark:border-border-dark">
                <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
                    <span className="material-symbols-outlined">account_balance_wallet</span>
                    حسابات الموردين
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                    <Link
                        to="/dashboard"
                        className="flex items-center gap-2 bg-text-light/10 hover:bg-text-light/20 dark:bg-white/10 dark:hover:bg-white/20 text-text-light dark:text-text-dark px-3 py-2 rounded-lg transition-colors shadow-sm text-sm">
                        <span className="material-symbols-outlined text-sm">arrow_forward</span>
                        <span className="hidden sm:inline">رجوع</span>
                    </Link>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Supplier Accounts List */}
                <div className="lg:col-span-1 bg-surface-light dark:bg-surface-dark rounded-xl shadow-sm border border-border-light dark:border-border-dark overflow-hidden">
                    <div className="p-4 bg-background-light dark:bg-background-dark/50 border-b border-border-light dark:border-border-dark">
                        <h3 className="font-bold text-text-light dark:text-text-dark flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">group</span>
                            الموردين ({accounts.length})
                        </h3>
                    </div>

                    <div className="overflow-y-auto max-h-[40vh] lg:max-h-[600px]">
                        {isLoading ? (
                            <div className="p-8 text-center text-text-muted">
                                <span className="material-symbols-outlined animate-spin text-4xl">progress_activity</span>
                            </div>
                        ) : accounts.length === 0 ? (
                            <div className="p-8 text-center text-text-muted">
                                لا يوجد موردين
                            </div>
                        ) : (
                            accounts.map((account) => (
                                <div
                                    key={account.supplierId}
                                    onClick={() => handleAccountClick(account)}
                                    className={`p-4 border-b border-border-light dark:border-border-dark cursor-pointer transition-colors ${selectedAccount?.supplierId === account.supplierId
                                        ? "bg-primary/10 dark:bg-primary/20"
                                        : "hover:bg-background-light dark:hover:bg-background-dark/50"
                                        }`}>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h4 className="font-bold text-text-light dark:text-text-dark">
                                                {account.supplier.name}
                                            </h4>
                                            <p className="text-xs text-text-muted dark:text-accent mt-1">
                                                {account.supplier.phoneNumber}
                                            </p>
                                        </div>
                                        <div className="text-left">
                                            <p className={`text-lg font-bold ${Number(account.balance) > 0
                                                ? "text-red-600 dark:text-red-400"
                                                : "text-green-600 dark:text-green-400"
                                                }`}>
                                                {Number(account.balance).toFixed(2)} EGP
                                            </p>
                                            <p className="text-xs text-text-muted dark:text-accent">
                                                {Number(account.balance) > 0 ? "مستحق" : "مسدد"}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Account Details */}
                <div className="lg:col-span-2 space-y-6">
                    {!selectedAccount ? (
                        <div className="bg-surface-light dark:bg-surface-dark rounded-xl shadow-sm border border-border-light dark:border-border-dark p-12 text-center">
                            <span className="material-symbols-outlined text-6xl text-text-muted/30 dark:text-accent/30 mb-4">
                                touch_app
                            </span>
                            <p className="text-text-muted dark:text-accent">
                                اختر موردًا لعرض التفاصيل
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Supplier Info & Actions */}
                            <div className="bg-surface-light dark:bg-surface-dark rounded-xl shadow-sm border border-border-light dark:border-border-dark p-6">
                                <div className="flex justify-between items-start mb-5">
                                    <div>
                                        <h3 className="text-xl font-bold text-text-light dark:text-text-dark">
                                            {selectedAccount.supplier.name}
                                        </h3>
                                        <p className="text-sm text-text-muted dark:text-accent">
                                            {selectedAccount.supplier.phoneNumber}
                                        </p>
                                    </div>
                                    <div className="text-left">
                                        <p className={`text-2xl font-bold ${Number(selectedAccount.balance) > 0
                                            ? "text-red-600 dark:text-red-400"
                                            : "text-green-600 dark:text-green-400"}`}>
                                            {Number(selectedAccount.balance).toFixed(2)} EGP
                                        </p>
                                        <p className="text-sm text-text-muted dark:text-accent">
                                            الرصيد المستحق
                                        </p>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex flex-col sm:flex-row gap-3">
                                    {/* Add Old Debt — always visible */}
                                    <button
                                        onClick={handleAddOldDebt}
                                        className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm">
                                        <span className="material-symbols-outlined">history_edu</span>
                                        إضافة دين قديم
                                    </button>

                                    {/* Pay — only visible when balance > 0 */}
                                    {Number(selectedAccount.balance) > 0 && (
                                        <button
                                            onClick={handleMakePayment}
                                            className="flex-1 bg-primary hover:bg-primary-dark text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm">
                                            <span className="material-symbols-outlined">payments</span>
                                            سداد دفعة
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Purchases List */}
                            {purchases.length > 0 && (
                                <div className="bg-surface-light dark:bg-surface-dark rounded-xl shadow-sm border border-border-light dark:border-border-dark overflow-hidden">
                                    <div className="p-4 bg-background-light dark:bg-background-dark/50 border-b border-border-light dark:border-border-dark">
                                        <h3 className="font-bold text-text-light dark:text-text-dark flex items-center gap-2">
                                            <span className="material-symbols-outlined text-primary">receipt_long</span>
                                            سجل الفواتير ({purchases.length})
                                        </h3>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm whitespace-nowrap">
                                            <thead className="text-xs uppercase bg-accent/20 dark:bg-surface-dark/80">
                                                <tr>
                                                    <th className="px-4 py-3">رقم الفاتورة</th>
                                                    <th className="px-4 py-3">التاريخ</th>
                                                    <th className="px-4 py-3">الإجمالي</th>
                                                    <th className="px-4 py-3">المدفوع</th>
                                                    <th className="px-4 py-3">المتبقي</th>
                                                    <th className="px-4 py-3">الحالة</th>
                                                    <th className="px-4 py-3">إجراءات</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {purchases.map((purchase) => (
                                                    <tr
                                                        key={purchase.id}
                                                        className="border-b border-border-light dark:border-border-dark hover:bg-background-light dark:hover:bg-background-dark/50">
                                                        <td className="px-4 py-3 font-bold">#{purchase.id}</td>
                                                        <td className="px-4 py-3 text-text-muted">{formatDate(purchase.createdAt)}</td>
                                                        <td className="px-4 py-3">{Number(purchase.netTotal).toFixed(2)} EGP</td>
                                                        <td className="px-4 py-3 text-green-600">{Number(purchase.paidAmount).toFixed(2)} EGP</td>
                                                        <td className="px-4 py-3 text-red-600 font-bold">{Number(purchase.remaining).toFixed(2)} EGP</td>
                                                        <td className="px-4 py-3">
                                                            <span className={`whitespace-nowrap inline-block text-center px-2 py-1 rounded text-xs font-bold ${purchase.paymentStatus === "PAID"
                                                                ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                                                                : purchase.paymentStatus === "PARTIALLY_PAID"
                                                                    ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400"
                                                                    : purchase.paymentStatus === "RETURNED"
                                                                        ? "bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400"
                                                                        : purchase.paymentStatus === "CANCELLED"
                                                                            ? "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 line-through"
                                                                            : "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"
                                                                }`}>
                                                                {purchase.paymentStatus === "PAID"
                                                                    ? "مدفوع"
                                                                    : purchase.paymentStatus === "PARTIALLY_PAID"
                                                                        ? "غير مدفوع بالكامل"
                                                                        : purchase.paymentStatus === "RETURNED"
                                                                            ? "مرتجع"
                                                                            : purchase.paymentStatus === "CANCELLED"
                                                                                ? "ملغي"
                                                                                : "غير مدفوع"}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleViewDetails(purchase.id);
                                                                }}
                                                                className="text-primary hover:text-primary-dark transition-colors"
                                                                title="عرض التفاصيل">
                                                                <span className="material-symbols-outlined text-xl">visibility</span>
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Payment History */}
                            <div className="bg-surface-light dark:bg-surface-dark rounded-xl shadow-sm border border-border-light dark:border-border-dark overflow-hidden">
                                <div className="p-4 bg-background-light dark:bg-background-dark/50 border-b border-border-light dark:border-border-dark">
                                    <h3 className="font-bold text-text-light dark:text-text-dark flex items-center gap-2">
                                        <span className="material-symbols-outlined text-primary">history</span>
                                        سجل الحركات ({payments.length})
                                    </h3>
                                </div>
                                <div className="overflow-x-auto">
                                    {payments.length === 0 ? (
                                        <div className="p-8 text-center text-text-muted">
                                            لا يوجد حركات مسجلة
                                        </div>
                                    ) : (
                                        <table className="w-full text-sm whitespace-nowrap">
                                            <thead className="text-xs uppercase bg-accent/20 dark:bg-surface-dark/80">
                                                <tr>
                                                    <th className="px-4 py-3">النوع</th>
                                                    <th className="px-4 py-3">التاريخ</th>
                                                    <th className="px-4 py-3">المبلغ</th>
                                                    <th className="px-4 py-3">الخزينة</th>
                                                    <th className="px-4 py-3">الفاتورة</th>
                                                    <th className="px-4 py-3">ملاحظات</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {payments.map((payment) => {
                                                    const isDebt = isOldDebtEntry(payment);
                                                    return (
                                                        <tr
                                                            key={payment.id}
                                                            className={`border-b border-border-light dark:border-border-dark ${isDebt
                                                                ? "bg-amber-50 dark:bg-amber-900/10"
                                                                : "hover:bg-background-light dark:hover:bg-background-dark/50"
                                                                }`}>
                                                            <td className="px-4 py-3">
                                                                {isDebt ? (
                                                                    <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 text-xs font-bold px-2 py-1 rounded">
                                                                        <span className="material-symbols-outlined text-sm">history_edu</span>
                                                                        دين قديم
                                                                    </span>
                                                                ) : (
                                                                    <span className="inline-flex items-center gap-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 text-xs font-bold px-2 py-1 rounded">
                                                                        <span className="material-symbols-outlined text-sm">payments</span>
                                                                        دفعة
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3 text-text-muted">
                                                                {formatDate(payment.paymentDate)}
                                                            </td>
                                                            <td className={`px-4 py-3 font-bold ${isDebt
                                                                ? "text-amber-600 dark:text-amber-400"
                                                                : "text-green-600 dark:text-green-400"
                                                                }`}>
                                                                {isDebt ? "+" : "-"}{Math.abs(Number(payment.amount)).toFixed(2)} EGP
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                {isDebt ? "—" : (payment.treasury?.name || "—")}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                {payment.purchaseId ? `#${payment.purchaseId}` : "—"}
                                                            </td>
                                                            <td className="px-4 py-3 text-text-muted text-xs max-w-xs truncate">
                                                                {payment.notes
                                                                    ? payment.notes.replace("[رصيد أولي] ", "").trim() || "—"
                                                                    : "—"}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* ─── Payment Modal ─── */}
            <Modal
                isOpen={isPaymentModalOpen}
                onClose={() => setIsPaymentModalOpen(false)}
                title="سداد دفعة">
                <form onSubmit={handlePaymentSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">
                            ربط بفاتورة محددة (اختياري)
                        </label>
                        <select
                            value={paymentData.purchaseId}
                            onChange={(e) =>
                                setPaymentData({ ...paymentData, purchaseId: e.target.value })
                            }
                            className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-text-light dark:text-text-dark rounded-lg p-2.5">
                            <option value="">الكل</option>
                            {purchases.filter(
                                (p) => p.paymentStatus !== "PAID" && p.paymentStatus !== "RETURNED" && p.paymentStatus !== "CANCELLED"
                            ).map((purchase) => (
                                <option key={purchase.id} value={purchase.id}>
                                    #{purchase.id} - {Number(purchase.remaining).toFixed(2)} EGP
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">الخزينة *</label>
                        <select
                            value={paymentData.treasuryId}
                            onChange={(e) =>
                                setPaymentData({ ...paymentData, treasuryId: e.target.value })
                            }
                            className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-text-light dark:text-text-dark rounded-lg p-2.5"
                            required>
                            <option value="">اختر الخزينة...</option>
                            {treasuries.map((treasury) => (
                                <option key={treasury.id} value={treasury.id}>
                                    {treasury.name} - {Number(treasury.balance).toFixed(2)} EGP
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">المبلغ *</label>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            max={selectedAccount?.balance || 0}
                            value={paymentData.amount}
                            onChange={(e) =>
                                setPaymentData({ ...paymentData, amount: e.target.value })
                            }
                            className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-text-light dark:text-text-dark rounded-lg p-2.5"
                            placeholder="0.00"
                            required
                        />
                        {selectedAccount && (
                            <p className="text-xs text-text-muted mt-1">
                                الحد الأقصى: {Number(selectedAccount.balance).toFixed(2)} EGP
                            </p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">ملاحظات</label>
                        <textarea
                            value={paymentData.notes}
                            onChange={(e) =>
                                setPaymentData({ ...paymentData, notes: e.target.value })
                            }
                            className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-text-light dark:text-text-dark rounded-lg p-2.5"
                            rows="3"
                            placeholder="أي ملاحظات إضافية..."></textarea>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="submit"
                            className="flex-1 bg-primary hover:bg-primary-dark text-white font-bold py-2.5 px-4 rounded-lg transition-colors">
                            تأكيد الدفع
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsPaymentModalOpen(false)}
                            className="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-text-light dark:text-text-dark font-bold py-2.5 px-4 rounded-lg transition-colors">
                            إلغاء
                        </button>
                    </div>
                </form>
            </Modal>

            {/* ─── Add Old Debt Modal ─── */}
            <Modal
                isOpen={isOldDebtModalOpen}
                onClose={() => setIsOldDebtModalOpen(false)}
                title="إضافة دين قديم">
                <div className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 flex items-start gap-2">
                    <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0">info</span>
                    <p className="text-sm text-amber-800 dark:text-amber-300">
                        هذا الخيار لتسجيل ديون سابقة لنظام ERP. لن يتم خصم أي مبلغ من الخزينة ولن يُنشأ فاتورة شراء.
                    </p>
                </div>

                <form onSubmit={handleOldDebtSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">
                            المورد
                        </label>
                        <div className="w-full bg-background-light/60 dark:bg-background-dark/60 border border-border-light dark:border-border-dark text-text-muted dark:text-text-dark rounded-lg p-2.5 font-semibold">
                            {selectedAccount?.supplier?.name}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">المبلغ المستحق (EGP) *</label>
                        <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={oldDebtData.amount}
                            onChange={(e) =>
                                setOldDebtData({ ...oldDebtData, amount: e.target.value })
                            }
                            className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-text-light dark:text-text-dark rounded-lg p-2.5"
                            placeholder="0.00"
                            required
                            autoFocus
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">التاريخ *</label>
                        <input
                            type="date"
                            value={oldDebtData.date}
                            onChange={(e) =>
                                setOldDebtData({ ...oldDebtData, date: e.target.value })
                            }
                            className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-text-light dark:text-text-dark rounded-lg p-2.5"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">ملاحظات / السبب</label>
                        <textarea
                            value={oldDebtData.notes}
                            onChange={(e) =>
                                setOldDebtData({ ...oldDebtData, notes: e.target.value })
                            }
                            className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-text-light dark:text-text-dark rounded-lg p-2.5"
                            rows="3"
                            placeholder="مثال: ديون متراكمة قبل بدء استخدام النظام..."></textarea>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="submit"
                            disabled={isSubmittingDebt}
                            className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white font-bold py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2">
                            {isSubmittingDebt ? (
                                <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                            ) : (
                                <span className="material-symbols-outlined text-base">history_edu</span>
                            )}
                            {isSubmittingDebt ? "جاري الحفظ..." : "تأكيد وتسجيل الدين"}
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsOldDebtModalOpen(false)}
                            className="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-text-light dark:text-text-dark font-bold py-2.5 px-4 rounded-lg transition-colors">
                            إلغاء
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Purchase Details Modal */}
            <PurchaseDetailsModal
                isOpen={isDetailsModalOpen}
                onClose={() => setIsDetailsModalOpen(false)}
                purchase={selectedPurchase}
            />
        </div>
    );
};

export default SupplierAccountsPage;
