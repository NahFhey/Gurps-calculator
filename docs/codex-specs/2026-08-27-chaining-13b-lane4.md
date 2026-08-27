# SPEC: 13b Lane 4 — Activity Chaining (follow-on affordances)

**Date:** 2026-08-27
**Design source:** docs/ACTIVITY_SYSTEM_13B_PLAN.md, "Lane 4: Chaining" (decisions are final; do not re-litigate)

## Background (why)

When a gathering-type downtime task (fishing, foraging, mining) resolves, its haul
lands in the party inventory, but the player must manually navigate to Cooking,
Crafting, or the alchemy Reagents view to use it. Lane 4 adds **contextual next-step
buttons** to the resolved task's results footer. This is a UX shortcut only — no
automation, no new data pipeline. The mechanism is a one-shot `pendingIntent` in the
UI state slice, consumed and cleared by the target surface.

This codebase is strict TypeScript (`strict: true`, tsc must pass clean), Redux-style
state with Immer (`src/state/campaignReducer.ts`), components access state via
`useCampaignStore()` from `src/state/campaignStore.tsx`. **No new `as any` casts. No
new bridge contexts. No `@ts-ignore`.**

## Deliverable 1: `pendingIntent` in the UI slice

In `src/state/campaignReducer.ts`:

```ts
export type PendingIntent =
  | { kind: 'cook'; foodIds: string[] }
  | { kind: 'craft' }
  | { kind: 'promote'; sourceNames: string[] };
```

- Add `pendingIntent: PendingIntent | null` to `CampaignState['ui']` (initial value
  `null` in `createCampaignState`).
- Two new actions in the action union + reducer switch:
  - `{ type: 'setPendingIntent'; payload: PendingIntent }`
  - `{ type: 'clearPendingIntent' }`
- Expose `setPendingIntent(intent)` and `clearPendingIntent()` action creators in
  `src/state/campaignStore.tsx` (follow the existing pattern, e.g. `setActiveModule`
  at line ~353).

**Never persisted across reload:** the whole `CampaignState` (including `ui`) is
saved via `saveCampaignState` (`src/persistence/campaignStorage.ts`). On the load /
hydrate path, force `ui.pendingIntent = null` (find where the loaded state is
normalized — the same place other `ui` defaults are backfilled; if no such
normalization exists for `ui`, add a minimal one at load time). Also in
`src/utils/exportImport.ts` (~line 350) where the `public` export already resets
`gmModeEnabled`/`gmSessionUnlocked`, reset `pendingIntent: null` in BOTH the
`public` and `gm` serializations.

## Deliverable 2: stamp `kind` on gathering inventory deltas

In `src/types/downtime.ts`, extend `InventoryDelta` (line ~337) with an optional
field:

```ts
/** What sort of item this delta touches — used by chaining affordances */
kind?: 'food' | 'material';
```

Populate `kind` at **every** site that constructs `inventoryChanges` entries for
gathering-type tasks (fishing, foraging, mining). Known sites — sweep with
`rg -n "inventoryChanges" src/` and cover any others you find that belong to
fishing/foraging/mining (do NOT touch alchemy/crafting/rest/combat sites):

- `src/components/downtime/views/FishingResolutionPanel.tsx` (~lines 770–835; the
  food push and the material push already call `campaignActions.acquireItem` with
  `kind: 'food'` / `kind: 'material'` — mirror that value onto the delta)
- `src/components/downtime/views/ForagingResolutionPanel.tsx` (~line 266+)
- `src/components/downtime/views/MiningResolutionPanel.tsx` (~lines 351, 401)
- `src/components/downtime/views/MiningActivity.tsx` (~lines 210, 270)
- Any auto-resolve paths for fishing/foraging that build `TaskResults`.

This is additive and optional — old persisted results without `kind` simply render
no affordances. No schema version bump.

## Deliverable 3: `ChainingAffordances` shared component

New file `src/components/downtime/views/shared/ChainingAffordances.tsx`, exported
from `src/components/downtime/views/shared/index.ts`.

```ts
interface ChainingAffordancesProps {
  results: TaskResults;
}
export function ChainingAffordances({ results }: ChainingAffordancesProps): JSX.Element | null
```

- Uses `useCampaignStore()` directly for dispatch (this is the house pattern — the
  task cards stay presentational and just render `<ChainingAffordances results={task.results} />`).
- Compute `foodChanges` = entries with `kind === 'food' && quantity > 0`;
  `materialChanges` = entries with `kind === 'material' && quantity > 0`.
- Render `null` when `!results.success` or when both lists are empty.
- Buttons (secondary styling — match the muted button style used elsewhere in the
  task cards, e.g. gray `bg-gray-700 hover:bg-gray-600` small buttons; NOT primary
  blue), each shown only when its list is non-empty:
  - `foodChanges` → **"Cook with these"** → `setPendingIntent({ kind: 'cook', foodIds: foodChanges.map(c => c.itemId) })`
  - `materialChanges` → **"Craft with these"** → `setPendingIntent({ kind: 'craft' })`
  - `materialChanges` → **"Send to lab"** → `setPendingIntent({ kind: 'promote', sourceNames: materialChanges.map(c => c.itemName) })` **and** `setActiveModule('manager')` (same click handler, intent first).
- Add `data-testid="chaining-affordances"` on the container and stable testids per
  button (`chain-cook`, `chain-craft`, `chain-promote`).

Mount it in the three gathering task cards, directly below the existing
`task.results` block, only when `task.results` exists:

