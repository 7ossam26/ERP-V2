# ERP-V2 Backend API Test Suite

Automated integration tests for all backend phases. Tests run against a live backend using native Node.js `fetch` (Node 18+). No test framework dependencies needed.

## Setup

1. Start the backend: `node backend/index.js`
2. Log in at `http://localhost:5173`
3. Open DevTools → Application → Local Storage → copy the value of `token`

## Running Tests

```bash
# Individual phase
node backend/tests/phase-a1-auth.test.js http://localhost:3001 YOUR_TOKEN

# With environment variables
BASE_URL=http://localhost:3001 TOKEN=eyJhbGci... node backend/tests/phase-a1-auth.test.js

# Original bug-fix regression suite
node backend/tests/api-tests.js http://localhost:3001 YOUR_TOKEN
```

## Test Files

| File | Phase | Coverage |
|------|-------|----------|
| `api-tests.js` | Regression | NEW-01 to NEW-18 bug fixes |
| `phase-a1-auth.test.js` | A1 | Auth, JWT, permissions, branch filter |
| `phase-a2-pos.test.js` | A2 | Shift lifecycle, sales, inventory deduction |
| `phase-a3-inventory.test.js` | A3 | Inventory records, stock transfers, BOM flag |
| `phase-a4-financial.test.js` | A4 | Treasury, deposits, withdrawals, supplier payments |
| `phase-a5-hr.test.js` | A5 | Employees, advances, deductions, salary payment |
| `phase-a6-delivery.test.js` | A6 | Delivery men, zones, settlement |
| `phase-a7-reports.test.js` | A7 | Summary, branch/date filters, shift report totals |
| `phase-a8-superadmin.test.js` | A8 | Users, roles, settings, audit logs |

## Token Types

- **ADMIN_TOKEN / TOKEN** — Superadmin or Admin (full access). Required for most tests.
- **LIMITED_TOKEN** — A role with restricted permissions. Used in A1 and A8 to verify 403 guards.

## Output

```
── A1-01 — Protected routes reject requests with no token ───────
  PASS GET /api/auth/me without token → 401
  PASS GET /api/employees without token → 401
  ...
── Results ──────────────────────────────────────────────────────
  12 passed  0 failed  3 skipped
```

## Notes

- Tests marked **SKIP** require specific DB state (e.g., an open shift, a supplier with debt).
- Tests marked **INFO** are observations — they don't affect pass/fail count.
- Phase A2 and A4 tests **create real transactions** (sales, deposits, withdrawals). Use a staging/test database.
- Exit code: `0` = all pass, `1` = one or more failures.
