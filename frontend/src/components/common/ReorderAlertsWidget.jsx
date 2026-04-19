import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { inventoryService } from "../../services/inventoryService";

const ReorderAlertsWidget = () => {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    inventoryService.getReorderAlerts()
      .then((data) => setAlerts(Array.isArray(data) ? data.slice(0, 5) : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (alerts.length === 0) return null;

  return (
    <div className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-orange-200 dark:border-orange-800 p-4 shadow-sm" dir="rtl">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-bold text-text-main dark:text-text-dark flex items-center gap-2">
          <span className="material-icons-round text-orange-500 text-[18px]">warning</span>
          تنبيهات المخزون
        </h3>
        <button onClick={() => navigate("/inventory/alerts")}
          className="text-xs text-primary font-medium hover:underline">
          عرض الكل
        </button>
      </div>
      <div className="space-y-2">
        {alerts.map((a, idx) => {
          const isZero = a.quantity <= 0;
          return (
            <div key={idx} className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isZero ? "bg-red-500" : "bg-orange-400"}`} />
                <span className="text-sm truncate">{a.itemName}</span>
              </div>
              <span className={`text-xs font-bold flex-shrink-0 ${isZero ? "text-red-600" : "text-orange-600"}`}>
                {a.quantity} / {a.reorderPoint}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ReorderAlertsWidget;
