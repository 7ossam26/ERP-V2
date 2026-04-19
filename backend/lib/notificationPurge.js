// backend/lib/notificationPurge.js
// Daily TTL job: delete notifications older than 30 days (D8).
// Runs on a simple setInterval — good enough for single-instance deploys.
// In multi-instance setups, only one process should run this (gate with an
// env flag like RUN_CRONS=true).

const prisma = require("../config/database");

const DAY_MS = 24 * 60 * 60 * 1000;
const RETENTION_DAYS = 30;

async function purgeOldNotifications() {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * DAY_MS);
  try {
    const result = await prisma.notification.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    if (result.count > 0) {
      console.log(
        `[CRON] Purged ${result.count} notifications older than ${RETENTION_DAYS}d`,
      );
    }
    return result.count;
  } catch (err) {
    console.error("[CRON] Notification purge failed:", err.message);
    return 0;
  }
}

function startNotificationPurgeCron() {
  if (process.env.DISABLE_NOTIFICATION_CRON === "true") {
    console.log("[CRON] Notification purge disabled via env");
    return null;
  }

  // Fire once shortly after boot, then every 24h.
  const bootDelay = 60_000; // 1 minute after boot so we don't block startup
  const bootTimer = setTimeout(purgeOldNotifications, bootDelay);
  const interval = setInterval(purgeOldNotifications, DAY_MS);

  // Allow the process to exit cleanly if nothing else is holding it open.
  if (bootTimer.unref) bootTimer.unref();
  if (interval.unref) interval.unref();

  console.log("[CRON] Notification purge scheduled (every 24h)");
  return interval;
}

module.exports = { startNotificationPurgeCron, purgeOldNotifications };
