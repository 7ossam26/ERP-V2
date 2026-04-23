import assert from "node:assert/strict";
import { getCardColorVars, getCardColorway } from "./cardPalette.js";

assert.deepEqual(
  getCardColorway("reports-general"),
  getCardColorway("reports-general"),
);

const vars = getCardColorVars("inventory");

assert.ok(vars["--brand-card-accent"]);
assert.ok(vars["--brand-card-bg-light"]);
assert.ok(vars["--brand-card-bg-dark"]);
assert.ok(vars["--brand-card-border-light"]);
assert.ok(vars["--brand-card-border-dark"]);
assert.ok(vars["--brand-card-ink"]);
assert.ok(vars["--brand-card-shadow"]);

assert.notDeepEqual(getCardColorway("dashboard"), getCardColorway("reports"));
