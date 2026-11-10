/**
 * engine.js — builds اليومية الأمريكية for one Cairo window and branch scope.
 *
 *   opening  = every entry dated before the window, summed per account
 *   rows     = every entry inside the window, chronological
 *   closing  = opening + period movement
 *
 * The opening pass runs the SAME mappers as the period (lib/journal/sources.js)
 * over all earlier history and only sums them — one code path, so the opening
 * balance can never follow a rule the rows don't.
 *
 * Branch view: an entry is shown when any of its legs belongs to a branch in
 * scope; legs that belong to another branch or to head office are re-pointed to
 * جاري الفروع والمركز, so every row still balances and the branch's own cash
 * column holds only the branch's own cash.
 *
 * Every entry is checked for Σ debit = Σ credit in integer cents. The count of
 * entries that fail is returned as `integrity.unbalancedEntries` — it must be 0;
 * anything else means a mapper is wrong, not that the data is.
 */

const prisma = require("../../config/database");
const { cairoDayKey } = require("../../utils/dateRange");
const { ACCOUNTS, ACCOUNT_IDS, OTHER_ACCOUNT, ACCOUNT_BY_ID } = require("./accounts");
const { SOURCES, toMoney } = require("./sources");

const DIAGNOSTICS = {
  SALE_NO_CARD_TREASURY: "مبيعات فيزا/انستاباي ولا توجد خزينة مُعرّفة لها في الإعدادات",
  SALE_CASH_WITHOUT_REVENUE: "نقدية دخلت الخزينة على فواتير غير مكتملة (معلقة/ملغاة) — لا تُحتسب إيرادًا",
  SALE_REVENUE_PLUG: "فواتير إجماليها لا يساوي (الإجمالي الفرعي − الخصم + التوصيل) — الفرق مُرحّل على المبيعات",
  BULK_PAYMENT_NO_TREASURY: "تحصيلات جملة نقدية بدون خزينة",
  ADVANCE_NO_BRANCH: "سلف بدون فرع — لا يمكن معرفة الخزينة التي صُرفت منها",
  PAYROLL_COMPONENTS: "رواتب مكوناتها لا تطابق صافي الراتب",
  PAYROLL_NO_TREASURY: "رواتب مصروفة بدون خزينة",
  TRANSFER_NO_RESOLVED_AT: "تحويلات قديمة بدون تاريخ اعتماد — رُحّلت بتاريخ الإنشاء",
  OPENING_STOCK_NO_COST: "أرصدة مخزون افتتاحية بدون تكلفة — لم تُقيَّم",
};
const MAX_SAMPLES = 10;

function createDiagnostics() {
  const byCode = new Map();
  return {
    add(code, ref, amountC = 0) {
      let d = byCode.get(code);
      if (!d) {
        d = { code, label: DIAGNOSTICS[code] || code, count: 0, amountC: 0, samples: [] };
        byCode.set(code, d);
      }
      d.count += 1;
      d.amountC += amountC;
      if (d.samples.length < MAX_SAMPLES && ref) d.samples.push(ref);
    },
    list() {
      return [...byCode.values()].map(({ amountC, ...d }) => ({ ...d, amount: toMoney(amountC) }));
    },
  };
}
const NO_DIAGNOSTICS = { add() {}, list: () => [] };

/** Branch ↔ treasury/warehouse maps and the card-treasury roles. */
async function loadContext() {
  const [config, branches, treasuries] = await Promise.all([
    prisma.systemConfiguration.findFirst({
      select: { mainTreasuryId: true, visaTreasuryId: true, instapayTreasuryId: true },
    }),
    // Inactive branches included: their history is still real money.
    prisma.branch.findMany({
      select: { id: true, name: true, treasuryId: true, warehouseId: true },
    }),
    prisma.treasury.findMany({ select: { id: true, name: true, balance: true } }),
  ]);
  const cfg = config || {};
  return {
    config: cfg,
    bankTreasuryIds: new Set([cfg.visaTreasuryId, cfg.instapayTreasuryId].filter((id) => id != null)),
    treasuryToBranch: new Map(branches.map((b) => [b.treasuryId, b.id])),
    warehouseToBranch: new Map(branches.map((b) => [b.warehouseId, b.id])),
    branchNames: new Map(branches.map((b) => [b.id, b.name])),
    treasuryNames: new Map(treasuries.map((t) => [t.id, t.name])),
    treasuries,
  };
}

