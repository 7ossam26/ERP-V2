const mysql = require("mysql2/promise");
const dotenv = require("dotenv");
const path = require("path");

// Load env
const envBackend = path.resolve(__dirname, "../.env");
dotenv.config({ path: envBackend });
// If not found, try root
if (!process.env.DATABASE_URL) {
    const envRoot = path.resolve(__dirname, "../../.env");
    dotenv.config({ path: envRoot });
}

console.log("DB URL Loaded:", process.env.DATABASE_URL ? "YES" : "NO");

async function main() {
    console.log("🚀 Adding General Manager Role...");

    if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL is not defined");
    }

    const connection = await mysql.createConnection(process.env.DATABASE_URL);

    try {
        // 1. Create Role
        const [result] = await connection.execute(
            `INSERT INTO roles (name, description, updated_at) VALUES (?, ?, NOW()) 
             ON DUPLICATE KEY UPDATE description = VALUES(description), updated_at = NOW()`,
            ["General Manager", "Manages multiple branches with full access"]
        );

        console.log("✅ Role 'General Manager' ensured.");

        // 2. Get Role ID
        const [rows] = await connection.execute("SELECT id FROM roles WHERE name = 'General Manager'");
        const roleId = rows[0].id;

        // 3. Assign Permissions (Same as Superadmin but maybe scoped? User said 'full admin rights')
        // We will give them access to ALL modules for now, similar to Superadmin.
        const modules = [
            "HR", "INVENTORY", "POS", "PURCHASES", "SALES", "REPORTS",
            "TREASURIES", "BRANCHES", "EMPLOYEES", "CLIENTS", "SUPPLIERS",
            "CATEGORIES", "ITEMS", "WAREHOUSES", "SETTINGS", "EXPENSES",
            "DEPOSITS", "STOCK_TRANSFER", "CASH_TRANSFER", "TRANSFER_MANAGEMENT",
            "SUPPLIER_ACCOUNTS", "INVENTORY_COUNT",
            // Creation permissions
            "CREATES_WAREHOUSES", "CREATES_EMPLOYEES", "CREATES_SUPPLIERS",
            "CREATES_CLIENTS", "CREATES_CATEGORIES", "CREATES_ITEMS",
            "CREATES_TREASURIES", "CREATES_BRANCHES", "CREATES_DEPOSITS",
            "DELIVERY_MEN", "CREATES_DELIVERY_MEN", "DELIVERY_ZONES", "CREATES_DELIVERY_ZONES",
            "SHIFTS"
        ];

        for (const module of modules) {
            await connection.execute(
                `INSERT INTO permissions (role_id, module, can_access) VALUES (?, ?, ?) 
                 ON DUPLICATE KEY UPDATE can_access = ?`,
                [roleId, module, true, true]
            );
        }

        console.log("✅ Permissions assigned to General Manager.");

    } catch (err) {
        console.error("❌ Error:", err);
    } finally {
        await connection.end();
    }
}

main();
