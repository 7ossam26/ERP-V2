// scripts/seed-production.js
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const path = require("path");
const dotenv = require("dotenv");

// Load root .env.local
const envPath = path.resolve(__dirname, "../../.env.local");
dotenv.config({ path: envPath });

async function main() {
  console.log("🌱 Starting Production Seeding (via mysql2)...");

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not defined");
  }

  const connection = await mysql.createConnection(process.env.DATABASE_URL);

  try {
    // Helper for queries
    const query = async (sql, params) => {
      const [rows] = await connection.execute(sql, params);
      return rows;
    };

    // 1. ROLES
    // -------------------------------------------------------------
    const roles = [
      { name: "Superadmin", description: "Full system access" },
      { name: "Admin", description: "Administrative access" },
      { name: "Manager", description: "Department manager" },
      { name: "Employee", description: "Standard employee" },
    ];

    for (const r of roles) {
      await query(
        `INSERT INTO roles (name, description, updated_at) VALUES (?, ?, NOW()) 
                 ON DUPLICATE KEY UPDATE description = VALUES(description), updated_at = NOW()`,
        [r.name, r.description],
      );
    }
    console.log("✅ Roles synced");

    // 2. PERMISSIONS (Superadmin)
    // -------------------------------------------------------------
    const [superadminRows] = await connection.execute(
      "SELECT id FROM roles WHERE name = 'Superadmin'",
    );
    if (superadminRows.length === 0)
      throw new Error("Superadmin Role not found");
    const superadminRoleId = superadminRows[0].id;

    const modules = [
      "HR",
      "INVENTORY",
      "POS",
      "PURCHASES",
      "SALES",
      "REPORTS",
      "TREASURIES",
      "BRANCHES",
      "EMPLOYEES",
      "CLIENTS",
      "SUPPLIERS",
      "CATEGORIES",
      "ITEMS",
      "WAREHOUSES",
      "SETTINGS",
      "EXPENSES",
      "DEPOSITS",
      "CREATES_DEPOSITS",
      "WITHDRAWALS",
      "CREATES_WITHDRAWALS",
      "STOCK_TRANSFER",
      "CASH_TRANSFER",
      "TRANSFER_MANAGEMENT",
      "SUPPLIER_ACCOUNTS",
      "INVENTORY_COUNT",
      "CREATES_WAREHOUSES",
      "CREATES_EMPLOYEES",
      "CREATES_SUPPLIERS",
      "CREATES_CLIENTS",
      "CREATES_CATEGORIES",
      "CREATES_ITEMS",
      "CREATES_TREASURIES",
      "CREATES_BRANCHES",
      "DELIVERY_MEN",
      "CREATES_DELIVERY_MEN",
      "DELIVERY_ZONES",
      "CREATES_DELIVERY_ZONES",
      "DELIVERY_SETTLEMENT",
      "CREATES_PRODUCTION",
      "CREATES_PRODUCTION",
      "SHIFTS",
    ];

    for (const module of modules) {
      await query(
        `INSERT INTO permissions (role_id, module, can_access) VALUES (?, ?, ?) 
                 ON DUPLICATE KEY UPDATE can_access = ?`,
        [superadminRoleId, module, true, true],
      );
    }
    console.log("✅ Permissions synced");

    // 2.5. PERMISSIONS (Employee)
    // -------------------------------------------------------------
    const [employeeRows] = await connection.execute(
      "SELECT id FROM roles WHERE name = 'Employee'",
    );
    if (employeeRows.length > 0) {
      const employeeRoleId = employeeRows[0].id;
      const employeeModules = [
        "POS",
        "SALES",
        "CLIENTS",
        "ITEMS",
        "CATEGORIES",
        "INVENTORY",
        "CREATES_CLIENTS",
      ];

      for (const module of employeeModules) {
        await query(
          `INSERT INTO permissions (role_id, module, can_access) VALUES (?, ?, ?) 
                     ON DUPLICATE KEY UPDATE can_access = ?`,
          [employeeRoleId, module, true, true],
        );
      }
      console.log("✅ Employee Permissions synced");
    }

    // 2.6. PERMISSIONS (Admin)
    // -------------------------------------------------------------
    const [adminRows] = await connection.execute(
      "SELECT id FROM roles WHERE name = 'Admin'",
    );
    if (adminRows.length > 0) {
      const adminRoleId = adminRows[0].id;
      const adminModules = [
        "DEPOSITS",
        "CREATES_DEPOSITS",
        "WITHDRAWALS",
        "CREATES_WITHDRAWALS",
      ];

      for (const module of adminModules) {
        await query(
          `INSERT INTO permissions (role_id, module, can_access) VALUES (?, ?, ?) 
                     ON DUPLICATE KEY UPDATE can_access = ?`,
          [adminRoleId, module, true, true],
        );
      }
      console.log("✅ Admin Permissions synced");
    }

    // 3. INFRASTRUCTURE: MAIN BRANCH
    // -------------------------------------------------------------
    const MAIN_BRANCH_NAME = "Main Branch";
    const MAIN_WAREHOUSE_NAME = "Main Warehouse";
    const MAIN_TREASURY_NAME = "Main Treasury";

    // Warehouse
    let warehouseId;
    const [warehouseRows] = await connection.execute(
      "SELECT id FROM warehouses WHERE name = ?",
      [MAIN_WAREHOUSE_NAME],
    );
    if (warehouseRows.length > 0) {
      warehouseId = warehouseRows[0].id;
    } else {
      // FIX: Removed destructuring, as INSERT returns an object (ResultSetHeader), not an array
      const result = await query(
        "INSERT INTO warehouses (name, updated_at) VALUES (?, NOW())",
        [MAIN_WAREHOUSE_NAME],
      );
      warehouseId = result.insertId;
      console.log(`✅ Created ${MAIN_WAREHOUSE_NAME} (ID: ${warehouseId})`);
    }

    // Treasury
    let treasuryId;
    const [treasuryRows] = await connection.execute(
      "SELECT id FROM treasuries WHERE name = ?",
      [MAIN_TREASURY_NAME],
    );
    if (treasuryRows.length > 0) {
      treasuryId = treasuryRows[0].id;
    } else {
      // FIX: Removed destructuring
      const result = await query(
        "INSERT INTO treasuries (name, balance, updated_at) VALUES (?, 0, NOW())",
        [MAIN_TREASURY_NAME],
      );
      treasuryId = result.insertId;
      console.log(`✅ Created ${MAIN_TREASURY_NAME} (ID: ${treasuryId})`);
    }

    // Branch
    let branchId;
    const [branchRows] = await connection.execute(
      "SELECT id FROM branches WHERE name = ?",
      [MAIN_BRANCH_NAME],
    );
    if (branchRows.length > 0) {
      branchId = branchRows[0].id;
    } else {
      // FIX: Removed destructuring
      const result = await query(
        "INSERT INTO branches (name, address, warehouse_id, treasury_id, updated_at) VALUES (?, 'Headquarters', ?, ?, NOW())",
        [MAIN_BRANCH_NAME, warehouseId, treasuryId],
      );
      branchId = result.insertId;
      console.log(`✅ Created ${MAIN_BRANCH_NAME} (ID: ${branchId})`);
    }

    // 4. PLACEHOLDERS (General Client & Supplier)
    // -------------------------------------------------------------
    // General Client
    const [clientRows] = await connection.execute(
      "SELECT id FROM clients WHERE name = 'عميل نقدي'",
    );
    if (clientRows.length === 0) {
      // FIX: Removed destructuring
      const result = await query(
        "INSERT INTO clients (name, phone_number, updated_at) VALUES ('عميل نقدي', '00000000000', NOW())",
        [],
      );
      console.log(`✅ Created General Client (ID: ${result.insertId})`);
    }

    // General Supplier
    const [supplierRows] = await connection.execute(
      "SELECT id FROM suppliers WHERE name = 'مورد عام'",
    );
    if (supplierRows.length === 0) {
      // FIX: Removed destructuring
      const result = await query(
        "INSERT INTO suppliers (name, phone_number, updated_at) VALUES ('مورد عام', '00000000000', NOW())",
        [],
      );
      console.log(`✅ Created General Supplier (ID: ${result.insertId})`);
    }

    // 5. SUPERADMIN USER
    // -------------------------------------------------------------
    const adminUsername = process.env.ADMIN_USERNAME || "superadmin";
    const adminPassword = process.env.ADMIN_PASSWORD || "246810@Ad";
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    // Check if user exists
    const [userRows] = await connection.execute(
      "SELECT id FROM users WHERE username = ?",
      [adminUsername],
    );

    if (userRows.length === 0) {
      // FIX: Removed destructuring
      const result = await query(
        `INSERT INTO users (name, username, password, role_id, branch_id, is_active, has_sensitive_access, updated_at) 
                 VALUES ('Superadmin', ?, ?, ?, NULL, true, true, NOW())`,
        [adminUsername, hashedPassword, superadminRoleId],
      );
      console.log(
        `✅ Created Superadmin User: ${adminUsername} (ID: ${result.insertId})`,
      );
    } else {
      // Update existing
      await query(
        `UPDATE users SET role_id = ?, branch_id = NULL, password = ?, has_sensitive_access = true, updated_at = NOW() 
                 WHERE username = ?`,
        [superadminRoleId, hashedPassword, adminUsername],
      );
      console.log(
        `✅ Updated Superadmin User: ${adminUsername} (ID: ${userRows[0].id})`,
      );
    }

    console.log("✨ Seeding Complete!");
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
