const express = require("express");
const router = express.Router();
const prisma = require("../config/database");

// GET /api/temp-debug/fix-permissions
router.get("/fix-permissions", async (req, res) => {
    try {
        console.log(">>> [DEBUG] Starting permission fix...");

        // 1. Find invalid permissions (module = '' or NULL or not in known enums)
        // Prisma might throw if we query specifically for "NOT IN (...)" with enums it doesn't like,
        // so we'll use raw SQL to find and delete them.

        // Get all valid modules from the schema (hardcoded here to match schema.prisma)
        const validModules = [
            'HR', 'INVENTORY', 'INVENTORY_COUNT', 'STOCK_TRANSFER', 'POS', 'PURCHASES', 'SALES', 'REPORTS',
            'TREASURIES', 'CASH_TRANSFER', 'TRANSFER_MANAGEMENT', 'BRANCHES', 'EMPLOYEES', 'CLIENTS',
            'SUPPLIERS', 'SUPPLIER_ACCOUNTS', 'CATEGORIES', 'ITEMS', 'WAREHOUSES', 'SETTINGS', 'EXPENSES',
            'SHIFTS', 'DELIVERY_SETTLEMENT',
            'CREATES_WAREHOUSES', 'CREATES_EMPLOYEES', 'CREATES_SUPPLIERS', 'CREATES_CLIENTS',
            'CREATES_CATEGORIES', 'CREATES_ITEMS', 'CREATES_TREASURIES', 'CREATES_BRANCHES',
            'DEPOSITS', 'CREATES_DEPOSITS', 'DELIVERY_MEN', 'CREATES_DELIVERY_MEN',
            'DELIVERY_ZONES', 'CREATES_DELIVERY_ZONES', 'CREATES_PRODUCTION'
        ];

        // Convert to SQL string for IN clause
        const validModulesSql = validModules.map(m => `'${m}'`).join(', ');

        // Check count of invalid records
        const checkQuery = `
      SELECT COUNT(*) as count 
      FROM permissions 
      WHERE module = '' OR module IS NULL OR module NOT IN (${validModulesSql});
    `;

        // We use $queryRawUnsafe because we are constructing the query string.
        // In a real app we'd be more careful, but this is a temp debug script with hardcoded values.
        const result = await prisma.$queryRawUnsafe(checkQuery);
        // result comes back as an array of objects, e.g. [{ count: 5n }] (BigInt)

        const count = Number(result[0]?.count || 0);
        console.log(`>>> [DEBUG] Found ${count} invalid permission records.`);

        if (count > 0) {
            // Delete them
            const deleteQuery = `
            DELETE FROM permissions 
            WHERE module = '' OR module IS NULL OR module NOT IN (${validModulesSql});
        `;
            const deleted = await prisma.$executeRawUnsafe(deleteQuery);
            console.log(`>>> [DEBUG] Deleted ${deleted} records.`);

            return res.json({
                message: "Fixed invalid permissions.",
                foundInvalid: count,
                deleted: Number(deleted),
                validModulesCount: validModules.length
            });
        }

        return res.json({
            message: "No invalid permissions found.",
            foundInvalid: 0,
            validModulesCount: validModules.length
        });

    } catch (error) {
        console.error(">>> [DEBUG] Error fixing permissions:", error);
        res.status(500).json({ error: error.message, stack: error.stack });
    }
});

module.exports = router;
