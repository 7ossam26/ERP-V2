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

// Employee, Treasury, Branch, Warehouse, Client, Supplier, Category, Item, and Purchase services use real API
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
};

// Other services still use mock data (for now)
export const expenseService = createMockService("erp_expenses");
