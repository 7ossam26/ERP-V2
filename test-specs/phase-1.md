# Phase 1 Test Spec — Setup: Rebrand + Schema + Seed

## Manual Checklist

- [ ] `ramex-store` branch exists and is checked out
- [ ] No "ElGhonemy" text in any user-facing frontend page
- [ ] `npm run dev` starts (backend + frontend)
- [ ] `GET /api/health` returns 200
- [ ] Login page shows Ramex logo and correct branding
- [ ] `npx prisma migrate deploy` runs clean on empty DB
- [ ] `npx prisma generate` runs without errors
- [ ] `npm run seed:ramex` completes without errors (idempotent — run twice, no duplicate errors)

## Seed Correctness

- [ ] 2 warehouses exist: `مخزن فرع جسر السويس`, `مخزن فرع رامو`
- [ ] 2 treasuries exist (one per branch)
- [ ] 2 branches exist: `فرع جسر السويس`, `فرع رامو`
- [ ] 6 roles exist: Superadmin, Owner, BranchManager, Cashier, WarehouseKeeper, Accountant
- [ ] 8 users exist (superadmin, owner, manager.gasr, manager.ramo, cashier.gasr, cashier.ramo, warehouse.keeper, accountant)
- [ ] Walk-in client `عميل نقدي` with `isWalkIn=true` exists
- [ ] `SystemConfiguration` row exists with `companyName = 'رامكس ستور'`

## Permission Matrix (one check per role)

| Role           | Has POS? | Has SETTINGS? | Has OWNER_DASHBOARD? |
|----------------|----------|---------------|----------------------|
| Superadmin     | ✓        | ✓             | ✓                    |
| Owner          | ✓        | ✓             | ✓                    |
| BranchManager  | ✓        | ✗             | ✗                    |
| Cashier        | ✓        | ✗             | ✗                    |
| WarehouseKeeper| ✗        | ✗             | ✗                    |
| Accountant     | ✗        | ✗             | ✗                    |

## Auth Flow

- [ ] Login as `owner` (password `Owner@2026`) → redirected to `/change-password`
- [ ] Changing password clears `mustChangePassword` → subsequent login goes to `/dashboard`
- [ ] Wrong old password on `/change-password` returns Arabic error
- [ ] `superadmin` login → goes directly to `/superadmin/users` (no password change redirect)

## Walk-In Protection

- [ ] `PUT /api/clients/:walkInId` returns 403 with `لا يمكن تعديل العميل النقدي`
- [ ] `DELETE /api/clients/:walkInId` returns 403 with `لا يمكن حذف العميل النقدي`

## Playwright Specs (to implement)

```
test-specs/
  phase-1.spec.ts   ← E2E: login → mustChangePassword redirect → change → dashboard
  phase-1-seed.ts   ← DB assertions: all seeded entities present
  phase-1-walkin.ts ← API: walk-in PUT/DELETE blocked
  phase-1-perms.ts  ← API: per-role module access matrix
```
