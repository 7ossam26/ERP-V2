const prisma = require("../config/database");

/**
 * Generate a race-safe roll number: R-YYYYMM-NNNNN
 * Uses INSERT ... ON DUPLICATE KEY UPDATE on roll_number_sequences
 * to atomically increment the sequence even under concurrent requests.
 *
 * @param {object} [tx] - Optional Prisma transaction client
 * @returns {Promise<string>} e.g. "R-202604-00001"
 */
const generateRollNumber = async (tx) => {
  const client = tx || prisma;
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const yearMonth = `${year}${month}`;

  // Atomically upsert the sequence row and get the new value.
  // ON DUPLICATE KEY UPDATE increments last_seq and returns the new value via
  // a subsequent SELECT — all inside the same connection/transaction context.
  await client.$executeRawUnsafe(
    "INSERT INTO roll_number_sequences (`year_month`, last_seq)\n     VALUES (?, 1)\n     ON DUPLICATE KEY UPDATE last_seq = last_seq + 1",
    yearMonth
  );

  const rows = await client.$queryRawUnsafe(
    "SELECT last_seq FROM roll_number_sequences WHERE `year_month` = ?",
    yearMonth
  );

  const seq = Number(rows[0].last_seq);
  return `R-${yearMonth}-${String(seq).padStart(5, "0")}`;
};

module.exports = { generateRollNumber };
