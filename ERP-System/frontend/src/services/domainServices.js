import { createMockService } from "./mockServiceFactory";
import { employeeService } from "./employeeApi";
import { treasuryService } from "./treasuryService";

// Employee and Treasury services use real API
export { employeeService, treasuryService };

// Other services still use mock data (for now)
export const supplierService = createMockService("erp_suppliers");
export const clientService = createMockService("erp_clients");
export const itemService = createMockService("erp_items");
export const branchService = createMockService("erp_branches");
export const categoryService = createMockService("erp_categories");
export const warehouseService = createMockService("erp_warehouses");
export const expenseService = createMockService("erp_expenses");
