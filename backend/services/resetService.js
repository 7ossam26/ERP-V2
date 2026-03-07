const prisma = require("../config/database");

/**
 * Reset service to handle different database reset operations carefully.
 */
class ResetService {
  /**
   * Helper to execute raw queries, optionally disabling foreign keys
   * @param {string} query
   */
  static async executeRawUnsafe(query) {
    // Note: Prisma's $executeRawUnsafe doesn't easily support multi-statement without special connection settings
    // so we execute them one by one.
    await prisma.$executeRawUnsafe(query);
  }

  static async clearSales() {
    await prisma.$transaction(async (tx) => {
      // Delete child first
      await tx.saleItem.deleteMany();
      await tx.sale.deleteMany();
    });
  }

  static async clearPurchases() {
    await prisma.$transaction(async (tx) => {
      await tx.purchaseItem.deleteMany();
      // Also need to clear SupplierPayments linked to these purchases or nullify
      await tx.supplierPayment.updateMany({
        where: { purchaseId: { not: null } },
        data: { purchaseId: null },
      });
      // And expenses linked to these purchases
      await tx.expense.deleteMany({
        where: { purchaseId: { not: null } },
      });

      await tx.purchase.deleteMany();
    });
  }

  static async clearTreasury() {
    await prisma.$transaction(async (tx) => {
      await tx.expense.deleteMany({
        where: { purchaseId: null }, // Don't delete expenses linked to purchases here, they are handled in purchases
      });
      await tx.cashTransfer.deleteMany();
      await tx.deposit.deleteMany();
      await tx.withdrawal.deleteMany();
      await tx.supplierPayment.deleteMany();

      // Reset treasury balances
      await tx.treasury.updateMany({
        data: { balance: 0 },
      });

      // Reset supplier balances
      await tx.supplierAccount.updateMany({
        data: { balance: 0 },
      });
    });
  }

  static async clearInventoryMovements() {
    await prisma.$transaction(async (tx) => {
      await tx.stockTransferItem.deleteMany();
      await tx.stockTransfer.deleteMany();
    });
  }

  static async clearHR() {
    await prisma.$transaction(async (tx) => {
      await tx.payroll.deleteMany();
      await tx.employeeTransaction.deleteMany();

      // Need to unlink shifts from sales/expenses before deleting
      await tx.sale.updateMany({
        where: { shiftId: { not: null } },
        data: { shiftId: null },
      });

      await tx.expense.updateMany({
        where: { shiftId: { not: null } },
        data: { shiftId: null },
      });

      await tx.shift.deleteMany();
    });
  }

  static async clearItemsAndCategories() {
    await prisma.$transaction(async (tx) => {
      // Must clear inventory first
      await tx.inventory.deleteMany();

      // Clear linkages
      await tx.itemSupplier.deleteMany();
      await tx.itemCategory.deleteMany();
      await tx.bomCategory.deleteMany();

      // Clear BOMs
      await tx.bOMItem.deleteMany();
      await tx.bOM.deleteMany();

      // Clear main entities
      await tx.item.deleteMany();
      await tx.category.deleteMany();
    });
  }

  static async clearClients() {
    await prisma.$transaction(async (tx) => {
      // Don't delete ID 1 ("عميل نقدي")
      await tx.client.deleteMany({
        where: { id: { not: 1 } },
      });
    });
  }

  static async clearSuppliers() {
    await prisma.$transaction(async (tx) => {
      // Don't delete the seeded supplier (by name 'مورد عام')
      const generalSupplier = await tx.supplier.findFirst({
        where: { name: "مورد عام" },
      });

      let whereClause = {};
      if (generalSupplier) {
        whereClause = { id: { not: generalSupplier.id } };
      }

      // Delete accounts first
      await tx.supplierAccount.deleteMany({
        where: whereClause,
      });

      await tx.supplier.deleteMany({
        where: whereClause,
      });
    });
  }

  static async clearEmployees() {
    await prisma.$transaction(async (tx) => {
      // Unlink users who are employees
      await tx.user.updateMany({
        data: { branchId: null }, // Optionally reset branch mapping if tied
      });

      await tx.employee.deleteMany();
    });
  }

  static async clearCashTransfers() {
    await prisma.cashTransfer.deleteMany();
  }

  static async clearDeposits() {
    await prisma.deposit.deleteMany();
  }

  static async clearWithdrawals() {
    await prisma.withdrawal.deleteMany();
  }

  static async clearSupplierPayments() {
    await prisma.supplierPayment.deleteMany();
  }

  static async clearPayrolls() {
    await prisma.payroll.deleteMany();
  }

  static async clearEmployeeTransactions() {
    await prisma.employeeTransaction.deleteMany();
  }

  static async clearProductionOrders() {
    await prisma.$transaction(async (tx) => {
      await tx.productionOrderItem.deleteMany();
      await tx.productionOrder.deleteMany();
    });
  }

  static async clearDeliveryRecords() {
    await prisma.$transaction(async (tx) => {
      await tx.deliveryManTransaction.deleteMany();
      await tx.deliverySettlement.deleteMany();
    });
  }

  static async clearShifts() {
    await prisma.$transaction(async (tx) => {
      await tx.sale.updateMany({
        where: { shiftId: { not: null } },
        data: { shiftId: null },
      });

      await tx.expense.updateMany({
        where: { shiftId: { not: null } },
        data: { shiftId: null },
      });

      await tx.shift.deleteMany();
    });
  }

  static async clearAuditLogs() {
    await prisma.auditLog.deleteMany();
  }

  static async clearAllTransactions() {
    // It's safer to use raw queries with foreign key checks disabled for massive cross-table deletes
    try {
      await prisma.$executeRawUnsafe(`SET FOREIGN_KEY_CHECKS = 0;`);

      // Delete all transactional records
      const tablesToClear = [
        "sale_items",
        "sales",
        "purchase_items",
        "purchases",
        "expenses",
        "cash_transfers",
        "deposits",
        "withdrawals",
        "supplier_payments",
        "stock_transfer_items",
        "stock_transfers",
        "payrolls",
        "employee_transactions",
        "shifts",
        "production_orders",
        "production_order_items",
        "delivery_transactions",
        "delivery_settlements",
        "audit_logs",
      ];

      for (const table of tablesToClear) {
        await prisma.$executeRawUnsafe(`TRUNCATE TABLE \`${table}\`;`);
      }

      // Reset balances
      await prisma.$executeRawUnsafe(
        `UPDATE \`treasuries\` SET \`balance\` = 0;`,
      );
      await prisma.$executeRawUnsafe(
        `UPDATE \`supplier_accounts\` SET \`balance\` = 0;`,
      );
      await prisma.$executeRawUnsafe(
        `UPDATE \`inventory\` SET \`quantity\` = 0;`,
      );
    } finally {
      await prisma.$executeRawUnsafe(`SET FOREIGN_KEY_CHECKS = 1;`);
    }
  }
}

module.exports = ResetService;
