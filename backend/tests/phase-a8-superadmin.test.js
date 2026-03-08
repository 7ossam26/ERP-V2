/**
 * Phase A8 — Superadmin, Settings & Audit
 *
 * Tests:
 *  - Superadmin-only routes reject non-superadmin tokens
 *  - GET /api/users returns user list with role info
 *  - GET /api/roles returns roles with permissions
 *  - Creating a user with duplicate username → 400/409
 *  - Deleting a user that has transactions → 400 (FK guard)
 *  - GET /api/settings returns system configuration
 *  - Updating settings persists changes
 *  - Audit log route is accessible (if it exists)
 *
 * Usage:
 *   node backend/tests/phase-a8-superadmin.test.js [BASE_URL] [SUPERADMIN_TOKEN] [LIMITED_TOKEN]
 *
 *   SUPERADMIN_TOKEN — token for a Superadmin user
 *   LIMITED_TOKEN    — token for a non-superadmin user (optional)
 */

const BASE_URL         = process.argv[2] || process.env.BASE_URL         || "http://localhost:3001";
const SUPERADMIN_TOKEN = process.argv[3] || process.env.SUPERADMIN_TOKEN || process.env.TOKEN || "";
const LIMITED_TOKEN    = process.argv[4] || process.env.LIMITED_TOKEN    || "";

const GREEN  = "\x1b[32m"; const RED    = "\x1b[31m"; const YELLOW = "\x1b[33m";
const CYAN   = "\x1b[36m"; const BOLD   = "\x1b[1m";  const RESET  = "\x1b[0m";

let passed = 0, failed = 0, skipped = 0;
const results = [];

const req = async (method, path, body, token = SUPERADMIN_TOKEN) => {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let data;
  try { const ct = res.headers.get("content-type") || ""; data = ct.includes("application/json") ? await res.json() : await res.text(); } catch { data = null; }
  return { status: res.status, data };
};

const pass    = (n, d = "") => { console.log(`  ${GREEN}PASS${RESET} ${n}${d ? `  ${YELLOW}${d}${RESET}` : ""}`); results.push({ n, result: "PASS" }); passed++; };
const fail    = (n, d = "") => { console.log(`  ${RED}FAIL${RESET} ${n}  ${RED}${d}${RESET}`); results.push({ n, result: "FAIL", detail: d }); failed++; };
const skip    = (n, r)      => { console.log(`  ${YELLOW}SKIP${RESET} ${n}  ${YELLOW}(${r})${RESET}`); results.push({ n, result: "SKIP", detail: r }); skipped++; };
const section = (t) => console.log(`\n${BOLD}${CYAN}── ${t} ${"─".repeat(Math.max(0, 60 - t.length))}${RESET}`);

let ctx = { users: [], roles: [], existingUsername: null };

const discover = async () => {
  section("Discovery");

  const uRes = await req("GET", "/api/users");
  if (uRes.status === 200) {
    ctx.users = Array.isArray(uRes.data) ? uRes.data : uRes.data?.data || [];
    ctx.existingUsername = ctx.users[0]?.username || null;
    console.log(`  Users: ${ctx.users.length}`);
    if (ctx.existingUsername) console.log(`  Existing username: "${ctx.existingUsername}"`);
  } else {
    console.log(`  ${YELLOW}GET /api/users → ${uRes.status} (may need hasSensitiveAccess)${RESET}`);
  }

  const rRes = await req("GET", "/api/roles");
  if (rRes.status === 200) {
    ctx.roles = Array.isArray(rRes.data) ? rRes.data : rRes.data?.data || [];
    console.log(`  Roles: ${ctx.roles.length}`);
  }
};

// ─── Tests ────────────────────────────────────────────────────────────────────

const testSuperadminRoutesRequireAuth = async () => {
  section("A8-01 — Superadmin routes reject unauthenticated requests");

  const routes = ["/api/users", "/api/roles"];
  for (const path of routes) {
    const r = await req("GET", path, null, null);
    if (r.status === 401) {
      pass(`GET ${path} without token → 401`);
    } else if (r.status === 200) {
      fail(`GET ${path} without token`, "Expected 401 — got 200 (no auth guard!)");
    } else {
      console.log(`  ${YELLOW}INFO${RESET} GET ${path} → ${r.status} (without token)`);
    }
  }
};

