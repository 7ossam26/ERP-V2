// scripts/ramex-seed.js
// Seed Ramex Store: branches, users, clients, categories, items.
// Idempotent — safe to re-run; uses SELECT-before-INSERT.
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

const ensurePermissions = require("./ramex-permissions");

async function main() {
  console.log("🌱 Ramex Store seeding started...");

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not defined");
  }

  const connection = await mysql.createConnection(process.env.DATABASE_URL);

  try {
    // Helper
    const query = async (sql, params = []) => {
      const [rows] = await connection.execute(sql, params);
      return rows;
    };

    const findOrCreate = async (table, findWhere, insertSql, insertParams) => {
      const [where_col, where_val] = findWhere;
      const rows = await query(`SELECT id FROM ${table} WHERE ${where_col} = ?`, [where_val]);
      if (rows.length > 0) return rows[0].id;
      const result = await query(insertSql, insertParams);
      return result.insertId;
    };

    // ─── 1. Permissions & Roles ──────────────────────────────────────────────
    await ensurePermissions();
    console.log("✅ Roles & permissions synced");

    // ─── 2. Warehouses ───────────────────────────────────────────────────────
    const gesrWarehouseId = await findOrCreate(
      "warehouses",
      ["name", "مخزن جسر السويس"],
      "INSERT INTO warehouses (name, updated_at) VALUES (?, NOW())",
      ["مخزن جسر السويس"]
    );
    const ramoWarehouseId = await findOrCreate(
      "warehouses",
      ["name", "مخزن رامو"],
      "INSERT INTO warehouses (name, updated_at) VALUES (?, NOW())",
      ["مخزن رامو"]
    );
    console.log(`✅ Warehouses: جسر السويس(${gesrWarehouseId}), رامو(${ramoWarehouseId})`);

    // ─── 3. Treasuries ───────────────────────────────────────────────────────
    const gesrTreasuryId = await findOrCreate(
      "treasuries",
      ["name", "خزنة جسر السويس"],
      "INSERT INTO treasuries (name, balance, updated_at) VALUES (?, 0, NOW())",
      ["خزنة جسر السويس"]
    );
    const ramoTreasuryId = await findOrCreate(
      "treasuries",
      ["name", "خزنة رامو"],
      "INSERT INTO treasuries (name, balance, updated_at) VALUES (?, 0, NOW())",
      ["خزنة رامو"]
    );
    console.log(`✅ Treasuries: جسر السويس(${gesrTreasuryId}), رامو(${ramoTreasuryId})`);

    // ─── 4. Branches ─────────────────────────────────────────────────────────
    const gesrBranchId = await findOrCreate(
      "branches",
      ["name", "جسر السويس"],
      "INSERT INTO branches (name, address, warehouse_id, treasury_id, updated_at) VALUES (?, ?, ?, ?, NOW())",
      ["جسر السويس", "جسر السويس — أقمشة", gesrWarehouseId, gesrTreasuryId]
    );
    const ramoBranchId = await findOrCreate(
      "branches",
      ["name", "رامو"],
      "INSERT INTO branches (name, address, warehouse_id, treasury_id, updated_at) VALUES (?, ?, ?, ?, NOW())",
      ["رامو", "رامو — ملابس", ramoWarehouseId, ramoTreasuryId]
    );
    console.log(`✅ Branches: جسر السويس(${gesrBranchId}), رامو(${ramoBranchId})`);

    // ─── 5. Users ────────────────────────────────────────────────────────────
    const defaultPassword = process.env.RAMEX_SEED_PASSWORD || "ramex123";
    const hashed = await bcrypt.hash(defaultPassword, 10);

    const getRoleId = async (name) => {
      const rows = await query("SELECT id FROM roles WHERE name = ?", [name]);
      if (rows.length === 0) throw new Error(`Role not found: ${name}`);
      return rows[0].id;
    };

    const upsertUser = async ({ username, name, roleId, branchId }) => {
      const rows = await query("SELECT id FROM users WHERE username = ?", [username]);
      if (rows.length > 0) {
        await query(
          "UPDATE users SET name=?, role_id=?, branch_id=?, updated_at=NOW() WHERE username=?",
          [name, roleId, branchId, username]
        );
        return rows[0].id;
      }
      const result = await query(
        `INSERT INTO users (name, username, password, role_id, branch_id, is_active, has_sensitive_access, updated_at)
         VALUES (?, ?, ?, ?, ?, true, false, NOW())`,
        [name, username, hashed, roleId, branchId]
      );
      return result.insertId;
    };

    const ownerRoleId       = await getRoleId("Owner");
    const branchMgrRoleId   = await getRoleId("BranchManager");
    const cashierRoleId     = await getRoleId("Cashier");
    const warehouseRoleId   = await getRoleId("WarehouseKeeper");
    const accountantRoleId  = await getRoleId("Accountant");

    const ownerId       = await upsertUser({ username: "owner",          name: "المالك",              roleId: ownerRoleId,      branchId: null });
    const mgrGesrId     = await upsertUser({ username: "manager_gesr",   name: "مدير جسر السويس",     roleId: branchMgrRoleId,  branchId: gesrBranchId });
    const mgrRamoId     = await upsertUser({ username: "manager_ramo",   name: "مدير رامو",           roleId: branchMgrRoleId,  branchId: ramoBranchId });
    const cashierGesrId = await upsertUser({ username: "cashier_gesr",   name: "كاشير جسر السويس",    roleId: cashierRoleId,    branchId: gesrBranchId });
    const cashierRamoId = await upsertUser({ username: "cashier_ramo",   name: "كاشير رامو",          roleId: cashierRoleId,    branchId: ramoBranchId });
    const whGesrId      = await upsertUser({ username: "warehouse_gesr", name: "أمين مخزن جسر السويس",roleId: warehouseRoleId,  branchId: gesrBranchId });
    const whRamoId      = await upsertUser({ username: "warehouse_ramo", name: "أمين مخزن رامو",      roleId: warehouseRoleId,  branchId: ramoBranchId });
    const accountantId  = await upsertUser({ username: "accountant",     name: "المحاسب",             roleId: accountantRoleId, branchId: null });
    console.log("✅ Users upserted");

    // ─── 6. AccessibleBranches (many-to-many join table) ─────────────────────
    // Owner and Accountant → both branches. Others already have branchId set.
    // Prisma implicit M2M: table _AccessibleBranches, columns A=Branch.id, B=User.id
    const linkBranch = async (branchId, userId) => {
      await query(
        `INSERT INTO _AccessibleBranches (A, B) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE A = A`,
        [branchId, userId]
      );
    };

    for (const userId of [ownerId, accountantId]) {
      await linkBranch(gesrBranchId, userId);
      await linkBranch(ramoBranchId, userId);
    }
    for (const [userId, branchId] of [
      [mgrGesrId, gesrBranchId], [mgrRamoId, ramoBranchId],
      [cashierGesrId, gesrBranchId], [cashierRamoId, ramoBranchId],
      [whGesrId, gesrBranchId], [whRamoId, ramoBranchId],
    ]) {
      await linkBranch(branchId, userId);
    }
    console.log("✅ AccessibleBranches linked");

    // ─── 7. Walk-in clients ───────────────────────────────────────────────────
    // One global walk-in client (POS default)
    await findOrCreate(
      "clients",
      ["name", "عميل نقدي"],
      "INSERT INTO clients (name, phone_number, updated_at) VALUES (?, '00000000000', NOW())",
      ["عميل نقدي"]
    );
    console.log("✅ Walk-in client ensured");

    // ─── 8. Categories ───────────────────────────────────────────────────────
    const categories = [
      { name: "أقمشة",      showInPos: true },
      { name: "ملابس",      showInPos: true },
      { name: "إكسسوارات",  showInPos: true },
    ];
    for (const cat of categories) {
      await query(
        `INSERT INTO categories (name, show_in_pos, updated_at) VALUES (?, ?, NOW())
         ON DUPLICATE KEY UPDATE show_in_pos = VALUES(show_in_pos), updated_at = NOW()`,
        [cat.name, cat.showInPos]
      );
    }
    console.log("✅ Categories synced");

    // ─── 9. Sample Items ─────────────────────────────────────────────────────
    const items = [
      // FABRIC items (unit: متر, itemType: FABRIC)
      { name: "قماش قطن أبيض",   price: 25.00, costPrice: 15.00, unit: "متر",  itemType: "FABRIC",   showInPos: true },
      { name: "قماش حرير أزرق",  price: 55.00, costPrice: 35.00, unit: "متر",  itemType: "FABRIC",   showInPos: true },
      { name: "قماش كتان بيج",   price: 30.00, costPrice: 18.00, unit: "متر",  itemType: "FABRIC",   showInPos: true },
      // CLOTHES items (unit: قطعة, itemType: CLOTHES)
      { name: "قميص رجالي",       price: 150.00, costPrice: 80.00, unit: "قطعة", itemType: "CLOTHES",  showInPos: true },
      { name: "بنطلون جينز",      price: 250.00, costPrice: 130.00, unit: "قطعة", itemType: "CLOTHES", showInPos: true },
      { name: "فستان نسائي",      price: 300.00, costPrice: 160.00, unit: "قطعة", itemType: "CLOTHES", showInPos: true },
    ];

    const itemIds = {};
    for (const item of items) {
      const rows = await query("SELECT id FROM items WHERE name = ?", [item.name]);
      if (rows.length > 0) {
        itemIds[item.name] = rows[0].id;
        continue;
      }
      const result = await query(
        `INSERT INTO items (name, price, cost_price, unit, item_type, show_in_pos, reorder_point, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 5, NOW())`,
        [item.name, item.price, item.costPrice, item.unit, item.itemType, item.showInPos]
      );
      itemIds[item.name] = result.insertId;
    }
    console.log("✅ Sample items ensured");

    // ─── 10. Opening Inventory ───────────────────────────────────────────────
    // Fabric items → جسر السويس warehouse; Clothes → رامو warehouse
    const inventorySeeds = [
      { itemName: "قماش قطن أبيض",  warehouseId: gesrWarehouseId, qty: 100 },
      { itemName: "قماش حرير أزرق", warehouseId: gesrWarehouseId, qty: 50  },
      { itemName: "قماش كتان بيج",  warehouseId: gesrWarehouseId, qty: 80  },
      { itemName: "قميص رجالي",      warehouseId: ramoWarehouseId, qty: 30  },
      { itemName: "بنطلون جينز",     warehouseId: ramoWarehouseId, qty: 25  },
      { itemName: "فستان نسائي",     warehouseId: ramoWarehouseId, qty: 20  },
    ];
    for (const inv of inventorySeeds) {
      const itemId = itemIds[inv.itemName];
      if (!itemId) continue;
      await query(
        `INSERT INTO inventory (item_id, warehouse_id, quantity, updated_at)
         VALUES (?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE updated_at = updated_at`,
        [itemId, inv.warehouseId, inv.qty]
      );
    }
    console.log("✅ Opening inventory seeded");

    console.log("\n✨ Ramex Store seeding complete!");
    console.log(`   Default password for all test users: "${defaultPassword}"`);
    console.log("   Users: owner, manager_gesr, manager_ramo, cashier_gesr, cashier_ramo,");
    console.log("          warehouse_gesr, warehouse_ramo, accountant");

  } catch (err) {
    console.error("❌ Seeding failed:", err);
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
