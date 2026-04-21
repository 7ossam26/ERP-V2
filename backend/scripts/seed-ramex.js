// scripts/seed-ramex.js
// Idempotent Ramex Store seed — safe to re-run at any time.
// Creates: 2 warehouses, 2 treasuries, 2 branches, 6 roles + permissions,
//          8 users, 1 walk-in client, SystemConfiguration singleton.
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const path = require("path");
const dotenv = require("dotenv");

// Load env: backend/.env.local > backend/.env > root .env
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(__dirname, "../.env") });
}
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(__dirname, "../../.env") });
}

// ─── Infrastructure ────────────────────────────────────────────────────────────

const WAREHOUSES = [
  { name: "مخزن فرع جسر السويس" },
  { name: "مخزن فرع رامو" },
];

const BRANCHES = [
  { name: "فرع جسر السويس", address: "جسر السويس", warehouseIdx: 0 },
  { name: "فرع رامو",        address: "رامو",        warehouseIdx: 1 },
];

// ─── Roles & Permissions ───────────────────────────────────────────────────────

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
  "FABRIC_ROLLS", "ADJUSTMENTS", "COUNTS", "OWNER_DASHBOARD", "AUDIT",
];

const ROLES = [
  {
    name: "Superadmin",
    description: "سوبر أدمن — وصول كامل للنظام",
    modules: ALL_MODULES,
  },
  {
    name: "Owner",
    description: "مالك — وصول كامل على جميع الفروع",
    modules: ALL_MODULES,
  },
  {
    name: "BranchManager",
    description: "مدير فرع — وصول كامل داخل الفرع ما عدا الإعدادات العامة",
    modules: ALL_MODULES.filter(
      (m) => !["SETTINGS", "BRANCHES", "CREATES_BRANCHES", "CREATES_WAREHOUSES",
               "CREATES_TREASURIES", "TRANSFER_MANAGEMENT", "OWNER_DASHBOARD"].includes(m)
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
      "INVENTORY", "ITEMS", "CASH_TRANSFER", "TRANSFER_MANAGEMENT", "AUDIT",
    ],
  },
];

