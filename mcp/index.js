/**
 * ERP-V2 MCP Testing Server
 *
 * Exposes the ERP-V2 REST API as MCP tools so Claude can orchestrate
 * automated use-case testing guided by documentation.
 *
 * Tools:
 *   erp_login          — authenticate and store JWT in memory
 *   erp_request        — generic HTTP call to any ERP endpoint
 *   erp_list_scenarios — list available predefined test scenarios
 *   erp_run_scenario   — execute a predefined end-to-end test scenario
 *
 * Registration (run once):
 *   claude mcp add erp-tester node "C:\Users\Taha CompuTech\ERP-V2\mcp\index.js" -e ERP_BASE_URL=http://localhost:3001/api
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import axios from "axios";
import { getScenarios, runScenario } from "./scenarios.js";

const BASE_URL = process.env.ERP_BASE_URL || "http://localhost:3001/api";

// Shared state: auth token stored in process memory
let authToken = null;
let currentUser = null;

// Axios instance — token injected via interceptor so tools always use current token
const client = axios.create({ baseURL: BASE_URL });
client.interceptors.request.use((cfg) => {
  if (authToken) cfg.headers.Authorization = `Bearer ${authToken}`;
  return cfg;
});

// Helper: format axios error into a readable string
function formatError(err) {
  if (err.response) {
    return JSON.stringify({
      httpStatus: err.response.status,
      body: err.response.data,
    }, null, 2);
  }
  if (err.code === "ECONNREFUSED") {
    return `Connection refused — is the ERP backend running at ${BASE_URL}?`;
  }
  return err.message;
}

// ── Server ───────────────────────────────────────────────────────────────────
const server = new McpServer({
  name: "erp-tester",
  version: "1.0.0",
});

// ── Tool 1: erp_login ────────────────────────────────────────────────────────
server.tool(
  "erp_login",
  "Authenticate with the ERP system and store the JWT token for subsequent calls.",
  {
    username: z.string().describe("ERP username"),
    password: z.string().describe("ERP password"),
  },
  async ({ username, password }) => {
    try {
      const res = await client.post("/auth/login", { username, password });
      authToken = res.data.token;
      currentUser = res.data.user;
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            status: "authenticated",
            username: currentUser.username,
            role: currentUser.role,
            branch: currentUser.branch?.name ?? null,
            hasSensitiveAccess: currentUser.hasSensitiveAccess,
            permissions: currentUser.permissions,
          }, null, 2),
        }],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Login failed:\n${formatError(err)}` }],
        isError: true,
      };
    }
  }
);

// ── Tool 2: erp_request ──────────────────────────────────────────────────────
server.tool(
  "erp_request",
  "Make an authenticated HTTP request to any ERP API endpoint. Use this for any operation not covered by a predefined scenario.",
  {
    method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).describe("HTTP method"),
    path: z.string().describe("API path, e.g. /clients or /sales/42"),
    body: z.record(z.any()).optional().describe("Request body (for POST/PUT/PATCH)"),
    params: z.record(z.string()).optional().describe("Query parameters"),
  },
  async ({ method, path, body, params }) => {
    if (!authToken) {
      return {
        content: [{ type: "text", text: "Not authenticated. Call erp_login first." }],
        isError: true,
      };
    }
    try {
      const res = await client.request({ method, url: path, data: body, params });
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ status: res.status, data: res.data }, null, 2),
        }],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Request failed:\n${formatError(err)}` }],
        isError: true,
      };
    }
  }
);

// ── Tool 3: erp_list_scenarios ───────────────────────────────────────────────
server.tool(
  "erp_list_scenarios",
  "List all available predefined test scenarios with descriptions.",
  {},
  async () => {
    const scenarios = getScenarios();
    const lines = scenarios.map((s) => `• ${s.name}\n  ${s.description}`).join("\n\n");
    return {
      content: [{
        type: "text",
        text: `Available ERP test scenarios:\n\n${lines}\n\nRun any scenario with: erp_run_scenario`,
      }],
    };
  }
);

// ── Tool 4: erp_run_scenario ─────────────────────────────────────────────────
server.tool(
  "erp_run_scenario",
  "Execute a predefined end-to-end test scenario by name and return step-by-step results.",
  {
    scenario: z.string().describe("Scenario name — get valid names from erp_list_scenarios"),
  },
  async ({ scenario }) => {
    if (!authToken) {
      return {
        content: [{ type: "text", text: "Not authenticated. Call erp_login first." }],
        isError: true,
      };
    }
    const result = await runScenario(scenario, client);
    return {
      content: [{
        type: "text",
        text: JSON.stringify(result, null, 2),
      }],
    };
  }
);

// ── Start server ─────────────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
