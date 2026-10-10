# Database initialization, verification and recovery

Audience: whoever deploys or operates an ERP instance on Dokploy.

There is **no HTTP endpoint** for creating, seeding or resetting a database.
The former `/api/dangerous-reset-db`, `/api/setup-tables` and `/api/setup-seed`
routes were removed because they were unauthenticated. Everything below runs
from a shell inside the application container (Dokploy → application →
**Terminal**), or from a machine that can reach the database.

> Never replay `backend/prisma/migration.sql` against a database. It is a
> concatenation of historical migrations that contains `DROP`, `UPDATE` and
> enum-narrowing statements. The schema is owned by `backend/prisma/migrations/`
> and applied only by `prisma migrate deploy`.

## 1. What the container does on every start

`npm start` → `node backend/start.js`, which runs, in order:

1. `scripts/fix-server-schema.js` — idempotent repairs for databases that were
   baselined without their SQL having run. **Skipped automatically when the
   `purchases` table does not exist** (fresh or not-yet-migrated database).
2. `scripts/baseline-migrations.js` — reconciles `_prisma_migrations` with the
   real schema using probes. Issues no `DELETE` when `_prisma_migrations` does
   not exist yet.
3. `npx prisma migrate deploy` — applies pending migrations.
4. `index.js` — starts the HTTP server.

If any of steps 1–3 fails, the process exits with status 1 and the container
restarts. Step 3 is the only one that creates schema on a fresh database.

Startup never seeds data and never creates users.

## 2. Initializing a fresh database

Preconditions: the database exists, it is empty (verified with section 3, never
assumed), and the application's `DATABASE_URL` points at it.

1. Deploy the application. On an empty database the boot log shows
   `[FIX] purchases table not found … Skipping schema repair`, then all
   migrations applying, then `Server successfully running`. Nothing else is
   needed for the schema.
2. Open the container terminal and create the reference data and the first
   superadmin. Pass the password **only to this command** — do not store it in
   Dokploy's environment:

   ```sh
   cd /app/backend   # adjust to the container's working directory
   ADMIN_USERNAME=superadmin ADMIN_PASSWORD='<at least 12 characters>' node prisma/seed.js
   ```

   The seed creates roles, permissions, the main branch / warehouse /
   treasuries, system configuration, the walk-in client, the general supplier
   and the superadmin. It is idempotent: re-running it never changes an
   existing superadmin (no password reset, no re-activation, no role change)
   and does not need `ADMIN_PASSWORD` once the account exists.

3. Log in through the UI and change nothing else until the smoke tests pass.

The seed refuses to start — before writing anything — when it would need to
create the superadmin and `ADMIN_PASSWORD` is missing or shorter than 12
characters.

## 3. Read-only verification procedure

Use a database account that has **only** `SELECT` and `SHOW VIEW` on the target
schema, so that a typo cannot modify data. Creating that account is a write
on the server and must be done by the database owner:

```sql
CREATE USER 'erp_readonly'@'%' IDENTIFIED BY '<generated>';
GRANT SELECT, SHOW VIEW ON `<db>`.* TO 'erp_readonly'@'%';
```

If such an account cannot be used, open the session with
`START TRANSACTION READ ONLY;` and end it with `ROLLBACK;` — weaker, but MySQL
rejects writes inside it.

Run, replacing `<db>`:

```sql
-- 1. Does the database exist and how big is it?
SELECT schema_name FROM information_schema.schemata WHERE schema_name = '<db>';
SELECT COUNT(*) AS tables FROM information_schema.tables WHERE table_schema = '<db>';

-- 2. Which tables exist? (names and approximate row counts only)
SELECT table_name, table_rows
FROM information_schema.tables
WHERE table_schema = '<db>'
ORDER BY table_name;

-- 3. Migration history (only if _prisma_migrations exists)
SELECT COUNT(*) AS total,
       SUM(finished_at IS NOT NULL) AS finished,
       SUM(finished_at IS NULL AND rolled_back_at IS NULL) AS broken,
       SUM(rolled_back_at IS NOT NULL) AS rolled_back,
       MAX(finished_at) AS last_applied
FROM `<db>`._prisma_migrations;
SELECT migration_name FROM `<db>`._prisma_migrations ORDER BY started_at DESC LIMIT 5;

-- 4. Is there business data? Exact counts, no row contents.
SELECT (SELECT COUNT(*) FROM `<db>`.users)    AS users,
       (SELECT COUNT(*) FROM `<db>`.items)    AS items,
       (SELECT COUNT(*) FROM `<db>`.sales)    AS sales,
       (SELECT COUNT(*) FROM `<db>`.purchases) AS purchases,
       (SELECT COUNT(*) FROM `<db>`.shifts)   AS shifts;
```

`table_rows` is an InnoDB estimate; use query 4 for the decision.

### Interpreting the result

| What you see | State | Action |
|---|---|---|
| 0 tables | Empty | Section 2. |
| Exactly `purchase_returns` and `purchase_return_items`, no `_prisma_migrations` | Empty, plus the leftovers of crash-looped boots of the **old** startup code | `prisma migrate deploy` refuses this state with `P3005` (schema not empty) and the container keeps restarting; nothing is modified. Confirm both tables have 0 rows, take a backup (section 4), drop exactly these two tables, then continue with section 2. |
| `_prisma_migrations` present, `broken` = 0, all 4 business counts 0 | Migrated, not seeded | Seed (section 2, step 2). |
| `_prisma_migrations` present, `broken` > 0 | A migration failed mid-way | Do not restart in a loop. Read the failing migration's SQL, back up, and decide per migration. |
| Any business count > 0 | **Contains business data** | Treat as production. Backup first; never drop, reset or re-seed passwords. |
| Tables present but no `_prisma_migrations` | Schema created outside Prisma (e.g. `db push` or a legacy setup endpoint) | Do not start the app against it before deciding on a baseline; back up first. |

## 4. Backup and recovery checklist

Before **any** production database operation (first deployment against an
existing database, migration, seed with `--reset-admin-password`, dropping a
table, credential change):

- [ ] Identify the exact database service and schema (Dokploy service ID,
      internal hostname, schema name). Confirm no other application uses the
      same service and credentials.
- [ ] Take a logical backup and store it outside the database container:
      `mysqldump --single-transaction --routines --triggers --set-gtid-purged=OFF -h <host> -u <user> -p <db> > <db>-<UTC timestamp>.sql`
      (or a Dokploy database backup to S3, then confirm the object exists).
- [ ] Verify the backup: non-zero size, ends with `-- Dump completed`, and
      contains `CREATE TABLE` for `_prisma_migrations`, `users` and `sales`.
- [ ] Restore-test the dump into a throwaway schema on a non-production
      server and compare table counts with query 4.
- [ ] Record the current application image/commit so it can be redeployed.
- [ ] Write down the rollback trigger (what failure makes you restore) and
      who approves it.

Recovery: stop the application (so the boot chain does not run), restore the
dump into an empty schema, point the application at it, redeploy the
recorded image/commit, and run the smoke tests.

## 5. Superadmin password recovery

From the container terminal only:

```sh
ADMIN_PASSWORD='<new password, at least 12 characters>' node prisma/seed.js --reset-admin-password
```

This changes only the password of the `ADMIN_USERNAME` (default
`superadmin`) account. Existing sessions stay valid until their JWT expires
(7 days); rotate `JWT_SECRET` as well if the old password may have been used
by someone else.
