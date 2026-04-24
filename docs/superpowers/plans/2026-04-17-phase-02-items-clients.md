# Phase 02 — Items & Clients (Type-Switching + Tier Pricing) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend Items with 4 type-aware attribute sets and tier pricing; extend Clients with tier; add a single `pricingService` that resolves effective price per (client, item).

**Architecture:** Schema columns for type-specific attributes are added via a new Prisma migration. Backend routes are extended in-place (no new route files needed). A new `backend/services/pricingService.js` becomes the single source of truth for price resolution. Frontend item pages are restructured into focused sub-form components rendered conditionally on `itemType`; client pages gain a tier badge and walk-in lock.

**Tech Stack:** Node.js/Express, Prisma ORM (MySQL), React + Vite + Tailwind CSS, vanilla `fetch` via `api` helper in `apiClient.js`. Tests use the existing Node.js test runner pattern (`phase-aX.test.js`).

---

## File Map

### New files
| File | Responsibility |
|------|---------------|
| `backend/prisma/migrations/20260417000002_phase02_item_type_attrs_client_tier/migration.sql` | DB columns: fabric/clothes attrs on `items`, `tier` on `clients`, `ITEM_PRICES` module |
| `backend/services/pricingService.js` | Single source of truth: resolveEffectivePrice, resolveBulkPrices |
| `frontend/src/pages/items/FabricAttributesForm.jsx` | Sub-form for FABRIC-type fields |
| `frontend/src/pages/items/ClothesAttributesForm.jsx` | Sub-form for CLOTHES-type fields |
| `frontend/src/pages/items/TierPriceManager.jsx` | Inline CRUD for item tier prices |
| `backend/tests/phase-02-items-clients.test.js` | Integration tests for this phase |

### Modified files
| File | What changes |
|------|-------------|
| `backend/prisma/schema.prisma` | Add fabric/clothes columns to `Item`, add `ITEM_PRICES` to `Module` enum |
| `backend/routes/items.js` | Filters on GET /, type-aware validation on POST/PUT, immutable-type guard, tier-price sub-routes, PATCH toggles, Arabic delete errors |
| `backend/routes/clients.js` | `tier` on GET/POST/PUT, phone regex, walk-in protections, walk-in endpoint, resolve-price endpoint |
| `frontend/src/services/itemService.js` | Add `getWithTierPrices`, `upsertTierPrices`, `deleteTierPrice`, `patchShowInPos`, `patchReorderPoint`, `resolvePrice`; pass type fields through toFrontend/toBackend |
| `frontend/src/services/clientService.js` | Add `tier` to toFrontend/toBackend; add `getWalkIn`, `resolvePrice` |
| `frontend/src/pages/items/ItemManager.jsx` | Replace monolithic form with type-selector + conditional sub-forms; add type column to list |
| `frontend/src/pages/clients/ClientManager.jsx` | Add tier badge column and filter; walk-in lock icon; tier field in form |

---

## Task 1: DB Migration — Item Type Attributes + Client Tier + ITEM_PRICES Module

**Files:**
- Create: `backend/prisma/migrations/20260417000002_phase02_item_type_attrs_client_tier/migration.sql`
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Write the migration SQL**

```sql
-- Phase 02: item type-specific attribute columns, client tier, ITEM_PRICES permission

-- 1. Add ITEM_PRICES to Module enum
ALTER TABLE `permissions` MODIFY `module` ENUM(
  'HR','INVENTORY','INVENTORY_COUNT','STOCK_TRANSFER','POS','PURCHASES',
  'SALES','REPORTS','TREASURIES','CASH_TRANSFER','TRANSFER_MANAGEMENT',
  'BRANCHES','EMPLOYEES','CLIENTS','SUPPLIERS','SUPPLIER_ACCOUNTS',
  'CATEGORIES','ITEMS','WAREHOUSES','SETTINGS','EXPENSES','SHIFTS',
  'DELIVERY_SETTLEMENT','CREATES_WAREHOUSES','CREATES_EMPLOYEES',
  'CREATES_SUPPLIERS','CREATES_CLIENTS','CREATES_CATEGORIES','CREATES_ITEMS',
  'CREATES_TREASURIES','CREATES_BRANCHES','DEPOSITS','CREATES_DEPOSITS',
  'WITHDRAWALS','CREATES_WITHDRAWALS','DELIVERY_MEN','CREATES_DELIVERY_MEN',
  'DELIVERY_ZONES','CREATES_DELIVERY_ZONES','CREATES_PRODUCTION','PRODUCTION',
  'FABRIC_ROLLS','ADJUSTMENTS','COUNTS','OWNER_DASHBOARD','ITEM_PRICES'
) NOT NULL;

-- 2. Fabric-specific columns on items
ALTER TABLE `items`
  ADD COLUMN `fabric_type`  VARCHAR(100) NULL,
  ADD COLUMN `fabric_color` VARCHAR(100) NULL,
  ADD COLUMN `fabric_width` DECIMAL(5,2) NULL COMMENT 'meters, 0-10',
  ADD COLUMN `fabric_unit`  VARCHAR(50)  NULL,
  ADD COLUMN `fabric_gsm`   INT          NULL COMMENT '10-1000 if present';

-- 3. Clothes-specific columns on items
ALTER TABLE `items`
  ADD COLUMN `clothes_style_code`  VARCHAR(100) NULL,
  ADD COLUMN `clothes_size`        VARCHAR(50)  NULL,
  ADD COLUMN `clothes_size_label`  VARCHAR(100) NULL COMMENT 'used when size=CUSTOM',
  ADD COLUMN `clothes_color`       VARCHAR(100) NULL,
  ADD COLUMN `clothes_gender`      ENUM('MEN','WOMEN','UNISEX','KIDS') NULL;

-- 4. Add tier to clients (already has default RETAIL in schema — add col if missing)
ALTER TABLE `clients`
  ADD COLUMN IF NOT EXISTS `tier` ENUM('RETAIL','WHOLESALE') NOT NULL DEFAULT 'RETAIL';
```

Save to `backend/prisma/migrations/20260417000002_phase02_item_type_attrs_client_tier/migration.sql`.

- [ ] **Step 2: Update schema.prisma — Item model**

In `backend/prisma/schema.prisma`, inside `model Item { ... }`, add these fields after the `itemType` line:

```prisma
  // Fabric attributes (itemType == FABRIC)
  fabricType   String?  @map("fabric_type")  @db.VarChar(100)
  fabricColor  String?  @map("fabric_color") @db.VarChar(100)
  fabricWidth  Decimal? @map("fabric_width") @db.Decimal(5,2)
  fabricUnit   String?  @map("fabric_unit")  @db.VarChar(50)
  fabricGsm    Int?     @map("fabric_gsm")

  // Clothes attributes (itemType == CLOTHES)
  clothesStyleCode String?       @map("clothes_style_code")  @db.VarChar(100)
  clothesSize      String?       @map("clothes_size")        @db.VarChar(50)
  clothesSizeLabel String?       @map("clothes_size_label")  @db.VarChar(100)
  clothesColor     String?       @map("clothes_color")       @db.VarChar(100)
  clothesGender    ClothesGender? @map("clothes_gender")
```

Also add the enum above the `Item` model:

```prisma
enum ClothesGender {
  MEN
  WOMEN
  UNISEX
  KIDS
}
```

- [ ] **Step 3: Update schema.prisma — Module enum**

In the `enum Module` block, add `ITEM_PRICES` after `OWNER_DASHBOARD`:

```prisma
  ITEM_PRICES
```

- [ ] **Step 4: Apply migration to local DB**

```bash
cd backend
npx prisma migrate resolve --applied 20260417000002_phase02_item_type_attrs_client_tier
# OR if starting fresh: npx prisma db push
```

If using `db push` (dev-only):
```bash
npx prisma db push
```

Expected: no errors, DB columns exist.

- [ ] **Step 5: Regenerate Prisma client**

```bash
cd backend
npx prisma generate
```

Expected: output says "Generated Prisma Client".

- [ ] **Step 6: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/20260417000002_phase02_item_type_attrs_client_tier/
git commit -m "db: add item type-attr columns, client tier, ITEM_PRICES module (phase 02)"
```

---

## Task 2: `pricingService.js` — Single Source of Truth for Tier Resolution

**Files:**
- Create: `backend/services/pricingService.js`

- [ ] **Step 1: Write the failing test (pricing logic)**

In `backend/tests/phase-02-items-clients.test.js`, add this section (create the file):

```js
/**
 * Phase 02 — Items & Clients
 * Run: node backend/tests/phase-02-items-clients.test.js [BASE_URL] [ADMIN_TOKEN]
 */
const BASE_URL    = process.argv[2] || process.env.BASE_URL    || "http://localhost:3001";
const ADMIN_TOKEN = process.argv[3] || process.env.ADMIN_TOKEN || process.env.TOKEN || "";

const GREEN = "\x1b[32m", RED = "\x1b[31m", YELLOW = "\x1b[33m", CYAN = "\x1b[36m", BOLD = "\x1b[1m", RESET = "\x1b[0m";
let passed = 0, failed = 0;
const results = [];

const req = async (method, path, body, token) => {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let data;
  try { data = res.headers.get("content-type")?.includes("json") ? await res.json() : await res.text(); } catch { data = null; }
  return { status: res.status, data };
};

const pass = (name, d="") => { console.log(`  ${GREEN}PASS${RESET} ${name}${d ? "  "+YELLOW+d+RESET : ""}`); results.push({ name, result:"PASS" }); passed++; };
const fail = (name, d="") => { console.log(`  ${RED}FAIL${RESET} ${name}  ${RED}${d}${RESET}`); results.push({ name, result:"FAIL", detail:d }); failed++; };
const section = t => console.log(`\n${BOLD}${CYAN}── ${t} ${"─".repeat(Math.max(0,60-t.length))}${RESET}`);

// ─── pricingService unit-level via resolve-price endpoint ────────────────────
section("Pricing Service — resolve endpoint");

