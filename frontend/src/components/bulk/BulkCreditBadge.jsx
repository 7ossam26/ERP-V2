import React, { useEffect, useState } from "react";
import { bulkService } from "../../services/bulkService";
import { formatEGP } from "../../utils/bulkMoney";

/**
 * Shows open AR balance vs credit limit for a customer.
 * Passes if creditLimit is null (unlimited).
 */
export default function BulkCreditBadge({ customer }) {
  const [open, setOpen] = useState(null);

  useEffect(() => {
    if (!customer?.id) return;
    // Read the statement's closing balance rather than summing order.balanceDue.
    //
    // balanceDue lives on the order row, so a debt with no order — an opening
    // balance carried over from before the system — is invisible to it. Four
    // customers were showing 0 or 12,800 open while really owing 1,000 to 77,660;
    // 70,710 EGP of exposure a salesperson could not see. The statement is the
    // same orders-minus-payments arithmetic that backend/services/
    // bulkCredit.service.js enforces the limit with, so the badge and the block
    // now agree. Called with no date range, which the endpoint reads as the full
    // history (parseDateRange defaults to new Date(0)).
    bulkService
      .reportStatement({ customerId: customer.id })
      .then((data) => setOpen(Number(data?.summary?.closingBalance ?? 0)))
      .catch(() => {});
  }, [customer?.id]);

  if (!customer) return null;

  const limit = customer.creditLimit != null ? Number(customer.creditLimit) : null;
  const isOverLimit = limit != null && open != null && open > limit;
  const isNearLimit = limit != null && open != null && open > limit * 0.8 && !isOverLimit;

  const color = isOverLimit
    ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
    : isNearLimit
    ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
    : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300";

  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>
      مفتوح: {open != null ? formatEGP(open) : "..."}
      {limit != null && <span className="opacity-70">/ {formatEGP(limit)}</span>}
      {limit == null && <span className="opacity-70">(غير محدود)</span>}
      {isOverLimit && <span className="font-bold mr-1">⚠</span>}
    </span>
  );
}
