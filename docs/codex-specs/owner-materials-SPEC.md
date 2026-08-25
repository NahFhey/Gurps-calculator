# Task: Owner-Attributed Material Holdings (phase implementation)

## Background — read the design doc first

GURPS 4e campaign-management app (React 18 + TypeScript strict + Tailwind + Vite, Vitest/jsdom; Redux-style Immer store). **The design is fully decided — do not redesign.** Read `docs/OWNER_ATTRIBUTED_MATERIALS_PLAN.md` in full and implement it exactly; its "Recon findings" section corrects several stale doc comments you will encounter — trust the plan doc over in-code comments. This is the largest lane of a week-long pipeline; the seven `Codex-Authored` lanes in git log are your idiom references (always-succeed inventory actions, additive god-node edits, real-store component tests).

Summary: `Inventory.materials`/`Inventory.food` stop being advisory refs and become the authoritative per-owner holdings; the global `entities.materials`/`entities.foods` pools are deleted; migration seeds everything into the party inventory (schema 1.5.4); crafting/cooking consumption moves off wholesale `MATERIAL_SET`/`FOOD_SET` recomputes onto a real owner-aware consume action (party-only source in v1); Transfer Console learns quantity-transfer for stackables; stash/character panels render holdings; overview tabs keep totals via a compat selector with per-owner badges.

## Deliverables

### 1. Types — `src/types/campaign.ts`

- `MaterialEntry`/`FoodEntry` (~887-896): now authoritative holdings — widen as needed so an owner's entry is self-contained (it must carry name/type/quantity plus whatever display fields the overview needs; inspect what the current global pool entries carry and mirror that shape per-owner). **Rewrite the followup-#8 advisory-invariant doc comments** (~880 and at the reducer write sites) to state the new invariant: Inventory holdings are authoritative; there is no global pool.
- Delete `entities.materials` and `entities.foods` from `CampaignState` and everything that initializes them (`createCampaignState`). This is a deliberate breaking change inside the phase — the compiler is your migration checklist; fix every red site per the rules below.

### 2. Reducer — `src/state/inventory/inventoryReducer.ts` + actions

