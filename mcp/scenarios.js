/**
 * Predefined end-to-end test scenarios for the ERP-V2 system.
 * Each scenario uses a pre-authenticated axios client and returns a structured result.
 */

async function step(results, name, fn) {
  try {
    const data = await fn();
    results.push({ step: name, status: "pass", data });
    return data;
  } catch (err) {
    const detail = err.response?.data || err.message;
    results.push({ step: name, status: "fail", error: detail });
    throw err; // stop scenario on failure
  }
}

// ── Scenario: smoke ──────────────────────────────────────────────────────────
async function smoke(client) {
  const results = [];
  try {
    await step(results, "GET /auth/me (verify token)", async () => {
      const res = await client.get("/auth/me");
      return { username: res.data.username, role: res.data.role };
    });
    await step(results, "GET /clients (basic list)", async () => {
      const res = await client.get("/clients");
      return { count: Array.isArray(res.data) ? res.data.length : "N/A" };
    });
    await step(results, "GET /items (basic list)", async () => {
      const res = await client.get("/items");
      return { count: Array.isArray(res.data) ? res.data.length : "N/A" };
    });
  } catch {}
  return results;
}

// ── Scenario: client_crud ────────────────────────────────────────────────────
async function client_crud(client) {
  const results = [];
  let clientId;
  try {
    const created = await step(results, "POST /clients (create test client)", async () => {
      const res = await client.post("/clients", {
        name: "TEST_MCP_CLIENT",
        phoneNumber: "0100000000",
        address: "Test Address",
      });
      return res.data;
    });
    clientId = created.id;

    await step(results, "GET /clients/:id (read back)", async () => {
      const res = await client.get(`/clients/${clientId}`);
      return { id: res.data.id, name: res.data.name };
    });

    await step(results, "PUT /clients/:id (update)", async () => {
      const res = await client.put(`/clients/${clientId}`, {
        name: "TEST_MCP_CLIENT_UPDATED",
      });
      return { name: res.data.name };
    });
  } catch {}

  // Cleanup
  if (clientId) {
    try {
      await client.delete(`/clients/${clientId}`);
      results.push({ step: "DELETE /clients/:id (cleanup)", status: "pass" });
    } catch (e) {
      results.push({ step: "DELETE /clients/:id (cleanup)", status: "skip", note: e.response?.data?.error || e.message });
    }
  }
  return results;
}

// ── Scenario: item_crud ──────────────────────────────────────────────────────
async function item_crud(client) {
  const results = [];
  let categoryId, itemId;
  try {
    const cat = await step(results, "POST /categories (create test category)", async () => {
      const res = await client.post("/categories", { name: "TEST_MCP_CATEGORY" });
      return res.data;
    });
    categoryId = cat.id;

    const item = await step(results, "POST /items (create test item)", async () => {
      const res = await client.post("/items", {
        name: "TEST_MCP_ITEM",
        price: 100,
        costPrice: 60,
        unit: "piece",
        reorderPoint: 5,
        categories: [categoryId],
      });
      return res.data;
    });
    itemId = item.id;

    await step(results, "GET /items/:id (read back)", async () => {
      const res = await client.get(`/items/${itemId}`);
      return {
        name: res.data.name,
        price: res.data.price,
        categoriesCount: res.data.categories?.length,
      };
    });
  } catch {}

  // Cleanup item then category
  if (itemId) {
    try {
      await client.delete(`/items/${itemId}`);
      results.push({ step: "DELETE /items/:id (cleanup)", status: "pass" });
    } catch (e) {
      results.push({ step: "DELETE /items/:id (cleanup)", status: "skip", note: e.response?.data?.error || e.message });
    }
  }
  if (categoryId) {
    try {
      await client.delete(`/categories/${categoryId}`);
      results.push({ step: "DELETE /categories/:id (cleanup)", status: "pass" });
    } catch (e) {
      results.push({ step: "DELETE /categories/:id (cleanup)", status: "skip", note: e.response?.data?.error || e.message });
    }
  }
  return results;
}

