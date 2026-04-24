const prisma = require("../config/database");

/**
 * Generate a race-safe sequential number: PREFIX-YYYYMM-NNNNN
 * Uses INSERT ... ON DUPLICATE KEY UPDATE on number_sequences
 * to atomically increment the sequence even under concurrent requests.
 *
 * @param {string} prefix - e.g. "ADJ", "CNT"
 * @param {object} [tx] - Optional Prisma transaction client
 * @returns {Promise<string>} e.g. "ADJ-202604-00001"
 */
const generateNumber = async (prefix, tx) => {
  const client = tx || prisma;
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const yearMonth = `${year}${month}`;

  await client.$executeRawUnsafe(
    `INSERT INTO number_sequences (\`prefix\`, year_month, last_seq)
     VALUES (?, ?, 1)
     ON DUPLICATE KEY UPDATE last_seq = last_seq + 1`,
    prefix,
    yearMonth
  );

  const rows = await client.$queryRawUnsafe(
    `SELECT last_seq FROM number_sequences WHERE \`prefix\` = ? AND year_month = ?`,
    prefix,
    yearMonth
  );

  const seq = Number(rows[0].last_seq);
  return `${prefix}-${yearMonth}-${String(seq).padStart(5, "0")}`;
};

module.exports = { generateNumber };
