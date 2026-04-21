// Rounds a monetary value to the nearest 1 EGP.
// Use this at every persistence boundary (stored amounts) and display boundary.
// Carry full floating-point precision everywhere in between.
function roundMoney(n) {
  return Math.round(Number(n) || 0);
}

module.exports = { roundMoney };