// ─── Users ─────────────────────────────────────────────────────────────────────
// Passwords will be hashed. mustChangePassword=true for all non-superadmin.
// branchName null = no fixed branch (owner gets accessibleBranches set to both)
const USERS = [
  {
    name: "Superadmin",
    username: process.env.ADMIN_USERNAME || "superadmin",
    password: process.env.ADMIN_PASSWORD || "246810@Ad",
    roleName: "Superadmin",
    branchName: null,
    hasSensitiveAccess: true,
    mustChangePassword: false,
    allBranches: false,
  },
  {
    name: "المالك",
    username: "owner",
    password: "Owner@2026",
    roleName: "Owner",
    branchName: null,
    hasSensitiveAccess: true,
    mustChangePassword: true,
    allBranches: true,  // gets accessibleBranches = both branches
  },
  {
    name: "مدير فرع جسر السويس",
    username: "manager.gasr",
    password: "Manager@2026",
    roleName: "BranchManager",
    branchName: "فرع جسر السويس",
    hasSensitiveAccess: true,
    mustChangePassword: true,
    allBranches: false,
  },
  {
    name: "مدير فرع رامو",
    username: "manager.ramo",
    password: "Manager@2026",
    roleName: "BranchManager",
    branchName: "فرع رامو",
    hasSensitiveAccess: true,
    mustChangePassword: true,
    allBranches: false,
  },
  {
    name: "كاشير جسر السويس",
    username: "cashier.gasr",
    password: "Cashier@2026",
    roleName: "Cashier",
    branchName: "فرع جسر السويس",
    hasSensitiveAccess: false,
    mustChangePassword: true,
    allBranches: false,
  },
  {
    name: "كاشير رامو",
    username: "cashier.ramo",
    password: "Cashier@2026",
    roleName: "Cashier",
    branchName: "فرع رامو",
    hasSensitiveAccess: false,
    mustChangePassword: true,
    allBranches: false,
  },
  {
    name: "أمين المخزن",
    username: "warehouse.keeper",
    password: "Warehouse@2026",
    roleName: "WarehouseKeeper",
    branchName: "فرع جسر السويس",
    hasSensitiveAccess: false,
    mustChangePassword: true,
    allBranches: false,
  },
  {
    name: "المحاسب",
    username: "accountant",
    password: "Accountant@2026",
    roleName: "Accountant",
    branchName: null,
    hasSensitiveAccess: false,
    mustChangePassword: true,
    allBranches: false,
  },
];

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🚀 Starting Ramex Store seed...");

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not defined");
  }

  const connection = await mysql.createConnection(process.env.DATABASE_URL);

  const query = async (sql, params = []) => {
    const [rows] = await connection.execute(sql, params);
    return rows;
  };

  try {
    // ── 1. Warehouses ──────────────────────────────────────────────────────────
    const warehouseIds = [];
    for (const wh of WAREHOUSES) {
      let rows = await query("SELECT id FROM warehouses WHERE name = ?", [wh.name]);
      if (rows.length > 0) {
        warehouseIds.push(rows[0].id);
        console.log(`  ✅ Warehouse exists: ${wh.name} (ID: ${rows[0].id})`);
      } else {
        const result = await query(
          "INSERT INTO warehouses (name, updated_at) VALUES (?, NOW())",
          [wh.name]
        );
        warehouseIds.push(result.insertId);
        console.log(`  ✅ Created warehouse: ${wh.name} (ID: ${result.insertId})`);
      }
    }

    // ── 2. Treasuries (one per branch) ────────────────────────────────────────
    const treasuryIds = [];
    for (const branch of BRANCHES) {
      const tName = `خزينة ${branch.name}`;
      let rows = await query("SELECT id FROM treasuries WHERE name = ?", [tName]);
      if (rows.length > 0) {
        treasuryIds.push(rows[0].id);
        console.log(`  ✅ Treasury exists: ${tName} (ID: ${rows[0].id})`);
      } else {
        const result = await query(
          "INSERT INTO treasuries (name, balance, updated_at) VALUES (?, 0, NOW())",
          [tName]
        );
        treasuryIds.push(result.insertId);
        console.log(`  ✅ Created treasury: ${tName} (ID: ${result.insertId})`);
      }
    }

    // ── 3. Branches ───────────────────────────────────────────────────────────
    const branchIds = [];
    for (let i = 0; i < BRANCHES.length; i++) {
      const br = BRANCHES[i];
      const whId = warehouseIds[br.warehouseIdx];
      const trId = treasuryIds[i];

      let rows = await query("SELECT id FROM branches WHERE name = ?", [br.name]);
      if (rows.length > 0) {
        branchIds.push(rows[0].id);
        console.log(`  ✅ Branch exists: ${br.name} (ID: ${rows[0].id})`);
      } else {
        const result = await query(
          `INSERT INTO branches (name, address, warehouse_id, treasury_id, updated_at)
           VALUES (?, ?, ?, ?, NOW())`,
          [br.name, br.address, whId, trId]
        );
        branchIds.push(result.insertId);
        console.log(`  ✅ Created branch: ${br.name} (ID: ${result.insertId})`);
      }
    }

    // ── 4. Roles & Permissions ────────────────────────────────────────────────
    const roleIdMap = {};
    for (const role of ROLES) {
      await query(
        `INSERT INTO roles (name, description, updated_at)
         VALUES (?, ?, NOW())
         ON DUPLICATE KEY UPDATE description = VALUES(description), updated_at = NOW()`,
        [role.name, role.description]
      );
      const rows = await query("SELECT id FROM roles WHERE name = ?", [role.name]);
      roleIdMap[role.name] = rows[0].id;

      for (const mod of role.modules) {
        await query(
          `INSERT INTO permissions (role_id, module, can_access)
           VALUES (?, ?, true)
           ON DUPLICATE KEY UPDATE can_access = true`,
          [roleIdMap[role.name], mod]
        );
      }
      console.log(`  ✅ Role: ${role.name} (${role.modules.length} modules)`);
    }

    // ── 5. Users ──────────────────────────────────────────────────────────────
    // Build branch name → id map
    const branchNameToId = {};
    for (let i = 0; i < BRANCHES.length; i++) {
      branchNameToId[BRANCHES[i].name] = branchIds[i];
    }

    for (const u of USERS) {
      const roleId = roleIdMap[u.roleName];
      if (!roleId) {
        console.warn(`  ⚠️  Role "${u.roleName}" not found for user ${u.username}, skipping`);
        continue;
      }
      const branchId = u.branchName ? (branchNameToId[u.branchName] || null) : null;
      const hashedPassword = await bcrypt.hash(u.password, 10);

      const existing = await query("SELECT id FROM users WHERE username = ?", [u.username]);

      if (existing.length === 0) {
        const result = await query(
          `INSERT INTO users
             (name, username, password, role_id, branch_id,
              is_active, has_sensitive_access, must_change_password, updated_at)
           VALUES (?, ?, ?, ?, ?, true, ?, ?, NOW())`,
          [u.name, u.username, hashedPassword, roleId, branchId,
           u.hasSensitiveAccess, u.mustChangePassword]
        );
        const userId = result.insertId;
        console.log(`  ✅ Created user: ${u.username} (ID: ${userId})`);

        // Give Owner access to all branches
        if (u.allBranches) {
          for (const bId of branchIds) {
            await query(
              `INSERT IGNORE INTO _AccessibleBranches (A, B) VALUES (?, ?)`,
              [bId, userId]
            );
          }
        }
      } else {
        const userId = existing[0].id;
        await query(
          `UPDATE users SET role_id = ?, branch_id = ?, has_sensitive_access = ?,
           must_change_password = ?, updated_at = NOW() WHERE id = ?`,
          [roleId, branchId, u.hasSensitiveAccess, u.mustChangePassword, userId]
        );
        console.log(`  ✅ Updated user: ${u.username} (ID: ${userId})`);

        if (u.allBranches) {
          for (const bId of branchIds) {
            await query(
              `INSERT IGNORE INTO _AccessibleBranches (A, B) VALUES (?, ?)`,
              [bId, userId]
            );
          }
        }
      }
    }

    // ── 6. Walk-In Client ─────────────────────────────────────────────────────
    const walkInRows = await query("SELECT id FROM clients WHERE is_walk_in = true LIMIT 1");
    if (walkInRows.length === 0) {
      const result = await query(
        `INSERT INTO clients (name, phone_number, is_walk_in, tier, updated_at)
         VALUES ('عميل نقدي', '00000000000', true, 'RETAIL', NOW())`
      );
      console.log(`  ✅ Created walk-in client (ID: ${result.insertId})`);
    } else {
      console.log(`  ✅ Walk-in client exists (ID: ${walkInRows[0].id})`);
    }

    // ── 7. SystemConfiguration singleton ─────────────────────────────────────
    const cfgRows = await query("SELECT id FROM system_configuration LIMIT 1");
    if (cfgRows.length === 0) {
      await query(
        `INSERT INTO system_configuration (
           id,
           company_name,
           company_name_english,
           tax_number,
           address,
           phone_number,
           logo_url,
           theme_key,
           tax_enabled_on_purchases,
           tax_enabled_on_expenses,
           session_timeout_minutes,
           password_min_length,
           password_require_uppercase,
           password_require_lowercase,
           password_require_number,
           password_require_special_char,
           updated_at
         )
         VALUES (
           1,
           'رامكس ستور',
           'Ramex Store',
           '',
           '',
           '',
           '',
           'ramex-store',
           false,
           false,
           720,
           8,
           true,
           true,
           true,
           true,
           NOW()
         )`
      );
      console.log("  ✅ Created SystemConfiguration");
    } else {
      // Ensure company name is set correctly
      await query(
        `UPDATE system_configuration
         SET company_name = 'رامكس ستور',
             company_name_english = 'Ramex Store',
             theme_key = 'ramex-store',
             updated_at = NOW()
         WHERE id = 1`
      );
      console.log("  ✅ SystemConfiguration exists (updated company name)");
    }

    console.log("\n✨ Ramex Store seed complete!");
  } catch (err) {
    console.error("❌ Seed failed:", err);
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
