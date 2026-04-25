import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { inventoryService } from "../../services/inventoryService";
import toast from "react-hot-toast";
import Icon from "../../components/ui/Icon";

const ReorderAlertsPage = () => {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    inventoryService.getReorderAlerts()
      .then((data) => setAlerts(Array.isArray(data) ? data : []))
      .catch(() => toast.error("فشل تحميل تنبيهات إعادة الطلب"))
      .finally(() => setLoading(false));
  }, []);

  // Group by warehouse
  const grouped = {};
  alerts.forEach((a) => {
    if (!grouped[a.warehouseName]) grouped[a.warehouseName] = [];
    grouped[a.warehouseName].push(a);
  });

  return (
    <div className="bg-background-light dark:bg-background-dark min-h-screen p-4 sm:p-8" dir="rtl">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate("/inventory")}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            <Icon name="arrow_forward" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-text-main dark:text-text-dark flex items-center gap-2">
              <Icon name="warning" className="text-orange-500" />
              تنبيهات إعادة الطلب
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {alerts.length > 0 ? `${alerts.length} صنف تحت حد إعادة الطلب` : "لا توجد تنبيهات"}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Icon name="sync" className="animate-spin text-primary text-4xl" />
          </div>
        ) : alerts.length === 0 ? (
          <div className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-border-light dark:border-border-dark p-12 text-center shadow-sm">
            <Icon name="check_circle" className="text-6xl text-green-400 mb-3 block" />
            <p className="text-lg font-medium text-gray-500">جميع الأصناف أعلى من حد إعادة الطلب</p>
          </div>
        ) : (
          Object.entries(grouped).map(([warehouseName, items]) => (
            <div key={warehouseName} className="mb-6">
              <h3 className="text-lg font-bold text-text-main dark:text-text-dark mb-3 flex items-center gap-2">
                <Icon name="warehouse" className="text-gray-400" />
                {warehouseName}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map((alert, idx) => {
                  const pct = alert.reorderPoint > 0 ? Math.round((alert.quantity / alert.reorderPoint) * 100) : 0;
                  const isZero = alert.quantity <= 0;
                  return (
                    <div key={idx} className={`bg-surface-light dark:bg-surface-dark rounded-xl border p-4 shadow-sm ${
                      isZero ? "border-red-300 bg-red-50/50" : "border-orange-200"
                    }`}>
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-bold text-text-main dark:text-text-dark">{alert.itemName}</p>
                          <p className="text-xs text-gray-400">{alert.unit}</p>
                        </div>
                        {isZero ? (
                          <span className="px-2 py-0.5 rounded bg-red-100 text-red-700 text-xs font-bold border border-red-200">نفذ</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-orange-100 text-orange-700 text-xs font-bold border border-orange-200">منخفض</span>
                        )}
                      </div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-500">الكمية: <strong className={isZero ? "text-red-600" : "text-orange-600"}>{alert.quantity}</strong></span>
                        <span className="text-gray-500">الحد: <strong>{alert.reorderPoint}</strong></span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div className={`h-2 rounded-full ${isZero ? "bg-red-500" : "bg-orange-500"}`}
                          style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ReorderAlertsPage;
