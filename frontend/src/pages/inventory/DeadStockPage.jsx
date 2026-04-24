import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { inventoryService } from "../../services/inventoryService";
import toast from "react-hot-toast";

const DeadStockPage = () => {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(90);

  const fetchData = async (d) => {
    setLoading(true);
    try {
      const result = await inventoryService.getDeadStock(d);
      setData(Array.isArray(result) ? result : []);
    } catch {
      toast.error("فشل تحميل بيانات المخزون الراكد");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(days); }, [days]);

  const totalValue = data.reduce((s, d) => s + d.stockValue, 0);

  return (
    <div className="bg-background-light dark:bg-background-dark min-h-screen p-4 sm:p-8" dir="rtl">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/inventory")}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
              <span className="material-icons-round">arrow_forward</span>
            </button>
            <div>
              <h2 className="text-2xl font-bold text-text-main dark:text-text-dark flex items-center gap-2">
                <span className="material-icons-round text-gray-500">inventory</span>
                المخزون الراكد
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                أصناف لم تُباع منذ {days} يوم — {data.length} صنف ({totalValue.toFixed(2)} ج.م)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">فترة:</span>
            {[30, 60, 90, 180].map((d) => (
              <button key={d} onClick={() => setDays(d)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  days === d ? "bg-primary text-white border-primary" : "border-border-light dark:border-border-dark hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}>
                {d} يوم
              </button>
            ))}
          </div>
        </div>

        <div className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-border-light dark:border-border-dark shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-background-light dark:bg-background-dark border-b border-border-light dark:border-border-dark">
                  <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-400">الصنف</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-400">المخزن</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-600 dark:text-gray-400">الكمية</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-600 dark:text-gray-400">سعر التكلفة</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-600 dark:text-gray-400">قيمة المخزون</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-600 dark:text-gray-400">آخر بيع</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-600 dark:text-gray-400">أيام بدون بيع</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="py-12 text-center text-gray-400">
                    <span className="material-icons-round animate-spin text-primary text-3xl">sync</span>
                  </td></tr>
                ) : data.length === 0 ? (
                  <tr><td colSpan={7} className="py-12 text-center text-gray-400">
                    <span className="material-icons-round text-4xl mb-2 block text-green-400">check_circle</span>
                    <p>لا يوجد مخزون راكد في هذه الفترة</p>
                  </td></tr>
                ) : data.map((item, idx) => (
                  <tr key={idx} className="border-b border-border-light dark:border-border-dark hover:bg-background-light dark:hover:bg-background-dark">
                    <td className="px-4 py-3 font-medium">{item.itemName} <span className="text-xs text-gray-400">({item.unit})</span></td>
                    <td className="px-4 py-3 text-gray-500">{item.warehouseName}</td>
                    <td className="px-4 py-3 text-center font-bold">{Number(item.quantity).toFixed(2)}</td>
                    <td className="px-4 py-3 text-center">{item.costPrice.toFixed(2)}</td>
                    <td className="px-4 py-3 text-center font-medium text-red-600">{item.stockValue.toFixed(2)}</td>
                    <td className="px-4 py-3 text-center text-xs text-gray-400">
                      {item.lastSaleDate ? new Date(item.lastSaleDate).toLocaleDateString("ar-EG") : "لم يُباع أبداً"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-bold ${
                        item.daysSinceLastSale === null ? "text-red-600" : item.daysSinceLastSale > 180 ? "text-red-600" : "text-orange-600"
                      }`}>
                        {item.daysSinceLastSale === null ? "∞" : item.daysSinceLastSale}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeadStockPage;
