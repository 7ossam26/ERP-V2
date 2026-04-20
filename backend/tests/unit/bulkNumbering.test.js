// Unit tests for services/bulkNumbering.service.js
// Mocks Prisma raw SQL — verifies SELECT...FOR UPDATE locking and formatting.

const { allocateNumber } = require("../../services/bulkNumbering.service");

function makeTx({ nextValue, prefix }) {
  const queryRawUnsafe = jest.fn(async (_sql, _key) => [
    { next_value: nextValue, prefix },
  ]);
  const executeRawUnsafe = jest.fn(async () => 1);
  return { tx: { $queryRawUnsafe: queryRawUnsafe, $executeRawUnsafe: executeRawUnsafe }, queryRawUnsafe, executeRawUnsafe };
}

describe("bulkNumbering.allocateNumber", () => {
  test("formats with prefix and zero-pads to 4 by default", async () => {
    const { tx } = makeTx({ nextValue: 7, prefix: "BULK-" });
    const num = await allocateNumber(tx, "ORDER");
    expect(num).toBe("BULK-0007");
  });

  test("uses SELECT ... FOR UPDATE for the read", async () => {
    const { tx, queryRawUnsafe } = makeTx({ nextValue: 1, prefix: "BULK-RCP-" });
    await allocateNumber(tx, "SALES_RECEIPT");
    expect(queryRawUnsafe).toHaveBeenCalledTimes(1);
    const sql = queryRawUnsafe.mock.calls[0][0];
    expect(sql).toMatch(/FOR UPDATE/);
    expect(queryRawUnsafe.mock.calls[0][1]).toBe("SALES_RECEIPT");
  });

  test("increments next_value via UPDATE", async () => {
    const { tx, executeRawUnsafe } = makeTx({ nextValue: 1, prefix: "BULK-" });
    await allocateNumber(tx, "ORDER");
    expect(executeRawUnsafe).toHaveBeenCalledTimes(1);
    const sql = executeRawUnsafe.mock.calls[0][0];
    expect(sql).toMatch(/UPDATE `bulk_number_sequences`/);
    expect(sql).toMatch(/next_value` \+ 1/);
  });

  test("respects custom pad width", async () => {
    const { tx } = makeTx({ nextValue: 42, prefix: "X-" });
    const num = await allocateNumber(tx, "ORDER", { pad: 6 });
    expect(num).toBe("X-000042");
  });

  test("rejects unknown sequence keys", async () => {
    const tx = { $queryRawUnsafe: jest.fn(), $executeRawUnsafe: jest.fn() };
    await expect(allocateNumber(tx, "BOGUS")).rejects.toThrow(/unknown sequence key/);
    expect(tx.$queryRawUnsafe).not.toHaveBeenCalled();
  });

  test("throws if sequence row missing", async () => {
    const tx = {
      $queryRawUnsafe: jest.fn(async () => []),
      $executeRawUnsafe: jest.fn(),
    };
    await expect(allocateNumber(tx, "ORDER")).rejects.toThrow(/not seeded/);
  });
});