async function testPricingService() {
  // Create item
  const itemRes = await req("POST", "/api/items", { name: "TestPriceItem_"+Date.now(), price: 100, unit: "piece", itemType: "GENERIC" }, ADMIN_TOKEN);
  if (itemRes.status !== 201) { fail("create item for pricing test", JSON.stringify(itemRes.data)); return; }
  const itemId = itemRes.data.id;

  // Create client with RETAIL tier
  const clientRes = await req("POST", "/api/clients", { name: "TestRetailClient_"+Date.now(), phoneNumber: "01012345678", tier: "RETAIL" }, ADMIN_TOKEN);
  if (clientRes.status !== 201) { fail("create retail client", JSON.stringify(clientRes.data)); return; }
  const retailClientId = clientRes.data.id;

  // Create client with WHOLESALE tier
  const wsClientRes = await req("POST", "/api/clients", { name: "TestWholesaleClient_"+Date.now(), phoneNumber: "01112345679", tier: "WHOLESALE" }, ADMIN_TOKEN);
  if (wsClientRes.status !== 201) { fail("create wholesale client", JSON.stringify(wsClientRes.data)); return; }
  const wsClientId = wsClientRes.data.id;

  // No tier price → falls back to base price
  const r1 = await req("GET", `/api/clients/${retailClientId}/resolve-price/${itemId}`, null, ADMIN_TOKEN);
  if (r1.status === 200 && r1.data.effectivePrice == 100 && r1.data.source === "base_price") pass("no tier price → base_price (100)");
  else fail("no tier price → base_price", JSON.stringify(r1.data));

  // Add WHOLESALE tier price
  const tpRes = await req("POST", `/api/items/${itemId}/tier-prices`, [{ tier: "WHOLESALE", price: 80 }], ADMIN_TOKEN);
  if (tpRes.status !== 200) { fail("upsert tier price", JSON.stringify(tpRes.data)); return; }

  // RETAIL client still gets base price (no RETAIL tier price set)
  const r2 = await req("GET", `/api/clients/${retailClientId}/resolve-price/${itemId}`, null, ADMIN_TOKEN);
  if (r2.status === 200 && r2.data.effectivePrice == 100 && r2.data.source === "base_price") pass("RETAIL client → base_price when no RETAIL tier price");
  else fail("RETAIL client → base_price", JSON.stringify(r2.data));

  // WHOLESALE client gets tier price
  const r3 = await req("GET", `/api/clients/${wsClientId}/resolve-price/${itemId}`, null, ADMIN_TOKEN);
  if (r3.status === 200 && r3.data.effectivePrice == 80 && r3.data.source === "tier_price" && r3.data.tier === "WHOLESALE") pass("WHOLESALE client → tier_price (80)");
  else fail("WHOLESALE client → tier_price", JSON.stringify(r3.data));

  // Override tier
  const r4 = await req("GET", `/api/clients/${retailClientId}/resolve-price/${itemId}?overrideTier=WHOLESALE`, null, ADMIN_TOKEN);
  if (r4.status === 200 && r4.data.effectivePrice == 80 && r4.data.source === "tier_price") pass("override tier → WHOLESALE price");
  else fail("override tier → WHOLESALE price", JSON.stringify(r4.data));

  // Delete tier price
  const delTp = await req("DELETE", `/api/items/${itemId}/tier-prices/WHOLESALE`, null, ADMIN_TOKEN);
  if (delTp.status === 204) pass("delete tier price");
  else fail("delete tier price", JSON.stringify(delTp.data));

  // Cleanup
  await req("DELETE", `/api/items/${itemId}`, null, ADMIN_TOKEN);
  await req("DELETE", `/api/clients/${retailClientId}`, null, ADMIN_TOKEN);
  await req("DELETE", `/api/clients/${wsClientId}`, null, ADMIN_TOKEN);
}

// (tests run at bottom of file via main())
```

- [ ] **Step 2: Run test — confirm it fails (server not yet updated)**

```bash
node backend/tests/phase-02-items-clients.test.js http://localhost:3001 $ADMIN_TOKEN
```

Expected: FAIL on "create item for pricing test" (no itemType support yet) or similar. That's correct — the test is red.

- [ ] **Step 3: Create `backend/services/pricingService.js`**

```js
const prisma = require("../config/database");

/**
 * Resolve the effective price for a single (client, item) pair.
 * @param {number} clientId
 * @param {number} itemId
 * @param {string|null} overrideTier  "RETAIL" | "WHOLESALE" | null
 * @returns {{ effectivePrice: number, tier: string, source: "tier_price"|"base_price" }}
 */
async function resolveEffectivePrice(clientId, itemId, overrideTier = null) {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { tier: true },
  });
  if (!client) throw new Error("Client not found");

  const effectiveTier = overrideTier || client.tier;

  const tierPrice = await prisma.priceTier.findUnique({
    where: { itemId_tierName: { itemId, tierName: effectiveTier } },
    select: { price: true },
  });

  if (tierPrice) {
    return { effectivePrice: Number(tierPrice.price), tier: effectiveTier, source: "tier_price" };
  }

  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: { price: true },
  });
  if (!item) throw new Error("Item not found");

  return { effectivePrice: Number(item.price), tier: effectiveTier, source: "base_price" };
}

/**
 * Resolve prices for multiple items for one client.
 * @param {number} clientId
 * @param {number[]} itemIds
 * @param {string|null} overrideTier
 * @returns {Map<number, { effectivePrice: number, tier: string, source: string }>}
 */
async function resolveBulkPrices(clientId, itemIds, overrideTier = null) {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { tier: true },
  });
  if (!client) throw new Error("Client not found");

  const effectiveTier = overrideTier || client.tier;

  const [tierPrices, items] = await Promise.all([
    prisma.priceTier.findMany({
      where: { itemId: { in: itemIds }, tierName: effectiveTier },
      select: { itemId: true, price: true },
    }),
    prisma.item.findMany({
      where: { id: { in: itemIds } },
      select: { id: true, price: true },
    }),
  ]);

  const tierMap = new Map(tierPrices.map(tp => [tp.itemId, Number(tp.price)]));
  const baseMap = new Map(items.map(i => [i.id, Number(i.price)]));

  const result = new Map();
  for (const itemId of itemIds) {
    if (tierMap.has(itemId)) {
      result.set(itemId, { effectivePrice: tierMap.get(itemId), tier: effectiveTier, source: "tier_price" });
    } else {
      result.set(itemId, { effectivePrice: baseMap.get(itemId) ?? 0, tier: effectiveTier, source: "base_price" });
    }
  }
  return result;
}

module.exports = { resolveEffectivePrice, resolveBulkPrices };
```

- [ ] **Step 4: Commit**

```bash
git add backend/services/pricingService.js backend/tests/phase-02-items-clients.test.js
git commit -m "feat: add pricingService (resolveEffectivePrice + resolveBulkPrices)"
```

---

## Task 3: Backend — Items Route Overhaul

**Files:**
- Modify: `backend/routes/items.js`

This task rewrites the items route to support:
- Filtered list (`GET /api/items`)
- Type-aware GET by ID (includes `priceTiers`, FABRIC roll summary)
- Type-aware POST/PUT with Arabic validation errors
- Immutable-type guard
- Tier-price sub-routes
- PATCH toggles
- Arabic DELETE error listing blockers

- [ ] **Step 1: Write failing tests for items**

Add to `backend/tests/phase-02-items-clients.test.js` after the pricing section:

```js
// ─── Items — type creation & validation ────────────────────────────────────
section("Items — type-aware CRUD");

async function testItems() {
  // GENERIC item (no type-specific fields required)
  const g = await req("POST", "/api/items", {
    name: "GenericItem_"+Date.now(), price: 50, unit: "piece", itemType: "GENERIC"
  }, ADMIN_TOKEN);
  if (g.status === 201 && g.data.itemType === "GENERIC") pass("create GENERIC item");
  else fail("create GENERIC item", JSON.stringify(g.data));
  const genericId = g.data?.id;

  // FABRIC item — missing required fields → 400
  const fBad = await req("POST", "/api/items", {
    name: "FabricBad_"+Date.now(), price: 30, unit: "meter", itemType: "FABRIC"
  }, ADMIN_TOKEN);
  if (fBad.status === 400) pass("FABRIC missing attrs → 400");
  else fail("FABRIC missing attrs → 400", `got ${fBad.status}`);

  // FABRIC item — all required fields
  const fGood = await req("POST", "/api/items", {
    name: "FabricGood_"+Date.now(), price: 30, unit: "meter", itemType: "FABRIC",
    fabricType: "Cotton", fabricColor: "White", fabricWidth: 1.5, fabricUnit: "meter"
  }, ADMIN_TOKEN);
  if (fGood.status === 201 && fGood.data.itemType === "FABRIC") pass("create FABRIC item with attrs");
  else fail("create FABRIC item", JSON.stringify(fGood.data));
  const fabricId = fGood.data?.id;

  // CLOTHES item — missing required fields → 400
  const cBad = await req("POST", "/api/items", {
    name: "ClothesBad_"+Date.now(), price: 70, unit: "piece", itemType: "CLOTHES"
  }, ADMIN_TOKEN);
  if (cBad.status === 400) pass("CLOTHES missing attrs → 400");
  else fail("CLOTHES missing attrs → 400", `got ${cBad.status}`);

  // CLOTHES item — all required fields
  const cGood = await req("POST", "/api/items", {
    name: "ClothesGood_"+Date.now(), price: 70, unit: "piece", itemType: "CLOTHES",
    clothesStyleCode: "ST-001", clothesSize: "M", clothesColor: "Blue", clothesGender: "MEN"
  }, ADMIN_TOKEN);
  if (cGood.status === 201 && cGood.data.itemType === "CLOTHES") pass("create CLOTHES item");
  else fail("create CLOTHES item", JSON.stringify(cGood.data));
  const clothesId = cGood.data?.id;

  // fabricGSM out of range → 400
  const fGsmBad = await req("POST", "/api/items", {
    name: "FabricGSMBad_"+Date.now(), price: 30, unit: "meter", itemType: "FABRIC",
    fabricType: "Cotton", fabricColor: "White", fabricWidth: 1.5, fabricUnit: "meter",
    fabricGsm: 5
  }, ADMIN_TOKEN);
  if (fGsmBad.status === 400) pass("fabricGsm < 10 → 400");
  else fail("fabricGsm < 10 → 400", `got ${fGsmBad.status}`);

  // fabricWidth out of range → 400
  const fWidthBad = await req("POST", "/api/items", {
    name: "FabricWidthBad_"+Date.now(), price: 30, unit: "meter", itemType: "FABRIC",
    fabricType: "Cotton", fabricColor: "White", fabricWidth: 15, fabricUnit: "meter"
  }, ADMIN_TOKEN);
  if (fWidthBad.status === 400) pass("fabricWidth > 10 → 400");
  else fail("fabricWidth > 10 → 400", `got ${fWidthBad.status}`);

  // GET by ID includes priceTiers
  const getItem = await req("GET", `/api/items/${genericId}`, null, ADMIN_TOKEN);
  if (getItem.status === 200 && Array.isArray(getItem.data.priceTiers)) pass("GET /:id includes priceTiers array");
  else fail("GET /:id priceTiers", JSON.stringify(getItem.data));

  // Tier price upsert
  const tp = await req("POST", `/api/items/${genericId}/tier-prices`, [{ tier: "WHOLESALE", price: 40 }], ADMIN_TOKEN);
  if (tp.status === 200) pass("upsert tier price");
  else fail("upsert tier price", JSON.stringify(tp.data));

  // GET by ID — FABRIC roll summary
  const getFabric = await req("GET", `/api/items/${fabricId}`, null, ADMIN_TOKEN);
  if (getFabric.status === 200 && getFabric.data.rollSummary !== undefined) pass("GET FABRIC includes rollSummary");
  else fail("GET FABRIC rollSummary", JSON.stringify(getFabric.data));

  // PATCH showInPos
  const patch1 = await req("PATCH", `/api/items/${genericId}/show-in-pos`, { showInPos: false }, ADMIN_TOKEN);
  if (patch1.status === 200 && patch1.data.showInPos === false) pass("PATCH showInPos false");
  else fail("PATCH showInPos", JSON.stringify(patch1.data));

  // PATCH reorderPoint
  const patch2 = await req("PATCH", `/api/items/${genericId}/reorder-point`, { reorderPoint: 25 }, ADMIN_TOKEN);
  if (patch2.status === 200 && patch2.data.reorderPoint === 25) pass("PATCH reorderPoint 25");
  else fail("PATCH reorderPoint", JSON.stringify(patch2.data));

  // Cleanup
  await req("DELETE", `/api/items/${genericId}`, null, ADMIN_TOKEN);
  await req("DELETE", `/api/items/${fabricId}`, null, ADMIN_TOKEN);
  await req("DELETE", `/api/items/${clothesId}`, null, ADMIN_TOKEN);
}
```

- [ ] **Step 2: Run — confirm FAIL**

```bash
node backend/tests/phase-02-items-clients.test.js http://localhost:3001 $ADMIN_TOKEN
```

Expected: FAILs on "create GENERIC item" (itemType not yet accepted on POST).

- [ ] **Step 3: Rewrite `backend/routes/items.js`**

Replace the entire file with:

```js
const express = require("express");
const router = express.Router();
const prisma = require("../config/database");
const {
  authenticateToken,
  requirePermission,
  requireCreatePermission,
  requireAnyPermission,
  requireSensitiveAccess,
} = require("../middleware/auth");
const { resolveEffectivePrice } = require("../services/pricingService");

