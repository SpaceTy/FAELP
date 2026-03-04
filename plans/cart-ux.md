# Branch: feature/cart-ux

## Task: Better UX for adding to cart

### Context
Currently, the MaterialCard has a single "Material anfragen" button that adds 1 unit to the cart each click. Once added, it shows "Im Warenkorb (N)" but still only adds +1 per click. There's no way to adjust quantity or remove items without going to the cart page. The UX should be improved so users can manage cart items directly from the material card.

### Key Files
- `frontend/user/src/components/Material/MaterialCard.tsx` — the card component
- `frontend/user/src/hooks/useCart.ts` — cart signal with addItem, removeItem, updateQuantity, getItem
- `frontend/user/src/pages/MaterialsPage.tsx` — grid of material cards

### Changes

1. **Edit** `frontend/user/src/components/Material/MaterialCard.tsx`

   Replace the current single "Material anfragen" button with a two-state UI:

   **State A: Not in cart** (cartItem is undefined)
   - Show "Material anfragen" button (same as current)
   - Clicking adds 1 to cart and transitions to State B

   **State B: In cart** (cartItem exists)
   - Show an inline quantity control row:
     - "−" button (calls `updateQuantity(id, qty - 1)` — which auto-removes at 0)
     - Quantity display in the middle
     - "+" button (calls `addItem(id, 1)`)
   - The row should be styled to fit the card width, same height as the original button
   - Use existing design tokens: `bg-primary`, `text-secondary`, borders, etc.
   - The quantity buttons should have clear hover states

   Keep the "Details anzeigen" button below unchanged.

   Import `updateQuantity` and `removeItem` from `@/hooks/useCart` (already exports these).

2. **Verify** the `availableCount` constraint
   - The "+" button should be disabled when `cartItem.quantity >= material.availableCount`
   - Show a subtle indicator when the max is reached (e.g., the count turns amber or the + button grays out)

### Design Notes
- Keep it minimal — just replace the button area, don't redesign the whole card
- The quantity controls should feel native to the card, not bolted on
- Match the existing German language ("Material anfragen", not "Add to Cart")