async function collect(ctx, window, emit, diag) {
  for (const source of SOURCES) {
    await source(ctx, window, emit, diag);
  }
}

const sumSide = (lines, side) => lines.reduce((s, l) => s + l[side], 0);

/** null = consolidated (no re-pointing). */
const makeScope = (branchIds) => {
  if (!branchIds) return (e) => e;
  const inScope = new Set(branchIds);
  return (e) => {
    if (!e.lines.some((l) => inScope.has(l.branchId))) return null;
    return {
      ...e,
      lines: e.lines.map((l) => (inScope.has(l.branchId) ? l : { ...l, account: "INTER_BRANCH" })),
    };
  };
};

const zeroTotals = () => Object.fromEntries(ACCOUNT_IDS.map((id) => [id, { dr: 0, cr: 0 }]));
const addLines = (totals, lines) => {
  for (const l of lines) {
    totals[l.account].dr += l.dr;
    totals[l.account].cr += l.cr;
  }
};

/**
 * Subsidiary balances, company-wide and pre-scope: per treasury, per supplier,
 * per customer, plus driver custody. Used only for the tie-outs.
 */
const createSubsidiary = () => ({
  treasury: new Map(),
  supplier: new Map(),
  customer: new Map(),
  custodyC: 0,
});
const addSubsidiary = (sub, lines) => {
  const bump = (map, key, deltaC) => map.set(key, (map.get(key) || 0) + deltaC);
  for (const l of lines) {
    const netDrC = l.dr - l.cr;
    if ((l.account === "CASH" || l.account === "BANK") && l.treasuryId != null) {
      bump(sub.treasury, l.treasuryId, netDrC);
    }
    // Payables are a credit balance: report what is owed as a positive number.
    if (l.account === "PAYABLES" && l.supplierId != null) bump(sub.supplier, l.supplierId, -netDrC);
    if (l.account === "RECEIVABLES" && l.customerId != null) bump(sub.customer, l.customerId, netDrC);
    if (l.account === "DRIVER_CUSTODY") sub.custodyC += netDrC;
  }
};

/**
 * Build the journal.
 *
 * @param {Date}          start, end   Cairo window (utils/dateRange)
 * @param {number[]|null} branchIds    null = consolidated
 * @returns raw journal in cents; see `present()` for the response shape.
 */
async function buildJournal({ start, end, branchIds = null }) {
  const ctx = await loadContext();
  const scope = makeScope(branchIds);
  const diag = createDiagnostics();
  const subsidiary = createSubsidiary();
  let unbalancedEntries = 0;
  const unbalancedSamples = [];

  const check = (e) => {
    if (sumSide(e.lines, "dr") !== sumSide(e.lines, "cr")) {
      unbalancedEntries += 1;
      if (unbalancedSamples.length < MAX_SAMPLES) unbalancedSamples.push(e.key);
    }
  };

  const opening = zeroTotals();
  await collect(
    ctx,
    { from: null, to: new Date(start.getTime() - 1) },
    (e) => {
      check(e);
      addSubsidiary(subsidiary, e.lines);
      const s = scope(e);
      if (s) addLines(opening, s.lines);
    },
    NO_DIAGNOSTICS,
  );

  const rows = [];
  const period = zeroTotals();
  await collect(
    ctx,
    { from: start, to: end },
    (e) => {
      check(e);
      addSubsidiary(subsidiary, e.lines);
      const s = scope(e);
      if (!s) return;
      addLines(period, s.lines);
      rows.push(s);
    },
    diag,
  );

  rows.sort((a, b) => a.date - b.date || a.key.localeCompare(b.key));

  const closing = zeroTotals();
  for (const id of ACCOUNT_IDS) {
    closing[id].dr = opening[id].dr + period[id].dr;
    closing[id].cr = opening[id].cr + period[id].cr;
  }

  return {
    ctx,
    rows,
    opening,
    period,
    closing,
    subsidiary,
    diagnostics: diag.list(),
    integrity: {
      unbalancedEntries,
      unbalancedSamples,
      periodBalanced: ACCOUNT_IDS.reduce((s, id) => s + period[id].dr - period[id].cr, 0) === 0,
    },
  };
}

// ── presentation ────────────────────────────────────────────────────────────

/**
 * Which columns to show. Unselected accounts fold into حسابات أخرى instead of
 * dropping out — dropping them would leave rows that no longer balance.
 */