- `src/components/downtime/views/FishingTaskCard.tsx` (results block ~line 256)
- `src/components/downtime/views/ForagingTaskCard.tsx` (~line 210)
- `src/components/downtime/views/MiningTaskCard.tsx` (~line 176)

**Explicitly NOT offered** (per plan): alchemy task cards, crafting task cards,
rest, combat loot. Do not add the component anywhere else.

## Deliverable 4: DowntimePanel reacts to the intent

`src/components/downtime/DowntimePanel.tsx` holds the local `activeView` state
(`useState<DowntimeView>('tiles')`). Add a `useEffect` watching
`state.ui.pendingIntent` (read via `useCampaignStore()`):

- `kind === 'cook'` → `setActiveView('cooking')`
- `kind === 'craft'` → `setActiveView('crafting')`
- `kind === 'promote'` or `null` → do nothing.

**Do NOT clear the intent here** — the target surface consumes and clears it.

## Deliverable 5: target surfaces consume the intent (once)

Consumption contract for all three: a `useEffect` watching the intent; when the
matching kind is present, apply it, then dispatch `clearPendingIntent()` in the same
effect. Consumed exactly once — after clearing, a re-render must not re-apply.

### 5a. Cooking — `src/components/cooking/CookingTab.tsx`

If `pendingIntent?.kind === 'cook'`:
- `setView('create')`.
- For each `foodId` in the payload that exists in the `foods` list **with
  `quantity > 0`**, append a `SelectedIngredient` row (`{ id, foodId, amount }` —
  `src/components/cooking/types.ts` line ~31) to the `selected` state. Generate the
  row `id` and default `amount` exactly the way the existing manual add-ingredient
  handler in CookingTab does (reuse that handler or its logic — do not invent new
  defaults). Missing/depleted foodIds are skipped silently.
- Clear the intent.

### 5b. Crafting — `src/components/downtime/views/CraftingActivity.tsx`

If `pendingIntent?.kind === 'craft'`: set the crafting sub-view state to
`'designs'`, clear the intent. No prefill (per plan — the designs preview already
shows affordability).

### 5c. Promote — `src/components/ManagerTab.tsx` + `src/components/manager/views/ReagentsView.tsx`

- ManagerTab (local `view` state, `useState<ManagerView>('foodTypes')` line ~67): if
  `pendingIntent?.kind === 'promote'`, capture `sourceNames` into local state,
  `setView('reagents')`, clear the intent.
- Pass a new optional prop `initialPromotionSourceNames?: string[]` to
  `ReagentsView` (single prop, no drilling beyond this).
- ReagentsView: when the prop is provided (non-empty), open the
  `InventoryReagentPicker` (the existing promotion picker, line ~179) on mount, and
  preselect the **first** name in the list that matches a `PromotionSource` (match
  on `source.name === name`, sources already filter `quantity > 0`) via the existing
  `selectSource` path. If no name matches, open the picker with nothing selected.
  ManagerTab should clear its captured names after handing them off so re-opening
  the reagents tab later doesn't re-trigger the picker.

Note: the task cards live inside the `downtime` module and ManagerTab only mounts
when `ui.activeModule === 'manager'`, so mount-time consumption is sufficient there;
CookingTab/CraftingActivity may already be mounted, hence the effect-based watch.

## Testing (definition of done)

Vitest + jsdom, follow existing test patterns in the neighboring `__tests__`
directories (real-data-shaped fixtures, not idealized ones). Required coverage:

1. **Reducer** (`src/state/__tests__/`): `setPendingIntent` stores the intent;
   `clearPendingIntent` nulls it; the load/hydrate normalization forces
   `pendingIntent` to `null` even when the persisted blob contains one.
2. **ChainingAffordances** (new test file under
   `src/components/downtime/views/shared/__tests__/`): renders nothing on
   `success: false`; renders nothing when no deltas carry `kind`; food-only haul
   shows only "Cook with these"; material-only haul shows only "Craft with these" +
   "Send to lab"; mixed haul shows all three; clicking each button dispatches the
   specced intent payload (and `setActiveModule('manager')` for promote).
3. **CookingTab consumption**: with a pending cook intent and two matching foods
   (one depleted, quantity 0), landing on the create view preselects exactly the
   available one; intent is cleared; a re-render does not duplicate rows.
4. **CraftingActivity consumption**: pending craft intent lands on the designs
   sub-view and clears the intent.
5. **ManagerTab/ReagentsView consumption**: pending promote intent lands on the
   reagents view with the picker open and the first matching source preselected;
   unmatched names open the picker unselected.

**Self-verify before finishing (all must pass):**

```bash
npx tsc --noEmit
npx vitest run src/components/downtime src/state/__tests__/campaignReducer.test.ts src/components/cooking src/components/manager 2>&1 | tail -15
```

Fix any failures yourself. Zero new tsc errors, zero new `as any`.

## Out of scope (do not build)

- Pipeline automation / auto-triggering chains.
- Affordances on alchemy/crafting completion, rest, or combat loot.
- Item→material bridge for crafted components.
- Making cooking a real DowntimeTask.
- Persisting `pendingIntent`.
- Any changes to gathering resolution math or the inventory bus semantics.

## Final summary requested

One paragraph on design decisions — especially how you guaranteed one-shot
consumption (no double-apply under React 18 StrictMode double-effects) and anything
you found in the auto-resolve paths while stamping `kind`.
