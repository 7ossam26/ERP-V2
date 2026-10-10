// Static guard over the HTTP surface. It reads the route sources rather than
// booting the server (index.js listens and starts crons on require).
//
// Regression focus: index.js used to expose /api/dangerous-reset-db,
// /api/setup-tables and /api/setup-seed with no authentication, letting any
// caller drop every table, replay migration.sql, or reset the superadmin
// password. These tests fail if such a route — or any other unauthenticated
// route — reappears.

const fs = require("fs");
const path = require("path");

const BACKEND = path.resolve(__dirname, "../..");
const ROUTES_DIR = path.join(BACKEND, "routes");
const read = (p) => fs.readFileSync(p, "utf8");

// The only routes that may be reached without a Bearer JWT, with the reason.
const PUBLIC_ROUTES = {
  "auth.js POST /login": "credential exchange",
  "auth.js POST /logout": "stateless, touches no data",
};
// Non-JWT authenticators that are acceptable in place of authenticateToken.
const ALT_AUTH = ["authFromTicket"]; // events.js: single-use ticket minted by an authenticated POST

const ROUTE_CALL = /\b(router|app)\.(get|post|put|patch|delete|all)\(\s*(["'`/])((?:\\.|(?!\3).)*)\3/g;

function routeCalls(src) {
  const out = [];
  let m;
  while ((m = ROUTE_CALL.exec(src))) {
    const pathText = m[3] === "/" ? `/${m[4]}/` : m[4];
    // Middleware list = text from the call up to where the handler starts.
    const tail = src.slice(m.index, m.index + 600);
    const handlerAt = tail.search(/async\s*\(|\(\s*req\b|\bctrl\.|Controller\.|controller\./);
    out.push({
      index: m.index,
      method: m[2].toUpperCase(),
      path: pathText,
      middleware: handlerAt === -1 ? tail : tail.slice(0, handlerAt),
    });
  }
  return out;
}

function firstRouterLevelAuth(src) {
  const re = /router\.use\(([\s\S]{0,200}?)\)/g;
  let m;
  while ((m = re.exec(src))) {
    if (/authenticateToken/.test(m[1])) return m.index;
  }
  return Infinity;
}

describe("index.js", () => {
  const src = read(path.join(BACKEND, "index.js"));
  const calls = routeCalls(src);

  test("does not register any database setup / reset / seed route", () => {
    const offending = calls.filter((c) => /setup|reset|seed|wipe|drop/i.test(c.path));
    expect(offending).toEqual([]);
    expect(src).not.toMatch(/req\.query\.secret/);
    expect(src).not.toMatch(/require\(["']\.\/prisma\/seed(\.js)?["']\)/);
  });

  test("registers only the health check and the SPA fallback directly on app", () => {
    expect(calls.map((c) => `${c.method} ${c.path}`).sort()).toEqual(
      ["GET /.*/", "GET /api/health"].sort()
    );
  });
});

describe("routes/*.js", () => {
  const files = fs.readdirSync(ROUTES_DIR).filter((f) => f.endsWith(".js"));

  test("found the route files", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  test("every route is authenticated (router-level or per-route), except the documented public ones", () => {
    const unauthenticated = [];
    for (const file of files) {
      const src = read(path.join(ROUTES_DIR, file));
      const routerAuthAt = firstRouterLevelAuth(src);
      for (const c of routeCalls(src)) {
        const key = `${file} ${c.method} ${c.path}`;
        const covered =
          c.index > routerAuthAt ||
          /authenticateToken/.test(c.middleware) ||
          ALT_AUTH.some((a) => c.middleware.includes(a));
        if (!covered && !PUBLIC_ROUTES[key]) unauthenticated.push(key);
      }
    }
    expect(unauthenticated).toEqual([]);
  });

  test("the documented public routes still exist (keeps the allowlist honest)", () => {
    const all = files.flatMap((file) =>
      routeCalls(read(path.join(ROUTES_DIR, file))).map((c) => `${file} ${c.method} ${c.path}`)
    );
    for (const key of Object.keys(PUBLIC_ROUTES)) expect(all).toContain(key);
  });

  test("the superadmin router (incl. POST /reset/:category) is gated by authenticateToken + isSuperadmin before any route", () => {
    const src = read(path.join(ROUTES_DIR, "superadmin.js"));
    const gate = src.search(/router\.use\(\s*authenticateToken\s*,\s*isSuperadmin\s*\)/);
    const firstRoute = routeCalls(src)[0].index;
    expect(gate).toBeGreaterThan(-1);
    expect(gate).toBeLessThan(firstRoute);
    expect(routeCalls(src).some((c) => c.method === "POST" && c.path === "/reset/:category")).toBe(true);
  });
});
