# Spec: Phase 15a — Inventory → Sheet Equipment Bridge (promotion with move semantics)

**Date:** 2026-09-01
**Repo:** GURPS VTT (React 18 + TypeScript strict + Vite, Redux-style state with Immer, Vitest/jsdom)
**Branch:** you are on `codex/equipment-bridge`. Commit nothing; leave all changes in the working tree.
**Design doc (read first, it is the authority on intent):** `docs/EQUIPMENT_BRIDGE_15A_PLAN.md` — 13 numbered decisions from a design session. This spec operationalizes them; if this spec and the plan conflict, flag it in your final summary rather than silently picking one.
**Pre-flight (required):** read the plan doc, then `src/types/campaign.ts` (ItemInstance ~L940, Inventory ~L963, AcquiredItem ~L998, CurrencyConfig ~L834), `src/types/characterSheet.ts` (Equipment ~L211, createDefaultGCSData ~L495), `src/state/inventory/inventoryReducer.ts` (findInventoryRecord, acquireInventoryItem, ITEM_CONSUMED, itemRetagged handlers), `src/components/inventory/InventoryTab.tsx` (Give-to quick-assign, ~L351), `src/components/character-sheet/EquipmentSection.tsx`, `src/components/character-panels/CharacterEquipmentPanel.tsx` (draft-save pattern), `src/components/crafting/CraftingWorkbench.tsx` (completion dispatch — locate `acquireItem(` near the "Craft complete!" alert), `src/utils/encumbrance.ts`. Line numbers are approximate — locate by name.

## Background (why)

Crafted, looted, and bought gear lands in `entities.inventories` as `ItemInstance`s — which carry no weight/category/stats — while character sheets read `Character.gcsData.equipment` (`Equipment`), which feeds encumbrance, per-location DR, and combat setup. There is zero linkage: a crafted sword tagged to a character appears in InventoryTab and nowhere else. This lane adds the bridge: **explicit promotion with move semantics**. An item lives in exactly one ledger at a time — inventory ("in the pack/stash") or sheet equipment ("on the body") — moved by a pair of atomic reducer actions. No mirroring, no sync.

## Architecture rules (non-negotiable)

- `strict: true` stays clean: `npx tsc --noEmit` → 0 errors. **No new `as any`.** `import type` for type-only imports.
- State logic in reducers/utils, never components. Immer drafts throughout.
- Reducer preconditions fail as silent no-ops (bus convention — no throws). Match `itemRetagged`'s idioms.
- Do not run `npm install`. Copy neighboring component patterns (Tailwind classes, testids, picker mechanics from the Give-to flow).

---

## Part 1 — Types

### 1a. `src/types/campaign.ts`

```ts
/** Sheet-domain stats an item carries while it is NOT on a character sheet.
 * Opaque cargo: the inventory system ferries it, never edits it. (Plan decision 3) */
export type EquipmentCargo = Omit<Equipment, 'id' | 'name' | 'quantity' | 'equipped' | 'sourceItem'>;
```

(Import the `Equipment` type from `./characterSheet` — check for import-cycle safety; if a cycle appears, define `EquipmentCargo` in `characterSheet.ts` and import it into `campaign.ts` instead.)

