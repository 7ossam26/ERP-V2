#!/usr/bin/env node
/**
 * Rebuild every treasury balance from the documents that are allowed to move it,
 * and report any treasury whose stored balance disagrees.
 *
 * WHY THIS EXISTS
 *
 * Treasury.balance is a stored number, not a derived one. Every code path that
 * moves money issues its own `balance: { increment/decrement }` and separately
 * writes whatever document represents it. Nothing forces the two to agree, and
 * no screen compares them — so when they diverge, the balance simply carries a
 * figure with no paper behind it and nobody sees it.
 *
 * That is not hypothetical. On 02/08/2026 a customer collection credited
 * خزينة الإدارة with 75,120 while writing payment rows worth 10,260. The 64,860
 * difference sat unnoticed for three days and was only found by rebuilding the
 * balance exactly the way this script does.
 *
 * WHAT "CLEAN" MEANS HERE
 *
 * A zero difference does NOT mean the cash is physically present — only that the
 * balance matches its own paperwork. A physical count is still the authority.
 * What this catches is the other failure: money in the number with no document,
 * or a document whose money never landed.
 *
 * USAGE
 *   node scripts/reconcile-treasuries.js            # table, exits 1 on any drift
 *   node scripts/reconcile-treasuries.js --json     # machine-readable
 *   node scripts/reconcile-treasuries.js --id 9     # one treasury, with detail
 *
 * Exit code 1 on any discrepancy, so a cron job or CI step can alert on it.
 */

const prisma = require("../config/database");

// The posting rules live in lib/treasuryRebuild.js so the American journal
// (lib/journal) ties its cash columns to exactly the same rules as this script.
const { rebuild, TOLERANCE } = require("../lib/treasuryRebuild");

const money = (n) => Number(n || 0).toFixed(2);

async function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes("--json");
  const idFlag = args.indexOf("--id");
  const onlyId = idFlag !== -1 ? parseInt(args[idFlag + 1], 10) : null;

  const config = await prisma.systemConfiguration.findFirst({
    select: { visaTreasuryId: true, instapayTreasuryId: true },
  });

  const treasuries = await prisma.treasury.findMany({
    where: onlyId ? { id: onlyId } : {},
    select: { id: true, name: true, scope: true, balance: true },
    orderBy: { id: "asc" },
  });

  const results = [];
  for (const t of treasuries) {
    const r = await rebuild(t, config);
    results.push({ id: t.id, name: t.name, scope: t.scope, ...r });
  }

  const drifted = results.filter((r) => Math.abs(r.diff) > TOLERANCE);

  if (asJson) {
    console.log(JSON.stringify({ checkedAt: new Date().toISOString(), results, drifted }, null, 2));
    process.exit(drifted.length ? 1 : 0);
  }

  const w = { name: 22, num: 15 };
  console.log("\nمطابقة أرصدة الخزائن بمستنداتها\n");
  console.log(
    "الخزينة".padEnd(w.name) +
    "من المستندات".padStart(w.num) +
    "في السيستم".padStart(w.num) +
    "الفرق".padStart(w.num),
  );
  console.log("─".repeat(w.name + w.num * 3));
  for (const r of results) {
    const flag = Math.abs(r.diff) > TOLERANCE ? "  ✕" : "";
    console.log(
      `${r.id}. ${r.name}`.padEnd(w.name) +
      money(r.expected).padStart(w.num) +
      money(r.actual).padStart(w.num) +
      money(r.diff).padStart(w.num) +
      flag,
    );
  }
  console.log("─".repeat(w.name + w.num * 3));

  // A single treasury gets its breakdown printed, since that is what you want
  // when you are chasing one number rather than scanning for problems.
  if (onlyId && results[0]) {
    console.log(`\nتفصيل ${results[0].name}:\n`);
    for (const l of results[0].lines) {
      if (!l.count) continue;
      console.log(`  ${l.label.padEnd(24)} ${String(l.count).padStart(5)} حركة ${money(l.amount).padStart(15)}`);
    }
  }

  if (drifted.length) {
    console.log(`\n✕ ${drifted.length} خزينة رصيدها لا يطابق مستنداتها:\n`);
    for (const r of drifted) {
      const dir = r.diff > 0 ? "زيادة بلا مستند" : "نقص بلا مستند";
      console.log(`   ${r.id}. ${r.name} — ${dir}: ${money(Math.abs(r.diff))}`);
    }
    console.log("\nالفرق الموجب معناه فلوس في الرصيد بلا ورق يثبتها.");
    console.log("الفرق السالب معناه ورق بفلوس لم تصل الرصيد.");
    console.log("في الحالتين، الجرد الفعلي هو الفيصل.\n");
    process.exit(1);
  }

  console.log("\n✓ كل الخزائن مطابقة لمستنداتها.");
  console.log("  ملاحظة: ده لا يعني أن النقدية موجودة فعليًا — الجرد وحده يثبت ذلك.\n");
  process.exit(0);
}

main()
  .catch((e) => {
    console.error("فشل الفحص:", e.message);
    process.exit(2);
  })
  .finally(() => prisma.$disconnect());
