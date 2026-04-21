// Idempotent seed for fresh environments.
// Ensures Visa + Instapay global treasuries exist and are wired into
// SystemConfiguration. Safe to re-run.

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function ensureTreasuryByScope(scope, name) {
  const existing = await prisma.treasury.findFirst({
    where: { scope, isActive: true },
  });
  if (existing) return existing;
  return prisma.treasury.create({
    data: { name, scope, balance: 0, isActive: true },
  });
}

async function main() {
  const visa = await ensureTreasuryByScope("GLOBAL_VISA", "خزينة فيزا");
  const instapay = await ensureTreasuryByScope(
    "GLOBAL_INSTAPAY",
    "خزينة انستاباي",
  );

  const config = await prisma.systemConfiguration.findFirst({
    where: { id: 1 },
  });

  if (!config) {
    await prisma.systemConfiguration.create({
      data: {
        id: 1,
        companyName: "ERP System",
        visaTreasuryId: visa.id,
        instapayTreasuryId: instapay.id,
      },
    });
    console.log("✅ Created SystemConfiguration with Visa + Instapay treasuries.");
  } else {
    const patch = {};
    if (!config.visaTreasuryId) patch.visaTreasuryId = visa.id;
    if (!config.instapayTreasuryId) patch.instapayTreasuryId = instapay.id;
    if (Object.keys(patch).length > 0) {
      await prisma.systemConfiguration.update({ where: { id: 1 }, data: patch });
      console.log(`✅ Patched SystemConfiguration: ${Object.keys(patch).join(", ")}`);
    } else {
      console.log("ℹ️ SystemConfiguration already wired for Visa + Instapay.");
    }
  }

  console.log(`   Visa Treasury:     #${visa.id} ${visa.name}`);
  console.log(`   Instapay Treasury: #${instapay.id} ${instapay.name}`);
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
