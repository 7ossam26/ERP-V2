import React, { useEffect, useState } from "react";
import GenericPageManager from "../../../components/shared/GenericPageManager";
import ReportFilterForm from "../../../components/shared/ReportFilterForm";
import {
  overtimeService,
  branchService,
} from "../../../services/domainServices";
import EmployeeTransactionEditForm from "./EmployeeTransactionEditForm";

const OvertimeHistory = () => {
  const [branches, setBranches] = useState([]);

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const data = await branchService.getAll();
        setBranches(data);
      } catch (error) {
        console.error("Failed to fetch branches", error);
      }
    };
    fetchBranches();
  }, []);

  const columns = [
    { header: "الموظف", accessor: "employeeName" },
    { header: "الفرع", accessor: "branchName" },
    { header: "المبلغ", accessor: "amount" },
    { header: "السبب", accessor: "reason", wrap: true },
    { header: "التاريخ", accessor: "date" },
    { header: "الوقت", accessor: "time" },
    { header: "تم الإنشاء بواسطة", accessor: "createdBy" },
  ];

  return (
    <GenericPageManager
      title="سجل الاضافي"
      subtitle="أجور الاضافي للموظفين"
      icon="more_time"
      service={overtimeService}
      columns={columns}
      FilterComponent={ReportFilterForm}
      branches={branches} // Pass branches to GenericPageManager -> FilterComponent
      FormComponent={EmployeeTransactionEditForm}
      backPath="/reports/detailed"
      hideAddButton={true}
    />
  );
};

export default OvertimeHistory;
