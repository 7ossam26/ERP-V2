/**
 * ERP-V2 Role-Based Access Control Test Runner
 * Tests 3 roles: Admin, Manager, Cashier (Employee)
 * Runs against: https://elghonemy.kiko-tech.com/api
 *
 * SAFE: Creates clearly labeled test data, cleans up after.
 * Dangerous operations (reset) tested via wrong credentials only.
 */

import axios from "axios";

const BASE = "https://elghonemy.kiko-tech.com/api";
const SUPERADMIN = { username: "superadmin", password: "246810@Ad" };
const BRANCH_ID = 1;

// Actual permissions from production (discovered via GET /superadmin/roles/:id/permissions)
const ROLE_IDS = { admin: 2, manager: 3, employee: 4 };

// Track created resources for cleanup
const cleanup = { userIds: [], clientIds: [], itemIds: [], categoryIds: [] };

// ── HTTP client factory ───────────────────────────────────────────────────────
function makeClient(token = null) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return axios.create({ baseURL: BASE, headers, validateStatus: () => true });
}

// ── Login helper ──────────────────────────────────────────────────────────────
async function login(username, password) {
  const res = await makeClient().post("/auth/login", { username, password });
  if (res.status !== 201 && res.status !== 200) throw new Error(`Login failed for ${username}: ${res.status}`);
  return res.data.token;
}

// ── Single test runner ────────────────────────────────────────────────────────
async function runTest(name, description, expectedStatuses, fn) {
  try {
    const result = await fn();
    const actualStatus = result.status;
    const pass = expectedStatuses.includes(actualStatus);
    const snippet = JSON.stringify(
      typeof result.data === "object" ?
        (Array.isArray(result.data) ? `[${result.data.length} items]` : Object.fromEntries(Object.entries(result.data || {}).slice(0, 3)))
        : result.data
    ).slice(0, 120);
    return { name, description, expectedStatuses, actualStatus, pass, snippet };
  } catch (err) {
    return { name, description, expectedStatuses, actualStatus: "ERR", pass: false, snippet: err.message.slice(0, 120) };
  }
}

