// Rounds a monetary value to 2 decimal places (piastres).
// Matches backend/utils/money.js — any formula change must be mirrored in both.
export function roundMoney(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

// Formats an EGP amount with Arabic locale.
export function formatEGP(value) {
  const n = Number(value) || 0;
  return n.toLocaleString("ar-EG", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}
