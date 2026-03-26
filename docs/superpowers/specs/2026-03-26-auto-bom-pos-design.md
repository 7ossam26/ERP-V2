# Auto BOM Production in POS

**Date:** 2026-03-26
**Status:** Approved

## Problem

When a linked BOM item (mixture) has 0 warehouse stock but raw materials ARE available, the POS frontend blocks the user from adding it to cart. The backend already has auto-production logic (sales.js lines 793-885) but the frontend prevents the request from reaching it.

## Solution

### 1. Frontend — Calculate `autoProducible` for linked BOMs (POSPage.jsx)

In `loadInventory()`, for each linked BOM item, calculate max producible quantity from raw materials using the same formula as unlinked BOMs. Store as `autoProducible` field on the product. Display shows both actual stock and producible quantity.

### 2. Frontend — Allow BOM items with auto-production in cart

- `handleProductClick()`: Allow clicking when `quantity + autoProducible > 0`
- `addToCartWithQuantity()`: For linked BOMs with auto-production, check against combined availability (`quantity + autoProducible`)
- Product card: Show green "+X إنتاج تلقائي" indicator

### 3. Backend — Create ProductionOrder during auto-production (sales.js)

When auto-production fires during a sale, create `ProductionOrder` + `ProductionOrderItem` records for audit trail, matching the pattern in the BOM execute route (bom.js).

### No changes needed

- Database schema (no migrations)
- BOM routes
- Core auto-production logic (already works in sales.js)

## Files Changed

- `frontend/src/pages/pos/POSPage.jsx` — loadInventory, handleProductClick, addToCartWithQuantity, product card
- `backend/routes/sales.js` — ProductionOrder creation in auto-production block
