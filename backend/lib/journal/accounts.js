/**
 * accounts.js — the columns of اليومية الأمريكية.
 *
 * ERP-V2 has no chart of accounts: every document moves its own running balance
 * (Treasury.balance, SupplierAccount.balance, DeliveryMan.walletBalance …).
 * These are the accounts the journal SYNTHESISES from those documents. Each
 * one is a Debit/Credit column pair in the report, in this order.
 *
 * `normal` is the side a balance normally sits on. It only decides how the
 * opening/closing rows are signed for display; posting never depends on it.
 */

const ACCOUNTS = [
  { id: "CASH", labelAr: "النقدية بالخزائن", normal: "dr" },
  { id: "BANK", labelAr: "البنك والفيزا والمحافظ", normal: "dr" },
  { id: "IN_TRANSIT", labelAr: "نقدية بالطريق", normal: "dr" },
  { id: "DRIVER_CUSTODY", labelAr: "عهدة الطيارين", normal: "dr" },
  { id: "RECEIVABLES", labelAr: "العملاء", normal: "dr" },
  { id: "PAYABLES", labelAr: "الموردين", normal: "cr" },
  { id: "INVENTORY", labelAr: "المخزون", normal: "dr" },
  { id: "EMPLOYEE_ADVANCES", labelAr: "سلف الموظفين", normal: "dr" },
  { id: "VAT", labelAr: "ضريبة القيمة المضافة", normal: "cr" },
  { id: "REVENUE", labelAr: "المبيعات", normal: "cr" },
  { id: "COGS", labelAr: "تكلفة المبيعات", normal: "dr" },
  { id: "OPEX", labelAr: "المصروفات التشغيلية", normal: "dr" },
  { id: "PAYROLL", labelAr: "الرواتب والأجور", normal: "dr" },
  { id: "OPENING_EQUITY", labelAr: "الأرصدة الافتتاحية", normal: "cr" },
  { id: "ADJUSTMENTS", labelAr: "تسويات وفروقات", normal: "dr" },
  // Only ever appears in a branch-scoped view: the counter-leg of a line that
  // belongs to another branch or to head office, so every row still balances.
  { id: "INTER_BRANCH", labelAr: "جاري الفروع والمركز", normal: "dr" },
];

// Unselected accounts collapse into this pair rather than dropping out —
// dropping them would leave rows that no longer balance.
const OTHER_ACCOUNT = { id: "OTHER", labelAr: "حسابات أخرى", normal: "dr" };

const ACCOUNT_IDS = ACCOUNTS.map((a) => a.id);
const ACCOUNT_BY_ID = new Map([...ACCOUNTS, OTHER_ACCOUNT].map((a) => [a.id, a]));

/**
 * Which column a treasury's money sits in.
 *
 * Card and InstaPay money is identified by the treasury's ROLE in system
 * configuration, never by Treasury.scope: nothing in the code ever sets
 * `scope`, and a card sale credits the configured global treasury while its
 * own Sale.treasuryId still names the branch (see lib/treasuryRebuild.js).
 */
const treasuryAccount = (ctx, treasuryId) =>
  treasuryId != null && ctx.bankTreasuryIds.has(treasuryId) ? "BANK" : "CASH";

module.exports = { ACCOUNTS, OTHER_ACCOUNT, ACCOUNT_IDS, ACCOUNT_BY_ID, treasuryAccount };