router.use(authenticateToken);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validateTypeAttrs(itemType, body) {
  if (itemType === "FABRIC") {
    const missing = [];
    if (!body.fabricType)  missing.push("نوع القماش (fabricType)");
    if (!body.fabricColor) missing.push("لون القماش (fabricColor)");
    if (body.fabricWidth == null) missing.push("عرض القماش (fabricWidth)");
    if (!body.fabricUnit)  missing.push("وحدة القماش (fabricUnit)");
    if (missing.length) return `حقول القماش المطلوبة: ${missing.join("، ")}`;
    if (body.fabricWidth < 0 || body.fabricWidth > 10)
      return "عرض القماش يجب أن يكون بين 0 و 10 أمتار";
    if (body.fabricGsm != null && (body.fabricGsm < 10 || body.fabricGsm > 1000))
      return "كثافة القماش (GSM) يجب أن تكون بين 10 و 1000";
  }
  if (itemType === "CLOTHES") {
    const missing = [];
    if (!body.clothesStyleCode) missing.push("كود الموديل (clothesStyleCode)");
    if (!body.clothesSize && !body.clothesSizeLabel) missing.push("المقاس (clothesSize أو clothesSizeLabel)");
    if (!body.clothesColor)  missing.push("لون الملابس (clothesColor)");
    if (!body.clothesGender) missing.push("الجنس (clothesGender)");
    if (missing.length) return `حقول الملابس المطلوبة: ${missing.join("، ")}`;
    const validGenders = ["MEN", "WOMEN", "UNISEX", "KIDS"];
    if (!validGenders.includes(body.clothesGender))
      return `الجنس يجب أن يكون أحد القيم: ${validGenders.join(", ")}`;
  }
  return null;
}

function extractTypeAttrs(itemType, body) {
  if (itemType === "FABRIC") {
    return {
      fabricType:  body.fabricType  || null,
      fabricColor: body.fabricColor || null,
      fabricWidth: body.fabricWidth != null ? parseFloat(body.fabricWidth) : null,
      fabricUnit:  body.fabricUnit  || null,
      fabricGsm:   body.fabricGsm  != null ? parseInt(body.fabricGsm) : null,
      // Clear clothes attrs
      clothesStyleCode: null, clothesSize: null, clothesSizeLabel: null,
      clothesColor: null, clothesGender: null,
    };
  }
  if (itemType === "CLOTHES") {
    return {
      clothesStyleCode: body.clothesStyleCode || null,
      clothesSize:      body.clothesSize      || null,
      clothesSizeLabel: body.clothesSizeLabel || null,
      clothesColor:     body.clothesColor     || null,
      clothesGender:    body.clothesGender    || null,
      // Clear fabric attrs
      fabricType: null, fabricColor: null, fabricWidth: null,
      fabricUnit: null, fabricGsm: null,
    };
  }
  // ACCESSORY / GENERIC — clear all type-specific attrs
  return {
    fabricType: null, fabricColor: null, fabricWidth: null, fabricUnit: null, fabricGsm: null,
    clothesStyleCode: null, clothesSize: null, clothesSizeLabel: null, clothesColor: null, clothesGender: null,
  };
}

// ─── GET / — list with filters ─────────────────────────────────────────────
router.get("/", requireAnyPermission(["ITEMS", "CREATES_ITEMS", "POS", "PURCHASES"]), async (req, res) => {
  try {
    const { type, categoryId, supplierId, hasStock, showInPos, q, page = 1, limit = 200 } = req.query;

    const where = {};
    if (type) where.itemType = type;
    if (showInPos !== undefined) where.showInPos = showInPos === "true";

    if (categoryId) {
      where.categories = { some: { categoryId: parseInt(categoryId) } };
    }
    if (supplierId) {
      where.suppliers = { some: { supplierId: parseInt(supplierId) } };
    }
    if (hasStock === "true") {
      where.inventory = { some: { quantity: { gt: 0 } } };
    }
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { fabricColor: { contains: q } },
        { clothesStyleCode: { contains: q } },
        { clothesColor: { contains: q } },
      ];
    }

    const items = await prisma.item.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit),
      include: {
        suppliers: { include: { supplier: true } },
        categories: { include: { category: true } },
        inventory: true,
        priceTiers: true,
      },
    });

    res.json(items);
  } catch (error) {
    res.status(500).json({ error: "فشل جلب الأصناف", message: error.message });
  }
});

// ─── GET /:id ─────────────────────────────────────────────────────────────
router.get("/:id", requireAnyPermission(["ITEMS", "CREATES_ITEMS", "POS", "PURCHASES"]), async (req, res) => {
  try {
    const itemId = parseInt(req.params.id);
    const item = await prisma.item.findUnique({
      where: { id: itemId },
      include: {
        suppliers: { include: { supplier: true } },
        categories: { include: { category: true } },
        inventory: { include: { warehouse: true } },
        priceTiers: true,
      },
    });

    if (!item) return res.status(404).json({ error: "الصنف غير موجود" });

    // FABRIC: attach roll summary
    let rollSummary = null;
    if (item.itemType === "FABRIC") {
      const rolls = await prisma.fabricRoll.groupBy({
        by: ["warehouseId"],
        where: { itemId, status: "AVAILABLE" },
        _count: { id: true },
        _sum: { lengthMeters: true },
      });
      rollSummary = rolls.map(r => ({
        warehouseId: r.warehouseId,
        rollCount: r._count.id,
        totalMeters: Number(r._sum.lengthMeters ?? 0),
      }));
    }

    res.json({ ...item, rollSummary });
  } catch (error) {
    res.status(500).json({ error: "فشل جلب الصنف", message: error.message });
  }
});

// ─── POST / ───────────────────────────────────────────────────────────────
router.post("/", requireCreatePermission("CREATES_ITEMS"), async (req, res) => {
  try {
    const { name, price, costPrice, unit, reorderPoint, showInPos, suppliers, categories, itemType = "GENERIC" } = req.body;

    if (!name) return res.status(400).json({ error: "اسم الصنف مطلوب" });

    const validTypes = ["FABRIC", "CLOTHES", "ACCESSORY", "GENERIC"];
    if (!validTypes.includes(itemType))
      return res.status(400).json({ error: `نوع الصنف غير صحيح. القيم المقبولة: ${validTypes.join(", ")}` });

    const typeError = validateTypeAttrs(itemType, req.body);
    if (typeError) return res.status(400).json({ error: typeError });

    const typeAttrs = extractTypeAttrs(itemType, req.body);

    const item = await prisma.item.create({
      data: {
        name,
        price: parseFloat(price) || 0,
        costPrice: parseFloat(costPrice) || 0,
        unit: unit || "piece",
        reorderPoint: parseInt(reorderPoint) || 10,
        showInPos: showInPos !== false && showInPos !== "false",
        itemType,
        ...typeAttrs,
        suppliers: {
          create: suppliers?.map(id => ({ supplier: { connect: { id: parseInt(id) } } })) || [],
        },
        categories: {
          create: categories?.map(id => ({ category: { connect: { id: parseInt(id) } } })) || [],
        },
      },
      include: {
        suppliers: { include: { supplier: true } },
        categories: { include: { category: true } },
        priceTiers: true,
      },
    });

    res.status(201).json(item);
  } catch (error) {
    if (error.code === "P2002") {
      const target = error.meta?.target;
      if (target?.includes("name")) return res.status(400).json({ error: "اسم الصنف موجود بالفعل" });
      return res.status(400).json({ error: "قيمة مكررة: " + target });
    }
    res.status(500).json({ error: "فشل إنشاء الصنف", message: error.message });
  }
});

// ─── PUT /:id ─────────────────────────────────────────────────────────────
router.put("/:id", requireAnyPermission(["ITEMS", "CREATES_ITEMS"]), requireSensitiveAccess, async (req, res) => {
  try {
    const itemId = parseInt(req.params.id);
    const { name, price, costPrice, unit, reorderPoint, showInPos, suppliers, categories, itemType } = req.body;

    // Load current item to check type immutability
    const existing = await prisma.item.findUnique({
      where: { id: itemId },
      select: {
        itemType: true,
        _count: { select: { purchaseItems: true, saleItems: true, fabricRolls: true } },
      },
    });
    if (!existing) return res.status(404).json({ error: "الصنف غير موجود" });

    if (itemType && itemType !== existing.itemType) {
      const hasRefs = existing._count.purchaseItems > 0 || existing._count.saleItems > 0 || existing._count.fabricRolls > 0;
      if (hasRefs) {
        return res.status(400).json({ error: "لا يمكن تغيير نوع الصنف بعد استخدامه في مشتريات أو مبيعات أو لفات قماش" });
      }
    }

    const resolvedType = itemType || existing.itemType;
    if (itemType) {
      const typeError = validateTypeAttrs(resolvedType, req.body);
      if (typeError) return res.status(400).json({ error: typeError });
    }

    const typeAttrs = itemType ? extractTypeAttrs(resolvedType, req.body) : {};

    const item = await prisma.$transaction(async (tx) => {
      const updated = await tx.item.update({
        where: { id: itemId },
        data: {
          ...(name !== undefined && { name }),
          ...(price !== undefined && { price: parseFloat(price) }),
          ...(costPrice !== undefined && { costPrice: parseFloat(costPrice) }),
          ...(unit !== undefined && { unit }),
          ...(reorderPoint !== undefined && { reorderPoint: parseInt(reorderPoint) }),
          ...(showInPos !== undefined && { showInPos: showInPos !== false && showInPos !== "false" }),
          ...(itemType && { itemType }),
          ...typeAttrs,
        },
      });

      if (suppliers !== undefined) {
        await tx.itemSupplier.deleteMany({ where: { itemId } });
        if (suppliers.length > 0) {
          await tx.itemSupplier.createMany({
            data: suppliers.map(sid => ({ itemId, supplierId: parseInt(sid) })),
          });
        }
      }

      if (categories !== undefined) {
        await tx.itemCategory.deleteMany({ where: { itemId } });
        if (categories.length > 0) {
          await tx.itemCategory.createMany({
            data: categories.map(cid => ({ itemId, categoryId: parseInt(cid) })),
          });
        }
      }

      return tx.item.findUnique({
        where: { id: itemId },
        include: {
          suppliers: { include: { supplier: true } },
          categories: { include: { category: true } },
          priceTiers: true,
        },
      });
    });

    res.json(item);
  } catch (error) {
    if (error.code === "P2025") return res.status(404).json({ error: "الصنف غير موجود" });
    if (error.code === "P2002") return res.status(400).json({ error: "اسم الصنف موجود بالفعل" });
    res.status(500).json({ error: "فشل تحديث الصنف", message: error.message });
  }
});