- `stackMaterial`/`stackFood` (~61-90) become per-owner: stack into a given inventory's holdings by name+type. `acquireInventoryItem`'s material/food cases write to the owner's inventory (owner is already a parameter). `upsertEntryRef` disappears with the refs.
- **New always-succeed actions** `inventory/materialsConsumed { owner, entries: Array<{ name?; type?; quantity }> }` and `inventory/foodsConsumed { ... }` (match how the existing consume-shaped payloads identified entries — inspect the old dead `MATERIAL_CONSUME` payload for the identification convention and keep it): decrement the owner's holdings, clamp at zero, remove zero-quantity entries. Missing owner/entry = no-op.
- **New transfer action** `inventory/materialTransferred { sourceOwner, targetOwner, entryId or name+type, quantity }` (+ food equivalent, or one action with a kind discriminator — your call, keep it symmetric with the codebase's style): moves quantity between owners, creating the target entry if absent, removing the source entry at zero. Always-succeed.
- **Remove the dead legacy actions** `MATERIAL_CONSUME`/`FOOD_CONSUME` and `MATERIAL_SET`/`FOOD_SET`'s material/food-pool semantics: `MATERIAL_SET`/`FOOD_SET` are used by crafting/cooking today as the de-facto consume path AND possibly by Manager CRUD for the materials catalog — inspect every dispatch site first (`saveMaterials`/`saveFoods` in `campaignStore.tsx` and their callers). Catalog/setup-style writers (if any) get retargeted to the party inventory's holdings; the crafting/cooking consume-style writers move to the new consume actions (deliverable 4). Do not leave a wholesale-replace path for holdings.

### 3. Migration — schema 1.5.3 → 1.5.4 (`src/utils/dataMigrations.ts`, `src/utils/schemaVersioning.ts`, persistence)

- `migrateTo1_5_4`: move every entry from the legacy global `materials`/`foods` records into the party inventory's holdings (exact quantities preserved); **discard all existing per-owner ref arrays** (both party and character — the refs are drifted provenance, not holdings; characters start at zero); idempotent; tolerate saves that predate the bus (missing inventories → `ensureInventoryRecords` pattern).
- Hydration/serialization paths (`campaignStorage`, checkpoint/restore in the campaign reducer) updated for the removed entities keys.

### 4. Consume-site rewiring

- `src/components/crafting/CraftingWorkbench.tsx` (~287-302) and `src/components/cooking/CookingTab.tsx` (~127-137 create, ~254-265 remake): replace the client-side array recompute + `saveMaterials`/`saveFoods` with dispatching the new consume actions, owner `'party'`. The quantities consumed must be identical to what the old recompute produced for the same inputs (write the tests to prove it). Availability checks in these flows ("do we have enough") switch to the compat selector.
- Alchemy: touch nothing (it has no consumption path; out of scope).
- Gathering acquisition sites: no behavior change (owner stays `'party'`) — they already flow through `acquireItem`, which now lands in party holdings via deliverable 2.

### 5. Selectors — `src/state/selectors/inventorySelectors.ts`

- Compat totals: `selectMaterialQuantityByType`/`selectFoodQuantityByType` (and any sibling total-style selectors, ~51-54/~89-92) now sum across all inventories — same signatures, same semantics for a party-only world.
- New: `selectOwnerMaterialHoldings(state, owner)`, `selectMaterialOwnerBreakdown(state, name/type) → Array<{ownerLabel, quantity}>` (for the overview badges).

### 6. UI

- `src/components/inventory/views/PartyStashView.tsx`: Materials and Food sections rendering party holdings (name × quantity), each row with a Transfer button seeding the Transfer Console (as items do today). No checkboxes/quick-assign on stackable rows.
- `src/components/inventory/views/TransferConsole.tsx` + the router's `handleTransfer`: material/food transfers with a quantity input (mirror the existing currency-amount pattern exactly — validation messages included), dispatching the new transfer action + `inventoryLog.itemTransferred`-style logging (add a materials variant to `activityLogger` if the message shape needs quantity+type).
- `src/components/character-panels/CharacterInventoryPanel.tsx`: render the character's material/food holdings (read-only list, same visual idiom as its items list).
- `src/components/inventory/views/InventoryOverviewView.tsx`: totals via compat selectors, plus a muted per-owner breakdown per row ("24 — party 20, Rina 4"; omit the breakdown when it's party-only).

### 7. Tests (minimum 30 new/updated beyond mechanical fixes)

- Migration: pool→party exact quantities; refs discarded (character starts empty); idempotent; pre-bus save tolerance; round-trip.
- Reducer: per-owner stacking; consume decrement/clamp/remove-at-zero/no-ops; transfer partial + full + create-target + missing-source no-op.
- Selectors: compat totals equal sums; owner holdings; breakdown.
- Crafting + cooking: same-inputs consumption parity with the old recompute (fixture-based: given materials X and recipe/project Y, resulting party holdings identical to the legacy path's output); availability gating unchanged.
- UI: stash sections render; console quantity transfer (valid, over-quantity rejected message, cross-owner); character panel renders holdings; overview badges (multi-owner and party-only cases).
- Every existing test that referenced `entities.materials`/`entities.foods` updated to the new shape — these count as mechanical fixes, not toward the 30.

## Hard constraints

- `strict: true` — `npx tsc --noEmit` zero errors. **No new `as any`, no `@ts-ignore`/`@ts-expect-error`.** `import type` for types.
- God-node edits (`campaign.ts`, `campaignStore.tsx`, `campaignReducer.ts`) as narrow as the deletion allows — removing the two entities keys and their action plumbing is in scope; refactor nothing unrelated.
- All new reducer actions always-succeed; no validation/rejection paths (UI gates quantities).
- Do not touch: alchemy, the meal-buff/dietary logic, combat consumables (`ItemInstance` paths), gathering roll logic, the Manager's tool/facility systems.
- No new dependencies; do not run npm install (node_modules is a symlink, already populated).
- Preserve unrelated pre-existing bugs; report them.

## Definition of done — self-verify before finishing

```
npx tsc --noEmit
npx vitest run src/state/inventory src/state/selectors src/utils/__tests__ 2>&1 | tail -5
npx vitest run
```

All green (full suite baseline at this commit: 3,688 tests / ~220 files; expect that count to move both ways — deleted-pool tests fixed, 30+ added; server-integration EPERM in the sandbox is a known environment limit). Final summary: one paragraph on implementation choices — especially what you found at the `MATERIAL_SET`/`FOOD_SET` dispatch sites and how catalog-style writers (if any) were retargeted — plus the exact list of files where the compiler forced changes, and any pre-existing bugs found.
