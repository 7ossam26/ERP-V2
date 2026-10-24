-- Record which physical container a cash transfer left from / arrived in.
--
-- WHY
-- ---
-- A branch holds cash in two places — the register (الدرج) and the branch safe
-- (خزنة الفرع) — but has ONE treasury account holding both. A transfer only
-- moved that account, so the shift's expected-drawer formula had to guess where
-- the cash physically came from. It guessed "always the safe", and a cashier who
-- kept the full previous count as the opening float and then sent part of it to
-- head office from the drawer closed with a phantom shortage equal to the
-- transfer; cash sent INTO the drawer printed as an overage.
--
-- `from_drawer` / `to_drawer` say which container; `from_shift_id` /
-- `to_shift_id` stamp the shift that drawer belonged to, so attribution is by
-- shift, not by a time window. `resolved_at` is when the transfer was approved
-- or rejected — a rejection refunds the source, and whether that refund lands
-- back in the drawer depends on whether its shift was still open.
--
-- NON-DESTRUCTIVE, ADD-ONLY. The flags default to 0 (= the safe), which is
-- exactly how every existing transfer has been treated since a70259f, so no
-- historical shift figure changes. The new FKs are ON DELETE SET NULL. Nothing
-- is dropped, renamed, retyped or backfilled.

-- AlterTable
ALTER TABLE `cash_transfers` ADD COLUMN `resolved_at` DATETIME(3) NULL,
    ADD COLUMN `from_drawer` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `from_shift_id` INTEGER NULL,
    ADD COLUMN `to_drawer` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `to_shift_id` INTEGER NULL;

-- CreateIndex
CREATE INDEX `cash_transfers_from_shift_id_idx` ON `cash_transfers`(`from_shift_id`);

-- CreateIndex
CREATE INDEX `cash_transfers_to_shift_id_idx` ON `cash_transfers`(`to_shift_id`);

-- AddForeignKey
ALTER TABLE `cash_transfers` ADD CONSTRAINT `cash_transfers_from_shift_id_fkey` FOREIGN KEY (`from_shift_id`) REFERENCES `shifts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cash_transfers` ADD CONSTRAINT `cash_transfers_to_shift_id_fkey` FOREIGN KEY (`to_shift_id`) REFERENCES `shifts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