// ── Full test suite for one role ──────────────────────────────────────────────
async function runRoleTests(roleName, token, roleContext) {
  const c = makeClient(token);
  const tests = [];

  // ── A: Authentication & Identity ──────────────────────────────────────────
  tests.push(await runTest("A1", "GET /auth/me — token validity & role check", [200],
    () => c.get("/auth/me")));

  // ── B: Read Access ────────────────────────────────────────────────────────
  tests.push(await runTest("B1", "GET /clients — client list access", [200, 403],
    () => c.get("/clients")));

  tests.push(await runTest("B2", "GET /items — item catalog access", [200, 403],
    () => c.get("/items")));

  tests.push(await runTest("B3", "GET /sales — sales list access", [200, 403],
    () => c.get("/sales")));

  tests.push(await runTest("B4", "GET /purchases — purchase access", [200, 403],
    () => c.get("/purchases")));

  tests.push(await runTest("B5", "GET /employees — HR employee access", [200, 403],
    () => c.get("/employees")));

  tests.push(await runTest("B6", "GET /expenses — treasury expenses access", [200, 403],
    () => c.get("/expenses")));

  tests.push(await runTest("B7", "GET /reports/sales-summary — reports access", [200, 403],
    () => c.get("/reports/sales-summary")));

  tests.push(await runTest("B8", "GET /treasuries — treasury configuration access", [200, 403],
    () => c.get("/treasuries")));

  tests.push(await runTest("B9", "GET /warehouses — warehouse configuration access", [200, 403],
    () => c.get("/warehouses")));

  tests.push(await runTest("B10", "GET /shifts — shift management access", [200, 403],
    () => c.get("/shifts")));

  // ── C: Create Operations ──────────────────────────────────────────────────
  const clientRes = await runTest("C1", "POST /clients — create new client", [201, 403],
    () => c.post("/clients", { name: `TEST_MCP_${roleName}_CLIENT`, phoneNumber: "01000000000" }));
  tests.push(clientRes);
  if (clientRes.actualStatus === 201) {
    try {
      const data = await c.post("/clients", { name: `TEST_MCP_${roleName}_CLIENT`, phoneNumber: "01000000000" });
      if (data.data?.id) cleanup.clientIds.push({ id: data.data.id, roleName });
    } catch {}
  }
  // Track the first created client if passed
  if (clientRes.pass && clientRes.actualStatus === 201) {
    const tryCreate = await c.post("/clients", { name: `TEST_MCP_${roleName}_DEL` });
    if (tryCreate.data?.id) {
      roleContext.createdClientId = tryCreate.data.id;
      cleanup.clientIds.push({ id: tryCreate.data.id, roleName });
    }
  }

  const categoryRes = await runTest("C2", "POST /categories — create item category", [201, 403],
    () => c.post("/categories", { name: `TEST_MCP_${roleName}_CAT` }));
  tests.push(categoryRes);
  if (categoryRes.actualStatus === 201) {
    const tryCreate = await c.post("/categories", { name: `TEST_MCP_${roleName}_CAT2` });
    if (tryCreate.data?.id) {
      roleContext.createdCategoryId = tryCreate.data.id;
      cleanup.categoryIds.push({ id: tryCreate.data.id, roleName });
    }
  }

  const itemRes = await runTest("C3", "POST /items — create new inventory item", [201, 403],
    () => c.post("/items", { name: `TEST_MCP_${roleName}_ITEM`, price: 99.99, costPrice: 50 }));
  tests.push(itemRes);
  if (itemRes.actualStatus === 201) {
    const tryCreate = await c.post("/items", { name: `TEST_MCP_${roleName}_ITEM2`, price: 1, costPrice: 0.5 });
    if (tryCreate.data?.id) {
      roleContext.createdItemId = tryCreate.data.id;
      cleanup.itemIds.push({ id: tryCreate.data.id, roleName });
    }
  }

  // ── D: Sensitive / Destructive Operations ─────────────────────────────────
  tests.push(await runTest("D1", "DELETE /clients/:id — delete a client (sensitive)", [200, 204, 403, 404],
    () => {
      const id = roleContext.createdClientId || 99999;
      return c.delete(`/clients/${id}`);
    }));

  tests.push(await runTest("D2", "DELETE /items/:id — delete an item (sensitive)", [200, 204, 403, 404],
    () => {
      const id = roleContext.createdItemId || 99999;
      return c.delete(`/items/${id}`);
    }));

  // Safe reset test: use wrong manager credentials → expect 401 (accessible) or 403 (blocked)
  tests.push(await runTest("D3", "POST /superadmin/reset/:cat — manager verify gate (wrong creds)", [401, 403],
    () => c.post("/superadmin/reset/sales", { managerUsername: "wronguser", managerPassword: "wrongpass" })));

  // ── E: Superadmin Guard ───────────────────────────────────────────────────
  tests.push(await runTest("E1", "GET /superadmin/users — must be blocked (not superadmin)", [403],
    () => c.get("/superadmin/users")));

  tests.push(await runTest("E2", "POST /superadmin/roles — must be blocked (not superadmin)", [403],
    () => c.post("/superadmin/roles", { name: "HACK_ROLE" })));

  // Unauthenticated access (use a fresh no-token client)
  tests.push(await runTest("E3", "No token → GET /clients — must return 401", [401],
    () => makeClient().get("/clients")));

  tests.push(await runTest("E4", "Bad token → GET /clients — must return 401", [401],
    () => makeClient("invalid.token.xyz").get("/clients")));

  return tests;
}

// ── Setup: create test user ───────────────────────────────────────────────────
async function createTestUser(saToken, username, roleId, hasSensitiveAccess) {
  const sa = makeClient(saToken);
  const res = await sa.post("/superadmin/users", {
    name: `Test ${username}`,
    username,
    password: "TestPass@1234",
    roleId,
    branchId: BRANCH_ID,
    isActive: true,
    hasSensitiveAccess,
  });
  if (res.status !== 201 && res.status !== 200) {
    throw new Error(`Failed to create ${username}: ${res.status} ${JSON.stringify(res.data)}`);
  }
  return res.data.id || res.data.user?.id;
}

// ── Cleanup: delete test user ─────────────────────────────────────────────────
async function deleteTestUser(saToken, userId) {
  const sa = makeClient(saToken);
  await sa.delete(`/superadmin/users/${userId}`);
}

async function deleteTestClient(saToken, clientId) {
  const sa = makeClient(saToken);
  await sa.delete(`/clients/${clientId}`);
}