// ─── DELETE /:id ──────────────────────────────────────────────────────────
router.delete("/:id", requirePermission("ITEMS"), requireSensitiveAccess, async (req, res) => {
  try {
    const itemId = parseInt(req.params.id);

    const item = await prisma.item.findUnique({
      where: { id: itemId },
      select: {
        _count: {
          select: {
            purchaseItems: true,
            saleItems: true,
            fabricRolls: true,
            bomItems: true,
            productionOrderItems: true,
            stockTransferItems: true,
          },
        },
      },
    });
    if (!item) return res.status(404).json({ error: "الصنف غير موجود" });

    const blockers = [];
    if (item._count.purchaseItems     > 0) blockers.push("مشتريات");
    if (item._count.saleItems         > 0) blockers.push("مبيعات");
    if (item._count.fabricRolls       > 0) blockers.push("لفات قماش");
    if (item._count.bomItems          > 0) blockers.push("قوائم المواد");
    if (item._count.productionOrderItems > 0) blockers.push("أوامر إنتاج");
    if (item._count.stockTransferItems > 0) blockers.push("تحويلات مخزن");

    if (blockers.length > 0) {
      return res.status(400).json({
        error: `لا يمكن حذف الصنف لأنه مرتبط بـ: ${blockers.join("، ")}`,
      });
    }

    await prisma.item.delete({ where: { id: itemId } });
    res.status(204).send();
  } catch (error) {
    if (error.code === "P2025") return res.status(404).json({ error: "الصنف غير موجود" });
    res.status(500).json({ error: "فشل حذف الصنف", message: error.message });
  }
});

// ─── POST /:id/tier-prices — upsert [{tier, price}] ──────────────────────
router.post("/:id/tier-prices", requirePermission("ITEM_PRICES"), async (req, res) => {
  try {
    const itemId = parseInt(req.params.id);
    const entries = req.body; // array of { tier, price }

    if (!Array.isArray(entries) || entries.length === 0)
      return res.status(400).json({ error: "أرسل مصفوفة [{tier, price}]" });

    const validTiers = ["RETAIL", "WHOLESALE"];
    for (const e of entries) {
      if (!validTiers.includes(e.tier))
        return res.status(400).json({ error: `قيمة الفئة غير صحيحة: ${e.tier}. المقبول: ${validTiers.join(", ")}` });
      if (e.price == null || isNaN(parseFloat(e.price)))
        return res.status(400).json({ error: "السعر مطلوب لكل فئة" });
    }

    const upserts = entries.map(e =>
      prisma.priceTier.upsert({
        where: { itemId_tierName: { itemId, tierName: e.tier } },
        update: { price: parseFloat(e.price), isActive: true },
        create: { itemId, tierName: e.tier, minQty: 1, price: parseFloat(e.price) },
      })
    );

    const result = await prisma.$transaction(upserts);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "فشل حفظ أسعار الفئات", message: error.message });
  }
});

// ─── DELETE /:id/tier-prices/:tier ───────────────────────────────────────
router.delete("/:id/tier-prices/:tier", requirePermission("ITEM_PRICES"), async (req, res) => {
  try {
    const itemId = parseInt(req.params.id);
    const tierName = req.params.tier;

    await prisma.priceTier.delete({
      where: { itemId_tierName: { itemId, tierName } },
    });
    res.status(204).send();
  } catch (error) {
    if (error.code === "P2025") return res.status(404).json({ error: "سعر الفئة غير موجود" });
    res.status(500).json({ error: "فشل حذف سعر الفئة", message: error.message });
  }
});

// ─── PATCH /:id/show-in-pos ───────────────────────────────────────────────
router.patch("/:id/show-in-pos", requireAnyPermission(["ITEMS", "CREATES_ITEMS"]), async (req, res) => {
  try {
    const itemId = parseInt(req.params.id);
    const { showInPos } = req.body;
    if (showInPos === undefined) return res.status(400).json({ error: "showInPos مطلوب" });

    const item = await prisma.item.update({
      where: { id: itemId },
      data: { showInPos: showInPos === true || showInPos === "true" },
    });
    res.json(item);
  } catch (error) {
    if (error.code === "P2025") return res.status(404).json({ error: "الصنف غير موجود" });
    res.status(500).json({ error: "فشل تحديث إظهار POS", message: error.message });
  }
});

// ─── PATCH /:id/reorder-point ─────────────────────────────────────────────
router.patch("/:id/reorder-point", requireAnyPermission(["ITEMS", "CREATES_ITEMS"]), async (req, res) => {
  try {
    const itemId = parseInt(req.params.id);
    const { reorderPoint } = req.body;
    if (reorderPoint === undefined) return res.status(400).json({ error: "reorderPoint مطلوب" });

    const item = await prisma.item.update({
      where: { id: itemId },
      data: { reorderPoint: parseInt(reorderPoint) },
    });
    res.json(item);
  } catch (error) {
    if (error.code === "P2025") return res.status(404).json({ error: "الصنف غير موجود" });
    res.status(500).json({ error: "فشل تحديث نقطة إعادة الطلب", message: error.message });
  }
});

module.exports = router;
```

- [ ] **Step 4: Run items tests — confirm PASS**

```bash
node backend/tests/phase-02-items-clients.test.js http://localhost:3001 $ADMIN_TOKEN
```

Expected: all "Items — type-aware CRUD" tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/routes/items.js
git commit -m "feat: items route — type-aware CRUD, tier prices, PATCH toggles, Arabic errors"
```

---

## Task 4: Backend — Clients Route Overhaul

**Files:**
- Modify: `backend/routes/clients.js`

- [ ] **Step 1: Write failing tests for clients**

Add to `backend/tests/phase-02-items-clients.test.js`:

```js
// ─── Clients — tier, phone, walk-in ──────────────────────────────────────
section("Clients — tier + walk-in protections");

async function testClients() {
  // Create RETAIL client (default)
  const r = await req("POST", "/api/clients", {
    name: "RetailCl_"+Date.now(), phoneNumber: "01012345000"
  }, ADMIN_TOKEN);
  if (r.status === 201 && r.data.tier === "RETAIL") pass("create client → default RETAIL tier");
  else fail("create client default RETAIL", JSON.stringify(r.data));
  const retailId = r.data?.id;

  // Create WHOLESALE client
  const w = await req("POST", "/api/clients", {
    name: "WholesaleCl_"+Date.now(), phoneNumber: "01112345001", tier: "WHOLESALE"
  }, ADMIN_TOKEN);
  if (w.status === 201 && w.data.tier === "WHOLESALE") pass("create WHOLESALE client");
  else fail("create WHOLESALE client", JSON.stringify(w.data));
  const wsId = w.data?.id;

  // Bad phone → 400
  const bad = await req("POST", "/api/clients", {
    name: "BadPhone_"+Date.now(), phoneNumber: "12345"
  }, ADMIN_TOKEN);
  if (bad.status === 400) pass("bad phone → 400");
  else fail("bad phone → 400", `got ${bad.status}`);

  // isWalkIn: true on create → 400
  const wiBad = await req("POST", "/api/clients", {
    name: "WalkInBad_"+Date.now(), phoneNumber: "-", isWalkIn: true
  }, ADMIN_TOKEN);
  if (wiBad.status === 400) pass("isWalkIn on create → 400");
  else fail("isWalkIn on create → 400", `got ${wiBad.status}`);

  // GET walk-in endpoint
  const wi = await req("GET", "/api/clients/walk-in", null, ADMIN_TOKEN);
  if (wi.status === 200 && wi.data.id) pass("GET /walk-in returns walk-in client");
  else fail("GET /walk-in", JSON.stringify(wi.data));
  const walkInId = wi.data?.id;

  // DELETE walk-in → 403
  const delWi = await req("DELETE", `/api/clients/${walkInId}`, null, ADMIN_TOKEN);
  if (delWi.status === 403) pass("DELETE walk-in → 403");
  else fail("DELETE walk-in → 403", `got ${delWi.status}`);

  // PUT walk-in → 403
  const putWi = await req("PUT", `/api/clients/${walkInId}`, { name: "hacked" }, ADMIN_TOKEN);
  if (putWi.status === 403) pass("PUT walk-in → 403");
  else fail("PUT walk-in → 403", `got ${putWi.status}`);

  // GET /:id includes salesSummary
  const getCl = await req("GET", `/api/clients/${retailId}`, null, ADMIN_TOKEN);
  if (getCl.status === 200 && getCl.data.salesSummary !== undefined) pass("GET /:id includes salesSummary");
  else fail("GET /:id salesSummary", JSON.stringify(getCl.data));

  // Cleanup
  await req("DELETE", `/api/clients/${retailId}`, null, ADMIN_TOKEN);
  await req("DELETE", `/api/clients/${wsId}`, null, ADMIN_TOKEN);
}
```

- [ ] **Step 2: Run — confirm FAIL**

```bash
node backend/tests/phase-02-items-clients.test.js http://localhost:3001 $ADMIN_TOKEN
```

Expected: FAILs on "create client → default RETAIL tier" (tier not returned yet).

- [ ] **Step 3: Rewrite `backend/routes/clients.js`**

Replace the entire file with:

