import React, { useEffect, useState } from "react";
import GenericPageManager from "../../../components/shared/GenericPageManager";
import ReportFilterForm from "../../../components/shared/ReportFilterForm";
import {
  advanceService,
  branchService,
} from "../../../services/domainServices";
import AdvancePaymentForm from "./AdvancePaymentForm";

const AdvancePaymentsHistory = () => {
  const [branches, setBranches] = useState([]);

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const data = await branchService.getAll();
        // Filter out the legacy "Main Branch" seed row
        const filteredBranches = data.filter(
          (branch) => branch.name !== "Main Branch",
        );
        setBranches(filteredBranches);
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
      title="سجل السلف"
      subtitle="تاريخ سلف الموظفين"
      icon="payments"
      service={advanceService}
      columns={columns}
      FilterComponent={ReportFilterForm}
      branches={branches}
      FormComponent={AdvancePaymentForm}
      backPath="/reports/detailed"
      hideAddButton={true}
    />
  );
};

export default AdvancePaymentsHistory;
