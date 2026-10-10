// authenticateToken / isSuperadmin — the gates every protected route relies on.
//
// Regression focus: the middleware used to fall back to a hardcoded, publicly
// known JWT secret when JWT_SECRET was unset, so anyone could mint a
// Superadmin token. There is no fallback any more: with no secret configured,
// every token is rejected.

jest.mock("../../config/database", () => ({
  user: { findUnique: jest.fn() },
}));

const jwt = require("jsonwebtoken");
const prisma = require("../../config/database");
const { authenticateToken, isSuperadmin } = require("../../middleware/auth");

const OLD_FALLBACK_SECRET = "fallback_secret_key_change_me";
const TEST_SECRET = "unit-test-secret-not-used-anywhere-else";

const makeRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

const reqWithToken = (token) => ({
  headers: token ? { authorization: `Bearer ${token}` } : {},
});

const superadminClaims = { id: 1, username: "superadmin", role: "Superadmin" };

let savedSecret;
beforeEach(() => {
  jest.clearAllMocks();
  savedSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = TEST_SECRET;
  prisma.user.findUnique.mockResolvedValue({ id: 1 });
});
afterEach(() => {
  if (savedSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = savedSecret;
});

describe("authenticateToken", () => {
  test("rejects a request with no token", async () => {
    const res = makeRes();
    const next = jest.fn();
    await authenticateToken(reqWithToken(null), res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test("accepts a token signed with the configured secret for an existing user", async () => {
    const req = reqWithToken(jwt.sign(superadminClaims, TEST_SECRET));
    const res = makeRes();
    const next = jest.fn();
    await authenticateToken(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toMatchObject(superadminClaims);
  });

  test("rejects a token forged with the old hardcoded fallback secret", async () => {
    const res = makeRes();
    const next = jest.fn();
    await authenticateToken(
      reqWithToken(jwt.sign(superadminClaims, OLD_FALLBACK_SECRET)),
      res,
      next
    );
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test("with JWT_SECRET unset, even a fallback-signed token is rejected (fails closed)", async () => {
    delete process.env.JWT_SECRET;
    const res = makeRes();
    const next = jest.fn();
    await authenticateToken(
      reqWithToken(jwt.sign(superadminClaims, OLD_FALLBACK_SECRET)),
      res,
      next
    );
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  test("rejects an expired token", async () => {
    const res = makeRes();
    const next = jest.fn();
    const expired = jwt.sign({ ...superadminClaims, exp: Math.floor(Date.now() / 1000) - 60 }, TEST_SECRET);
    await authenticateToken(reqWithToken(expired), res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test("rejects a valid token whose user no longer exists", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const res = makeRes();
    const next = jest.fn();
    await authenticateToken(reqWithToken(jwt.sign(superadminClaims, TEST_SECRET)), res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe("isSuperadmin", () => {
  test.each(["Admin", "General Manager", "Manager", "Employee", "Call Center"])(
    "refuses role %s",
    (role) => {
      const res = makeRes();
      const next = jest.fn();
      isSuperadmin({ user: { id: 2, role } }, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    }
  );

  test("refuses a request with no authenticated user", () => {
    const res = makeRes();
    const next = jest.fn();
    isSuperadmin({}, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test("allows Superadmin", () => {
    const res = makeRes();
    const next = jest.fn();
    isSuperadmin({ user: superadminClaims }, res, next);
    expect(next).toHaveBeenCalled();
  });
});
