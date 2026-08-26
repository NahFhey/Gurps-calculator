# SPEC: Reagent Promotion — Inventory→Alchemy Bridge

## Background

React 18 + TypeScript (strict) + Vite GURPS campaign manager. Redux-style state:
`CampaignState` managed by `src/state/campaignReducer.ts` (Immer), domain reducers
in `src/state/<domain>/`, components access state via `useCampaignStore()` from
`src/state/campaignStore.tsx`. Full design concept: `docs/REAGENT_PROMOTION_PLAN.md`
(in this worktree) — READ IT FIRST; this spec implements it exactly.

The gap: gathered herbs land in party inventory (`Inventory.materials` /
`Inventory.food` on the party-owned `Inventory` record) but cannot become
brewable `AlchemyReagent` stock (`entities.alchemyReagents`) without manual GM
re-entry. You will build the one-way promotion bridge.

## Deliverable 1 — `inventory/reagentPromoted` action + reducer

In `src/state/inventory/inventoryActions.ts`:
- New constant `REAGENT_PROMOTED = 'inventory/reagentPromoted'`.
- New action type:
  ```ts
  export type ReagentPromotedAction = {
    type: typeof REAGENT_PROMOTED;
    payload: {
      source: { kind: 'material' | 'food'; name: string; type?: string; quantity: number };
      target:
        | { mode: 'existing'; reagentId: Id }
        | { mode: 'new'; reagent: AlchemyReagent };
    };
  };
  ```
  Owner is implicitly `'party'` (v1 is party-only; do NOT add an owner field —
  the plan scopes ownership out). Add to the `InventoryAction` union and the
  action-type exports; `isInventoryAction` must route it.
- Always-succeed semantics: no validation/rejection paths.

In `src/state/inventory/inventoryReducer.ts` (`handleInventoryAction`):
- Handle `REAGENT_PROMOTED` in ONE pass (atomic within the Immer produce):
  1. Find the party inventory record (mirror how the `MATERIALS_CONSUMED` /
     `FOODS_CONSUMED` handlers resolve the party owner) and the matching
     `materials` or `food` entry by name (+type when provided) per
     `payload.source.kind`. Decrement by `source.quantity`, clamping at zero;
     remove the entry when its quantity reaches zero — mirror the existing
     consume-handler semantics exactly.
  2. Upsert the reagent in `state.entities.alchemyReagents`:
     - `mode: 'existing'` → add `source.quantity` to that reagent's `quantity`.
       Touch NOTHING else on it (aspects, refinement, identificationLevel,
       falseProfile, identityId, etc. all stay as-is). If the reagentId doesn't
       exist, fall back to creating nothing reagent-side but still perform the
       decrement? NO — always-succeed means do the sensible thing: if the id is
       missing, skip the entire action (no decrement either) so stock never
       vanishes into nothing.
     - `mode: 'new'` → insert `payload.target.reagent` keyed by its id.
       The UI constructs the full reagent object (Deliverable 3); the reducer
       stores it verbatim.
  - If the source entry is missing or has zero quantity, promote what exists
    (clamp) — decrement to zero and add only the actually-available amount to
    the reagent (both modes). If nothing is available, the action is a no-op.

In `src/state/campaignStore.tsx`:
- Bound action creator `promoteReagent(payload)` following the existing
  `consumeMaterials` / `acquireItem` patterns (see lines ~394-410, ~571).

## Deliverable 2 — activity log helper

In `src/utils/activityLogger.ts`, extend `alchemyLog` (starts line ~38):
```ts
reagentPromoted: (reagentName: string, quantity: number) =>
  createActivityLogEntry('alchemy', 'reagent_promoted', {
    message: `${quantity} ${reagentName} promoted to lab stock`
  }),
```
Match the existing helper style exactly.

## Deliverable 3 — "Import from inventory" picker in the Manager ReagentsView

File: `src/components/manager/views/ReagentsView.tsx` (NOT
`src/components/alchemy/ReagentsView.tsx` — that one is a different, display
surface; do not touch it).

- Add an "Import from inventory" button next to the existing "New Reagent" /
  add button, opening a picker panel (same visual style as the existing add
  form — Tailwind, dark slate).
