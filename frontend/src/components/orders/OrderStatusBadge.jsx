import React from "react";

const LABELS = {
  NEW: "جديد",
  PREPARING: "جارٍ التجهيز",
  READY: "جاهز",
  OUT_FOR_DELIVERY: "خرج للتوصيل",
  DELIVERED: "تم التسليم",
  CANCELLED: "ملغي",
};

const COLORS = {
  NEW: "bg-red-100 text-red-800",
  PREPARING: "bg-yellow-100 text-yellow-800",
  READY: "bg-blue-100 text-blue-800",
  OUT_FOR_DELIVERY: "bg-purple-100 text-purple-800",
  DELIVERED: "bg-green-100 text-green-800",
  CANCELLED: "bg-gray-200 text-gray-700",
};

const OrderStatusBadge = ({ status, className = "" }) => (
  <span
    className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${COLORS[status] || "bg-gray-100 text-gray-700"} ${className}`}>
    {LABELS[status] || status}
  </span>
);

export default OrderStatusBadge;
export { LABELS as ORDER_STATUS_LABELS, COLORS as ORDER_STATUS_COLORS };
