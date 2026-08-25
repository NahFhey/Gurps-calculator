# Task: Implement the Attunement State Machine for magic items

## Background — read the design doc first

GURPS 4e campaign-management app (React 18 + TypeScript strict + Tailwind + Vite, Vitest/jsdom; Redux-style Immer store). **The design is fully decided — do not redesign.** Read `docs/ATTUNEMENT_STATE_MACHINE_PLAN.md` and implement its decisions exactly. Summary of the rule: a character may attune at most **Magery + 1** magic items (Magery advantage required at all — Magery 0 → 1 slot, no Magery → 0); the item must be in that character's own inventory.

Sibling precedent from this week: the meal-buff lane (`docs/COOKING_BUFF_WRITE_PATH_PLAN.md`, commit tagged `Codex-Authored`) shows the expected shape of additive god-node edits, test style, and always-succeed reducer idiom.

## Deliverables

### 1. Type fields — `src/types/campaign.ts` (additive only)

On `ItemInstance` (~line 845): add `magical?: boolean` and `attuned?: boolean`. Absent = false for both. **No schema bump** — optional fields; old saves simply lack them. On the `AcquiredItem` payload union (~line 922): the equipment/other variants gain optional `magical?: boolean`.

### 2. Reducer — `src/state/inventory/inventoryReducer.ts` + `src/state/inventory/inventoryActions.ts` (additive, plus one edit inside ITEM_RETAGGED)

- New constant `ITEM_ATTUNEMENT_SET = 'inventory/itemAttunementSet'` and action type `{ itemId: Id; attuned: boolean }`, exported alongside the existing bus actions (also re-export from `src/state/inventory/index.ts` matching the existing pattern).
- Reducer case: find the item across inventories, set `attuned`. Always-succeed — missing item is a no-op, mundane items accept the write (the UI just never offers it). Idempotent.
- `ITEM_ACQUIRED` (case at ~line 283): carry `magical` from the payload onto the written item for equipment/other kinds.
- `ITEM_RETAGGED` (case at ~line 331): when the item moves, clear `attuned` (set false/delete) — invariant maintenance, not validation. Applies to every retag (character→character, character→party, party→character).
- Wire a store action wrapper if the bus actions are exposed through `useCampaignStore().actions` (check how `retagItem` is exposed in `src/state/campaignStore.tsx` and mirror it — additive god-node edit only).

### 3. Selectors — `src/state/selectors/inventorySelectors.ts` (additive; plain functions, matching the file's existing unmemoized idiom)

- `selectMageryLevel(state, characterId): number | null` — scans `character.gcsData?.advantages` for the first entry whose `name` trimmed + lowercased **starts with** `'magery'`; returns `level ?? 0`; returns `null` when no match (distinguishes "Magery 0" from "no Magery"). Advantage shape: `{ name, level?, points }` (`src/types/characterSheet.ts` ~95-107).
- `selectAttunementCapacity(state, characterId): number` — `magery === null ? 0 : magery + 1`.
- `selectAttunedItems(state, characterId): ItemInstance[]` — attuned items in that character's inventory record.

### 4. UI — `src/components/character-panels/CharacterInventoryPanel.tsx`

Item rows currently render name/quantity + a remove button (~lines 180-197). Add:
- **Wand mark-magical toggle** on every item row: small icon button (lucide `Wand2` or similar, matching the file's icon usage), toggles `magical` — dispatch through the store the same way the panel's existing mutations go (check how remove works; if there is no generic item-update action, add `magical` toggling via a minimal additive action `inventory/itemMagicalSet { itemId, magical }` following the same pattern as attunement-set). Visually subtle when off (muted), colored when on.
- **Attune toggle** only on rows where `item.magical`: sparkle/star icon button (`Sparkles`/`Star`); filled/colored when attuned; disabled when the character is at capacity AND this item is not already attuned, with a `title` tooltip explaining ("Attunement cap reached (Magery + 1)"). No-Magery characters (capacity 0) see it always disabled with tooltip "Requires Magery".
- **Capacity line** in the panel header: "Attuned N/M", rendered only when capacity > 0 or the character has at least one magical item.

### 5. Loot form — `src/components/combat/LootDistribution.tsx`

The add-loot form gains a **"Magical" checkbox**, visible only when the loot type is `equipment` or `other`. Carried on `LootItem` (`src/types/combatTracker.ts` ~591, add optional `magical?: boolean`) and through the loot→`itemAcquired` dispatch so looted items arrive with the flag. Follow how `materialType` was added to the same form (see the resolved followup #9 in `docs/INVENTORY_INTEGRATION_FOLLOWUPS.md`) — same pattern, same test style.

### 6. Tests (minimum 22 new)

- Reducer: attunement set/unset/idempotent; missing-item no-op; acquired items carry `magical`; retag clears `attuned` in all three ownership directions; magical-set action.
- Selectors: Magery detection — "Magery 2" → capacity 3; "Magery 0" → 1; bare "Magery" (no level) → 1; "Magery (One College)" variant → prefix-matches; "MAGERY" case-insensitivity; no Magery → 0; attuned-items listing.
- UI (component tests with real store, style of `src/components/inventory/__tests__/PartyStashView.test.tsx`): attune toggle appears only on magical rows; disabled at cap with tooltip; capacity line visibility rules; wand toggle flips `magical`; attuning dispatches with correct payload.
- Loot: checkbox renders only for equipment/other; checked → acquired item has `magical: true`; unchecked default → absent/false.
- Persistence: save/load round-trips both flags (follow the meal-buff round-trip test pattern in `src/utils/__tests__/`).

## Hard constraints

- `strict: true` — `npx tsc --noEmit` zero errors. **No new `as any`, no `@ts-ignore`/`@ts-expect-error`.** `import type` for types.
- God nodes (`campaign.ts`, `campaignStore.tsx`, `campaignReducer.ts` if touched at all): strictly additive.
- The reducer must never reject an attunement write (no cap check in the reducer). The ONLY reducer-side attunement logic beyond the set is the retag-clear.
- Do not touch the GCS character-sheet `Equipment` section, the conditions engine, combat state, or the crafting output path.
- No new dependencies; do not run npm install (node_modules is a symlink, already populated).
- Preserve pre-existing bugs; report them instead of fixing.

## Definition of done — self-verify before finishing

```
npx tsc --noEmit
npx vitest run src/state/inventory src/state/selectors src/components/character-panels src/components/combat/__tests__ 2>&1 | tail -5
npx vitest run
```

All green (full suite baseline at this commit: 3,559 tests / 215 files; expect that plus yours; server-integration tests may EPERM in the sandbox — note it, don't chase it). Final summary: one paragraph on implementation choices — especially anything about how the retag-clear interacts with the existing retag write — plus any pre-existing bugs found.
