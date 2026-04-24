import assert from "node:assert/strict";
import test from "node:test";

import { getLoginErrorMessage } from "./loginErrorMessage.js";

test("returns a clear invalid-credentials message for 401 login failures", () => {
  assert.equal(
    getLoginErrorMessage({
      status: 401,
      message: "Invalid credentials",
    }),
    "Invalid username or password. Please try again.",
  );
});

test("keeps explicit non-auth API messages when they are available", () => {
  assert.equal(
    getLoginErrorMessage({
      status: 503,
      message: "Service unavailable",
    }),
    "Service unavailable",
  );
});

test("falls back when the error does not include a usable message", () => {
  assert.equal(getLoginErrorMessage(null, "Login failed."), "Login failed.");
});
