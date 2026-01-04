import React from "react";
import GenericPageManager from "../../../components/shared/GenericPageManager";
import { branchService } from "../../../services/domainServices";

const StockTransferHistory = () => {
  const columns = [
    { header: "من مخزن", accessor: "fromWarehouse" },
    { header: "إلى مخزن", accessor: "toWarehouse" },
    { header: "الصنف", accessor: "itemName" },
    { header: "الكمية", accessor: "quantity" },
    { header: "التاريخ", accessor: "date" },
  ];

  return (
    <GenericPageManager
      title="سجل تحويلات المخزون"
      subtitle="حركة البضائع بين المخازن"
      icon="inventory"
      service={branchService}
      columns={columns}
      FormComponent={() => <div>Form Placeholder</div>}
      backPath="/reports/detailed"
      hideAddButton={true}
    />
  );
};

export default StockTransferHistory;
