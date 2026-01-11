import React from "react";
import GenericPageManager from "../../../components/shared/GenericPageManager";
import ReportFilterForm from "../../../components/shared/ReportFilterForm";
import Modal from "../../../components/ui/Modal";
import { treasuryService } from "../../../services/domainServices";

const transferServiceAdapter = {
  ...treasuryService,
  getAll: treasuryService.getTransfers,
};

const CashTransferHistory = () => {
  const [selectedTransfer, setSelectedTransfer] = React.useState(null);
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  const columns = [
    {
      header: "من خزينة",
      accessor: "fromTreasury",
      render: (item) => item.fromTreasury?.name || "-",
    },
    {
      header: "إلى خزينة",
      accessor: "toTreasury",
      render: (item) => item.toTreasury?.name || "-",
    },
    { header: "المبلغ", accessor: "amount" },
    {
      header: "التاريخ",
      accessor: "date",
      render: (item) => new Date(item.createdAt).toLocaleDateString("ar-EG"),
    },
    {
      header: "بواسطة",
      accessor: "createdBy",
      render: (item) => item.createdBy?.name || "-",
    },
    {
      header: "الموافقة بواسطة",
      accessor: "acceptedBy",
      render: (item) => item.acceptedBy?.name || "-",
    },
    {
      header: "الحالة",
      accessor: "status",
      render: (item) => (
        <span
          className={`px-2 py-1 rounded-full text-xs font-bold ${
            item.status === "APPROVED"
              ? "bg-green-100 text-green-800"
              : item.status === "REJECTED"
              ? "bg-red-100 text-red-800"
              : "bg-yellow-100 text-yellow-800"
          }`}>
          {item.status === "APPROVED"
            ? "مقبول"
            : item.status === "REJECTED"
            ? "مرفوض"
            : "قيد الانتظار"}
        </span>
      ),
    },
  ];

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedTransfer(null);
  };

  return (
    <>
      <GenericPageManager
        title="سجل تحويلات الخزينة"
        subtitle="حركة الأموال بين الخزائن"
        icon="account_balance"
        service={transferServiceAdapter}
        columns={columns}
        FormComponent={({ onFilter }) => (
          <ReportFilterForm onFilter={onFilter} />
        )}
        backPath="/reports/detailed"
        hideAddButton={true}
        customActions={(item) => [
          {
            label: "View Details",
            icon: "visibility",
            color: "text-blue-500",
            onClick: () => {
              setSelectedTransfer(item);
              setIsModalOpen(true);
            },
          },
        ]}
      />

      {/* Detail Modal */}
      {isModalOpen && selectedTransfer && (
        <Modal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          title={`تفاصيل التحويل رقم #${selectedTransfer.id}`}>
          <div className="space-y-4 text-right" dir="rtl">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-sm text-gray-500 mb-1">من خزينة</p>
                <p className="font-semibold">
                  {selectedTransfer.fromTreasury?.name || "-"}
                </p>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-sm text-gray-500 mb-1">إلى خزينة</p>
                <p className="font-semibold">
                  {selectedTransfer.toTreasury?.name || "-"}
                </p>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-sm text-gray-500 mb-1">المبلغ</p>
                <p className="font-bold text-lg text-primary">
                  {selectedTransfer.amount}
                </p>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-sm text-gray-500 mb-1">التاريخ</p>
                <p className="font-semibold">
                  {new Date(selectedTransfer.createdAt).toLocaleString("ar-EG")}
                </p>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-sm text-gray-500 mb-1">بواسطة</p>
                <p className="font-semibold">
                  {selectedTransfer.createdBy?.name || "-"}
                </p>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-sm text-gray-500 mb-1">تم القبول بواسطة</p>
                <p className="font-semibold">
                  {selectedTransfer.acceptedBy?.name || "-"}
                </p>
              </div>
            </div>

            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-sm text-gray-500 mb-1">ملاحظات</p>
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {selectedTransfer.notes || "لا توجد ملاحظات"}
              </p>
            </div>

            <div className="flex justify-end pt-4 border-t border-gray-100 dark:border-gray-700">
              <span
                className={`px-3 py-1 rounded-full text-sm font-bold ${
                  selectedTransfer.status === "APPROVED"
                    ? "bg-green-100 text-green-800"
                    : selectedTransfer.status === "REJECTED"
                    ? "bg-red-100 text-red-800"
                    : "bg-yellow-100 text-yellow-800"
                }`}>
                {selectedTransfer.status === "APPROVED"
                  ? "مقبول"
                  : selectedTransfer.status === "REJECTED"
                  ? "مرفوض"
                  : "قيد الانتظار"}
              </span>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};

export default CashTransferHistory;