- `ItemInstance` gains `equipmentData?: EquipmentCargo`.
- The `AcquiredItem` `equipment | other` variant gains `equipmentData?: EquipmentCargo`; `acquireInventoryItem` copies it onto the created `ItemInstance` (on id-stacking merges, keep the existing instance's blob if present, else adopt the incoming one).

### 1b. `src/types/characterSheet.ts`

`Equipment` gains:

```ts
/** Inventory-domain provenance carried while the item is ON the sheet; restored at demotion.
 * `id` is the source ItemInstance id — used to re-stack onto a surviving remainder. (Plan decisions 3, 7) */
sourceItem?: {
  id: Id;
  crafterId?: Id;
  magical?: boolean;
  attuned?: boolean;
  source?: string;
};
```

`value`↔`cost` and `notes`↔`notes` map natively (do NOT duplicate them in `sourceItem`). Per plan decision 6, `Equipment.cost` is now denominated in the campaign base currency — same unit as `ItemInstance.value`, carried 1:1 both ways.

## Part 2 — Reducer actions (`src/state/inventory/`)

Two new bus actions, handled in the inventory reducer alongside `itemAcquired`/`itemRetagged` (they operate on the full campaign draft). Add action-type constants + creators in `inventoryActions.ts` following the existing pattern, and expose store helpers in `src/state/campaignStore.tsx` next to `acquireItem`/`retagItem` (names: `promoteItem`, `demoteItem`).

### `inventory/itemPromoted`

```ts
{ type: 'inventory/itemPromoted', payload: {
    itemId: Id;            // ItemInstance to promote (scan all inventories, like itemRetagged)
    characterId: Id;       // target character
    equipment: Omit<Equipment, 'id' | 'sourceItem'>;  // form output: name, quantity, weight, cost, category, stats, equipped, notes...
} }
```

Semantics (single Immer pass — atomicity is the point, plan decision 10):
1. Locate the `ItemInstance` by id across all inventories. Not found → silent no-op.
2. `characterId` must exist in `entities.characters`. Missing → silent no-op.
3. `quantity` (from `payload.equipment.quantity`) is clamped to `[1, instance.quantity ?? 1]`.
4. Decrement the instance by that quantity; splice it when it reaches 0 (ITEM_CONSUMED-style).
5. Ensure `character.gcsData` exists (`createDefaultGCSData()` — merge, don't clobber existing gcsData).
6. Push a new `Equipment` entry: `{ id: generated-unique, ...payload.equipment, sourceItem: { id: itemId, crafterId, magical, attuned, source } }` (provenance fields copied from the instance). Generate the id the way `EquipmentSection.handleAdd` does, but collision-proof it (e.g. include a random suffix) since promotion can run more than once in the same millisecond in tests.
7. **Ownership rule (plan decisions 8/9):** the reducer does not police which inventory the item came from — the UI enforces "character-owned items promote only to their owner; party-owned items pick a target" (one ownership verb: retag).

### `inventory/itemDemoted`

```ts
{ type: 'inventory/itemDemoted', payload: {
    characterId: Id;
    equipmentId: Id;       // Equipment entry on that character's sheet
    quantity?: number;     // default: full entry quantity; clamped to [1, entry.quantity]
} }
```

Semantics:
1. Locate the `Equipment` entry on `entities.characters[characterId].gcsData.equipment`. Missing character/gcsData/entry → silent no-op.
2. Decrement the entry by `quantity`; remove it when it reaches 0.
3. Destination is **the character's own inventory** (find-or-create via the existing ensure/find helpers — same mechanism `itemAcquired` uses for a `character` owner). Never the party stash (plan decision 8).
4. Reconstruct the `ItemInstance`: `name`, `quantity`, `value: entry.cost`, `notes`, provenance fields from `entry.sourceItem`, and `equipmentData` packed from the entry's sheet-domain fields (everything in `EquipmentCargo`).
5. **Id rule (avoids cross-inventory id collisions):**
   - If the destination inventory already holds an instance with id `sourceItem.id` → stack into it (`quantity +=`), refresh its `equipmentData` from the demoted entry.
   - Else if **no** inventory anywhere holds that id → recreate with `sourceItem.id` (stable identity).
   - Else (a remainder lives in some *other* inventory, e.g. partial promote from the party stash) → mint a fresh id.
   - No `sourceItem` at all (grandfathered sheet rows, plan decision 12) → mint a fresh id; provenance fields absent.

## Part 3 — Crafting stamps a starter blob (plan decision 5)

In `CraftingWorkbench`'s completion dispatch, extend the `acquireItem` payload with `equipmentData`:
- `weight: stats.finalWeight`
- `category`: map `templateType` → `'weapons' | 'ranged'` → `'weapon'`, `'armor'` → `'armor'`, anything else → `'general'`
- `damage` / `reach`: from the template when present (weapons)
- Include only defined fields — no `undefined` keys.

## Part 4 — UI

### 4a. Promote entry point — InventoryTab (plan decision 9)

Row action **"Equip…"** on item rows (`ItemInstance` rows only — not materials/food/tools), beside the existing Give-to quick-assign, reusing its picker mechanics:
- Party-owned row → character picker first (promotion to a character implies it becomes theirs — this is the one place promote crosses ownership, sanctioned because the GM picks the target explicitly), then the confirm form.
- Character-owned row → confirm form directly, target = owning character.

### 4b. Confirm form — new component `src/components/inventory/EquipItemModal.tsx` (plan decision 4)

A modal form producing `Omit<Equipment, 'id' | 'sourceItem'>`:
- Pre-fill: `name` ← instance name, `quantity` ← full stack (editable, clamped 1..stack — partial promotion, plan decision 7), `cost` ← `value ?? 0`, `notes` ← notes, everything else ← `equipmentData` when present, else `EquipmentSection.handleAdd` defaults (weight 0, category `'general'`, `equipped: true`).
- Fields: name, quantity, weight, cost, category select; category-dependent detail fields matching `EquipmentSection`'s expanded row (damage/reach for weapon; dr + drLocations checkboxes for armor; db for shield); notes.
- Confirm dispatches `promoteItem`; Cancel dispatches nothing. Keep it dumb — no business logic beyond clamping.
- Label the cost field with the campaign base currency unit: `entities.currencyConfig`'s primary currency (`primaryKey` → its `CurrencyDef`), falling back to `'cp'` when unset.

### 4c. Demote — EquipmentSection "send to pack"

Row action (icon button beside the existing remove/equipped controls) on each equipment row. **Draft reconciliation (important):** `CharacterEquipmentPanel` edits a local `draftGcsData` and saves it wholesale via `updateCharacter`; a naive store dispatch would be resurrected by the next draft save. The handler must do both: remove/decrement the row in the local draft **and** dispatch `demoteItem`, so draft and store agree. Whole-entry demote is fine for the UI (no quantity prompt); the reducer supports partial for future use.
- Relabel the cost column header from `$` to the campaign base currency unit (same lookup as 4b) — this is the plan-decision-6 relabel.

## Part 5 — Schema & migration

`CURRENT_SCHEMA_VERSION` `1.6.0` → `1.6.1` in `src/utils/schemaVersioning.ts` with a no-op migration entry (all new fields optional; nothing to transform). Follow the existing entry format exactly. No hydrate-time backfill (plan decision 12).

## Part 6 — Tests (Vitest, follow neighboring test idioms)

Reducer (`src/state/inventory/__tests__/`, extend or add alongside existing inventoryReducer tests):
1. Whole-stack promote: instance spliced, Equipment appended with correct fields + `sourceItem` provenance, `gcsData` created for a character that lacks it (and NOT clobbered for one that has it).
2. Partial promote: remainder keeps id and count; Equipment gets the promoted quantity.
3. Round trip: promote (with stats entered) → demote → instance restored with `equipmentData` blob, `value` = cost, provenance intact; blob then pre-fills a second promote (assert the blob content).
4. Demote re-stack: partial promote leaves remainder in the character's own inventory → demote stacks onto it (one row, summed quantity).
5. Demote id-collision: partial promote from the **party** stash → demote to the character mints a fresh id (party remainder untouched, no duplicate ids).
6. Grandfathered demote: Equipment with no `sourceItem` demotes to a fresh instance.
7. Always-succeed no-ops: unknown itemId, unknown characterId, unknown equipmentId — state unchanged (deep-equal).
8. `acquireInventoryItem` carries `equipmentData` through (and the stacking-merge rule).

Component (`__tests__` beside the components):
9. `EquipItemModal` pre-fills from `equipmentData` and clamps quantity to the stack.
10. CraftingWorkbench completion stamps `equipmentData` with `finalWeight` + mapped category (extend `src/components/crafting/__tests__/CraftingWorkbenchCompletion.test.tsx` — it already asserts the acquire payload through a real store).
11. EquipmentSection "send to pack" removes the row from the draft AND the store dispatch fires (mock or real store per neighboring tests).

Integration sanity: after a promote, `calculateCharacterEncumbrance(character)` (from `src/utils/encumbrance.ts`) reflects the new weight — one test proving the bullet's point.

## Definition of done — self-verify before finishing

1. `npx tsc --noEmit` → 0 errors.
2. `npx vitest run src/state/inventory src/components/inventory src/components/crafting/__tests__/CraftingWorkbenchCompletion.test.tsx src/components/character-sheet 2>&1` — all pass, including every pre-existing test (the inventory reducer suite is load-bearing; do not weaken existing assertions).
3. Also run `npx vitest run src/__tests__/combatIntegration.test.ts src/utils/__tests__/exportImport.test.ts` — serialization round-trip must survive the new optional fields.
4. Fix any failures yourself before finishing.

## Final summary requested

One paragraph on design decisions you made within the spec's degrees of freedom — especially the demote id rule implementation, the EquipmentCargo type placement (import-cycle outcome), and the CharacterEquipmentPanel draft reconciliation. List every file you created or modified.
