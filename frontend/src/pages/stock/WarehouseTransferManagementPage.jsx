import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { stockTransferService } from "../../services/stockTransferService";

const WarehouseTransferManagementPage = () => {
  const [loading, setLoading] = useState(true);
  const [transfers, setTransfers] = useState([]);
  const [filteredTransfers, setFilteredTransfers] = useState([]);
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    fetchTransfers();
  }, []);

  useEffect(() => {
    filterTransfers();
  }, [transfers, activeFilter]);

  const fetchTransfers = async () => {
    try {
      setLoading(true);
      const data = await stockTransferService.getAll();
      setTransfers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load warehouse transfers:", error);
      toast.error(error.message || "فشل في تحميل التحويلات المخزنية");
    } finally {
      setLoading(false);
    }
  };

  const filterTransfers = () => {
    if (activeFilter === "ALL") {
      setFilteredTransfers(transfers);
    } else {
      setFilteredTransfers(transfers.filter((t) => t.status === activeFilter));
    }
  };

  const handleApprove = async (id) => {
    try {
      setActionLoading(id);
      await stockTransferService.approve(id);
      toast.success("تم قبول التحويل المخزني بنجاح");
      fetchTransfers();
    } catch (error) {
      console.error("Failed to approve transfer:", error);
      toast.error(error.message || "فشل في قبول التحويل");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id) => {
    try {
      setActionLoading(id);
      await stockTransferService.reject(id);
      toast.success("تم رفض التحويل وإرجاع المخزون");
      fetchTransfers();
    } catch (error) {
      console.error("Failed to reject transfer:", error);
      toast.error(error.message || "فشل في رفض التحويل");
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      PENDING: {
        bg: "bg-yellow-100 dark:bg-yellow-900/30",
        text: "text-yellow-800 dark:text-yellow-200",
        label: "قيد الانتظار",
      },
      APPROVED: {
        bg: "bg-green-100 dark:bg-green-900/30",
        text: "text-green-800 dark:text-green-200",
        label: "مقبول",
      },
      REJECTED: {
        bg: "bg-red-100 dark:bg-red-900/30",
        text: "text-red-800 dark:text-red-200",
        label: "مرفوض",
      },
      COMPLETED: {
        bg: "bg-blue-100 dark:bg-blue-900/30",
        text: "text-blue-800 dark:text-blue-200",
        label: "مكتمل",
      },
    };

    const badge = badges[status] || badges.PENDING;

    return (
      <span
        className={`px-3 py-1 rounded-full text-xs font-bold ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString("ar-EG", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatQuantity = (q) => {
    const n = Number(q);
    if (Number.isNaN(n)) return q;
    return Number.isInteger(n) ? n.toString() : n.toFixed(2).replace(/\.?0+$/, "");
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-text-primary dark:text-text-dark mb-2">
          إدارة التحويلات المخزنية
        </h1>
        <p className="text-text-secondary dark:text-gray-400">
          عرض وقبول ورفض التحويلات بين المخازن
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto">
        {[
          { key: "ALL", label: "الكل" },
          { key: "PENDING", label: "قيد الانتظار" },
          { key: "APPROVED", label: "مقبول" },
          { key: "REJECTED", label: "مرفوض" },
        ].map((filter) => (
          <button
            key={filter.key}
            onClick={() => setActiveFilter(filter.key)}
            className={`px-6 py-2 rounded-xl font-bold transition-all whitespace-nowrap ${activeFilter === filter.key
                ? "bg-primary text-white shadow-lg"
                : "bg-surface-light dark:bg-surface-dark text-text-primary dark:text-text-dark hover:bg-accent/20"
              }`}>
            {filter.label}
          </button>
        ))}
      </div>

      {/* Transfers List */}
      <div className="space-y-4">
        {filteredTransfers.length === 0 ? (
          <div className="text-center py-12 bg-surface-light dark:bg-surface-dark rounded-2xl">
            <span className="material-icons-round text-6xl text-gray-300 dark:text-gray-600 mb-4">
              inventory_2
            </span>
            <p className="text-gray-500 dark:text-gray-400">لا توجد تحويلات</p>
          </div>
        ) : (
          filteredTransfers.map((transfer) => {
            const totalQty = (transfer.items || []).reduce(
              (sum, it) => sum + Number(it.quantity || 0),
              0
            );

            return (
              <div
                key={transfer.id}
                className="bg-surface-light dark:bg-surface-dark rounded-2xl p-6 shadow-sm border border-border-light dark:border-border-dark">
                <div className="flex flex-col md:flex-row justify-between gap-4">
                  {/* Transfer Info */}
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-xl font-bold text-primary">
                        {transfer.transferNumber}
                      </span>
                      {getStatusBadge(transfer.status)}
                      <span className="text-sm text-text-secondary dark:text-gray-400">
                        ({transfer.items?.length || 0} صنف — إجمالي {formatQuantity(totalQty)})
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-sm flex-wrap">
                      <span className="font-bold text-text-primary dark:text-text-dark">
                        من:
                      </span>
                      <span className="bg-accent/20 px-3 py-1 rounded-lg">
                        {transfer.fromWarehouse?.name}
                      </span>
                      <span className="material-icons-round text-primary">
                        arrow_back
                      </span>
                      <span className="font-bold text-text-primary dark:text-text-dark">
                        إلى:
                      </span>
                      <span className="bg-primary/20 px-3 py-1 rounded-lg text-primary font-bold">
                        {transfer.toWarehouse?.name}
                      </span>
                    </div>

                    {/* Items list */}
                    {transfer.items?.length > 0 && (
                      <div className="bg-background-light dark:bg-background-dark rounded-lg p-3 max-h-40 overflow-y-auto">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs">
                          {transfer.items.map((it) => (
                            <div
                              key={it.id}
                              className="flex justify-between gap-2 border-b border-border-light/50 dark:border-border-dark/50 py-1">
                              <span className="text-text-primary dark:text-text-dark truncate">
                                {it.item?.name || `#${it.itemId}`}
                              </span>
                              <span className="font-bold text-primary whitespace-nowrap">
                                × {formatQuantity(it.quantity)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="text-xs text-text-secondary dark:text-gray-400 flex flex-wrap gap-3">
                      <span>
                        <span className="material-icons-round text-sm align-middle mr-1">
                          schedule
                        </span>
                        {formatDate(transfer.createdAt)}
                      </span>
                      {transfer.user?.name && (
                        <span>
                          <span className="material-icons-round text-sm align-middle mr-1">
                            person
                          </span>
                          {transfer.user.name}
                        </span>
                      )}
                      {transfer.acceptedBy?.name && (
                        <span>
                          <span className="material-icons-round text-sm align-middle mr-1">
                            verified_user
                          </span>
                          {transfer.acceptedBy.name}
                        </span>
                      )}
                    </div>

                    {transfer.notes && (
                      <div className="text-sm text-text-secondary dark:text-gray-400 bg-background-light dark:bg-background-dark px-3 py-2 rounded-lg">
                        <span className="font-bold">ملاحظات:</span>{" "}
                        {transfer.notes}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {transfer.status === "PENDING" && (
                    <div className="flex md:flex-col gap-2">
                      <button
                        onClick={() => handleApprove(transfer.id)}
                        disabled={actionLoading === transfer.id}
                        className="flex-1 md:flex-none bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                        {actionLoading === transfer.id ? (
                          <span className="material-icons-round animate-spin text-sm">
                            refresh
                          </span>
                        ) : (
                          <span className="material-icons-round text-sm">
                            check_circle
                          </span>
                        )}
                        قبول
                      </button>
                      <button
                        onClick={() => handleReject(transfer.id)}
                        disabled={actionLoading === transfer.id}
                        className="flex-1 md:flex-none bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                        {actionLoading === transfer.id ? (
                          <span className="material-icons-round animate-spin text-sm">
                            refresh
                          </span>
                        ) : (
                          <span className="material-icons-round text-sm">
                            cancel
                          </span>
                        )}
                        رفض
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default WarehouseTransferManagementPage;
