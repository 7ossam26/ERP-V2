import React, { useState, useEffect, useRef } from "react";
import { useBranch } from "../../contexts/BranchContext";
import { useReactToPrint } from "react-to-print";
import { deliveryService } from "../../services/deliveryService";
import AuthService from "../../services/authService";
import SettlementReceipt from "./components/SettlementReceipt";
import ManagerVerificationModal from "../../components/shared/ManagerVerificationModal";
import { toast } from "react-hot-toast";

const DeliverySettlementPage = () => {
    const { activeBranchId } = useBranch();
    // View mode: 'settlement' or 'report'
    const [viewMode, setViewMode] = useState('settlement');

    // Mobile: show driver list or detail panel
    const [showDriverList, setShowDriverList] = useState(true);

    // Settlement Mode State
    const [drivers, setDrivers] = useState([]);
    const [allDrivers, setAllDrivers] = useState([]); // For search filtering
    const [selectedDrivers, setSelectedDrivers] = useState([]); // Changed to array for bulk
    const [selectedDriver, setSelectedDriver] = useState(null); // For single driver details
    const [history, setHistory] = useState({ salesByDate: [], payments: [] });
    const [selectedSales, setSelectedSales] = useState([]);
    const [notes, setNotes] = useState("");

    // Daily Report State
    const [dailyReport, setDailyReport] = useState([]);

    // Search & Filtering
    const [searchQuery, setSearchQuery] = useState("");
    const [dateRange, setDateRange] = useState({ start: "", end: "" });

    // Treasury
    const [treasuries, setTreasuries] = useState([]);
    const [selectedTreasury, setSelectedTreasury] = useState(null);

    // Loading States
    const [loading, setLoading] = useState(false);
    const [settling, setSettling] = useState(false);

    // Manager Verification
    const [showManagerVerification, setShowManagerVerification] = useState(false);
    const [settlementType, setSettlementType] = useState(null); // 'single' or 'bulk'

    // Printing
    const receiptRef = useRef();
    const [printData, setPrintData] = useState(null);

    const handlePrint = useReactToPrint({
        contentRef: receiptRef,
        onAfterPrint: () => setPrintData(null),
    });

    // Fetch Drivers with Debt
    useEffect(() => {
        fetchDrivers();
    }, [activeBranchId]);

    // Apply search filter
    useEffect(() => {
        if (searchQuery.trim() === "") {
            setDrivers(allDrivers);
        } else {
            const filtered = allDrivers.filter(d =>
                d.name.toLowerCase().includes(searchQuery.toLowerCase())
            );
            setDrivers(filtered);
        }
    }, [searchQuery, allDrivers]);

    const fetchDrivers = async () => {
        try {
            setLoading(true);
            const allFetchedDrivers = await deliveryService.getAll();
            // Filter drivers with positive wallet balance (debt)
            const indebted = allFetchedDrivers.filter(d => parseFloat(d.walletBalance) > 0);
            setAllDrivers(indebted);
            setDrivers(indebted);
        } catch (error) {
            console.error("Failed to fetch drivers", error);
        } finally {
            setLoading(false);
        }
    };



    const fetchDailyReport = async () => {
        try {
            setLoading(true);
            const params = {};
            if (dateRange.start) params.startDate = dateRange.start;
            if (dateRange.end) params.endDate = dateRange.end;

            const data = await deliveryService.getDailyReport(params);
            setDailyReport(data);
        } catch (error) {
            console.error("Failed to fetch daily report", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (viewMode === 'report') {
            fetchDailyReport();
        }
    }, [viewMode, dateRange]);

    const handleSelectDriver = async (driver) => {
        setSelectedDriver(driver);
        setSelectedSales([]);
        setNotes("");
        setShowDriverList(false); // On mobile: switch to detail view
        try {
            setLoading(true);
            const params = {};
            if (dateRange.start) params.startDate = dateRange.start;
            if (dateRange.end) params.endDate = dateRange.end;
            const data = await deliveryService.getHistory(driver.id, params);
            setHistory(data);
        } catch (error) {
            console.error("Failed to fetch history", error);
        } finally {
            setLoading(false);
        }
    };

    const toggleDriverSelection = (driver) => {
        if (selectedDrivers.find(d => d.id === driver.id)) {
            setSelectedDrivers(prev => prev.filter(d => d.id !== driver.id));
        } else {
            setSelectedDrivers(prev => [...prev, driver]);
        }
    };

    const toggleSelectAll = () => {
        if (selectedDrivers.length === drivers.length) {
            setSelectedDrivers([]);
        } else {
            setSelectedDrivers([...drivers]);
        }
    };

    const toggleDaySelection = (day) => {
        const daySaleIds = day.orders.filter(o => o.deliveryStatus === 'OUT_FOR_DELIVERY').map(o => o.id);
        const allSelected = daySaleIds.every(id => selectedSales.includes(id));

        if (allSelected) {
            setSelectedSales(prev => prev.filter(id => !daySaleIds.includes(id)));
        } else {
            setSelectedSales(prev => [...new Set([...prev, ...daySaleIds])]);
        }
    };

    const toggleSaleSelection = (saleId) => {
        if (selectedSales.includes(saleId)) {
            setSelectedSales(prev => prev.filter(id => id !== saleId));
        } else {
            setSelectedSales(prev => [...prev, saleId]);
        }
    };

    const calculateTotal = () => {
        let total = 0;
        history.salesByDate.forEach(day => {
            day.orders.forEach(order => {
                if (selectedSales.includes(order.id)) {
                    total += parseFloat(order.netDebt || 0);
                }
            });
        });
        return total;
    };

    const calculateTotalDebtForSelectedDrivers = () => {
        return selectedDrivers.reduce((sum, driver) => sum + parseFloat(driver.walletBalance), 0);
    };

    const handleSettle = async () => {
        // S9: Cashier settles directly — no manager password required
        if (selectedDrivers.length > 1) {
            setSettlementType('bulk');
            await handleBulkSettle({});
        } else if (selectedDriver && selectedSales.length > 0) {
            setSettlementType('single');
            await handleSingleSettle({});
        }
    };

    const handleManagerVerify = async (credentials) => {
        if (settlementType === 'bulk') {
            await handleBulkSettle(credentials);
        } else if (settlementType === 'single') {
            await handleSingleSettle(credentials);
        }
    };

    const handleSingleSettle = async (credentials) => {
        if (selectedSales.length === 0) return;
        const amount = calculateTotal();

        try {
            setSettling(true);
            const user = AuthService.getCurrentUser();

            await deliveryService.settleDeliveryMan({
                deliveryManId: selectedDriver.id,
                amount: amount,
                userId: user?.id,
                notes: notes,
                saleIds: selectedSales,
                ...credentials, // managerUsername, managerPassword
            });

            // Prepare Print Data
            const settledOrders = [];
            history.salesByDate.forEach(day => {
                day.orders.forEach(order => {
                    if (selectedSales.includes(order.id)) {
                        settledOrders.push(order);
                    }
                });
            });

            setPrintData({
                driverName: selectedDriver.name,
                settlementId: Date.now(),
                date: new Date(),
                orders: settledOrders,
                totalAmount: amount,
                notes,
                user,
                treasury: { name: `خزنة فرع ${selectedDriver.branch?.name || 'الفرع'}` }
            });

            setTimeout(() => {
                handlePrint();
                fetchDrivers();
                if (selectedDriver) handleSelectDriver(selectedDriver);
            }, 500);

            setShowManagerVerification(false);
            toast.success('تمت التسوية بنجاح');

        } catch (error) {
            console.error("Settlement failed", error);
            toast.error(error.data?.message || "فشلت عملية التسوية");
        } finally {
            setSettling(false);
        }
    };

    const handleBulkSettle = async (credentials) => {
        try {
            setSettling(true);
            const user = AuthService.getCurrentUser();

            const deliveryMen = selectedDrivers.map(driver => ({
                id: driver.id,
                amount: parseFloat(driver.walletBalance),
                saleIds: [] // Settle all outstanding orders for bulk
            }));

            const result = await deliveryService.settleBulk({
                deliveryMen,
                userId: user?.id,
                notes: notes || "Bulk Settlement",
                ...credentials, // managerUsername, managerPassword
            });

            toast.success(`تمت تسوية ${result.driversSettled} طيار بنجاح!\nإجمالي المبلغ: ${result.totalAmount.toFixed(2)} ج.م`);

            // Refresh data
            fetchDrivers();
            setSelectedDrivers([]);
            setSelectedDriver(null);
            setShowManagerVerification(false);

        } catch (error) {
            console.error("Bulk settlement failed", error);
            toast.error(error.data?.message || "فشلت عملية التسوية الجماعية");
        } finally {
            setSettling(false);
        }
    };

    return (
        <div className="flex flex-col lg:flex-row h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden" style={{ direction: "rtl" }}>
            {/* Sidebar: Drivers List */}
            <div className={`${showDriverList ? 'flex' : 'hidden'} lg:flex w-full lg:w-1/3 border-b lg:border-b-0 lg:border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-col`}>
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white">تسوية الطيارين</h2>
                    <p className="text-sm text-gray-500">الطيارين مديوني الذمة فقط</p>

                    {/* Search */}
                    <div className="mt-3">
                        <input
                            type="text"
                            placeholder="بحث بالاسم..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                        />
                    </div>

                    {/* Bulk Selection Controls */}
                    {drivers.length > 0 && (
                        <div className="mt-3 flex items-center justify-between">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={selectedDrivers.length === drivers.length && drivers.length > 0}
                                    onChange={toggleSelectAll}
                                    className="w-4 h-4 rounded text-blue-600"
                                />
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">تحديد الكل</span>
                            </label>
                            {selectedDrivers.length > 0 && (
                                <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-2 py-1 rounded-full">
                                    {selectedDrivers.length} محدد
                                </span>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto">
                    {drivers.map(driver => (
                        <div
                            key={driver.id}
                            className={`p-4 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${selectedDrivers.find(d => d.id === driver.id) ? 'bg-blue-50 dark:bg-blue-900/20 border-r-4 border-r-blue-500' : ''
                                } ${selectedDriver?.id === driver.id ? 'bg-green-50 dark:bg-green-900/20' : ''}`}
                        >
                            <div className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    checked={!!selectedDrivers.find(d => d.id === driver.id)}
                                    onChange={() => toggleDriverSelection(driver)}
                                    className="w-5 h-5 rounded text-blue-600 cursor-pointer"
                                />
                                <div
                                    onClick={() => handleSelectDriver(driver)}
                                    className="flex-1 cursor-pointer"
                                >
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <h3 className="font-bold text-gray-900 dark:text-white">{driver.name}</h3>
                                            <span className="text-xs text-gray-500">{driver.phone}</span>
                                        </div>
                                        <div className="text-left">
                                            <span className="block font-bold text-red-600 dark:text-red-400">{parseFloat(driver.walletBalance).toFixed(2)} ج.م</span>
                                            <span className="text-xs text-gray-400">مديونية</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                    {drivers.length === 0 && !loading && (
                        <div className="p-8 text-center text-gray-500">
                            {searchQuery ? "لا توجد نتائج للبحث" : "لا يوجد طيارين عليهم مديونيات حالياً"}
                        </div>
                    )}
                </div>
            </div>

            {/* Main Content */}
            <div className={`${showDriverList ? 'hidden' : 'flex'} lg:flex flex-1 flex-col h-full overflow-hidden`}>
                {/* View Mode Toggle */}
                <div className="p-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row gap-2">
                    <div className="flex items-center gap-2">
                        {/* Mobile: back to drivers list */}
                        <button
                            onClick={() => setShowDriverList(true)}
                            className="lg:hidden flex items-center gap-1 px-3 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold text-sm"
                        >
                            <span className="material-icons-round text-base">arrow_forward</span>
                        </button>
                        <button
                            onClick={() => setViewMode('settlement')}
                            className={`px-3 py-2 rounded-xl font-bold transition-all text-sm ${viewMode === 'settlement'
                                ? 'bg-blue-600 text-white shadow-lg'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                }`}
                        >
                            التسوية
                        </button>
                        <button
                            onClick={() => setViewMode('report')}
                            className={`px-3 py-2 rounded-xl font-bold transition-all text-sm ${viewMode === 'report'
                                ? 'bg-blue-600 text-white shadow-lg'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                }`}
                        >
                            التقرير اليومي
                        </button>
                    </div>

                    {/* Date Range */}
                    <div className="flex flex-wrap gap-2 sm:mr-auto">
                        <input
                            type="date"
                            value={dateRange.start}
                            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                            className="flex-1 min-w-[130px] px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
                            max={new Date().toISOString().split("T")[0]}
                        />
                        <span className="self-center text-gray-500 text-sm">إلى</span>
                        <input
                            type="date"
                            value={dateRange.end}
                            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                            className="flex-1 min-w-[130px] px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
                            max={new Date().toISOString().split("T")[0]}
                        />
                    </div>
                </div>

                {/* Settlement View */}
                {viewMode === 'settlement' && (
                    selectedDriver || selectedDrivers.length > 0 ? (
                        <>
                            <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col sm:flex-row justify-between gap-3 shadow-sm z-10">
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                        {selectedDrivers.length > 1
                                            ? `تسوية جماعية (${selectedDrivers.length} طيار)`
                                            : selectedDriver?.name
                                        }
                                    </h2>
                                    <p className="text-gray-500 text-sm">
                                        {selectedDrivers.length > 1
                                            ? "التسوية ستتم لجميع الطلبات المعلقة"
                                            : "تحديد الطلبات المراد تسويتها"
                                        }
                                    </p>
                                </div>

                                {/* Treasury Info (Read-only) */}
                                <div className="flex flex-wrap items-center gap-3">
                                    <div className="text-left bg-blue-50 dark:bg-blue-900/20 px-3 py-2 rounded-xl border border-blue-200 dark:border-blue-700">
                                        <span className="block text-xs text-blue-600 dark:text-blue-400">💰 الخزن المستهدفة</span>
                                        <span className="block text-sm font-bold text-blue-700 dark:text-blue-300">
                                            {selectedDrivers.length > 1
                                                ? "خزن الفروع (تلقائي)"
                                                : `خزنة فرع ${selectedDriver?.branch?.name || 'الفرع'}`
                                            }
                                        </span>
                                    </div>

                                    <div className="text-left">
                                        <span className="block text-xs text-gray-500">المبلغ المحدد للتسوية</span>
                                        <span className="block text-xl font-bold text-blue-600 dark:text-blue-400">
                                            {selectedDrivers.length > 1
                                                ? calculateTotalDebtForSelectedDrivers().toFixed(2)
                                                : calculateTotal().toFixed(2)
                                            } ج.م
                                        </span>
                                    </div>
                                    <button
                                        onClick={handleSettle}
                                        disabled={(selectedDrivers.length === 0 && selectedSales.length === 0) || settling}
                                        className="px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 text-sm">
                                        <span className="material-icons-round text-base">lock</span>
                                        {settling ? "جاري التسوية..." : "تأكيد المدير والتسوية"}
                                    </button>
                                </div>
                            </div>

                            {selectedDriver && selectedDrivers.length <= 1 && (
                                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                    {history.salesByDate.length === 0 && (
                                        <div className="text-center py-12 text-gray-500">لا يوجد سجل تاريخي</div>
                                    )}

                                    {history.salesByDate.map(day => (
                                        <div key={day.date} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                                            <div className="bg-gray-50 dark:bg-gray-700/50 p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                                                <div className="flex items-center gap-3">
                                                    <input
                                                        type="checkbox"
                                                        className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                        checked={day.orders.filter(o => o.deliveryStatus === 'OUT_FOR_DELIVERY').every(o => selectedSales.includes(o.id))}
                                                        onChange={() => toggleDaySelection(day)}
                                                        disabled={day.status === 'Settled'}
                                                    />
                                                    <span className="font-bold text-gray-700 dark:text-gray-200">{day.date}</span>
                                                    <span className={`px-2 py-0.5 text-xs rounded-full ${day.status === 'Settled' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                                        {day.status === 'Settled' ? 'تمت التسوية' : 'معلق'}
                                                    </span>
                                                </div>
                                                <div className="text-sm font-medium text-gray-600 dark:text-gray-300">
                                                    إجمالي اليوم (مديونية): <span className="text-gray-900 dark:text-white font-bold">{day.totalNetDebt.toFixed(2)} ج.م</span>
                                                </div>
                                            </div>

                                            <div className="divide-y divide-gray-100 dark:divide-gray-700">
                                                {day.orders.map(order => {
                                                    const total = parseFloat(order.total) || 0;
                                                    const fee = parseFloat(order.deliveryFee) || 0;
                                                    const share = parseFloat(order.deliveryDriverShare) || 0;
                                                    const netDebt = total - share;

                                                    return (
                                                        <div
                                                            key={order.id}
                                                            className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors ${order.deliveryStatus === 'DELIVERED' ? 'opacity-50 grayscale' : 'cursor-pointer'
                                                                }`}
                                                            onClick={() => order.deliveryStatus !== 'DELIVERED' && toggleSaleSelection(order.id)}
                                                        >
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center gap-4">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={selectedSales.includes(order.id)}
                                                                        onChange={() => { }}
                                                                        disabled={order.deliveryStatus === 'DELIVERED'}
                                                                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                                                                    />
                                                                    <div>
                                                                        <span className="block font-bold text-gray-800 dark:text-gray-200">طلب #{order.saleNumber}</span>
                                                                        <div className="text-xs text-gray-500 mt-1 flex gap-4">
                                                                            <span>المبلغ: {total.toFixed(2)}</span>
                                                                            <span className="text-green-600">+{fee.toFixed(2)} رسوم</span>
                                                                            <span className="text-red-600">-{share.toFixed(2)} حصة</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="text-right">
                                                                    <span className="block font-bold text-xl text-gray-900 dark:text-white">{netDebt.toFixed(2)} ج.م</span>
                                                                    <span className="text-xs text-gray-400">صافي الدين</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {selectedDrivers.length > 1 && (
                                <div className="flex-1 overflow-y-auto p-6">
                                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                                        <h3 className="text-lg font-bold mb-4">الطيارين المحددين للتسوية الجماعية:</h3>
                                        <div className="space-y-3">
                                            {selectedDrivers.map(driver => (
                                                <div key={driver.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                                                    <span className="font-medium">{driver.name}</span>
                                                    <span className="font-bold text-red-600">{parseFloat(driver.walletBalance).toFixed(2)} ج.م</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
                                            <span className="text-lg font-bold">الإجمالي:</span>
                                            <span className="text-2xl font-bold text-blue-600">{calculateTotalDebtForSelectedDrivers().toFixed(2)} ج.م</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                                <label className="block text-sm font-bold mb-2 dark:text-white">ملاحظات التسوية</label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="أضف أي ملاحظات هنا..."
                                    rows="2"
                                />
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                            <span className="material-icons-round text-6xl mb-4">motorcycle</span>
                            <p className="text-xl">اختر طيار أو عدة طيارين لبدء التسوية</p>
                        </div>
                    )
                )}

                {/* Daily Report View */}
                {viewMode === 'report' && (
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">التقرير اليومي</h2>

                        {dailyReport.length === 0 && !loading && (
                            <div className="text-center py-12 text-gray-500">لا توجد بيانات للفترة المحددة</div>
                        )}

                        {dailyReport.map(day => (
                            <div key={day.date} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 border-b border-gray-200 dark:border-gray-700">
                                    <div className="flex justify-between items-center">
                                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">{day.date}</h3>
                                        <div className="text-right">
                                            <div className="text-sm text-gray-600 dark:text-gray-400">إجمالي اليوم</div>
                                            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{day.totalDebt.toFixed(2)} ج.م</div>
                                            <div className="text-xs text-gray-500">{day.totalOrders} طلب</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 space-y-4">
                                    {day.drivers.map(driver => (
                                        <div key={driver.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                            <div className="flex justify-between items-center mb-3">
                                                <h4 className="font-bold text-gray-900 dark:text-white">{driver.name}</h4>
                                                <span className="font-bold text-red-600">{driver.totalDebt.toFixed(2)} ج.م</span>
                                            </div>
                                            <div className="space-y-2">
                                                {driver.orders.map(order => {
                                                    const total = order.total || 0;
                                                    const fee = order.deliveryFee || 0;
                                                    const share = order.deliveryDriverShare || 0;
                                                    const netDebt = total - share;

                                                    return (
                                                        <div key={order.id} className="flex justify-between items-center text-sm bg-gray-50 dark:bg-gray-900 p-2 rounded">
                                                            <span className="text-gray-700 dark:text-gray-300">#{order.saleNumber}</span>
                                                            <div className="flex gap-3 text-xs">
                                                                <span>{total.toFixed(2)}</span>
                                                                <span className="text-green-600">+{fee.toFixed(2)}</span>
                                                                <span className="text-red-600">-{share.toFixed(2)}</span>
                                                                <span className="font-bold">= {netDebt.toFixed(2)}</span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Hidden Receipt Component */}
            <div style={{ display: 'none' }}>
                <SettlementReceipt ref={receiptRef} data={printData} />
            </div>

            {/* Manager Verification Modal */}
            <ManagerVerificationModal
                isOpen={showManagerVerification}
                onClose={() => setShowManagerVerification(false)}
                onVerify={handleManagerVerify}
                title="تأكيد التسوية"
                description={
                    settlementType === 'bulk'
                        ? `أنت على وشك تسوية مديونية ${selectedDrivers.length} طيار بإجمالي ${calculateTotalDebtForSelectedDrivers().toFixed(2)} ج.م`
                        : `أنت على وشك تسوية مديونية ${selectedDriver?.name} بمبلغ ${calculateTotal().toFixed(2)} ج.م`
                }
                loading={settling}
                zIndex="z-[70]"
            />
        </div>
    );
};

export default DeliverySettlementPage;
