// Global setup — Seeds test data via API before all tests run
const { ApiHelpers } = require('./fixtures/api-helpers');

const BASE = 'http://localhost:3001/api';

// All module permissions
const ALL_MODULES = [
  'HR','INVENTORY','INVENTORY_COUNT','STOCK_TRANSFER','POS','PURCHASES','SALES',
  'REPORTS','TREASURIES','CASH_TRANSFER','TRANSFER_MANAGEMENT','BRANCHES',
  'EMPLOYEES','CLIENTS','SUPPLIERS','SUPPLIER_ACCOUNTS','CATEGORIES','ITEMS',
  'WAREHOUSES','SETTINGS','EXPENSES','SHIFTS','DELIVERY_SETTLEMENT','DEPOSITS',
  'CREATES_DEPOSITS','WITHDRAWALS','CREATES_WITHDRAWALS','CREATES_WAREHOUSES',
  'CREATES_EMPLOYEES','CREATES_SUPPLIERS','CREATES_CLIENTS','CREATES_CATEGORIES',
  'CREATES_ITEMS','CREATES_TREASURIES','CREATES_BRANCHES','DELIVERY_MEN',
  'CREATES_DELIVERY_MEN','DELIVERY_ZONES','CREATES_DELIVERY_ZONES',
  'CREATES_PRODUCTION','PRODUCTION',
];

const BRANCH_MGR_MODULES = [
  'POS','SALES','PURCHASES','STOCK_TRANSFER','EXPENSES','SHIFTS','ITEMS',
  'CLIENTS','CATEGORIES','INVENTORY','REPORTS','BRANCHES','EMPLOYEES',
  'CREATES_CLIENTS','CREATES_ITEMS','SUPPLIER_ACCOUNTS','TREASURIES',
];

const CASHIER_MODULES = [
  'POS','SALES','CLIENTS','ITEMS','CATEGORIES','CREATES_CLIENTS','EXPENSES','SHIFTS',
];