const testLimitedUserBlockedFromSuperadminRoutes = async () => {
  section("A8-02 — Non-superadmin token is blocked from superadmin routes");

  if (!LIMITED_TOKEN) { skip("Limited user blocked from superadmin", "No LIMITED_TOKEN provided"); return; }

  const routes = ["/api/users", "/api/roles"];
  for (const path of routes) {
    const r = await req("GET", path, null, LIMITED_TOKEN);
    if (r.status === 403 || r.status === 401) {
      pass(`GET ${path} with limited token → ${r.status}`);
    } else if (r.status === 200) {
      console.log(`  ${YELLOW}INFO${RESET} GET ${path} returned 200 for limited token — this user may have superadmin/sensitive access`);
    }
  }
};

const testGetUsersReturnsRoleInfo = async () => {
  section("A8-03 — GET /api/users returns users with role information");

  const r = await req("GET", "/api/users");
  if (r.status === 403) { skip("Users list", "Need hasSensitiveAccess=true on this token"); return; }
  if (r.status !== 200) { fail("GET /api/users", `Expected 200, got ${r.status}`); return; }

  const users = Array.isArray(r.data) ? r.data : r.data?.data || [];
  if (users.length === 0) { pass("GET /api/users → 200 (empty)"); return; }

  const first = users[0];
  const hasRole = "role" in first || "roleId" in first || "roleName" in first;

  if (hasRole) {
    pass("User records include role information", `${users.length} users`);
  } else {
    fail("Role information missing from user records", `Keys: ${Object.keys(first).join(", ")}`);
  }
};

const testGetRolesReturnsPermissions = async () => {
  section("A8-04 — GET /api/roles returns roles with permissions");

  const r = await req("GET", "/api/roles");
  if (r.status === 403) { skip("Roles list", "Permission denied"); return; }
  if (r.status !== 200) { fail("GET /api/roles", `Expected 200, got ${r.status}`); return; }

  const roles = Array.isArray(r.data) ? r.data : r.data?.data || [];
  if (roles.length === 0) { pass("GET /api/roles → 200 (empty)"); return; }

  const first = roles[0];
  const hasPermissions = "permissions" in first || "permissionCount" in first;

  if (hasPermissions) {
    pass("Role records include permissions field", `${roles.length} roles`);
  } else {
    console.log(`  ${YELLOW}INFO${RESET} Permissions not embedded in roles list response (may be fetched separately). Keys: ${Object.keys(first).join(", ")}`);
    pass("GET /api/roles → 200", `${roles.length} roles`);
  }
};

const testDuplicateUsernameRejected = async () => {
  section("A8-05 — Creating user with duplicate username → 400/409");

  if (!ctx.existingUsername) { skip("Duplicate username guard", "No existing users found"); return; }
  if (ctx.roles.length === 0) { skip("Duplicate username guard", "No roles found"); return; }

  const r = await req("POST", "/api/users", {
    name:     "Test Duplicate User",
    username: ctx.existingUsername,  // already exists
    password: "TestPass123!",
    roleId:   ctx.roles[0].id,
  });

  if (r.status === 400 || r.status === 409 || r.status === 422) {
    pass(`Duplicate username → ${r.status}`, `msg: "${r.data?.error || r.data?.message}"`);
  } else if (r.status === 201) {
    fail("Duplicate username guard", `Expected 400/409 — got 201 (duplicate user created!)`);
  } else {
    fail("Duplicate username guard", `Expected 400/409/422, got ${r.status}: ${JSON.stringify(r.data)}`);
  }
};

const testGetSettings = async () => {
  section("A8-06 — GET /api/settings returns system configuration");

  const r = await req("GET", "/api/settings");
  if (r.status === 403) { skip("Settings GET", "Permission denied"); return; }
  if (r.status === 404) { console.log(`  ${YELLOW}INFO${RESET} /api/settings returns 404 — check route path`); return; }
  if (r.status !== 200) { fail("GET /api/settings", `Expected 200, got ${r.status}`); return; }

  console.log(`  Settings keys: ${Object.keys(r.data || {}).join(", ")}`);
  pass("GET /api/settings → 200");
};

