import React from "react";
import GenericPageManager from "../../../components/shared/GenericPageManager";
import ReportFilterForm from "../../../components/shared/ReportFilterForm";
import { itemService } from "../../../services/domainServices";

const CreationHistory = () => {
  const columns = [
    { header: "نوع السجل", accessor: "recordType" },
    { header: "الاسم", accessor: "name" },
    { header: "أنشأ بواسطة", accessor: "createdBy" },
    { header: "تاريخ الإنشاء", accessor: "createdAt" },
  ];

  return (
    <GenericPageManager
      title="سجل الإنشاءات"
      subtitle="تاريخ العمليات المسجلة"
      icon="history_edu"
      service={itemService}
      columns={columns}
      FormComponent={({ onFilter }) => <ReportFilterForm onFilter={onFilter} />}
      backPath="/reports/detailed"
      hideAddButton={true}
    />
  );
};

export default CreationHistory;
