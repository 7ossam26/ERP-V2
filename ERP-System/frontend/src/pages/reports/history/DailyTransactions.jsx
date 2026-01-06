import React from "react";
import GenericPageManager from "../../../components/shared/GenericPageManager";
import {
  treasuryService,
  branchService,
} from "../../../services/domainServices";
import ReportFilterForm from "../../../components/shared/ReportFilterForm";
import { useState, useEffect } from "react";

const DailyTransactions = () => {
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState("all");

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
    { header: "رقم العملية", accessor: "id" },
    { header: "النوع", accessor: "type" },
    { header: "المبلغ", accessor: "amount" },
    { header: "التفاصيل", accessor: "details" },
    { header: "التوقيت", accessor: "timestamp" },
  ];

  const BranchFilter = (
    <div className="flex items-center gap-2">
      <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
        الفرع:
      </span>
      <select
        value={selectedBranch}
        onChange={(e) => setSelectedBranch(e.target.value)}
        className="bg-white dark:bg-surface-dark border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary outline-none">
        <option value="all">كل الفروع</option>
        {branches.map((branch) => (
          <option key={branch.id} value={branch.id}>
            {branch.name}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <GenericPageManager
      title="سجل المبيعات"
      subtitle="سجل المبيعات والفواتير"
      icon="receipt_long"
      service={treasuryService}
      columns={columns}
      FormComponent={({ onFilter }) => <ReportFilterForm onFilter={onFilter} />}
      backPath="/reports/detailed"
      hideAddButton={true}
      headerActions={BranchFilter}
    />
  );
};

export default DailyTransactions;
