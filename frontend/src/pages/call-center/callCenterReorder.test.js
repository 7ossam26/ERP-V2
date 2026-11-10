import assert from "node:assert/strict";
import test from "node:test";

import {
  availableOf,
  mergeReorderIntoCart,
  resolveReorderLines,
} from "./callCenterReorder.js";

const catalog = [
  { id: 1, name: "Kunafa", price: 60, unit: "piece", available: 10 },
  { id: 2, name: "Basbousa", price: 80, unit: "kg", available: 0.75 },
  { id: 3, name: "Om Ali", price: 45, unit: "piece", available: 0 },
  { id: 4, name: "Konafa Box", price: 120, unit: "piece", stock: 1, autoProducible: 2.6 },
];

test("availableOf prefers the server value and falls back to stock + autoProducible", () => {
  assert.equal(availableOf({ available: 4, stock: 1 }), 4);
  assert.equal(availableOf({ stock: 1, autoProducible: 2.5 }), 3.5);
  assert.equal(availableOf(null), 0);
});

test("resolveReorderLines grades each line against the branch catalog", () => {
  const resolved = resolveReorderLines(
    [
      { itemId: 1, name: "Kunafa", unit: "piece", quantity: 2, unitPrice: 60, total: 120 },
      { itemId: 2, name: "Basbousa", unit: "kg", quantity: 1.5, unitPrice: 70, total: 105 },
      { itemId: 3, name: "Om Ali", unit: "piece", quantity: 1, unitPrice: 45, total: 45 },
      { itemId: 99, name: "Gone", unit: "piece", quantity: 1, unitPrice: 10, total: 10 },
      { itemId: null, name: "Deleted", unit: null, quantity: 1, unitPrice: 5, total: 5 },
    ],
    catalog,
  );

  assert.deepEqual(resolved.map((l) => l.status), ["ok", "partial", "unavailable", "missing", "missing"]);
  assert.equal(resolved[0].priceChanged, false);
  assert.equal(resolved[1].priceChanged, true);
  assert.equal(resolved[1].currentPrice, 80);
  assert.equal(resolved[1].available, 0.75);
});

test("resolveReorderLines folds repeated items and floors piece availability", () => {
  const resolved = resolveReorderLines(
    [
      { itemId: 4, name: "Konafa Box", unit: "piece", quantity: 1, unitPrice: 120, total: 120 },
      { itemId: 4, name: "Konafa Box", unit: "piece", quantity: 2, unitPrice: 120, total: 240 },
    ],
    catalog,
  );

  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].quantity, 3);
  assert.equal(resolved[0].total, 360);
  assert.equal(resolved[0].available, 3);
  assert.equal(resolved[0].status, "ok");
});

test("resolveReorderLines reports unknown until a branch catalog is loaded", () => {
  const [line] = resolveReorderLines(
    [{ itemId: 1, name: "Kunafa", unit: "piece", quantity: 2, unitPrice: 60, total: 120 }],
    [],
  );
  assert.equal(line.status, "unknown");
});

test("mergeReorderIntoCart fills an empty cart at current prices and skips what can't be sold", () => {
  const resolved = resolveReorderLines(
    [
      { itemId: 1, name: "Kunafa", unit: "piece", quantity: 2, unitPrice: 55, total: 110 },
      { itemId: 2, name: "Basbousa", unit: "kg", quantity: 1.5, unitPrice: 80, total: 120 },
      { itemId: 3, name: "Om Ali", unit: "piece", quantity: 1, unitPrice: 45, total: 45 },
    ],
    catalog,
  );

  const result = mergeReorderIntoCart([], resolved);

  assert.deepEqual(result.cart, [
    { itemId: 1, name: "Kunafa", price: 60, quantity: 2, stock: 10, unit: "piece" },
    { itemId: 2, name: "Basbousa", price: 80, quantity: 0.75, stock: 0.75, unit: "kg" },
  ]);
  assert.deepEqual(result.added, ["Kunafa", "Basbousa"]);
  assert.deepEqual(result.clamped, ["Basbousa"]);
  assert.deepEqual(result.skipped, ["Om Ali"]);
});

test("mergeReorderIntoCart adds on top of existing cart lines without exceeding stock", () => {
  const cart = [{ itemId: 1, name: "Kunafa", price: 60, quantity: 9, stock: 10, unit: "piece" }];
  const resolved = resolveReorderLines(
    [{ itemId: 1, name: "Kunafa", unit: "piece", quantity: 2, unitPrice: 60, total: 120 }],
    catalog,
  );

  const result = mergeReorderIntoCart(cart, resolved);

  assert.equal(result.cart.length, 1);
  assert.equal(result.cart[0].quantity, 10);
  assert.deepEqual(result.clamped, ["Kunafa"]);
  assert.equal(cart[0].quantity, 9, "input cart is not mutated");

  const again = mergeReorderIntoCart(result.cart, resolved);
  assert.deepEqual(again.added, []);
  assert.deepEqual(again.clamped, ["Kunafa"]);
});
