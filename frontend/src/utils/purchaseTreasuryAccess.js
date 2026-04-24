const TREASURY_PAYMENT_METHODS = new Set(["CASH", "CREDIT", "MIXED"]);

export function shouldFetchPurchaseTreasuries({
  isAuthenticated,
  hasTreasuriesPermission,
}) {
  return Boolean(isAuthenticated && hasTreasuriesPermission);
}

export function canReadPurchaseTreasuries(authService) {
  return shouldFetchPurchaseTreasuries({
    isAuthenticated: authService?.isAuthenticated?.(),
    hasTreasuriesPermission: authService?.hasPermission?.("TREASURIES"),
  });
}

export function getInitialPurchasePaymentMethod({ canReadTreasuries }) {
  return canReadTreasuries ? "CASH" : "DEFERRED";
}

export function isTreasuryPaymentMethod(paymentMethod) {
  return TREASURY_PAYMENT_METHODS.has(String(paymentMethod).toUpperCase());
}
