const createNotificationsTableSql = `
  CREATE TABLE IF NOT EXISTS \`notifications\` (
    \`id\` INTEGER NOT NULL AUTO_INCREMENT,
    \`user_id\` INTEGER NOT NULL,
    \`branch_id\` INTEGER NULL,
    \`type\` ENUM('NEW_CALL_CENTER_ORDER', 'ORDER_STATUS_CHANGED') NOT NULL,
    \`payload\` JSON NOT NULL,
    \`read_at\` DATETIME(3) NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX \`notifications_user_id_read_at_created_at_idx\`(\`user_id\`, \`read_at\`, \`created_at\`),
    INDEX \`notifications_created_at_idx\`(\`created_at\`),
    PRIMARY KEY (\`id\`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
`;

const requiredColumnFixes = [
  {
    table: "treasuries",
    column: "scope",
    addSql: `
      ALTER TABLE \`treasuries\`
        ADD COLUMN \`scope\` ENUM('BRANCH_CASH', 'GLOBAL_VISA', 'GLOBAL_INSTAPAY', 'MAIN')
        NOT NULL DEFAULT 'BRANCH_CASH'
    `,
  },
  {
    table: "system_configuration",
    column: "visa_treasury_id",
    renameFrom: "bank_treasury_id",
    beforeRenameSqls: [
      "ALTER TABLE `system_configuration` DROP FOREIGN KEY `system_configuration_bank_treasury_id_fkey`",
    ],
    renameSql: `
      ALTER TABLE \`system_configuration\`
        CHANGE COLUMN \`bank_treasury_id\` \`visa_treasury_id\` INTEGER NULL
    `,
    addSql: `
      ALTER TABLE \`system_configuration\`
        ADD COLUMN \`visa_treasury_id\` INTEGER NULL
    `,
  },
  {
    table: "system_configuration",
    column: "instapay_treasury_id",
    addSql: `
      ALTER TABLE \`system_configuration\`
        ADD COLUMN \`instapay_treasury_id\` INTEGER NULL
    `,
  },
  {
    table: "sales",
    column: "paid_at",
    addSql: "ALTER TABLE `sales` ADD COLUMN `paid_at` DATETIME(3) NULL",
  },
  // Frozen snapshot of the additive HR amounts (اضافي / مكافئة) on each payroll.
  // NOT NULL DEFAULT 0 keeps the reconciliation invariant
  //   net_salary = base_salary - advances - deductions + overtime + bonuses
  // true for historical rows too.
  {
    table: "payrolls",
    column: "overtime",
    addSql:
      "ALTER TABLE `payrolls` ADD COLUMN `overtime` DECIMAL(10, 2) NOT NULL DEFAULT 0",
  },
  {
    table: "payrolls",
    column: "bonuses",
    addSql:
      "ALTER TABLE `payrolls` ADD COLUMN `bonuses` DECIMAL(10, 2) NOT NULL DEFAULT 0",
  },
];

const foreignKeyFixes = [
  `ALTER TABLE \`notifications\` ADD CONSTRAINT \`notifications_user_id_fkey\`
    FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
  `ALTER TABLE \`notifications\` ADD CONSTRAINT \`notifications_branch_id_fkey\`
    FOREIGN KEY (\`branch_id\`) REFERENCES \`branches\`(\`id\`) ON DELETE SET NULL ON UPDATE CASCADE`,
  `ALTER TABLE \`system_configuration\` ADD CONSTRAINT \`system_configuration_visa_treasury_id_fkey\`
    FOREIGN KEY (\`visa_treasury_id\`) REFERENCES \`treasuries\`(\`id\`) ON DELETE SET NULL ON UPDATE CASCADE`,
  `ALTER TABLE \`system_configuration\` ADD CONSTRAINT \`system_configuration_instapay_treasury_id_fkey\`
    FOREIGN KEY (\`instapay_treasury_id\`) REFERENCES \`treasuries\`(\`id\`) ON DELETE SET NULL ON UPDATE CASCADE`,
];

module.exports = {
  createNotificationsTableSql,
  foreignKeyFixes,
  requiredColumnFixes,
};