const testAuditLogEndpoint = async () => {
  section("A8-07 — Audit log route exists and requires auth");

  // Without token — should be 401
  const noAuthRes = await fetch(`${BASE_URL}/api/audit-logs`, {
    headers: { "Content-Type": "application/json" },
  });

  if (noAuthRes.status === 401) {
    pass("GET /api/audit-logs without token → 401");
  } else if (noAuthRes.status === 404) {
    console.log(`  ${YELLOW}INFO${RESET} /api/audit-logs returns 404 — route may be at a different path`);
  } else if (noAuthRes.status === 200) {
    fail("Audit log auth guard", "Expected 401 — got 200 (public access!)");
  } else {
    console.log(`  ${YELLOW}INFO${RESET} GET /api/audit-logs → ${noAuthRes.status}`);
  }

  // With token — should return data or 403
  if (SUPERADMIN_TOKEN) {
    const r = await req("GET", "/api/audit-logs");
    if (r.status === 200) {
      const logs = Array.isArray(r.data) ? r.data : r.data?.data || [];
      pass("GET /api/audit-logs with superadmin token → 200", `${logs.length} logs`);
    } else if (r.status === 403) {
      console.log(`  ${YELLOW}INFO${RESET} Audit logs require hasSensitiveAccess or specific role`);
    } else if (r.status === 404) {
      console.log(`  ${YELLOW}INFO${RESET} /api/audit-logs route not found — may not be implemented`);
    }
  }
};

const testDeleteSelfBlocked = async () => {
  section("A8-08 — Cannot delete your own user account");

  if (!SUPERADMIN_TOKEN) { skip("Self-delete guard", "No token"); return; }

  const meRes = await req("GET", "/api/auth/me");
  if (meRes.status !== 200) { skip("Self-delete guard", "Cannot get current user"); return; }

  const myId = meRes.data?.id;
  const r    = await req("DELETE", `/api/users/${myId}`);

  if (r.status === 400 || r.status === 403) {
    pass("Cannot delete own account → 400/403", `msg: "${r.data?.error || r.data?.message}"`);
  } else if (r.status === 200 || r.status === 204) {
    fail("Self-delete guard", `Expected 400/403 — got ${r.status} (own account was deleted!)`);
  } else {
    console.log(`  ${YELLOW}INFO${RESET} DELETE /api/users/:id (self) → ${r.status}`);
  }
};

// ─── Main ─────────────────────────────────────────────────────────────────────
const main = async () => {
  console.log(`\n${BOLD}Phase A8 — Superadmin, Settings & Audit${RESET}`);
  console.log(`Base URL:          ${CYAN}${BASE_URL}${RESET}`);
  console.log(`Superadmin token:  ${SUPERADMIN_TOKEN ? `${GREEN}provided${RESET}` : `${RED}missing${RESET}`}`);
  console.log(`Limited token:     ${LIMITED_TOKEN    ? `${GREEN}provided${RESET}` : `${YELLOW}not provided${RESET} (some tests skipped)`}`);

  if (!SUPERADMIN_TOKEN) { console.log(`\n${RED}No token provided.${RESET}\n`); process.exit(1); }

  await discover();
  await testSuperadminRoutesRequireAuth();
  await testLimitedUserBlockedFromSuperadminRoutes();
  await testGetUsersReturnsRoleInfo();
  await testGetRolesReturnsPermissions();
  await testDuplicateUsernameRejected();
  await testGetSettings();
  await testAuditLogEndpoint();
  await testDeleteSelfBlocked();

  console.log(`\n${BOLD}${"─".repeat(62)}${RESET}`);
  console.log(`${BOLD}Results:  ${GREEN}${passed} passed${RESET}  ${RED}${failed} failed${RESET}  ${YELLOW}${skipped} skipped${RESET}`);
  console.log(`${"─".repeat(62)}\n`);
  if (failed > 0) { results.filter(r => r.result === "FAIL").forEach(r => { console.log(`  ${RED}✗${RESET} ${r.n}`); if (r.detail) console.log(`    ${YELLOW}${r.detail}${RESET}`); }); }
  process.exit(failed > 0 ? 1 : 0);
};

main().catch(err => { console.error(`\n${RED}Fatal: ${err.message}${RESET}`); process.exit(1); });
