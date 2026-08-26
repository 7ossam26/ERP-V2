/**
 * Presentation registry for the four HR employee transaction types.
 *
 * Keys mirror the backend `TransactionType` enum
 * (backend/config/employeeTransactionTypes.js). Everything the UI needs to
 * render a type — Arabic label, icon, sign, text colour, submit-button colour —
 * lives here so the HR page and the reports pages stay in step. Before this,
 * every one of those was an inline `type === "ADVANCE" ? … : …` ternary that
 * silently collapsed any third type into "خصم".
 *
 * Colour note: green is already load-bearing on this page for "cash actually
 * moved" — the دفع راتب report row and the المرتب المتبقي cell. The additive
 * types deliberately avoid it (teal/purple) so "an accrual was recorded" never
 * looks like "money was paid out".
 */

export const EMPLOYEE_TRANSACTION_TYPES = {
  ADVANCE: {
    label: "سلفة",
    icon: "account_balance_wallet",
    sign: -1,
    text: "text-orange-600 dark:text-orange-400",
    button: "bg-[#FF7043] hover:bg-[#F4511E]",
  },
  DEDUCTION: {
    label: "خصم",
    icon: "remove_circle",
    sign: -1,
    text: "text-red-600 dark:text-red-400",
    button: "bg-red-600 hover:bg-red-700",
  },
  OVERTIME: {
    label: "اضافي",
    icon: "more_time",
    sign: +1,
    text: "text-teal-600 dark:text-teal-400",
    button: "bg-teal-600 hover:bg-teal-700",
  },
  BONUS: {
    label: "مكافئة",
    icon: "redeem",
    sign: +1,
    text: "text-purple-600 dark:text-purple-400",
    button: "bg-purple-600 hover:bg-purple-700",
  },
};

// Display order for the معاملة جديدة menu and the entry form's radio group.
export const EMPLOYEE_TRANSACTION_TYPE_ORDER = [
  "ADVANCE",
  "DEDUCTION",
  "OVERTIME",
  "BONUS",
];

// HRPage drives its shared modal off a `modalType` slug; these map between it
// and the transaction type the API expects.
export const MODAL_TO_TYPE = {
  advance: "ADVANCE",
  deduction: "DEDUCTION",
  overtime: "OVERTIME",
  bonus: "BONUS",
};

export const TYPE_TO_MODAL = {
  ADVANCE: "advance",
  DEDUCTION: "deduction",
  OVERTIME: "overtime",
  BONUS: "bonus",
};

// The HR monthly report mixes transactions with a synthetic PAYROLL row, so the
// label/colour lookups resolve that too.
const REPORT_ROW_TYPES = {
  ...EMPLOYEE_TRANSACTION_TYPES,
  PAYROLL: {
    label: "دفع راتب",
    icon: "payments",
    text: "text-green-600 dark:text-green-400",
  },
};

export const txTypeLabel = (type) => REPORT_ROW_TYPES[type]?.label ?? type;

export const txTypeTextClass = (type) =>
  REPORT_ROW_TYPES[type]?.text ?? "text-gray-700 dark:text-gray-200";

export default EMPLOYEE_TRANSACTION_TYPES;
