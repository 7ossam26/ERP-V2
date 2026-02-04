import React, { useState } from "react";
import GenericPageManager from "../../../components/shared/GenericPageManager";
import { purchaseService } from "../../../services/domainServices";
import ReportFilterForm from "../../../components/shared/ReportFilterForm";
import { useNavigate } from "react-router-dom";
import PurchaseDetailsModal from "./PurchaseDetailsModal";

const PurchaseHistory = () => {
  const navigate = useNavigate();
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  const columns = [
    {
      header: "رقم الفاتورة",
      accessor: "id",
      render: (item) => `#${item.id}`,
    },
    {
      header: "المورد",
      accessor: "supplier",
      render: (item) => item.supplier?.name || "-",
    },
    {
      header: "الخزينة",
      accessor: "treasury",
      render: (item) => item.treasury?.name || "-",
    },
    {
      header: "المخزن",
      accessor: "warehouse",
      render: (item) => item.warehouse?.name || "-",
    },
    {
      header: "الوقت",
      accessor: "createdAt",
      render: (item) => {
        if (!item.createdAt) return "-";
        const date = new Date(item.createdAt);
        const day = String(date.getDate()).padStart(2, "0");
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, "0");
        const minutes = String(date.getMinutes()).padStart(2, "0");
        return `${day}-${month}-${year} ${hours}:${minutes}`;
      },
    },
    {
      header: "إجمالي المبلغ",
      accessor: "netTotal",
      render: (item) => `${Number(item.netTotal || 0).toFixed(2)} ج.م`,
    },
    {
      header: "المتبقي",
      accessor: "remaining",
      render: (item) => {
        const remaining = Number(item.remaining || 0);
        return (
          <span
            className={
              remaining > 0 ? "text-red-600 font-bold" : "text-green-600"
            }>
            {remaining.toFixed(2)} ج.م
          </span>
        );
      },
    },
  ];

  const customActions = (item) => [
    {
      label: "عرض",
      icon: "visibility",
      onClick: async () => {
        try {
          // Fetch full purchase details with nested relationships
          const fullPurchase = await purchaseService.getById(item.id);
          setSelectedPurchase(fullPurchase);
          setIsDetailsModalOpen(true);
        } catch (error) {
          console.error("Failed to fetch purchase details:", error);
          // Fallback to using the item from the list
          setSelectedPurchase(item);
          setIsDetailsModalOpen(true);
        }
      },
      color: "text-blue-600",
      hoverColor: "hover:bg-blue-50 dark:hover:bg-blue-900/20",
    },
  ];

  return (
    <>
      <div className="print:hidden">
        <GenericPageManager
          title="سجل المشتريات"
          subtitle="أرشيف فواتير الشراء"
          icon="shopping_cart"
          service={purchaseService}
          columns={columns}
          customActions={customActions}
          FormComponent={({ onFilter }) => (
            <ReportFilterForm onFilter={onFilter} />
          )}
          backPath="/reports/detailed"
          hideAddButton={true}
        />
      </div>

      <PurchaseDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => {
          setIsDetailsModalOpen(false);
          setSelectedPurchase(null);
        }}
        purchase={selectedPurchase}
      />
    </>
  );
};

export default PurchaseHistory;
