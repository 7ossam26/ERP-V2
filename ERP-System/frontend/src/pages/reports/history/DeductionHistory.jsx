import React from "react";
import GenericPageManager from "../../../components/shared/GenericPageManager";
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
      FormComponent={() => <div>Form Placeholder</div>}
      backPath="/reports/detailed"
      hideAddButton={true}
    />
  );
};

export default DeductionHistory;