async function globalSetup() {
  console.log('🌱 Starting E2E test data seeding...');
  const api = new ApiHelpers();

  // Step 1: Login as Superadmin
  const loginRes = await api.login('superadmin', '246810@Ad');
  if (!loginRes.ok) {
    console.error('❌ Superadmin login failed:', loginRes.data);
    throw new Error('Cannot seed: superadmin login failed');
  }
  console.log('✅ Logged in as superadmin');

  // Step 2: Get existing roles
  const rolesRes = await api.get('/superadmin/roles');
  const existingRoles = rolesRes.ok ? rolesRes.data : [];
  const roleMap = {};
  for (const r of existingRoles) {
    roleMap[r.name] = r.id;
  }

  // Create roles if needed
  const rolesToCreate = [
    { name: 'Branch Manager', description: 'Branch manager access', modules: BRANCH_MGR_MODULES },
    { name: 'Cashier', description: 'POS cashier access', modules: CASHIER_MODULES },
    { name: 'General Manager', description: 'Full access across all branches', modules: ALL_MODULES },
  ];

  for (const role of rolesToCreate) {
    if (!roleMap[role.name]) {
      const res = await api.post('/superadmin/roles', { name: role.name, description: role.description });
      if (res.ok) {
        roleMap[role.name] = res.data.id;
        console.log(`✅ Created role: ${role.name} (ID: ${res.data.id})`);
      } else {
        console.log(`⚠️ Role ${role.name}: ${JSON.stringify(res.data)}`);
      }
    } else {
      console.log(`ℹ️ Role ${role.name} already exists (ID: ${roleMap[role.name]})`);
    }
  }

  // Set permissions for new roles
  for (const role of rolesToCreate) {
    if (roleMap[role.name]) {
      const perms = role.modules.map(m => ({ module: m, canAccess: true }));
      await api.put(`/superadmin/roles/${roleMap[role.name]}/permissions`, { permissions: perms });
    }
  }
  console.log('✅ Permissions configured');

  // Step 3: Infrastructure — Get existing data first
  const warehousesRes = await api.get('/warehouses');
  const treasuriesRes = await api.get('/treasuries');
  const branchesRes = await api.get('/branches');

  let warehouse2Id, treasury2Id, branch1Id, branch2Id;

  // Find branch 1 (main)
  const branches = branchesRes.ok ? branchesRes.data : [];
  const mainBranch = branches.find(b => b.name === 'الفرع الرئيسي') || branches[0];
  branch1Id = mainBranch?.id;

  // Create warehouse 2 if not exists
  const warehouses = warehousesRes.ok ? warehousesRes.data : [];
  const wh2 = warehouses.find(w => w.name === 'مخزن اختبار 2');
  if (!wh2) {
    const res = await api.post('/warehouses', { name: 'مخزن اختبار 2' });
    warehouse2Id = res.ok ? res.data.id : null;
    if (warehouse2Id) console.log(`✅ Created warehouse 2 (ID: ${warehouse2Id})`);
  } else {
    warehouse2Id = wh2.id;
  }

  // Create treasury 2 if not exists
  const treasuries = treasuriesRes.ok ? treasuriesRes.data : [];
  const tr2 = treasuries.find(t => t.name === 'خزنة اختبار 2');
  if (!tr2) {
    const res = await api.post('/treasuries', { name: 'خزنة اختبار 2', balance: 10000 });
    treasury2Id = res.ok ? res.data.id : null;
    if (treasury2Id) console.log(`✅ Created treasury 2 (ID: ${treasury2Id})`);
  } else {
    treasury2Id = tr2.id;
  }

  // Create branch 2 if not exists
  const br2 = branches.find(b => b.name === 'فرع اختبار 2');
  if (!br2 && warehouse2Id && treasury2Id) {
    const res = await api.post('/branches', {
      name: 'فرع اختبار 2',
      address: 'Test Branch 2 Address',
      warehouseId: warehouse2Id,
      treasuryId: treasury2Id,
    });
    branch2Id = res.ok ? res.data.id : null;
    if (branch2Id) console.log(`✅ Created branch 2 (ID: ${branch2Id})`);
  } else {
    branch2Id = br2?.id;
  }

  // Step 4: Create test users
  const usersRes = await api.get('/superadmin/users');
  const existingUsers = usersRes.ok ? usersRes.data : [];
  const existingUsernames = new Set(existingUsers.map(u => u.username));

  const testUsers = [
    { name: 'Test Admin', username: 'test_admin', password: 'Test1234!', roleId: roleMap['Admin'], branchId: null, hasSensitiveAccess: true },
    { name: 'Test GM', username: 'test_gm', password: 'Test1234!', roleId: roleMap['General Manager'], branchId: null, hasSensitiveAccess: true },
    { name: 'Test Branch Mgr', username: 'test_branch_mgr', password: 'Test1234!', roleId: roleMap['Branch Manager'], branchId: branch1Id, hasSensitiveAccess: false },
    { name: 'Test Cashier', username: 'test_cashier', password: 'Test1234!', roleId: roleMap['Cashier'], branchId: branch1Id, hasSensitiveAccess: false },
    { name: 'Test Cashier B2', username: 'test_cashier_b2', password: 'Test1234!', roleId: roleMap['Cashier'], branchId: branch2Id, hasSensitiveAccess: false },
    { name: 'Test Limited', username: 'test_limited', password: 'Test1234!', roleId: roleMap['Employee'], branchId: branch1Id, hasSensitiveAccess: false },
  ];

  for (const user of testUsers) {
    if (!existingUsernames.has(user.username) && user.roleId) {
      const res = await api.post('/superadmin/users', user);
      if (res.ok) {
        console.log(`✅ Created user: ${user.username}`);
      } else {
        console.log(`⚠️ User ${user.username}: ${JSON.stringify(res.data)}`);
      }
    }
  }

  // Step 5: Categories
  const catsRes = await api.get('/categories');
  const existingCats = catsRes.ok ? catsRes.data : [];
  const catNames = new Set(existingCats.map(c => c.name));
  const catsToCreate = ['مشروبات', 'مواد خام', 'أطعمة جاهزة'];
  for (const name of catsToCreate) {
    if (!catNames.has(name)) {
      await api.post('/categories', { name });
      console.log(`✅ Created category: ${name}`);
    }
  }

  // Step 6: Suppliers
  const suppRes = await api.get('/suppliers');
  const existingSupps = suppRes.ok ? suppRes.data : [];
  const suppNames = new Set(existingSupps.map(s => s.name));
  const suppsToCreate = [
    { name: 'مورد اختبار 1', phoneNumber: '01000000001' },
    { name: 'مورد اختبار 2', phoneNumber: '01000000002' },
  ];
  for (const s of suppsToCreate) {
    if (!suppNames.has(s.name)) {
      await api.post('/suppliers', s);
      console.log(`✅ Created supplier: ${s.name}`);
    }
  }

  // Step 7: Clients
  const clientsRes = await api.get('/clients');
  const existingClients = clientsRes.ok ? clientsRes.data : [];
  const clientNames = new Set(existingClients.map(c => c.name));
  const clientsToCreate = [
    { name: 'عميل اختبار 1', phoneNumber: '01100000001' },
    { name: 'عميل VIP', phoneNumber: '01100000002', address: 'شارع التحرير' },
  ];
  for (const c of clientsToCreate) {
    if (!clientNames.has(c.name)) {
      await api.post('/clients', c);
      console.log(`✅ Created client: ${c.name}`);
    }
  }

  // Step 8: Items
  const itemsRes = await api.get('/items');
  const existingItems = itemsRes.ok ? itemsRes.data : [];
  const itemNames = new Set(existingItems.map(i => i.name));

  const refreshedCats = await api.get('/categories');
  const catList = refreshedCats.ok ? refreshedCats.data : [];
  const catId = (name) => catList.find(c => c.name === name)?.id;

  const itemsToCreate = [
    { name: 'شاي اختبار', price: 10, costPrice: 5, unit: 'piece', showInPos: true, reorderPoint: 10 },
    { name: 'سكر اختبار', price: 20, costPrice: 15, unit: 'kg', showInPos: false, reorderPoint: 5 },
    { name: 'قهوة اختبار', price: 25, costPrice: 10, unit: 'piece', showInPos: true, reorderPoint: 10 },
    { name: 'لبن اختبار', price: 30, costPrice: 18, unit: 'kg', showInPos: true, reorderPoint: 5 },
    { name: 'منتج BOM اختبار', price: 50, costPrice: 30, unit: 'piece', showInPos: true, isBom: true, reorderPoint: 10 },
  ];

  for (const item of itemsToCreate) {
    if (!itemNames.has(item.name)) {
      const res = await api.post('/items', item);
      if (res.ok) console.log(`✅ Created item: ${item.name}`);
      else console.log(`⚠️ Item ${item.name}: ${JSON.stringify(res.data)}`);
    }
  }

  // Step 9: Delivery Zones
  const zonesRes = await api.get('/delivery-zones');
  const existingZones = zonesRes.ok ? zonesRes.data : [];
  const zoneNames = new Set(existingZones.map(z => z.name));
  if (!zoneNames.has('منطقة أ')) {
    await api.post('/delivery-zones', { name: 'منطقة أ', fee: 15, driverShare: 10, branchId: branch1Id });
    console.log('✅ Created zone: منطقة أ');
  }
  if (!zoneNames.has('منطقة ب')) {
    await api.post('/delivery-zones', { name: 'منطقة ب', fee: 25, driverShare: 15, branchId: branch1Id });
    console.log('✅ Created zone: منطقة ب');
  }

  // Step 10: Delivery Men
  const menRes = await api.get('/delivery-men');
  const existingMen = menRes.ok ? menRes.data : [];
  const menNames = new Set(existingMen.map(m => m.name));
  if (!menNames.has('سائق اختبار 1')) {
    await api.post('/delivery-men', { name: 'سائق اختبار 1', phoneNumber: '01200000001', branchId: branch1Id });
    console.log('✅ Created driver: سائق اختبار 1');
  }
  if (!menNames.has('سائق اختبار 2')) {
    await api.post('/delivery-men', { name: 'سائق اختبار 2', phoneNumber: '01200000002', branchId: branch1Id });
    console.log('✅ Created driver: سائق اختبار 2');
  }

  // Step 11: Employees
  const empRes = await api.get('/employees');
  const existingEmps = empRes.ok ? empRes.data : [];
  const empNames = new Set(existingEmps.map(e => e.name));
  if (!empNames.has('موظف اختبار أ')) {
    await api.post('/employees', { name: 'موظف اختبار أ', baseSalary: 5000, branchId: branch1Id, hireDate: '2025-01-01' });
    console.log('✅ Created employee: موظف اختبار أ');
  }

  console.log('✨ E2E test data seeding complete!');
}

module.exports = globalSetup;