```js
const express = require("express");
const router = express.Router();
const prisma = require("../config/database");
const {
  authenticateToken,
  requirePermission,
  requireCreatePermission,
  requireAnyPermission,
  requireSensitiveAccess,
} = require("../middleware/auth");
const { resolveEffectivePrice } = require("../services/pricingService");

router.use(authenticateToken);

// Phone validation: Egyptian format or "-" (walk-in only)
const PHONE_REGEX = /^(\+20|0020|0)?1[0125][0-9]{8}$/;
function validatePhone(phone, allowDash = false) {
  if (!phone) return null; // optional
  if (allowDash && phone === "-") return null;
  if (PHONE_REGEX.test(phone)) return null;
  return "رقم الهاتف يجب أن يكون مصرياً صحيحاً (مثل: 01xxxxxxxxx) أو يُترك فارغاً";
}

// ─── GET /walk-in — must be before /:id ──────────────────────────────────
router.get("/walk-in", requireAnyPermission(["CLIENTS", "POS", "SALES"]), async (req, res) => {
  try {
    const client = await prisma.client.findFirst({ where: { isWalkIn: true } });
    if (!client) return res.status(404).json({ error: "العميل النقدي غير موجود" });
    res.json(client);
  } catch (error) {
    res.status(500).json({ error: "فشل جلب العميل النقدي", message: error.message });
  }
});

// ─── GET / ────────────────────────────────────────────────────────────────
router.get("/", requireAnyPermission(["CLIENTS", "POS", "SALES"]), async (req, res) => {
  try {
    const { q, tier } = req.query;
    const where = {};
    if (tier) where.tier = tier;
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { phoneNumber: { contains: q } },
      ];
    }
    const clients = await prisma.client.findMany({
      where,
      orderBy: { createdAt: "asc" },
    });
    res.json(clients);
  } catch (error) {
    res.status(500).json({ error: "فشل جلب العملاء", message: error.message });
  }
});

// ─── GET /:id — includes salesSummary ────────────────────────────────────
router.get("/:id", requirePermission("CLIENTS"), async (req, res) => {
  try {
    const clientId = parseInt(req.params.id);
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) return res.status(404).json({ error: "العميل غير موجود" });

    const [saleCount, aggregate] = await Promise.all([
      prisma.sale.count({ where: { clientId, status: "COMPLETED" } }),
      prisma.sale.aggregate({
        where: { clientId, status: "COMPLETED" },
        _sum: { total: true },
        _max: { createdAt: true },
      }),
    ]);

    res.json({
      ...client,
      salesSummary: {
        count: saleCount,
        total: Number(aggregate._sum.total ?? 0),
        lastPurchaseDate: aggregate._max.createdAt,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "فشل جلب العميل", message: error.message });
  }
});

// ─── GET /:id/resolve-price/:itemId ──────────────────────────────────────
router.get("/:id/resolve-price/:itemId", requireAnyPermission(["CLIENTS", "POS", "SALES", "ITEM_PRICES"]), async (req, res) => {
  try {
    const clientId = parseInt(req.params.id);
    const itemId   = parseInt(req.params.itemId);
    const overrideTier = req.query.overrideTier || null;

    const result = await resolveEffectivePrice(clientId, itemId, overrideTier);
    res.json(result);
  } catch (error) {
    if (error.message === "Client not found") return res.status(404).json({ error: "العميل غير موجود" });
    if (error.message === "Item not found")   return res.status(404).json({ error: "الصنف غير موجود" });
    res.status(500).json({ error: "فشل حساب السعر", message: error.message });
  }
});

// ─── POST / ───────────────────────────────────────────────────────────────
router.post("/", requireCreatePermission("CREATES_CLIENTS"), async (req, res) => {
  try {
    const { name, phoneNumber, address, tier, checkIfExists, isWalkIn } = req.body;

    if (!name) return res.status(400).json({ error: "اسم العميل مطلوب" });
    if (isWalkIn) return res.status(400).json({ error: "لا يمكن إنشاء عميل نقدي يدوياً" });

    const phoneError = validatePhone(phoneNumber);
    if (phoneError) return res.status(400).json({ error: phoneError });

    if (checkIfExists && phoneNumber) {
      const existing = await prisma.client.findFirst({ where: { phoneNumber } });
      if (existing) return res.status(200).json({ ...existing, _isExisting: true });
    }

    const validTiers = ["RETAIL", "WHOLESALE"];
    const resolvedTier = (tier && validTiers.includes(tier)) ? tier : "RETAIL";

    const client = await prisma.client.create({
      data: { name, phoneNumber: phoneNumber || "", address: address || null, tier: resolvedTier },
    });
    res.status(201).json(client);
  } catch (error) {
    res.status(500).json({ error: "فشل إنشاء العميل", message: error.message });
  }
});

// ─── PUT /:id ─────────────────────────────────────────────────────────────
router.put("/:id", requireAnyPermission(["CLIENTS", "CREATES_CLIENTS", "POS", "SALES"]), async (req, res) => {
  try {
    const clientId = parseInt(req.params.id);

    const existing = await prisma.client.findUnique({ where: { id: clientId }, select: { isWalkIn: true } });
    if (!existing) return res.status(404).json({ error: "العميل غير موجود" });
    if (existing.isWalkIn) return res.status(403).json({ error: "لا يمكن تعديل العميل النقدي" });

    const { name, phoneNumber, address, tier } = req.body;
    const phoneError = validatePhone(phoneNumber);
    if (phoneError) return res.status(400).json({ error: phoneError });

    const validTiers = ["RETAIL", "WHOLESALE"];
    const client = await prisma.client.update({
      where: { id: clientId },
      data: {
        ...(name !== undefined && { name }),
        ...(phoneNumber !== undefined && { phoneNumber }),
        ...(address !== undefined && { address }),
        ...(tier && validTiers.includes(tier) && { tier }),
      },
    });
    res.json(client);
  } catch (error) {
    if (error.code === "P2025") return res.status(404).json({ error: "العميل غير موجود" });
    res.status(500).json({ error: "فشل تحديث العميل", message: error.message });
  }
});

// ─── DELETE /:id ──────────────────────────────────────────────────────────
router.delete("/:id", requirePermission("CLIENTS"), requireSensitiveAccess, async (req, res) => {
  try {
    const clientId = parseInt(req.params.id);

    const existing = await prisma.client.findUnique({
      where: { id: clientId },
      select: { isWalkIn: true, _count: { select: { sales: true } } },
    });
    if (!existing) return res.status(404).json({ error: "العميل غير موجود" });
    if (existing.isWalkIn) return res.status(403).json({ error: "لا يمكن حذف العميل النقدي" });
    if (existing._count.sales > 0) return res.status(400).json({ error: "لا يمكن حذف العميل لأن لديه مبيعات مسجلة" });

    await prisma.client.delete({ where: { id: clientId } });
    res.status(204).send();
  } catch (error) {
    if (error.code === "P2025") return res.status(404).json({ error: "العميل غير موجود" });
    res.status(500).json({ error: "فشل حذف العميل", message: error.message });
  }
});

module.exports = router;
```

- [ ] **Step 4: Run clients tests — confirm PASS**

```bash
node backend/tests/phase-02-items-clients.test.js http://localhost:3001 $ADMIN_TOKEN
```

