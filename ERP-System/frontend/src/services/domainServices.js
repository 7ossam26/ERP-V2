import { createMockService } from "./mockServiceFactory";
import { employeeService } from "./employeeApi";
import { treasuryService } from "./treasuryService";
import { branchService } from "./branchService";
import { warehouseService } from "./warehouseService";
import { clientService } from "./clientService";
import { supplierService } from "./supplierService";
import { categoryService } from "./categoryService";
import { itemService } from "./itemService";
import { purchaseService } from "./purchaseService";
import { salesService } from "./salesService";
import { settingsService } from "./settingsService";
import { inventoryService } from "./inventoryService";
import { stockTransferService } from "./stockTransferService";
import shiftService from "./shiftService";
import { reportService } from "./reportService";
import { expenseService } from "./expenseService";

// Employee, Treasury, Branch, Warehouse, Client, Supplier, Category, Item, Purchase, and Sales services use real API
export {
  employeeService,
  treasuryService,
  branchService,
  warehouseService,
  clientService,
  supplierService,
  categoryService,
  itemService,
  purchaseService,
  salesService,
  settingsService,
  inventoryService,
  stockTransferService,
  shiftService,
  reportService,
  expenseService,
};

export const deductionService = {
  getAll: async (filters = {}) => {
    return await employeeService.getAllTransactions({
      ...filters,
      type: "DEDUCTION",
    });
  },
  update: async (id, data) => {
    return await employeeService.updateTransaction(id, data);
  },
  delete: async (id) => {
    return await employeeService.deleteTransaction(id);
  },
  create: async () => {
    throw new Error("Create not supported directly");
  },
};

export const advanceService = {
  getAll: async (filters = {}) => {
    return await employeeService.getAllTransactions({
      ...filters,
      type: "ADVANCE",
    });
  },
  update: async (id, data) => {
    return await employeeService.updateTransaction(id, data);
  },
  delete: async (id) => {
    return await employeeService.deleteTransaction(id);
  },
  create: async () => {
    throw new Error("Create not supported directly");
  },
};
