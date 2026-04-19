// scripts/ramex-permissions.js
// Canonical Ramex Store permission matrix.
// Idempotent — safe to re-run at any time.
const mysql = require("mysql2/promise");
const dotenv = require("dotenv");
const path = require("path");

// Load env: backend/.env.local > backend/.env > root .env
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(__dirname, "../.env") });
}
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(__dirname, "../../.env") });
}

// ─── Permission Matrix ─────────────────────────────────────────────────────────

const ALL_MODULES = [
  "HR", "INVENTORY", "INVENTORY_COUNT", "STOCK_TRANSFER", "POS", "PURCHASES",
  "SALES", "REPORTS", "TREASURIES", "CASH_TRANSFER", "TRANSFER_MANAGEMENT",
  "BRANCHES", "EMPLOYEES", "CLIENTS", "SUPPLIERS", "SUPPLIER_ACCOUNTS",
  "CATEGORIES", "ITEMS", "WAREHOUSES", "SETTINGS", "EXPENSES", "SHIFTS",
  "DELIVERY_SETTLEMENT", "CREATES_WAREHOUSES", "CREATES_EMPLOYEES",
  "CREATES_SUPPLIERS", "CREATES_CLIENTS", "CREATES_CATEGORIES", "CREATES_ITEMS",
  "CREATES_TREASURIES", "CREATES_BRANCHES", "DEPOSITS", "CREATES_DEPOSITS",
  "WITHDRAWALS", "CREATES_WITHDRAWALS", "DELIVERY_MEN", "CREATES_DELIVERY_MEN",
  "DELIVERY_ZONES", "CREATES_DELIVERY_ZONES", "CREATES_PRODUCTION", "PRODUCTION",
  "FABRIC_ROLLS", "ADJUSTMENTS", "COUNTS",
];

const ROLES = [
  {
    name: "Owner",
    description: "مالك — وصول كامل على جميع الفروع",
    modules: ALL_MODULES,
  },
  {
    name: "BranchManager",
    description: "مدير فرع — وصول كامل داخل الفرع ما عدا الإعدادات العامة",
    modules: ALL_MODULES.filter(
      (m) =>
        !["SETTINGS", "BRANCHES", "CREATES_BRANCHES", "CREATES_WAREHOUSES",
          "CREATES_TREASURIES", "TRANSFER_MANAGEMENT"].includes(m)
    ),
  },
  {
    name: "Cashier",
    description: "كاشير — نقطة البيع والمناوبات وإنشاء العملاء",
    modules: [
      "POS", "SALES", "CLIENTS", "CREATES_CLIENTS",
      "ITEMS", "CATEGORIES", "INVENTORY", "SHIFTS",
    ],
  },
  {
    name: "WarehouseKeeper",
    description: "أمين مخزن — المخزون والمشتريات ورولات الأقمشة والتعديلات والجرد",
    modules: [
      "INVENTORY", "INVENTORY_COUNT", "PURCHASES", "STOCK_TRANSFER",
      "ITEMS", "CATEGORIES", "SUPPLIERS", "CREATES_SUPPLIERS",
      "WAREHOUSES", "FABRIC_ROLLS", "ADJUSTMENTS", "COUNTS",
    ],
  },
  {
    name: "Accountant",
    description: "محاسب — قراءة شاملة وكتابة الخزينة والمصروفات والموردين",
    modules: [
      "REPORTS", "TREASURIES", "EXPENSES",
      "DEPOSITS", "CREATES_DEPOSITS",
      "WITHDRAWALS", "CREATES_WITHDRAWALS",
      "SUPPLIER_ACCOUNTS", "SALES", "PURCHASES",
      "INVENTORY", "ITEMS", "CASH_TRANSFER", "TRANSFER_MANAGEMENT",
    ],
  },
];

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🚀 Syncing Ramex Store permission matrix...");

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not defined");
  }

  const connection = await mysql.createConnection(process.env.DATABASE_URL);

  try {
    const query = async (sql, params = []) => {
      const [rows] = await connection.execute(sql, params);
      return rows;
    };

    for (const role of ROLES) {
      // Upsert role
      await query(
        `INSERT INTO roles (name, description, updated_at)
         VALUES (?, ?, NOW())
         ON DUPLICATE KEY UPDATE description = VALUES(description), updated_at = NOW()`,
        [role.name, role.description]
      );

      const rows = await query("SELECT id FROM roles WHERE name = ?", [role.name]);
      const roleId = rows[0].id;

      // Upsert permissions
      for (const mod of role.modules) {
        await query(
          `INSERT INTO permissions (role_id, module, can_access)
           VALUES (?, ?, true)
           ON DUPLICATE KEY UPDATE can_access = true`,
          [roleId, mod]
        );
      }

      console.log(`  ✅ ${role.name} (${role.modules.length} modules)`);
    }

    console.log("✨ Permission matrix synced.");
  } catch (err) {
    console.error("❌ Error:", err);
    throw err;
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = main;
