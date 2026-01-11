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
};

// Other services still use mock data (for now)
import { expenseService } from "./expenseService";

// Other services still use mock data (for now)
// export const expenseService = createMockService("erp_expenses");
export { expenseService };
