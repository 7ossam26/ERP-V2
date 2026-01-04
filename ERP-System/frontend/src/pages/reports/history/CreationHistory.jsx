import React from "react";
import GenericPageManager from "../../../components/shared/GenericPageManager";
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
      FormComponent={() => <div>Form Placeholder</div>}
      backPath="/reports/detailed"
      hideAddButton={true}
    />
  );
};

export default CreationHistory;
