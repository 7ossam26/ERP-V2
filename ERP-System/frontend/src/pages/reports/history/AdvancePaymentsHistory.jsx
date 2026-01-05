import React from "react";
import GenericPageManager from "../../../components/shared/GenericPageManager";
import ReportFilterForm from "../../../components/shared/ReportFilterForm";
import { employeeService } from "../../../services/domainServices";

const AdvancePaymentsHistory = () => {
  const columns = [
    { header: "الموظف", accessor: "employeeName" },
    { header: "التاريخ", accessor: "date" },
    { header: "المبلغ", accessor: "amount" },
    { header: "السبب", accessor: "reason" },
    { header: "الحالة", accessor: "status" },
  ];

  return (
    <GenericPageManager
      title="سجل السلف"
      subtitle="تاريخ سلف الموظفين"
      icon="payments"
      service={employeeService} // Placeholder service for now
      columns={columns}
      FormComponent={({ onFilter }) => <ReportFilterForm onFilter={onFilter} />}
      backPath="/reports/detailed"
      hideAddButton={true}
    />
  );
};

export default AdvancePaymentsHistory;
