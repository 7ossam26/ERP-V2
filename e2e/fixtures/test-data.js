// Test data constants — credentials, entity names, expected values
// Populated by global-setup.js, used by all spec files

const BASE_URL = 'http://localhost:3001/api';

const USERS = {
  superadmin: { username: 'superadmin', password: '246810@Ad', role: 'Superadmin' },
  admin: { username: 'test_admin', password: 'Test1234!', role: 'Admin' },
  gm: { username: 'test_gm', password: 'Test1234!', role: 'General Manager' },
  branchMgr: { username: 'test_branch_mgr', password: 'Test1234!', role: 'Branch Manager' },
  cashier: { username: 'test_cashier', password: 'Test1234!', role: 'Cashier' },
  cashierB2: { username: 'test_cashier_b2', password: 'Test1234!', role: 'Cashier' },
  limited: { username: 'test_limited', password: 'Test1234!', role: 'Employee' },
};

const STORAGE_STATE = {
  superadmin: 'e2e/.auth/superadmin.json',
  admin: 'e2e/.auth/admin.json',
  gm: 'e2e/.auth/gm.json',
  branchMgr: 'e2e/.auth/branch-mgr.json',
  cashier: 'e2e/.auth/cashier.json',
  cashierB2: 'e2e/.auth/cashier-b2.json',
  limited: 'e2e/.auth/limited.json',
};

// IDs populated after seeding (written by global-setup.js)
const SEEDED_IDS = {
  roles: {},
  warehouses: {},
  treasuries: {},
  branches: {},
  categories: {},
  suppliers: {},
  clients: {},
  items: {},
  employees: {},
  deliveryZones: {},
  deliveryMen: {},
  bom: {},
};

module.exports = { BASE_URL, USERS, STORAGE_STATE, SEEDED_IDS };
