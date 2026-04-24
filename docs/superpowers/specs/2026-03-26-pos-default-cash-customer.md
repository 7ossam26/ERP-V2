# Default CASH Customer in POS

**Date:** 2026-03-26
**Status:** Approved

## Problem

When POS opens, no customer is reliably pre-selected. The cashier has to manually pick a customer for every transaction. Most POS transactions are cash/walk-in sales that should default to the "عميل نقدي" (Cash Customer, ID 1).

## Solution

### 1. Auto-select cash customer on load (POSPage.jsx)

In `fetchClients`, find "عميل نقدي" (or fallback to client ID 1) and auto-select it. Store in a ref for reuse after cart clear.

### 2. Reset to cash customer after clearCart

Instead of resetting `selectedClient` to `null`, reset to the stored cash customer ref.

### 3. Walk-in dropdown selects actual cash client

The "عميل نقدي (Walk-in)" dropdown option should select the actual client record instead of `null`, so the name displays correctly in the input.

## Files Changed

- `frontend/src/pages/pos/POSPage.jsx` — fetchClients, clearCart, walk-in dropdown
