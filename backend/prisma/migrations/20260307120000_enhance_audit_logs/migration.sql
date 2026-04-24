-- Enhance audit_logs: add branch_id, row_hash, and performance indexes
ALTER TABLE `audit_logs`
  ADD COLUMN `branch_id` INTEGER NULL AFTER `ip_address`,
  ADD COLUMN `row_hash`  CHAR(64)     NULL AFTER `branch_id`,
  MODIFY COLUMN `action`        VARCHAR(20)  NOT NULL,
  MODIFY COLUMN `target_entity` VARCHAR(60)  NOT NULL,
  MODIFY COLUMN `target_id`     VARCHAR(40)  NULL,
  MODIFY COLUMN `ip_address`    VARCHAR(45)  NULL;

-- Indexes for viewer queries (no FK on branch_id to avoid cascade issues)
CREATE INDEX `audit_logs_created_at_idx`            ON `audit_logs`(`created_at`);
CREATE INDEX `audit_logs_user_id_created_at_idx`    ON `audit_logs`(`user_id`, `created_at`);
CREATE INDEX `audit_logs_target_entity_target_id_idx` ON `audit_logs`(`target_entity`, `target_id`(20));
CREATE INDEX `audit_logs_branch_id_created_at_idx`  ON `audit_logs`(`branch_id`, `created_at`);

-- Foreign key for branch_id
ALTER TABLE `audit_logs`
  ADD CONSTRAINT `audit_logs_branch_id_fkey`
  FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