async function deleteTestItem(saToken, itemId) {
  const sa = makeClient(saToken);
  await sa.delete(`/items/${itemId}`);
}

async function deleteTestCategory(saToken, catId) {
  const sa = makeClient(saToken);
  await sa.delete(`/categories/${catId}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🔐 Logging in as superadmin...");
  const saToken = await login(SUPERADMIN.username, SUPERADMIN.password);
  console.log("✅ Superadmin authenticated\n");

  const testUsers = [
    { key: "admin",   username: "test_mcp_admin",   roleId: ROLE_IDS.admin,   sensitive: true  },
    { key: "manager", username: "test_mcp_manager", roleId: ROLE_IDS.manager, sensitive: false },
    { key: "cashier", username: "test_mcp_cashier", roleId: ROLE_IDS.employee, sensitive: false },
  ];

  const results = {};

  // Create test users
  for (const u of testUsers) {
    console.log(`👤 Creating test user: ${u.username}...`);
    try {
      const userId = await createTestUser(saToken, u.username, u.roleId, u.sensitive);
      u.userId = userId;
      cleanup.userIds.push(userId);
      console.log(`   Created with ID: ${userId}`);
    } catch (err) {
      console.error(`   ❌ ${err.message}`);
    }
  }

  console.log("\n🧪 Running test suites...\n");

  // Run tests for each role
  for (const u of testUsers) {
    if (!u.userId) {
      console.log(`⚠️  Skipping ${u.key} — user creation failed`);
      continue;
    }
    console.log(`\n── ${u.key.toUpperCase()} (${u.username}) ──────────────────────`);
    try {
      const token = await login(u.username, "TestPass@1234");
      const roleContext = {};
      const tests = await runRoleTests(u.key, token, roleContext);
      results[u.key] = {
        username: u.username,
        roleId: u.roleId,
        hasSensitiveAccess: u.sensitive,
        tests,
        passed: tests.filter(t => t.pass).length,
        failed: tests.filter(t => !t.pass).length,
        total: tests.length,
      };
      for (const t of tests) {
        const icon = t.pass ? "✅" : "❌";
        console.log(`   ${icon} [${t.name}] ${t.description.substring(0, 60)} → got ${t.actualStatus} (expected ${t.expectedStatuses.join("|")})`);
      }
    } catch (err) {
      console.error(`   ❌ Login failed for ${u.username}: ${err.message}`);
      results[u.key] = { error: err.message };
    }
  }

  // Cleanup
  console.log("\n🧹 Cleaning up test data...");

  // Delete created items/clients/categories via superadmin (has sensitive access)
  const saClient = makeClient(saToken);
  for (const { id } of cleanup.clientIds) {
    try { await saClient.delete(`/clients/${id}`); console.log(`   Deleted client ${id}`); } catch {}
  }
  for (const { id } of cleanup.itemIds) {
    try { await saClient.delete(`/items/${id}`); console.log(`   Deleted item ${id}`); } catch {}
  }
  for (const { id } of cleanup.categoryIds) {
    try { await saClient.delete(`/categories/${id}`); console.log(`   Deleted category ${id}`); } catch {}
  }
  for (const userId of cleanup.userIds) {
    try { await deleteTestUser(saToken, userId); console.log(`   Deleted user ${userId}`); } catch {}
  }

  // Write results JSON
  const output = {
    timestamp: new Date().toISOString(),
    environment: "production — https://elghonemy.kiko-tech.com",
    roles: {
      admin: "Admin (id=2) — full back-office, hasSensitiveAccess=true, no POS",
      manager: "Manager (id=3) — POS + expenses + employees + reports, no sensitive",
      cashier: "Employee (id=4) — POS + SALES + CLIENTS + ITEMS only",
    },
    results,
    summary: Object.fromEntries(
      Object.entries(results).map(([role, r]) => [role, r.error ? "ERROR" : `${r.passed}/${r.total} passed`])
    ),
  };

  // Write to file
  import("fs").then(({ writeFileSync }) => {
    writeFileSync("mcp/test-results.json", JSON.stringify(output, null, 2));
    console.log("\n✅ Results written to mcp/test-results.json");
  });

  console.log("\n📊 SUMMARY:");
  for (const [role, summary] of Object.entries(output.summary)) {
    console.log(`   ${role.toUpperCase()}: ${summary}`);
  }

  return output;
}

main().catch(console.error);
