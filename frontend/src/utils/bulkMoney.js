// Money helpers for Bulk POS (B2B). Prices are stored tax-inclusive — splitting
// produces the net + VAT breakdown shown on invoices and receipts.

export const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;

export function splitInclusive(inclusive, rate) {
  const total = Number(inclusive) || 0;
  const r = Number(rate) || 0;
  const net = round2(total / (1 + r));
  const tax = round2(total - net);
  return { net, tax, total: round2(total) };
}

export function formatEGP(value) {
  const n = Number(value) || 0;
  return n.toLocaleString("ar-EG", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

export function formatNumber(value) {
  const n = Number(value) || 0;
  return n.toLocaleString("ar-EG", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}
