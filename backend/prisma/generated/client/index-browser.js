
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.22.0
 * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
 */
Prisma.prismaVersion = {
  client: "5.22.0",
  engine: "605197351a3c8bdd595af2d2a9bc3025bca48ea2"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.NotFoundError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`NotFoundError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  Serializable: 'Serializable'
});

exports.Prisma.UserScalarFieldEnum = {
  id: 'id',
  name: 'name',
  username: 'username',
  password: 'password',
  roleId: 'roleId',
  isActive: 'isActive',
  hasSensitiveAccess: 'hasSensitiveAccess',
  branchId: 'branchId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.RoleScalarFieldEnum = {
  id: 'id',
  name: 'name',
  description: 'description',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PermissionScalarFieldEnum = {
  id: 'id',
  roleId: 'roleId',
  module: 'module',
  canAccess: 'canAccess'
};

exports.Prisma.AuditLogScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  action: 'action',
  targetEntity: 'targetEntity',
  targetId: 'targetId',
  details: 'details',
  oldValues: 'oldValues',
  ipAddress: 'ipAddress',
  branchId: 'branchId',
  rowHash: 'rowHash',
  createdAt: 'createdAt'
};

exports.Prisma.EmployeeScalarFieldEnum = {
  id: 'id',
  name: 'name',
  position: 'position',
  branchId: 'branchId',
  phoneNumber: 'phoneNumber',
  nationalId: 'nationalId',
  workingDaysPerMonth: 'workingDaysPerMonth',
  workingHoursPerDay: 'workingHoursPerDay',
  weeklyHoliday: 'weeklyHoliday',
  salary: 'salary',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.EmployeeTransactionScalarFieldEnum = {
  id: 'id',
  employeeId: 'employeeId',
  type: 'type',
  amount: 'amount',
  reason: 'reason',
  date: 'date',
  createdById: 'createdById',
  createdAt: 'createdAt'
};

exports.Prisma.PayrollScalarFieldEnum = {
  id: 'id',
  employeeId: 'employeeId',
  month: 'month',
  year: 'year',
  baseSalary: 'baseSalary',
  advances: 'advances',
  deductions: 'deductions',
  netSalary: 'netSalary',
  status: 'status',
  paymentDate: 'paymentDate',
  createdById: 'createdById',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.WarehouseScalarFieldEnum = {
  id: 'id',
  name: 'name',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  isActive: 'isActive'
};

exports.Prisma.TreasuryScalarFieldEnum = {
  id: 'id',
  name: 'name',
  balance: 'balance',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  isActive: 'isActive'
};

exports.Prisma.BranchScalarFieldEnum = {
  id: 'id',
  name: 'name',
  address: 'address',
  warehouseId: 'warehouseId',
  treasuryId: 'treasuryId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  isActive: 'isActive'
};

exports.Prisma.ClientScalarFieldEnum = {
  id: 'id',
  name: 'name',
  phoneNumber: 'phoneNumber',
  address: 'address',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SupplierScalarFieldEnum = {
  id: 'id',
  name: 'name',
  phoneNumber: 'phoneNumber',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.CategoryScalarFieldEnum = {
  id: 'id',
  name: 'name',
  showInPos: 'showInPos',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ItemScalarFieldEnum = {
  id: 'id',
  name: 'name',
  price: 'price',
  costPrice: 'costPrice',
  unit: 'unit',
  reorderPoint: 'reorderPoint',
  showInPos: 'showInPos',
  isBom: 'isBom',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.InventoryScalarFieldEnum = {
  itemId: 'itemId',
  warehouseId: 'warehouseId',
  quantity: 'quantity',
  updatedAt: 'updatedAt'
};

exports.Prisma.ItemSupplierScalarFieldEnum = {
  itemId: 'itemId',
  supplierId: 'supplierId'
};

exports.Prisma.ItemCategoryScalarFieldEnum = {
  itemId: 'itemId',
  categoryId: 'categoryId'
};

exports.Prisma.BOMCategoryScalarFieldEnum = {
  bomId: 'bomId',
  categoryId: 'categoryId'
};

exports.Prisma.PurchaseScalarFieldEnum = {
  id: 'id',
  supplierId: 'supplierId',
  treasuryId: 'treasuryId',
  warehouseId: 'warehouseId',
  supplierInvoiceNo: 'supplierInvoiceNo',
  paymentMethod: 'paymentMethod',
  paymentStatus: 'paymentStatus',
  subtotal: 'subtotal',
  discountType: 'discountType',
  discountValue: 'discountValue',
  discountAmount: 'discountAmount',
  netTotal: 'netTotal',
  paidAmount: 'paidAmount',
  remaining: 'remaining',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PurchaseItemScalarFieldEnum = {
  purchaseId: 'purchaseId',
  itemId: 'itemId',
  quantity: 'quantity',
  purchasePrice: 'purchasePrice',
  sellPrice: 'sellPrice',
  total: 'total'
};

exports.Prisma.PurchaseReturnScalarFieldEnum = {
  id: 'id',
  purchaseId: 'purchaseId',
  returnNumber: 'returnNumber',
  notes: 'notes',
  totalAmount: 'totalAmount',
  createdAt: 'createdAt'
};

exports.Prisma.PurchaseReturnItemScalarFieldEnum = {
  id: 'id',
  purchaseReturnId: 'purchaseReturnId',
  itemId: 'itemId',
  quantity: 'quantity',
  purchasePrice: 'purchasePrice',
  total: 'total'
};

exports.Prisma.ShiftScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  branchId: 'branchId',
  type: 'type',
  startTime: 'startTime',
  endTime: 'endTime',
  startCash: 'startCash',
  endCash: 'endCash',
  systemExpectedCash: 'systemExpectedCash',
  actualCash: 'actualCash',
  shortage: 'shortage',
  status: 'status',
  reviewedById: 'reviewedById',
  reviewedAt: 'reviewedAt'
};

exports.Prisma.SaleScalarFieldEnum = {
  id: 'id',
  saleNumber: 'saleNumber',
  clientId: 'clientId',
  employeeId: 'employeeId',
  userId: 'userId',
  branchId: 'branchId',
  treasuryId: 'treasuryId',
  warehouseId: 'warehouseId',
  shiftId: 'shiftId',
  deliveryManId: 'deliveryManId',
  deliveryZoneId: 'deliveryZoneId',
  deliveryFee: 'deliveryFee',
  deliveryDriverShare: 'deliveryDriverShare',
  deliveryAddress: 'deliveryAddress',
  deliveryStatus: 'deliveryStatus',
  subtotal: 'subtotal',
  taxRate: 'taxRate',
  taxAmount: 'taxAmount',
  total: 'total',
  paymentMethod: 'paymentMethod',
  paidAmount: 'paidAmount',
  changeAmount: 'changeAmount',
  status: 'status',
  notes: 'notes',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SaleItemScalarFieldEnum = {
  id: 'id',
  saleId: 'saleId',
  itemId: 'itemId',
  bomId: 'bomId',
  quantity: 'quantity',
  unitPrice: 'unitPrice',
  total: 'total'
};

exports.Prisma.CashTransferScalarFieldEnum = {
  id: 'id',
  amount: 'amount',
  notes: 'notes',
  fromTreasuryId: 'fromTreasuryId',
  toTreasuryId: 'toTreasuryId',
  status: 'status',
  createdAt: 'createdAt',
  createdById: 'createdById',
  acceptedById: 'acceptedById'
};

exports.Prisma.SystemConfigurationScalarFieldEnum = {
  id: 'id',
  companyName: 'companyName',
  taxNumber: 'taxNumber',
  mainWarehouseId: 'mainWarehouseId',
  mainTreasuryId: 'mainTreasuryId',
  bankTreasuryId: 'bankTreasuryId',
  taxRate: 'taxRate',
  salaryStartDay: 'salaryStartDay',
  salaryEndDay: 'salaryEndDay',
  shiftStartTime: 'shiftStartTime',
  shiftEndTime: 'shiftEndTime',
  morningShiftStart: 'morningShiftStart',
  morningShiftEnd: 'morningShiftEnd',
  eveningShiftStart: 'eveningShiftStart',
  eveningShiftEnd: 'eveningShiftEnd',
  updatedAt: 'updatedAt'
};

exports.Prisma.StockTransferScalarFieldEnum = {
  id: 'id',
  transferNumber: 'transferNumber',
  fromWarehouseId: 'fromWarehouseId',
  toWarehouseId: 'toWarehouseId',
  userId: 'userId',
  status: 'status',
  notes: 'notes',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.StockTransferItemScalarFieldEnum = {
  id: 'id',
  stockTransferId: 'stockTransferId',
  itemId: 'itemId',
  quantity: 'quantity'
};

exports.Prisma.SupplierAccountScalarFieldEnum = {
  id: 'id',
  supplierId: 'supplierId',
  balance: 'balance',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SupplierPaymentScalarFieldEnum = {
  id: 'id',
  supplierAccountId: 'supplierAccountId',
  purchaseId: 'purchaseId',
  amount: 'amount',
  treasuryId: 'treasuryId',
  notes: 'notes',
  paymentDate: 'paymentDate',
  createdAt: 'createdAt'
};

exports.Prisma.ExpenseScalarFieldEnum = {
  id: 'id',
  description: 'description',
  amount: 'amount',
  date: 'date',
  type: 'type',
  treasuryId: 'treasuryId',
  purchaseId: 'purchaseId',
  shiftId: 'shiftId',
  paymentMethod: 'paymentMethod',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.DepositScalarFieldEnum = {
  id: 'id',
  amount: 'amount',
  description: 'description',
  date: 'date',
  treasuryId: 'treasuryId',
  createdById: 'createdById',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.WithdrawalScalarFieldEnum = {
  id: 'id',
  amount: 'amount',
  description: 'description',
  date: 'date',
  treasuryId: 'treasuryId',
  createdById: 'createdById',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.DeliveryManScalarFieldEnum = {
  id: 'id',
  name: 'name',
  phone: 'phone',
  nationalId: 'nationalId',
  vehicleType: 'vehicleType',
  branchId: 'branchId',
  walletBalance: 'walletBalance',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.DeliveryManTransactionScalarFieldEnum = {
  id: 'id',
  deliveryManId: 'deliveryManId',
  amount: 'amount',
  type: 'type',
  description: 'description',
  createdAt: 'createdAt',
  createdById: 'createdById'
};

exports.Prisma.DeliveryZoneScalarFieldEnum = {
  id: 'id',
  name: 'name',
  fee: 'fee',
  driverShare: 'driverShare',
  branchId: 'branchId',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.BOMScalarFieldEnum = {
  id: 'id',
  name: 'name',
  outputItemId: 'outputItemId',
  outputQuantity: 'outputQuantity',
  price: 'price',
  unit: 'unit',
  isActive: 'isActive',
  notes: 'notes',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.BOMItemScalarFieldEnum = {
  id: 'id',
  bomId: 'bomId',
  itemId: 'itemId',
  quantity: 'quantity',
  notes: 'notes'
};

exports.Prisma.ProductionOrderScalarFieldEnum = {
  id: 'id',
  bomId: 'bomId',
  sourceWarehouseId: 'sourceWarehouseId',
  destWarehouseId: 'destWarehouseId',
  targetOutputQty: 'targetOutputQty',
  actualOutputQty: 'actualOutputQty',
  outputWasteQty: 'outputWasteQty',
  totalCost: 'totalCost',
  notes: 'notes',
  createdById: 'createdById',
  createdAt: 'createdAt'
};

exports.Prisma.ProductionOrderItemScalarFieldEnum = {
  id: 'id',
  productionOrderId: 'productionOrderId',
  itemId: 'itemId',
  quantityUsed: 'quantityUsed'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};


exports.Prisma.ModelName = {
  User: 'User',
  Role: 'Role',
  Permission: 'Permission',
  AuditLog: 'AuditLog',
  Employee: 'Employee',
  EmployeeTransaction: 'EmployeeTransaction',
  Payroll: 'Payroll',
  Warehouse: 'Warehouse',
  Treasury: 'Treasury',
  Branch: 'Branch',
  Client: 'Client',
  Supplier: 'Supplier',
  Category: 'Category',
  Item: 'Item',
  Inventory: 'Inventory',
  ItemSupplier: 'ItemSupplier',
  ItemCategory: 'ItemCategory',
  BOMCategory: 'BOMCategory',
  Purchase: 'Purchase',
  PurchaseItem: 'PurchaseItem',
  PurchaseReturn: 'PurchaseReturn',
  PurchaseReturnItem: 'PurchaseReturnItem',
  Shift: 'Shift',
  Sale: 'Sale',
  SaleItem: 'SaleItem',
  CashTransfer: 'CashTransfer',
  SystemConfiguration: 'SystemConfiguration',
  StockTransfer: 'StockTransfer',
  StockTransferItem: 'StockTransferItem',
  SupplierAccount: 'SupplierAccount',
  SupplierPayment: 'SupplierPayment',
  Expense: 'Expense',
  Deposit: 'Deposit',
  Withdrawal: 'Withdrawal',
  DeliveryMan: 'DeliveryMan',
  DeliveryManTransaction: 'DeliveryManTransaction',
  DeliveryZone: 'DeliveryZone',
  BOM: 'BOM',
  BOMItem: 'BOMItem',
  ProductionOrder: 'ProductionOrder',
  ProductionOrderItem: 'ProductionOrderItem'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
