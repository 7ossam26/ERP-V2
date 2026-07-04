// Rounds a monetary value to 2 decimal places (piastres).
// Use this at every persistence boundary (stored amounts) and display boundary.
// Carry full floating-point precision everywhere in between.
function roundMoney(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

module.exports = { roundMoney };
