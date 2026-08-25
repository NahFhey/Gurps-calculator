# Task: Decompose InventoryTab.tsx + add per-item "Give to…" quick-assign in Party Stash

## Background

This is a GURPS 4e campaign-management app (React 18 + TypeScript strict + Tailwind + Vite, Vitest/jsdom for tests). `src/components/InventoryTab.tsx` is a 968-line monolith containing two views (a per-character/pools overview and `PartyStashView`, which is already a separate function in the same file). The app convention is **thin router + view components**: the router owns state/store access, views are pure (props in, JSX out). Reference implementations: `src/components/downtime/` and `src/components/manager/` (each has a `views/` directory).

The Party Stash view shows party-owned inventories; items can be moved to a character via the Transfer Console, which routes item→character transfers through the inventory bus action `actions.retagItem(itemId, characterId)` (see the existing `handleTransfer` in PartyStashView — this already works). What's missing is a one-click path: assigning a crafted/gathered item to a character currently takes Transfer → pick destination → Confirm. Roadmap followup "take from shared UI" (docs/INVENTORY_INTEGRATION_FOLLOWUPS.md #3) asks for a quicker affordance.

## Deliverables

### Part 1 — Decomposition (pure refactor)

1. **`src/components/inventory/views/`** — extract the views from InventoryTab into separate pure component files (at minimum `PartyStashView.tsx` and the overview view; also extract the Transfer Console panel into its own `TransferConsole.tsx` view component). Views receive all data and callbacks via props; no `useCampaignStore()` inside views.
2. **`src/components/inventory/InventoryTab.tsx`** — thin router: all store access, `useState`/`useMemo`, and handlers (including `handleTransfer`) live here or in a small colocated hook. Shared local types (e.g. `TransferState`) go in `src/components/inventory/types.ts`.
3. **`src/components/InventoryTab.tsx`** — becomes a re-export shim (`export { InventoryTab } from './inventory/InventoryTab'`) so existing consumers (`src/unified/UnifiedShell.tsx`) keep working. Do NOT edit consumer files.
4. The existing test file `src/components/__tests__/InventoryTab.test.tsx` must still pass unmodified, or with import-path-only adjustments if truly unavoidable (prefer unmodified — the shim should make that possible).

### Part 2 — Quick-assign feature (small, additive)

5. In `PartyStashView`, on each **item** row of a **party-owned** inventory, add a compact `Give to…` `<select>` (styled like the existing selects: `rounded-lg border border-slate-700 bg-slate-900 …`, but small enough to sit inline in the row) listing the party characters (from the `characters` record prop, sorted by name), default option `Give to…` with empty value. Choosing a character immediately:
   - calls `actions.retagItem(item.id, characterId)`
   - logs via `actions.addLogEntry(inventoryLog.itemTransferred(...))` with the same label helpers the Transfer Console path uses (source = the inventory's label, destination = the character's pack label `"<Name>'s Pack"`)
   - resets the select back to the empty option (component-local state or key trick).
   No default preselection, no confirmation dialog (retag is undo-free by design but non-destructive — the item moves, it can be moved back). Tools and currency rows are NOT changed (they have no bus action).
6. The existing Transfer button/console flow stays exactly as-is alongside the new control.

### Tests

7. Add `src/components/inventory/__tests__/PartyStashView.test.tsx`: quick-assign renders only on item rows of party inventories; selecting a character dispatches `retagItem` with the right ids and logs the transfer; select resets after use. Plus at least one render test for each extracted view. Minimum 10 new tests. Follow the style of `src/components/__tests__/InventoryTab.test.tsx`.

## Hard constraints

- `strict: true` TypeScript — `npx tsc --noEmit` must pass with zero errors.
- **No new `as any` casts. No `@ts-ignore` / `@ts-expect-error`.** Use `import type` for type-only imports.
- Part 1 is a pure refactor: zero behavior/markup change beyond extraction. Part 2 is the only intentional UI change.
- Do not modify anything under `src/state/` or `src/types/`, and no components outside `src/components/InventoryTab.tsx` + the new `src/components/inventory/` directory.
- Do not add dependencies. Do not run npm install (node_modules is a symlink, already populated).

## Definition of done — self-verify before finishing

Run these yourself from the repo root and fix failures before finishing:

```
npx tsc --noEmit
npx vitest run src/components/__tests__/InventoryTab.test.tsx src/components/inventory
npx vitest run src/state/inventory 2>/dev/null || npx vitest run src/state
```

All must pass. Then write a final summary: one paragraph on the decomposition slicing and the quick-assign wiring, plus anything that looked like a pre-existing bug (do NOT fix pre-existing bugs — report them).
