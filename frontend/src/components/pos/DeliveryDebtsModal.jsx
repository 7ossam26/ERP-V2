import React, { useState, useEffect } from "react";
import { deliveryService } from "../../services/deliveryService";
import DeliverySettlementModal from "../../pages/delivery/DeliverySettlementModal";
import toast from "react-hot-toast";

const DeliveryDebtsModal = ({ isOpen, onClose, branchId, currentShiftId }) => {
  const [riderDebts, setRiderDebts] = useState([]);
  const [isSettlementModalOpen, setIsSettlementModalOpen] = useState(false);
  const [selectedSettlementDriver, setSelectedSettlementDriver] =
    useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchRiderDebts();
    }
  }, [isOpen, branchId, currentShiftId]);

  const fetchRiderDebts = async () => {
    try {
      if (!branchId || branchId === "undefined") {
        setRiderDebts([]);
        return;
      }

      if (!currentShiftId) {
        console.warn("DeliveryDebtsModal: No currentShiftId provided");
        setRiderDebts([]);
        return;
      }

      console.log("📊 DeliveryDebtsModal: Fetching stats with:", {
        branchId,
        shiftId: currentShiftId,
      });

      const data = await deliveryService.getStats({
        branchId,
        shiftId: currentShiftId,
      });

      console.log(
        "📊 DeliveryDebtsModal: Raw API response:",
        JSON.stringify(data),
      );
      console.log(
        `📊 DeliveryDebtsModal: Total delivery men returned: ${data?.length || 0}`,
      );

      // Filter to only show riders who actually have pending orders
      const ridersWithOrders = (data || []).filter((r) => r.orderCount > 0);
      console.log(
        `📊 DeliveryDebtsModal: Riders with orders: ${ridersWithOrders.length}`,
      );

      setRiderDebts(ridersWithOrders);
    } catch (error) {
      console.error("Failed to fetch rider debts:", error);
      toast.error(error.message || "فشل تحميل ديون الطيارين");
    }
  };

  const handleOpenSettlement = (rider) => {
    const driverData = {
      id: rider.id,
      name: rider.name,
      walletBalance: rider.totalCash,
    };
    setSelectedSettlementDriver(driverData);
    setIsSettlementModalOpen(true);
  };

  const handleSettleSubmit = async (data) => {
    await deliveryService.settle(data);
    toast.success("تمت التسوية بنجاح");
    setIsSettlementModalOpen(false);
    fetchRiderDebts(); // Refresh list
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <span className="material-icons-round text-primary text-3xl">
                account_balance_wallet
              </span>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  ديون الطيارين
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  متابعة وتسوية العهد المالية للطيارين
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
              <span className="material-icons-round text-gray-500">close</span>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <span className="material-icons-round text-sm">info</span>
                هذا العرض يوضح إجمالي المبالغ النقدية لطلبات التوصيل التي لم يتم
                تحصيلها بعد.
              </p>
            </div>

            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="w-full text-sm text-right">
                <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300">
                  <tr>
                    <th className="px-4 py-3 font-bold">الطيار</th>
                    <th className="px-4 py-3 font-bold">عدد الطلبات</th>
                    <th className="px-4 py-3 font-bold">إجمالي النقدية</th>
                    <th className="px-4 py-3 font-bold">إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {riderDebts.length > 0 ? (
                    riderDebts.map((rider) => (
                      <React.Fragment key={rider.id}>
                        <tr className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                          <td className="px-4 py-4 font-bold text-gray-900 dark:text-gray-100">
                            <div className="flex items-center gap-2">
                              <span className="material-icons-round text-gray-400">
                                two_wheeler
                              </span>
                              {rider.name}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-gray-600 dark:text-gray-400">
                            {rider.orderCount} طلب
                          </td>
                          <td className="px-4 py-4 font-bold text-red-600 dark:text-red-400 text-lg">
                            {parseFloat(rider.totalCash).toFixed(2)} ج.م
                          </td>
                          <td className="px-4 py-4">
                            <button
                              onClick={() => handleOpenSettlement(rider)}
                              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-bold transition-colors flex items-center gap-2 shadow-sm">
                              <span className="material-icons-round text-sm">
                                payments
                              </span>
                              تسوية
                            </button>
                          </td>
                        </tr>
                        {/* Orders Detail */}
                        {rider.orders?.map((order, idx) => (
                          <tr
                            key={order.id}
                            className="bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                            <td className="px-4 py-2 pr-10 text-xs text-gray-500">
                              └ طلب #{idx + 1}
                            </td>
                            <td className="px-4 py-2 text-xs text-gray-400">
                              —
                            </td>
                            <td className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400">
                              {parseFloat(order.total).toFixed(2)} ج.م
                            </td>
                            <td className="px-4 py-2"></td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan="4"
                        className="px-4 py-12 text-center text-gray-500 bg-white dark:bg-gray-800">
                        {!branchId ? (
                          <div className="flex flex-col items-center gap-2">
                            <span className="material-icons-round text-gray-400 text-4xl">
                              store_off
                            </span>
                            <p className="font-bold">الحساب غير مرتبط بفرع</p>
                            <p className="text-sm">لا يمكن عرض ديون الطيارين بدون فرع محدد</p>
                          </div>
                        ) : !currentShiftId ? (
                          <div className="flex flex-col items-center gap-2">
                            <span className="material-icons-round text-yellow-500 text-4xl">
                              warning
                            </span>
                            <p className="font-bold">لا توجد وردية نشطة</p>
                            <p className="text-sm">
                              يرجى بدء وردية جديدة لعرض ديون الطيارين
                            </p>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                            <span className="material-icons-round text-gray-300 text-4xl">
                              inbox
                            </span>
                            <p>لا توجد ديون معلقة حالياً</p>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white font-bold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
              إغلاق
            </button>
          </div>
        </div>
      </div>

      {isSettlementModalOpen && (
        <DeliverySettlementModal
          deliveryMan={selectedSettlementDriver}
          onClose={() => setIsSettlementModalOpen(false)}
          onSettle={handleSettleSubmit}
        />
      )}
    </>
  );
};

export default DeliveryDebtsModal;
