const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createNotificationsTableSql,
  requiredColumnFixes,
} = require("./schema-fix-definitions");

test("schema fix plan repairs the missing notifications table", () => {
  assert.match(createNotificationsTableSql, /CREATE TABLE IF NOT EXISTS `notifications`/);
  assert.match(createNotificationsTableSql, /`type` ENUM\('NEW_CALL_CENTER_ORDER', 'ORDER_STATUS_CHANGED'\)/);
});

test("schema fix plan repairs treasury scope drift", () => {
  assert.ok(
    requiredColumnFixes.some(
      (fix) => fix.table === "treasuries" && fix.column === "scope"
    )
  );
});

test("schema fix plan repairs missing payroll addition snapshot columns", () => {
  for (const column of ["overtime", "bonuses"]) {
    const fix = requiredColumnFixes.find(
      (f) => f.table === "payrolls" && f.column === column
    );
    assert.ok(fix, `missing payrolls.${column} fix`);
    // Must default to 0 so historical payrolls keep satisfying
    // net_salary = base_salary - advances - deductions + overtime + bonuses
    assert.match(fix.addSql, /NOT NULL DEFAULT 0/);
  }
});

test("schema fix plan repairs renamed digital treasury columns", () => {
  assert.ok(
    requiredColumnFixes.some(
      (fix) => fix.table === "system_configuration" && fix.column === "visa_treasury_id"
    )
  );
  assert.ok(
    requiredColumnFixes.some(
      (fix) => fix.table === "system_configuration" && fix.column === "instapay_treasury_id"
    )
  );
});
