import assert from "node:assert/strict";
import test from "node:test";

import {
  getInitialPurchasePaymentMethod,
  isTreasuryPaymentMethod,
  shouldFetchPurchaseTreasuries,
} from "./purchaseTreasuryAccess.js";

test("does not fetch purchase treasuries when the user lacks treasury permission", () => {
  assert.equal(
    shouldFetchPurchaseTreasuries({
      isAuthenticated: true,
      hasTreasuriesPermission: false,
    }),
    false,
  );
});

test("fetches purchase treasuries only for authenticated treasury users", () => {
  assert.equal(
    shouldFetchPurchaseTreasuries({
      isAuthenticated: true,
      hasTreasuriesPermission: true,
    }),
    true,
  );
});

test("defaults non-treasury purchase users to deferred entry", () => {
  assert.equal(
    getInitialPurchasePaymentMethod({ canReadTreasuries: false }),
    "DEFERRED",
  );
});

test("identifies payment methods that require a treasury selection", () => {
  assert.equal(isTreasuryPaymentMethod("CASH"), true);
  assert.equal(isTreasuryPaymentMethod("credit"), true);
  assert.equal(isTreasuryPaymentMethod("DEFERRED"), false);
});