- The picker lists the PARTY inventory's `materials` and `food` entries (both,
  labeled with their kind) with name and on-hand quantity. Get them via
  `useCampaignStore()` directly inside the new picker component (house rule:
  direct store access; do NOT thread new props through ManagerTab).
- Selecting an entry shows:
  - Quantity input, default = full stack, clamped 1..on-hand.
  - Target choice: "Add to existing reagent" (dropdown of current reagents)
    vs "Create new reagent". Default: preselect "add to existing" with the
    matching reagent when one has the exact same name (case-insensitive),
    otherwise default "create new".
  - Create-new shows the SAME enrichment fields as the existing new-reagent
    form (aspects, potency, refinement, roles, hazards) — reuse/extract the
    existing form UI rather than duplicating it if reasonably cheap; a modest
    extraction of the form body into a shared subcomponent within this file is
    fine. Defaults per the plan: name pre-filled from the entry (editable),
    `refinement: 'crude'`, `identificationLevel: 4`, `analysisHistory: []`,
    `falseProfile: null`, `concentrationSteps: 0`, roles default `['Active']`
    — i.e. the same construction as `handleSaveReagent` (lines ~47-77), plus
    `source: 'Promoted from party stock: <entry name>'` and
    `quantity: <chosen amount>`.
- On confirm: dispatch ONE `promoteReagent(...)` via the bound action creator,
  then `actions.addLogEntry(alchemyLog.reagentPromoted(name, qty))` (mirror how
  other views log; check how ReagentsView/ManagerTab currently access
  `actions`). Close the picker.
- Add-to-existing logs with the TARGET reagent's name; create-new with the new
  reagent's name.
- No inventory-side UI anywhere. No changes to gathering code. No undo
  affordance. No schema/migration changes.

## Constraints

- `strict: true` must stay clean: `npx tsc --noEmit`. NO new `as any`. Use
  `import type` for type-only imports.
- Files you may edit: `src/state/inventory/inventoryActions.ts`,
  `src/state/inventory/inventoryReducer.ts`, `src/state/campaignStore.tsx`,
  `src/utils/activityLogger.ts`, `src/components/manager/views/ReagentsView.tsx`,
  plus NEW test files under the matching `__tests__/` dirs. If a type import
  needs re-exporting (e.g. `AlchemyReagent` into inventoryActions), import from
  `src/types/campaign.ts` directly. `src/types/views.ts` may be touched ONLY if
  a props type genuinely must change (it shouldn't — the picker uses the store
  directly).
- No new dependencies. Match surrounding code style. Business logic in the
  reducer, not the component.
- Do not commit to git.

## Definition of done — self-verify before finishing

1. New reducer tests in `src/state/inventory/__tests__/` (new file
   `reagentPromotionReducer.test.ts`), covering at minimum:
   - partial promotion decrements source and increments existing reagent
   - full-stack promotion removes the source entry
   - clamp: requesting more than on-hand promotes only what exists
   - source entry missing entirely → no-op (reagent unchanged)
   - `mode: 'existing'` with unknown reagentId → full no-op (source NOT decremented)
   - `mode: 'existing'` leaves every non-quantity field of the target untouched
     (assert aspects, refinement, identificationLevel, falseProfile survive)
   - `mode: 'new'` inserts the reagent verbatim
   - food-kind source works identically to material-kind
   - action routes through `isInventoryAction` and the campaign reducer
2. Component tests for the picker (new file in
   `src/components/manager/views/__tests__/` or alongside existing manager
   tests — follow the existing manager test location convention): renders party
   materials + food, name-match preselects add-to-existing, confirm dispatches
   the action and logs. Use the existing manager/inventory component test
   patterns (Testing Library + CampaignStoreProvider).
3. Run and pass, fixing failures yourself:
   - `npx vitest run src/state/inventory/ src/components/manager/`
   - `npx vitest run src/__tests__/combatIntegration.test.ts`
   - `npx tsc --noEmit`
4. Final summary: one paragraph on design decisions — especially the party-
   inventory resolution in the reducer, the no-op edge cases, and how much of
   the existing new-reagent form you reused.