Expected: all "Clients — tier + walk-in protections" tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/routes/clients.js
git commit -m "feat: clients route — tier, phone validation, walk-in guards, salesSummary, resolve-price"
```

---

## Task 5: Run Full Pricing Service Tests — Confirm All Green

- [ ] **Step 1: Wire up test `main()` runner at bottom of test file**

Add to the bottom of `backend/tests/phase-02-items-clients.test.js`:

```js
async function main() {
  console.log(`\n${BOLD}Phase 02 — Items & Clients Tests${RESET}`);
  console.log(`Base: ${BASE_URL}\nToken: ${ADMIN_TOKEN ? "provided" : "MISSING — tests will fail"}\n`);
  await testPricingService();
  await testItems();
  await testClients();
  console.log(`\n${BOLD}Results: ${GREEN}${passed} passed${RESET}, ${RED}${failed} failed${RESET}\n`);
  process.exit(failed > 0 ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run full suite**

```bash
node backend/tests/phase-02-items-clients.test.js http://localhost:3001 $ADMIN_TOKEN
```

Expected: all tests PASS, exit 0.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/phase-02-items-clients.test.js
git commit -m "test: phase 02 full test suite green"
```

---

## Task 6: Frontend — Update `itemService.js`

**Files:**
- Modify: `frontend/src/services/itemService.js`

- [ ] **Step 1: Replace `itemService.js`**

```js
import api from "./apiClient";

const ITEMS_URL = "/items";

const TYPE_ATTR_KEYS = [
  "fabricType","fabricColor","fabricWidth","fabricUnit","fabricGsm",
  "clothesStyleCode","clothesSize","clothesSizeLabel","clothesColor","clothesGender",
];

const toFrontend = (b) => ({
  id: b.id,
  name: b.name,
  code: b.code || b.id,
  price: b.price,
  costPrice: b.costPrice,
  unit: b.unit,
  reorderPoint: b.reorderPoint,
  showInPos: b.showInPos,
  itemType: b.itemType || "GENERIC",
  suppliers: b.suppliers?.map(s => s.supplier?.id ?? s) || [],
  categories: b.categories?.map(c => c.category?.id ?? c) || [],
  inventory: b.inventory || [],
  priceTiers: b.priceTiers || [],
  rollSummary: b.rollSummary || null,
  createdAt: b.createdAt,
  updatedAt: b.updatedAt,
  // type-specific attrs
  fabricType: b.fabricType || null,
  fabricColor: b.fabricColor || null,
  fabricWidth: b.fabricWidth ?? null,
  fabricUnit: b.fabricUnit || null,
  fabricGsm: b.fabricGsm ?? null,
  clothesStyleCode: b.clothesStyleCode || null,
  clothesSize: b.clothesSize || null,
  clothesSizeLabel: b.clothesSizeLabel || null,
  clothesColor: b.clothesColor || null,
  clothesGender: b.clothesGender || null,
});

const toBackend = (d) => ({
  name: d.name,
  price: Number(d.price) || 0,
  costPrice: Number(d.costPrice) || 0,
  unit: d.unit || "piece",
  reorderPoint: Number(d.reorderPoint ?? 10),
  showInPos: d.showInPos !== false,
  itemType: d.itemType || "GENERIC",
  suppliers: d.suppliers ? [...new Set(d.suppliers.map(id => parseInt(id)))].filter(id => !isNaN(id)) : [],
  categories: d.categories || [],
  // Pass all type attrs (backend ignores irrelevant ones or nulls them)
  fabricType: d.fabricType || null,
  fabricColor: d.fabricColor || null,
  fabricWidth: d.fabricWidth != null ? Number(d.fabricWidth) : null,
  fabricUnit: d.fabricUnit || null,
  fabricGsm: d.fabricGsm != null ? Number(d.fabricGsm) : null,
  clothesStyleCode: d.clothesStyleCode || null,
  clothesSize: d.clothesSize || null,
  clothesSizeLabel: d.clothesSizeLabel || null,
  clothesColor: d.clothesColor || null,
  clothesGender: d.clothesGender || null,
});

export const itemService = {
  async getAll(params = {}) {
    const data = await api.get(ITEMS_URL, { params });
    return data.map(toFrontend);
  },

  async getById(id) {
    const data = await api.get(`${ITEMS_URL}/${id}`);
    return toFrontend(data);
  },

  async create(itemData) {
    const data = await api.post(ITEMS_URL, toBackend(itemData));
    return toFrontend(data);
  },

  async update(id, updates) {
    const data = await api.put(`${ITEMS_URL}/${id}`, toBackend(updates));
    return toFrontend(data);
  },

  async delete(id) {
    await api.delete(`${ITEMS_URL}/${id}`);
    return true;
  },

  async upsertTierPrices(id, entries) {
    // entries: [{ tier: "WHOLESALE", price: 80 }]
    return api.post(`${ITEMS_URL}/${id}/tier-prices`, entries);
  },

  async deleteTierPrice(id, tier) {
    return api.delete(`${ITEMS_URL}/${id}/tier-prices/${tier}`);
  },

  async patchShowInPos(id, showInPos) {
    const data = await api.patch(`${ITEMS_URL}/${id}/show-in-pos`, { showInPos });
    return toFrontend(data);
  },

  async patchReorderPoint(id, reorderPoint) {
    const data = await api.patch(`${ITEMS_URL}/${id}/reorder-point`, { reorderPoint });
    return toFrontend(data);
  },
};
```

- [ ] **Step 2: Update `frontend/src/services/clientService.js`**

Replace the entire file:

```js
import api from "./apiClient";

const CLIENTS_URL = "/clients";

const toFrontend = (b) => ({
  id: b.id,
  name: b.name,
  phone: b.phoneNumber,
  address: b.address,
  tier: b.tier || "RETAIL",
  isWalkIn: b.isWalkIn || false,
  salesSummary: b.salesSummary || null,
  createdAt: b.createdAt,
  updatedAt: b.updatedAt,
  _isExisting: b._isExisting,
});

export const clientService = {
  async getAll(params = {}) {
    const data = await api.get(CLIENTS_URL, { params });
    return data.map(toFrontend);
  },

  async getById(id) {
    const data = await api.get(`${CLIENTS_URL}/${id}`);
    return toFrontend(data);
  },

  async getWalkIn() {
    const data = await api.get(`${CLIENTS_URL}/walk-in`);
    return toFrontend(data);
  },

  async create(clientData, options = {}) {
    const data = await api.post(CLIENTS_URL, {
      name: clientData.name,
      phoneNumber: clientData.phone || clientData.phoneNumber,
      address: clientData.address,
      tier: clientData.tier,
      checkIfExists: options.checkIfExists,
    });
    return toFrontend(data);
  },

  async update(id, updates) {
    const data = await api.put(`${CLIENTS_URL}/${id}`, {
      name: updates.name,
      phoneNumber: updates.phone || updates.phoneNumber,
      address: updates.address,
      tier: updates.tier,
    });
    return toFrontend(data);
  },

  async delete(id) {
    await api.delete(`${CLIENTS_URL}/${id}`);
    return true;
  },

  async resolvePrice(clientId, itemId, overrideTier = null) {
    const params = overrideTier ? { overrideTier } : {};
    return api.get(`${CLIENTS_URL}/${clientId}/resolve-price/${itemId}`, { params });
  },
};
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/services/itemService.js frontend/src/services/clientService.js
git commit -m "feat: itemService + clientService — type attrs, tier, tier-price methods"
```

---

## Task 7: Frontend — Type-Specific Sub-Form Components

**Files:**
- Create: `frontend/src/pages/items/FabricAttributesForm.jsx`
- Create: `frontend/src/pages/items/ClothesAttributesForm.jsx`

- [ ] **Step 1: Create `FabricAttributesForm.jsx`**

```jsx
import React from "react";

const InputField = ({ label, name, value, onChange, type = "text", required, min, max, step, placeholder }) => (
  <div className="space-y-2">
    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
      {label}{required && <span className="text-red-500 mr-1">*</span>}
    </label>
    <input
      className="w-full bg-background-light dark:bg-background-dark border-gray-200 dark:border-gray-600 rounded-xl py-2.5 px-4 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
      name={name}
      value={value ?? ""}
      onChange={onChange}
      type={type}
      required={required}
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
    />
  </div>
);

export default function FabricAttributesForm({ formData, onChange }) {
  return (
    <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-xl border border-blue-200 dark:border-blue-800">
      <p className="md:col-span-2 text-sm font-bold text-blue-700 dark:text-blue-300">خصائص القماش</p>

      <InputField label="نوع القماش" name="fabricType" value={formData.fabricType} onChange={onChange} required placeholder="مثال: قطن، بوليستر" />
      <InputField label="اللون" name="fabricColor" value={formData.fabricColor} onChange={onChange} required placeholder="مثال: أبيض، أحمر" />
      <InputField label="العرض (متر)" name="fabricWidth" value={formData.fabricWidth} onChange={onChange} type="number" required min={0} max={10} step={0.01} placeholder="0 - 10" />

      <div className="space-y-2">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
          وحدة القياس<span className="text-red-500 mr-1">*</span>
        </label>
        <select
          name="fabricUnit"
          value={formData.fabricUnit ?? ""}
          onChange={onChange}
          required
          className="w-full bg-background-light dark:bg-background-dark border-gray-200 dark:border-gray-600 rounded-xl py-2.5 px-4 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary">
          <option value="">اختر الوحدة</option>
          <option value="meter">متر</option>
          <option value="yard">يارد</option>
          <option value="kg">كيلو جرام</option>
        </select>
      </div>

      <InputField label="كثافة القماش GSM (اختياري)" name="fabricGsm" value={formData.fabricGsm} onChange={onChange} type="number" min={10} max={1000} step={1} placeholder="10 - 1000" />
    </div>
  );
}
```

- [ ] **Step 2: Create `ClothesAttributesForm.jsx`**

```jsx
import React from "react";

export default function ClothesAttributesForm({ formData, onChange }) {
  const SIZES = ["XS","S","M","L","XL","XXL","XXXL","CUSTOM"];
  const GENDERS = [
    { value: "MEN",    label: "رجالي" },
    { value: "WOMEN",  label: "حريمي" },
    { value: "UNISEX", label: "مشترك" },
    { value: "KIDS",   label: "أطفال" },
  ];

  return (
    <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-purple-50 dark:bg-purple-950/20 rounded-xl border border-purple-200 dark:border-purple-800">
      <p className="md:col-span-2 text-sm font-bold text-purple-700 dark:text-purple-300">خصائص الملابس</p>

      <div className="space-y-2">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
          كود الموديل<span className="text-red-500 mr-1">*</span>
        </label>
        <input
          className="w-full bg-background-light dark:bg-background-dark border-gray-200 dark:border-gray-600 rounded-xl py-2.5 px-4 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary"
          name="clothesStyleCode"
          value={formData.clothesStyleCode ?? ""}
          onChange={onChange}
          required
          placeholder="مثال: ST-001"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
          المقاس<span className="text-red-500 mr-1">*</span>
        </label>
        <select
          name="clothesSize"
          value={formData.clothesSize ?? ""}
          onChange={onChange}
          required
          className="w-full bg-background-light dark:bg-background-dark border-gray-200 dark:border-gray-600 rounded-xl py-2.5 px-4 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary">
          <option value="">اختر المقاس</option>
          {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {formData.clothesSize === "CUSTOM" && (
        <div className="md:col-span-2 space-y-2">
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
            وصف المقاس المخصص<span className="text-red-500 mr-1">*</span>
          </label>
          <input
            className="w-full bg-background-light dark:bg-background-dark border-gray-200 dark:border-gray-600 rounded-xl py-2.5 px-4 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary"
            name="clothesSizeLabel"
            value={formData.clothesSizeLabel ?? ""}
            onChange={onChange}
            required
            placeholder="مثال: 38 سم خصر"
          />
        </div>
      )}

      <div className="space-y-2">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
          اللون<span className="text-red-500 mr-1">*</span>
        </label>
        <input
          className="w-full bg-background-light dark:bg-background-dark border-gray-200 dark:border-gray-600 rounded-xl py-2.5 px-4 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary"
          name="clothesColor"
          value={formData.clothesColor ?? ""}
          onChange={onChange}
          required
          placeholder="مثال: أزرق"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
          الجنس<span className="text-red-500 mr-1">*</span>
        </label>
        <select
          name="clothesGender"
          value={formData.clothesGender ?? ""}
          onChange={onChange}
          required
          className="w-full bg-background-light dark:bg-background-dark border-gray-200 dark:border-gray-600 rounded-xl py-2.5 px-4 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary">
          <option value="">اختر الجنس</option>
          {GENDERS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
        </select>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/items/FabricAttributesForm.jsx frontend/src/pages/items/ClothesAttributesForm.jsx
git commit -m "feat: FabricAttributesForm + ClothesAttributesForm sub-form components"
```

---

## Task 8: Frontend — `TierPriceManager.jsx`

**Files:**
- Create: `frontend/src/pages/items/TierPriceManager.jsx`

- [ ] **Step 1: Create `TierPriceManager.jsx`**

```jsx
import React, { useState } from "react";
import { itemService } from "../../services/domainServices";

const TIERS = [
  { value: "RETAIL",    label: "تجزئة (Retail)" },
  { value: "WHOLESALE", label: "جملة (Wholesale)" },
];

export default function TierPriceManager({ itemId, priceTiers = [], onUpdate, canEdit }) {
  const [saving, setSaving] = useState(false);
  const [localPrices, setLocalPrices] = useState(
    TIERS.reduce((acc, t) => {
      const existing = priceTiers.find(p => p.tierName === t.value);
      acc[t.value] = existing ? String(existing.price) : "";
      return acc;
    }, {})
  );

  const handleChange = (tier, value) => {
    setLocalPrices(prev => ({ ...prev, [tier]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const entries = TIERS
        .filter(t => localPrices[t.value] !== "")
        .map(t => ({ tier: t.value, price: parseFloat(localPrices[t.value]) }));
      if (entries.length > 0) {
        await itemService.upsertTierPrices(itemId, entries);
      }
      if (onUpdate) onUpdate();
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (tier) => {
    if (!confirm(`حذف سعر ${tier}؟`)) return;
    try {
      await itemService.deleteTierPrice(itemId, tier);
      setLocalPrices(prev => ({ ...prev, [tier]: "" }));
      if (onUpdate) onUpdate();
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-bold text-gray-700 dark:text-gray-300">أسعار الفئات</p>
      {TIERS.map(t => {
        const existing = priceTiers.find(p => p.tierName === t.value);
        return (
          <div key={t.value} className="flex items-center gap-3">
            <span className="w-36 text-sm text-gray-600 dark:text-gray-400">{t.label}</span>
            <input
              type="number"
              step="0.01"
              min={0}
              disabled={!canEdit}
              value={localPrices[t.value]}
              onChange={e => handleChange(t.value, e.target.value)}
              placeholder="السعر"
              className="w-32 bg-background-light dark:bg-background-dark border-gray-200 dark:border-gray-600 rounded-xl py-2 px-3 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary disabled:opacity-50"
            />
            {canEdit && existing && (
              <button
                onClick={() => handleDelete(t.value)}
                className="text-red-500 hover:text-red-700 text-sm font-medium">
                حذف
              </button>
            )}
          </div>
        );
      })}
      {canEdit && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-bold disabled:opacity-50">
          {saving ? "جاري الحفظ..." : "حفظ الأسعار"}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/items/TierPriceManager.jsx
git commit -m "feat: TierPriceManager inline component"
```

---

## Task 9: Frontend — Rebuild `ItemManager.jsx` with Type-Switching Form

**Files:**
- Modify: `frontend/src/pages/items/ItemManager.jsx`

- [ ] **Step 1: Rewrite `ItemManager.jsx`**

Replace the entire file:

```jsx
import React, { useState, useEffect } from "react";
import GenericPageManager from "../../components/shared/GenericPageManager";
import { itemService, supplierService, categoryService } from "../../services/domainServices";
import AuthService from "../../services/authService";
import FabricAttributesForm from "./FabricAttributesForm";
import ClothesAttributesForm from "./ClothesAttributesForm";
import TierPriceManager from "./TierPriceManager";

const ITEM_TYPES = [
  { value: "GENERIC",   label: "عام", icon: "inventory_2" },
  { value: "ACCESSORY", label: "إكسسوار", icon: "diamond" },
  { value: "FABRIC",    label: "قماش", icon: "texture" },
  { value: "CLOTHES",   label: "ملابس", icon: "checkroom" },
];

const TYPE_LABELS = { GENERIC: "عام", ACCESSORY: "إكسسوار", FABRIC: "قماش", CLOTHES: "ملابس" };
const TYPE_COLORS = {
  GENERIC:   "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
  ACCESSORY: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  FABRIC:    "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  CLOTHES:   "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
};

export const ItemForm = ({ initialData, onClose, onSave, data, showToast }) => {
  const nextId = data?.length > 0 ? Math.max(...data.map(d => parseInt(d.id) || 0)) + 1 : 1;

  const [formData, setFormData] = useState({
    id: initialData?.id || nextId,
    name: initialData?.name || "",
    price: initialData?.price || "",
    costPrice: initialData?.costPrice || "",
    unit: initialData?.unit || "piece",
    reorderPoint: initialData?.reorderPoint ?? 10,
    showInPos: initialData?.showInPos ?? true,
    itemType: initialData?.itemType || "GENERIC",
    suppliers: initialData?.suppliers || [],
    categories: initialData?.categories || [],
    // Fabric
    fabricType: initialData?.fabricType || "",
    fabricColor: initialData?.fabricColor || "",
    fabricWidth: initialData?.fabricWidth ?? "",
    fabricUnit: initialData?.fabricUnit || "",
    fabricGsm: initialData?.fabricGsm ?? "",
    // Clothes
    clothesStyleCode: initialData?.clothesStyleCode || "",
    clothesSize: initialData?.clothesSize || "",
    clothesSizeLabel: initialData?.clothesSizeLabel || "",
    clothesColor: initialData?.clothesColor || "",
    clothesGender: initialData?.clothesGender || "",
  });

  const [availableSuppliers, setAvailableSuppliers] = useState([]);
  const [availableCategories, setAvailableCategories] = useState([]);
  const [keepOpen, setKeepOpen] = useState(false);
  const isEdit = !!initialData;
  const typeImmutable = isEdit && (
    (initialData?.purchaseItems?.length > 0) ||
    (initialData?.saleItems?.length > 0) ||
    (initialData?.fabricRolls?.length > 0)
  );

  const canEditPrices = AuthService.hasPermission("ITEM_PRICES");

  useEffect(() => {
    Promise.all([supplierService.getAll(), categoryService.getAll()]).then(([suppliers, categories]) => {
      setAvailableSuppliers(suppliers);
      setAvailableCategories(categories);
    });
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handleTypeChange = (newType) => {
    if (typeImmutable) return;
    setFormData(prev => ({ ...prev, itemType: newType }));
  };

  const toggleSupplier = (id) => setFormData(prev => ({
    ...prev,
    suppliers: prev.suppliers.includes(id) ? prev.suppliers.filter(s => s !== id) : [...prev.suppliers, id],
  }));

  const toggleCategory = (id) => setFormData(prev => ({
    ...prev,
    categories: prev.categories.includes(id) ? prev.categories.filter(c => c !== id) : [...prev.categories, id],
  }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!e.target.checkValidity()) {
      showToast?.("برجاء ملء جميع الحقول المطلوبة بشكل صحيح", "error");
      return;
    }
    await onSave(formData, !keepOpen);
    if (keepOpen) {
      setFormData(prev => ({ ...prev, id: parseInt(prev.id) + 1, name: "", price: "" }));
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="grid grid-cols-1 md:grid-cols-2 gap-6">

      {/* Type Selector */}
      <div className="md:col-span-2 space-y-2">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
          نوع الصنف{typeImmutable && <span className="text-xs text-orange-500 mr-2">(لا يمكن تغييره بعد الاستخدام)</span>}
        </label>
        <div className="flex flex-wrap gap-2">
          {ITEM_TYPES.map(t => (
            <button
              key={t.value}
              type="button"
              onClick={() => handleTypeChange(t.value)}
              disabled={typeImmutable}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 text-sm font-bold transition-all ${
                formData.itemType === t.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-primary/50"
              } disabled:opacity-50 disabled:cursor-not-allowed`}>
              <span className="material-icons-round text-sm">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ID (readonly) */}
      <div className="space-y-2">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">الرقم التعريفي</label>
        <input className="w-full bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-600 rounded-xl py-2.5 px-4 text-gray-500 cursor-not-allowed"
          name="id" value={formData.id} readOnly type="text" />
      </div>

      {/* Name */}
      <div className="space-y-2">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">اسم الصنف<span className="text-red-500 mr-1">*</span></label>
        <input className="w-full bg-background-light dark:bg-background-dark border-gray-200 dark:border-gray-600 rounded-xl py-2.5 px-4 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary"
          name="name" value={formData.name} onChange={handleChange} required maxLength={150} placeholder="أدخل اسم الصنف" />
      </div>

      {/* Price */}
      <div className="space-y-2">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">سعر البيع</label>
        <input className="w-full bg-background-light dark:bg-background-dark border-gray-200 dark:border-gray-600 rounded-xl py-2.5 px-4 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary text-right"
          name="price" value={formData.price} onChange={handleChange} type="number" step="0.01" min={0} max={999999.99} dir="ltr" placeholder="0.00" />
      </div>

      {/* Cost Price */}
      <div className="space-y-2">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">سعر التكلفة</label>
        <input className="w-full bg-background-light dark:bg-background-dark border-gray-200 dark:border-gray-600 rounded-xl py-2.5 px-4 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary text-right"
          name="costPrice" value={formData.costPrice} onChange={handleChange} type="number" step="0.01" min={0} dir="ltr" placeholder="0.00" />
      </div>

      {/* Unit */}
      <div className="space-y-2">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">الوحدة</label>
        <select className="w-full bg-background-light dark:bg-background-dark border-gray-200 dark:border-gray-600 rounded-xl py-2.5 px-4 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary"
          name="unit" value={formData.unit} onChange={handleChange}>
          <option value="piece">قطعة</option>
          <option value="meter">متر</option>
          <option value="kg">كيلو جرام</option>
          <option value="box">علبة</option>
        </select>
      </div>

      {/* Reorder Point */}
      <div className="space-y-2">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">نقطة إعادة الطلب</label>
        <input className="w-full bg-background-light dark:bg-background-dark border-gray-200 dark:border-gray-600 rounded-xl py-2.5 px-4 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary"
          name="reorderPoint" value={formData.reorderPoint} onChange={handleChange} type="number" min={0} step={1} placeholder="10" />
      </div>

      {/* showInPos */}
      <div className="space-y-2">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">إظهار في نقطة البيع</label>
        <label className="relative inline-flex items-center cursor-pointer gap-3 mt-3">
          <input type="checkbox" name="showInPos" checked={formData.showInPos} onChange={handleChange} className="sr-only peer" />
          <div className="relative w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{formData.showInPos ? "ظاهر" : "مخفي"}</span>
        </label>
      </div>

      {/* Type-specific sub-forms */}
      {formData.itemType === "FABRIC" && (
        <FabricAttributesForm formData={formData} onChange={handleChange} />
      )}
      {formData.itemType === "CLOTHES" && (
        <ClothesAttributesForm formData={formData} onChange={handleChange} />
      )}

      {/* Tier Prices (edit mode only, permission-gated) */}
      {isEdit && canEditPrices && (
        <div className="md:col-span-2 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
          <TierPriceManager
            itemId={formData.id}
            priceTiers={initialData?.priceTiers || []}
            canEdit={canEditPrices}
            onUpdate={() => {}}
          />
        </div>
      )}

      {/* Suppliers */}
      <div className="md:col-span-2 space-y-2">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">الموردين</label>
        <div className="bg-background-light dark:bg-background-dark border border-gray-200 dark:border-gray-600 rounded-xl p-4 max-h-48 overflow-y-auto">
          {availableSuppliers.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {availableSuppliers.map(s => (
                <label key={s.id} className="flex items-center gap-3 cursor-pointer p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg">
                  <input type="checkbox" checked={formData.suppliers.includes(s.id)} onChange={() => toggleSupplier(s.id)}
                    className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary" />
                  <span className="text-gray-700 dark:text-gray-200 font-medium">{s.name}</span>
                </label>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-2">لا يوجد موردين</p>
          )}
        </div>
      </div>

      {/* Categories */}
      <div className="md:col-span-2 space-y-2">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">التصنيفات</label>
        <div className="bg-background-light dark:bg-background-dark border border-gray-200 dark:border-gray-600 rounded-xl p-4 max-h-48 overflow-y-auto">
          {availableCategories.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {availableCategories.map(c => (
                <label key={c.id} className="flex items-center gap-3 cursor-pointer p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg">
                  <input type="checkbox" checked={formData.categories.includes(c.id)} onChange={() => toggleCategory(c.id)}
                    className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary" />
                  <span className="text-gray-700 dark:text-gray-200 font-medium">{c.name}</span>
                </label>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-2">لا توجد تصنيفات</p>
          )}
        </div>
      </div>

      {/* Buttons */}
      <div className="md:col-span-2 flex flex-col sm:flex-row justify-end gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
        <button type="button" onClick={onClose}
          className="w-full sm:w-auto px-6 py-3 rounded-xl border border-border-light dark:border-border-dark text-text-light dark:text-text-dark font-bold text-sm hover:bg-background-light dark:hover:bg-background-dark transition-all min-h-touch">
          إلغاء
        </button>
        {!isEdit && (
          <button type="submit" onClick={() => setKeepOpen(true)}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary dark:text-accent font-bold text-sm border border-primary/20 flex items-center justify-center gap-2 min-h-touch">
            <span className="material-icons-round text-lg">playlist_add</span>حفظ وإضافة آخر
          </button>
        )}
        <button type="submit" onClick={() => setKeepOpen(false)}
          className="w-full sm:w-auto px-6 py-3 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 min-h-touch">
          <span className="material-icons-round text-lg">save</span>
          {isEdit ? "حفظ التغييرات" : "حفظ وإغلاق"}
        </button>
      </div>
    </form>
  );
};

const ItemManager = () => {
  const [suppliersMap, setSuppliersMap] = useState({});
  const [categoriesMap, setCategoriesMap] = useState({});
  const [filterType, setFilterType] = useState("");

  useEffect(() => {
    Promise.all([supplierService.getAll(), categoryService.getAll()]).then(([suppliers, categories]) => {
      setSuppliersMap(Object.fromEntries(suppliers.map(s => [s.id, s.name])));
      setCategoriesMap(Object.fromEntries(categories.map(c => [c.id, c.name])));
    });
  }, []);

  const columns = [
    {
      header: "النوع",
      accessor: "itemType",
      render: (item) => (
        <span className={`px-2 py-1 rounded text-xs font-bold ${TYPE_COLORS[item.itemType] || TYPE_COLORS.GENERIC}`}>
          {TYPE_LABELS[item.itemType] || item.itemType}
        </span>
      ),
    },
    {
      header: "الصنف",
      accessor: "name",
      render: (item) => <div className="font-bold text-gray-900 dark:text-white">{item.name}</div>,
    },
    {
      header: "السعر",
      accessor: "price",
      render: (item) => <span className="font-bold text-primary">{item.price} ج.م</span>,
    },
    {
      header: "الوحدة",
      accessor: "unit",
      render: (item) => <span className="text-gray-500 text-sm">{item.unit}</span>,
    },
    {
      header: "POS",
      accessor: "showInPos",
      render: (item) => (
        <span className={`px-2 py-1 rounded text-xs font-bold ${item.showInPos ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300" : "bg-red-100 text-red-800"}`}>
          {item.showInPos ? "ظاهر" : "مخفي"}
        </span>
      ),
    },
    {
      header: "الموردين",
      accessor: "suppliers",
      render: (item) => (
        <div className="flex flex-wrap gap-1">
          {item.suppliers?.length > 0
            ? item.suppliers.map(id => (
                <span key={id} className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                  {suppliersMap[id] || id}
                </span>
              ))
            : <span className="text-gray-400 text-sm">-</span>}
        </div>
      ),
    },
  ];

  return (
    <GenericPageManager
      title="إدارة الأصناف"
      subtitle="المنتجات والأسعار والمخزون"
      icon="category"
      service={{
        ...itemService,
        getAll: () => itemService.getAll(filterType ? { type: filterType } : {}),
      }}
      columns={columns}
      FormComponent={ItemForm}
      emptyMessage="لا توجد أصناف مسجلة."
      hideAddButton={!AuthService.hasPermission("CREATES_ITEMS")}
      extraHeader={
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilterType("")}
            className={`px-3 py-1.5 rounded-xl text-sm font-bold transition-all ${!filterType ? "bg-primary text-white" : "border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-primary/50"}`}>
            الكل
          </button>
          {ITEM_TYPES.map(t => (
            <button key={t.value} onClick={() => setFilterType(t.value)}
              className={`px-3 py-1.5 rounded-xl text-sm font-bold transition-all ${filterType === t.value ? "bg-primary text-white" : "border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-primary/50"}`}>
              {t.label}
            </button>
          ))}
        </div>
      }
    />
  );
};

export default ItemManager;
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/items/ItemManager.jsx
git commit -m "feat: ItemManager — type-selector, sub-forms, tier prices, type filter"
```

---

## Task 10: Frontend — Update `ClientManager.jsx` with Tier Badge + Walk-in Lock

**Files:**
- Modify: `frontend/src/pages/clients/ClientManager.jsx`

- [ ] **Step 1: Rewrite `ClientManager.jsx`**

Replace the entire file:

```jsx
import React, { useState } from "react";
import GenericPageManager from "../../components/shared/GenericPageManager";
import { clientService } from "../../services/domainServices";
import AuthService from "../../services/authService";

const TIER_LABELS = { RETAIL: "تجزئة", WHOLESALE: "جملة" };
const TIER_COLORS = {
  RETAIL:    "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
  WHOLESALE: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
};

const PHONE_REGEX = /^(\+20|0020|0)?1[0125][0-9]{8}$/;
function validatePhone(phone) {
  if (!phone || phone === "-") return null;
  if (PHONE_REGEX.test(phone)) return null;
  return "رقم الهاتف يجب أن يكون مصرياً صحيحاً (مثل: 01xxxxxxxxx)";
}

export const ClientForm = ({ initialData, onClose, onSave, data, showToast }) => {
  const nextId = data?.length > 0 ? Math.max(...data.map(d => parseInt(d.id) || 0)) + 1 : 1;
  const isWalkIn = !!initialData?.isWalkIn;

  const [formData, setFormData] = useState({
    id: initialData?.id || nextId,
    name: initialData?.name || "",
    phone: initialData?.phone || "",
    address: initialData?.address || "",
    tier: initialData?.tier || "RETAIL",
  });
  const [keepOpen, setKeepOpen] = useState(false);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!e.target.checkValidity()) {
      showToast?.("برجاء ملء جميع الحقول المطلوبة", "error");
      return;
    }
    const phoneError = validatePhone(formData.phone);
    if (phoneError) { showToast?.(phoneError, "error"); return; }

    await onSave(formData, !keepOpen);
    if (keepOpen) {
      setFormData(prev => ({ ...prev, id: parseInt(prev.id) + 1, name: "", phone: "", address: "" }));
    }
  };

  const fieldClass = (disabled) =>
    `w-full border-gray-200 dark:border-gray-600 rounded-xl py-2.5 px-4 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow ${
      disabled
        ? "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-not-allowed"
        : "bg-background-light dark:bg-background-dark"
    }`;

  return (
    <form onSubmit={handleSubmit} noValidate className="grid grid-cols-1 gap-6">
      {isWalkIn && (
        <div className="flex items-center gap-2 p-3 bg-orange-50 dark:bg-orange-950/20 rounded-xl border border-orange-200 dark:border-orange-800">
          <span className="material-icons-round text-orange-500">lock</span>
          <span className="text-sm text-orange-700 dark:text-orange-300 font-medium">هذا العميل النقدي — لا يمكن تعديله</span>
        </div>
      )}

      <div className="space-y-2">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">الرقم التعريفي</label>
        <input className={fieldClass(true)} name="id" value={formData.id} readOnly type="text" />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
          اسم العميل{!isWalkIn && <span className="text-red-500 mr-1">*</span>}
        </label>
        <input className={fieldClass(isWalkIn)} name="name" value={formData.name} onChange={handleChange}
          required={!isWalkIn} disabled={isWalkIn} maxLength={100} placeholder="أدخل اسم العميل" />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">رقم الهاتف</label>
        <input className={fieldClass(isWalkIn)} name="phone" value={formData.phone} onChange={handleChange}
          disabled={isWalkIn} dir="ltr" placeholder="01xxxxxxxxx" type="tel" maxLength={14} />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">العنوان</label>
        <textarea className={fieldClass(isWalkIn)} name="address" value={formData.address} onChange={handleChange}
          disabled={isWalkIn} placeholder="أدخل عنوان العميل (اختياري)" rows={3} maxLength={200} />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">فئة العميل</label>
        <select className={fieldClass(isWalkIn)} name="tier" value={formData.tier} onChange={handleChange} disabled={isWalkIn}>
          <option value="RETAIL">تجزئة (Retail)</option>
          <option value="WHOLESALE">جملة (Wholesale)</option>
        </select>
      </div>

      {!isWalkIn && (
        <div className="flex flex-col sm:flex-row justify-end gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
          <button type="button" onClick={onClose}
            className="w-full sm:w-auto px-6 py-3 rounded-xl border border-border-light dark:border-border-dark text-text-light dark:text-text-dark font-bold text-sm hover:bg-background-light dark:hover:bg-background-dark transition-all min-h-touch">
            إلغاء
          </button>
          {!initialData && (
            <button type="submit" onClick={() => setKeepOpen(true)}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary dark:text-accent font-bold text-sm border border-primary/20 flex items-center justify-center gap-2 min-h-touch">
              <span className="material-icons-round text-lg">playlist_add</span>حفظ وإضافة آخر
            </button>
          )}
          <button type="submit" onClick={() => setKeepOpen(false)}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 min-h-touch">
            <span className="material-icons-round text-lg">save</span>
            {initialData ? "حفظ التغييرات" : "حفظ وإغلاق"}
          </button>
        </div>
      )}
      {isWalkIn && (
        <button type="button" onClick={onClose}
          className="w-full px-6 py-3 rounded-xl border border-border-light dark:border-border-dark text-text-light dark:text-text-dark font-bold text-sm hover:bg-background-light dark:hover:bg-background-dark transition-all min-h-touch">
          إغلاق
        </button>
      )}
    </form>
  );
};

const ClientManager = () => {
  const [filterTier, setFilterTier] = useState("");

  const columns = [
    {
      header: "العميل",
      accessor: "name",
      render: (item) => (
        <div className="flex items-center gap-2">
          {item.isWalkIn && <span className="material-icons-round text-orange-400 text-sm">lock</span>}
          <span className="font-bold text-gray-900 dark:text-white">{item.name}</span>
        </div>
      ),
    },
    {
      header: "الفئة",
      accessor: "tier",
      render: (item) => (
        <span className={`px-2 py-1 rounded text-xs font-bold ${TIER_COLORS[item.tier] || TIER_COLORS.RETAIL}`}>
          {TIER_LABELS[item.tier] || item.tier}
        </span>
      ),
    },
    {
      header: "رقم الهاتف",
      accessor: "phone",
      render: (item) => <span dir="ltr" className="text-gray-600 dark:text-gray-300">{item.phone || "-"}</span>,
    },
    {
      header: "العنوان",
      accessor: "address",
      render: (item) => <span className="text-gray-600 dark:text-gray-400 text-sm">{item.address || "-"}</span>,
    },
  ];

  return (
    <GenericPageManager
      title="إدارة العملاء"
      subtitle="قاعدة بيانات العملاء"
      icon="groups"
      service={{
        ...clientService,
        getAll: () => clientService.getAll(filterTier ? { tier: filterTier } : {}),
      }}
      columns={columns}
      FormComponent={ClientForm}
      emptyMessage="لا يوجد عملاء مسجلين."
      hideAddButton={!AuthService.hasPermission("CREATES_CLIENTS")}
      extraHeader={
        <div className="flex gap-2">
          <button onClick={() => setFilterTier("")}
            className={`px-3 py-1.5 rounded-xl text-sm font-bold transition-all ${!filterTier ? "bg-primary text-white" : "border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400"}`}>
            الكل
          </button>
          <button onClick={() => setFilterTier("RETAIL")}
            className={`px-3 py-1.5 rounded-xl text-sm font-bold transition-all ${filterTier === "RETAIL" ? "bg-primary text-white" : "border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400"}`}>
            تجزئة
          </button>
          <button onClick={() => setFilterTier("WHOLESALE")}
            className={`px-3 py-1.5 rounded-xl text-sm font-bold transition-all ${filterTier === "WHOLESALE" ? "bg-primary text-white" : "border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400"}`}>
            جملة
          </button>
        </div>
      }
    />
  );
};

export default ClientManager;
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/clients/ClientManager.jsx
git commit -m "feat: ClientManager — tier badge, walk-in lock, tier filter"
```

---

## Task 11: Final Verification

- [ ] **Step 1: Run full backend test suite**

```bash
node backend/tests/phase-02-items-clients.test.js http://localhost:3001 $ADMIN_TOKEN
```

Expected: all tests PASS, exit code 0.

- [ ] **Step 2: Manual smoke-test checklist (browser at http://localhost:5173)**

Open browser and verify:
1. Items page loads; type filter buttons appear (الكل / عام / إكسسوار / قماش / ملابس)
2. Add new item → FABRIC type → sub-form appears with fabric fields; save → success
3. Add new item → CLOTHES type → sub-form appears; save without required fields → toast error
4. Edit FABRIC item → type selector disabled if item has purchases/sales
5. Clients page shows فئة (tier) column with badge colors
6. Walk-in client row shows lock icon; click edit → lock banner shown, fields disabled
7. Create new client → tier dropdown works; WHOLESALE badge shows in list

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "phase(02): items-clients — type-switching items + tier pricing + pricing service + walk-in"
```

---

## Exit Criteria Checklist

- [ ] All 4 item types creatable via UI; type-specific validation works; Arabic errors
- [ ] Type immutable after references (400 + Arabic message)
- [ ] Tier prices add/edit/remove; resolve endpoint returns correct value
- [ ] Client CRUD with tier works; walk-in non-editable, non-deletable (UI + API)
- [ ] Arabic search on items (name/color/styleCode) and clients (name/phone)
- [ ] Permission matrix enforced (ITEM_PRICES gated)
- [ ] `pricingService` is the only place tier resolution happens
- [ ] Tests green
