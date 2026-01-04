import React from "react";
import GenericPageManager from "../../../components/shared/GenericPageManager";
import { supplierService } from "../../../services/domainServices";

const PurchaseHistory = () => {
  const columns = [
    { header: "رقم الفاتورة", accessor: "invoiceId" },
    { header: "المورد", accessor: "supplierName" },
    { header: "الإجمالي", accessor: "total" },
    { header: "التاريخ", accessor: "date" },
    { header: "الحالة", accessor: "status" },
  ];

  return (
    <GenericPageManager
      title="سجل المشتريات"
      subtitle="أرشيف فواتير الشراء"
      icon="shopping_cart"
      service={supplierService}
      columns={columns}
      FormComponent={() => <div>Form Placeholder</div>}
      backPath="/reports/detailed"
      hideAddButton={true}
    />
  );
};

export default PurchaseHistory;
