import React from "react";
import GenericPageManager from "../../../components/shared/GenericPageManager";
import ReportFilterForm from "../../../components/shared/ReportFilterForm";
import { employeeService } from "../../../services/domainServices";

const DeductionHistory = () => {
  const columns = [
    { header: "الموظف", accessor: "employeeName" },
    { header: "المبلغ", accessor: "amount" },
    { header: "السبب", accessor: "reason" },
    { header: "التاريخ", accessor: "date" },
  ];

  return (
    <GenericPageManager
      title="سجل الخصومات"
      subtitle="الخصومات والجزاءات"
      icon="money_off"
      service={employeeService}
      columns={columns}
      FormComponent={({ onFilter }) => <ReportFilterForm onFilter={onFilter} />}
      backPath="/reports/detailed"
      hideAddButton={true}
    />
  );
};

export default DeductionHistory;
