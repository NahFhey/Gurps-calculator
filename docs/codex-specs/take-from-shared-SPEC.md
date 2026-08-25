# Task: Take-from-Shared completion — bulk give + crafter attribution

## Background — read the design doc first

GURPS 4e campaign-management app (React 18 + TypeScript strict + Tailwind + Vite, Vitest/jsdom; Redux-style Immer store). **The design is fully decided — do not redesign.** Read `docs/TAKE_FROM_SHARED_COMPLETION_PLAN.md` and implement its decisions. This completes followup #3: the per-row "Give to…" quick-assign already shipped (see `src/components/inventory/views/PartyStashView.tsx`); you are adding bulk give and crafter attribution on top of it. Reference lanes for idiom and test style: the attunement and consumables lanes (both merged this week, `Codex-Authored` trailers in git log).

Summary: items-only (pooled materials/food are OUT — do not touch them); checkbox multi-select + contextual action bar in the party stash looping `retagItem`; optional `crafterId?` on `ItemInstance` written at crafting completion (completing shift's worker); crafting-sourced items preselect their crafter in both give controls; no dedicated claim view.

## Deliverables

### 1. Type — `src/types/campaign.ts` (additive only)

- `ItemInstance` gains `crafterId?: Id` (doc comment: character who completed the crafting project; absent for non-crafted items or unresolved workers).
- The `AcquiredItem` union's `equipment`/`other` variants gain optional `crafterId?: Id`.
- `ITEM_ACQUIRED` in `src/state/inventory/inventoryReducer.ts` carries `crafterId` onto the written item (additive; mind the acquire helper the consumables lane refactored — extend it, don't fork it).

### 2. Crafting completion — `src/components/downtime/views/CraftingWorkbench.tsx`

At the completion dispatch (`acquireItem(...)` in `handleProgress`, ~line 403): resolve the **completing shift's worker name to a character id** (a name→id lookup already exists in the component, ~line 149 — reuse that mechanism, do not add a new convention) and pass it as `crafterId`. If the name resolves to no character, omit the field. No other crafting behavior changes.

### 3. Bulk give — `src/components/inventory/views/PartyStashView.tsx` (+ router wiring if needed)

- Checkbox at the start of each **item** row in party-owned inventories (tools/currency rows unchanged).
- When ≥1 checked, a contextual action bar renders above the inventory list: "N selected — Give to [character ▾] [Give] [Clear]". Character select sorted by name, same styling idiom as the existing quick-assign select.
- **Give** loops the existing retag path once per selected item (dispatch `retagItem` + the same `inventoryLog.itemTransferred` logging the quick-assign path uses — reuse the router's existing `handleGiveItem` per item rather than duplicating log logic). Selection clears after give; items that vanished mid-selection are skipped silently (always-succeed spirit).
- Selection state is component-local; it resets when the view unmounts.

### 4. Preselection

In BOTH the per-row quick-assign select and the bulk bar's select: when every relevant item has `source === 'crafting'` and the same resolvable `crafterId` (for the per-row control: that item's crafterId), initialize the select to that character instead of the empty "Give to…" option. The user can still change it; choosing the preselected value and confirming behaves identically to a manual pick. Loot/gathered items and mixed bulk selections stay neutral (empty default).

### 5. Tests (minimum 14 new)

- Reducer: acquired equipment carries `crafterId`; absent when not provided; preserved through retag (and through the consumables snapshot/revert if those tests are cheap to extend — optional).
- CraftingWorkbench (component test with real store, following the existing crafting test file's approach if one exists, else the PartyStashView test style): completion writes the item with the completing shift's worker's characterId; unresolvable worker name → field absent.
- PartyStashView: checkboxes render on item rows only; bar appears at ≥1 selection with correct count; Give dispatches retag for each selected id and logs per item; selection clears after give; Clear empties selection without dispatching; preselection — crafting-sourced row preselects crafter, loot row stays neutral, mixed bulk selection stays neutral, uniform crafting selection preselects.

## Hard constraints

- `strict: true` — `npx tsc --noEmit` zero errors. **No new `as any`, no `@ts-ignore`/`@ts-expect-error`.** `import type` for types.
- God nodes (`campaign.ts`, `campaignStore.tsx`, `campaignReducer.ts`): strictly additive.
- **Do NOT touch pooled materials/food** — no give affordance, no ref moves, nothing. Items (`ItemInstance`) only.
- No new reducer actions — bulk is a client-side loop over the existing `retagItem`.
- Do not modify the Transfer Console, tools/currency flows, `CombatItem` library, or the consumables Items workflow.
- No new dependencies; do not run npm install (node_modules is a symlink, already populated).
- Preserve pre-existing bugs; report them.

## Definition of done — self-verify before finishing

```
npx tsc --noEmit
npx vitest run src/components/inventory src/components/__tests__/InventoryTab.test.tsx src/state/inventory src/components/downtime 2>&1 | tail -5
npx vitest run
```

All green (full suite baseline: whatever HEAD shows — run it first to record the number; expect baseline plus yours; server-integration EPERM in the sandbox is a known environment limit). Final summary: one paragraph on implementation choices — especially the completing-shift worker resolution and how preselection composes with the shipped quick-assign — plus any pre-existing bugs found.
