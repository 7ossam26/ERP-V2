import assert from "node:assert/strict";
import test from "node:test";

import { shouldFetchSystemSettings } from "./systemSettingsAccess.js";

test("does not fetch system settings when the user is not authenticated", () => {
  assert.equal(
    shouldFetchSystemSettings({
      isAuthenticated: false,
      hasSettingsPermission: true,
    }),
    false,
  );
});

test("does not fetch system settings without SETTINGS permission", () => {
  assert.equal(
    shouldFetchSystemSettings({
      isAuthenticated: true,
      hasSettingsPermission: false,
    }),
    false,
  );
});

test("fetches system settings only for authenticated settings users", () => {
  assert.equal(
    shouldFetchSystemSettings({
      isAuthenticated: true,
      hasSettingsPermission: true,
    }),
    true,
  );
});