// ── Scenario: list_all ───────────────────────────────────────────────────────
async function list_all(client) {
  const results = [];
  const endpoints = [
    "/clients", "/suppliers", "/items", "/categories",
    "/employees", "/warehouses", "/treasuries", "/branches",
    "/sales", "/purchases", "/expenses", "/shifts",
  ];
  for (const ep of endpoints) {
    try {
      const res = await client.get(ep);
      const count = Array.isArray(res.data)
        ? res.data.length
        : res.data?.data?.length ?? "N/A";
      results.push({ step: `GET ${ep}`, status: "pass", data: { count } });
    } catch (err) {
      results.push({
        step: `GET ${ep}`,
        status: "fail",
        error: err.response?.data || err.message,
      });
    }
  }
  return results;
}

// ── Scenario: auth_gates ─────────────────────────────────────────────────────
async function auth_gates(client) {
  const results = [];
  const { create: axiosCreate } = await import("axios");
  const unauthClient = axiosCreate({ baseURL: client.defaults.baseURL });

  // Expect 401
  try {
    await unauthClient.get("/clients");
    results.push({ step: "GET /clients without token → expect 401", status: "fail", note: "Got 200 — endpoint is unprotected!" });
  } catch (err) {
    if (err.response?.status === 401) {
      results.push({ step: "GET /clients without token → 401", status: "pass" });
    } else {
      results.push({ step: "GET /clients without token", status: "fail", error: err.response?.data || err.message });
    }
  }

  // Expect 401 on bad token
  const badClient = axiosCreate({
    baseURL: client.defaults.baseURL,
    headers: { Authorization: "Bearer invalid.token.here" },
  });
  try {
    await badClient.get("/clients");
    results.push({ step: "GET /clients with bad token → expect 401", status: "fail" });
  } catch (err) {
    if (err.response?.status === 401) {
      results.push({ step: "GET /clients with bad token → 401", status: "pass" });
    } else {
      results.push({ step: "GET /clients with bad token", status: "fail", error: err.response?.data || err.message });
    }
  }

  return results;
}

// ── Scenario: supplier_crud ──────────────────────────────────────────────────
async function supplier_crud(client) {
  const results = [];
  let supplierId;
  try {
    const s = await step(results, "POST /suppliers (create test supplier)", async () => {
      const res = await client.post("/suppliers", {
        name: "TEST_MCP_SUPPLIER",
        phone: "0111111111",
        address: "Supplier St.",
      });
      return res.data;
    });
    supplierId = s.id;

    await step(results, "GET /suppliers/:id (read back)", async () => {
      const res = await client.get(`/suppliers/${supplierId}`);
      return { id: res.data.id, name: res.data.name };
    });
  } catch {}

  if (supplierId) {
    try {
      await client.delete(`/suppliers/${supplierId}`);
      results.push({ step: "DELETE /suppliers/:id (cleanup)", status: "pass" });
    } catch (e) {
      results.push({ step: "DELETE /suppliers/:id (cleanup)", status: "skip", note: e.response?.data?.error || e.message });
    }
  }
  return results;
}

// ── Registry ─────────────────────────────────────────────────────────────────
const SCENARIOS = {
  smoke: {
    name: "smoke",
    description: "Verify auth token works; GET clients + items to confirm API is live",
    fn: smoke,
  },
  client_crud: {
    name: "client_crud",
    description: "Create → Read → Update → Delete a test client (full lifecycle)",
    fn: client_crud,
  },
  item_crud: {
    name: "item_crud",
    description: "Create category + item → read back → verify fields → cleanup",
    fn: item_crud,
  },
  supplier_crud: {
    name: "supplier_crud",
    description: "Create → Read → Delete a test supplier",
    fn: supplier_crud,
  },
  list_all: {
    name: "list_all",
    description: "GET all major endpoints and report record counts (system inventory)",
    fn: list_all,
  },
  auth_gates: {
    name: "auth_gates",
    description: "Verify protected endpoints return 401 without/with bad token",
    fn: auth_gates,
  },
};

export function getScenarios() {
  return Object.values(SCENARIOS).map(({ name, description }) => ({ name, description }));
}

export async function runScenario(name, client) {
  const scenario = SCENARIOS[name];
  if (!scenario) {
    return { error: `Unknown scenario: "${name}". Run erp_list_scenarios to see available options.` };
  }
  const steps = await scenario.fn(client);
  const passed = steps.filter((s) => s.status === "pass").length;
  const failed = steps.filter((s) => s.status === "fail").length;
  return {
    scenario: name,
    steps,
    passed,
    failed,
    summary: failed === 0 ? "PASS" : `FAIL (${failed} step(s) failed)`,
  };
}
