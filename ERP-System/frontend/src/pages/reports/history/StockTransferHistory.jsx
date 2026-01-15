import React, { useState } from "react";
import GenericPageManager from "../../../components/shared/GenericPageManager";
import ReportFilterForm from "../../../components/shared/ReportFilterForm";
import { stockTransferService } from "../../../services/stockTransferService";
import StockTransferDetailsModal from "./StockTransferDetailsModal";

const StockTransferHistory = () => {
  const [selectedTransfer, setSelectedTransfer] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const columns = [
    { header: "رقم التحويل", accessor: "transferNumber" },
    {
      header: "من مخزن",
      accessor: "fromWarehouse",
      render: (row) => row.fromWarehouse?.name,
    },
    {
      header: "إلى مخزن",
      accessor: "toWarehouse",
      render: (row) => row.toWarehouse?.name,
    },
    {
      header: "التاريخ",
      accessor: "createdAt",
      render: (row) => new Date(row.createdAt).toLocaleDateString("en-GB"),
    },
    {
      header: "الوقت",
      accessor: "createdAt",
      render: (row) => new Date(row.createdAt).toLocaleTimeString("en-GB"),
    },
    {
      header: "بواسطة",
      accessor: "user",
      render: (row) => row.user?.name,
    },
    { header: "ملاحظات", accessor: "notes", wrap: true },
  ];

  const handleViewDetails = (transfer) => {
    setSelectedTransfer(transfer);
    setIsDetailsOpen(true);
  };

  const customActions = (item) => [
    {
      icon: "visibility",
      label: "عرض التفاصيل",
      onClick: () => handleViewDetails(item),
      color: "text-blue-500",
      hoverColor: "hover:bg-blue-50 dark:hover:bg-blue-900/20",
    },
  ];

  return (
    <>
      <GenericPageManager
        title="سجل تحويلات المخزون"
        subtitle="حركة البضائع بين المخازن"
        icon="move_down"
        service={stockTransferService}
        columns={columns}
        FilterComponent={ReportFilterForm}
        customActions={customActions}
        backPath="/reports/detailed"
        hideAddButton={true}
      />

      <StockTransferDetailsModal
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        transfer={selectedTransfer}
      />
    </>
  );
};

export default StockTransferHistory;