const resolveColumns = (selected, isBranchView) => {
  const base = ACCOUNTS.filter((a) => a.id !== "INTER_BRANCH" || isBranchView);
  if (!selected || selected.length === 0) return { columns: base, fold: (id) => id };
  const keep = new Set(selected.filter((id) => ACCOUNT_BY_ID.has(id)));
  const shown = base.filter((a) => keep.has(a.id));
  const folds = base.some((a) => !keep.has(a.id));
  return {
    columns: folds ? [...shown, OTHER_ACCOUNT] : shown,
    fold: (id) => (keep.has(id) ? id : OTHER_ACCOUNT.id),
  };
};

const foldTotals = (totals, columns, fold) => {
  const out = Object.fromEntries(columns.map((c) => [c.id, { dr: 0, cr: 0 }]));
  for (const id of ACCOUNT_IDS) {
    const target = out[fold(id)];
    if (!target) continue; // INTER_BRANCH in a consolidated view is always 0
    target.dr += totals[id].dr;
    target.cr += totals[id].cr;
  }
  return out;
};

const moneyTotals = (folded) =>
  Object.fromEntries(
    Object.entries(folded).map(([id, t]) => [
      id,
      { dr: toMoney(t.dr), cr: toMoney(t.cr), net: toMoney(t.dr - t.cr) },
    ]),
  );

/** One displayed row from one or more entries (daily mode merges many). */
const presentRow = (ctx, entries, columns, fold, daily) => {
  const first = entries[0];
  const lines = Object.fromEntries(columns.map((c) => [c.id, { dr: 0, cr: 0 }]));
  for (const e of entries) {
    for (const l of e.lines) {
      const t = lines[fold(l.account)];
      if (!t) continue;
      t.dr += l.dr;
      t.cr += l.cr;
    }
  }
  const totalDrC = Object.values(lines).reduce((s, t) => s + t.dr, 0);
  const totalCrC = Object.values(lines).reduce((s, t) => s + t.cr, 0);
  return {
    key: daily ? `${cairoDayKey(first.date)}:${first.source}:${first.type}` : first.key,
    date: first.date.toISOString(),
    day: cairoDayKey(first.date),
    source: first.source,
    type: first.type,
    ref: daily ? `${entries.length} حركة` : first.ref,
    party: daily ? null : first.party,
    branch: first.branchId != null ? ctx.branchNames.get(first.branchId) || null : null,
    count: entries.length,
    totalDr: toMoney(totalDrC),
    totalCr: toMoney(totalCrC),
    lines: Object.fromEntries(
      Object.entries(lines)
        .filter(([, t]) => t.dr || t.cr)
        .map(([id, t]) => [id, { dr: toMoney(t.dr), cr: toMoney(t.cr) }]),
    ),
  };
};

/**
 * Shape a built journal for the API / Excel.
 *
 * @param {object}   journal    from buildJournal
 * @param {string[]} accounts   optional column selection
 * @param {"detail"|"daily"} mode
 * @param {number}   offset, limit   page of rows (limit null = all)
 */
function present(journal, { accounts = null, mode = "detail", isBranchView = false, offset = 0, limit = null } = {}) {
  const { columns, fold } = resolveColumns(accounts, isBranchView);
  const daily = mode === "daily";

  let groups;
  if (daily) {
    const byKey = new Map();
    for (const e of journal.rows) {
      const k = `${cairoDayKey(e.date)}|${e.source}|${e.type}`;
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k).push(e);
    }
    groups = [...byKey.values()];
  } else {
    groups = journal.rows.map((e) => [e]);
  }

  const totalRows = groups.length;
  const page = limit == null ? groups : groups.slice(offset, offset + limit);
  const nextOffset = limit != null && offset + limit < totalRows ? offset + limit : null;

  return {
    columns: columns.map(({ id, labelAr, normal }) => ({ id, labelAr, normal })),
    opening: moneyTotals(foldTotals(journal.opening, columns, fold)),
    period: moneyTotals(foldTotals(journal.period, columns, fold)),
    closing: moneyTotals(foldTotals(journal.closing, columns, fold)),
    rows: page.map((g) => presentRow(journal.ctx, g, columns, fold, daily)),
    totalRows,
    nextOffset,
    diagnostics: journal.diagnostics,
    integrity: journal.integrity,
  };
}

module.exports = { buildJournal, present, loadContext, makeScope, resolveColumns };
