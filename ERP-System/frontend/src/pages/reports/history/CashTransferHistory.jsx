import React from "react";
import GenericPageManager from "../../../components/shared/GenericPageManager";
import { treasuryService } from "../../../services/domainServices";

const CashTransferHistory = () => {
  const columns = [
    { header: "من خزينة", accessor: "fromTreasury" },
    { header: "إلى خزينة", accessor: "toTreasury" },
    { header: "المبلغ", accessor: "amount" },
    { header: "التاريخ", accessor: "date" },
    { header: "الموظف", accessor: "employee" },
  ];

  return (
    <GenericPageManager
      title="سجل تحويلات الخزينة"
      subtitle="حركة الأموال بين الخزائن"
      icon="account_balance"
      service={treasuryService}
      columns={columns}
      FormComponent={() => <div>Form Placeholder</div>}
      backPath="/reports/detailed"
      hideAddButton={true}
    />
  );
};

export default CashTransferHistory;
