# Task: Implement the Combat Consumables Consumption Path

## Background — read the design doc first

GURPS 4e campaign-management app (React 18 + TypeScript strict + Tailwind + Vite, Vitest/jsdom; single Redux-style Immer store — combat state and inventory live in ONE reducer tree, so one dispatched action can atomically touch both). **The design is fully decided — do not redesign.** Read `docs/COMBAT_CONSUMABLES_PLAN.md` and implement its decisions. Two sibling lanes merged this week are your reference implementations for idiom and test style: the attunement lane (`docs/ATTUNEMENT_STATE_MACHINE_PLAN.md` — always-succeed inventory actions, additive god-node edits) and the meal-buff lane.

Summary: party combatants consume `ItemInstance`s from their own character inventory via the existing (stubbed) Items workflow in the combat ActionPanel. Consumption is permanent — no combat-undo coupling — with a per-entry manual "undo use" that restores from a snapshot. Delete-at-zero. No effect automation.

## Design refinements pinned here (the plan doc left them open; do it this way)

- **Consumption entries live in combat state:** add optional `consumptions?: ConsumptionEntry[]` to `CombatState` (`src/types/combatTracker.ts` ~212). Optional field → old saves/snapshots simply lack it, no migration. Entries die with the encounter. `ConsumptionEntry = { id: Id; participantId: Id; participantName: string; characterId: Id; itemSnapshot: ItemInstance; quantity: number; round: number }`.
- **One atomic action per direction**, both always-succeed, in the inventory domain (`src/state/inventory/`):
  - `inventory/itemConsumed { itemId, quantity?, combat?: { participantId, participantName, round } }` — finds the item across inventories, captures its snapshot BEFORE decrementing, decrements by quantity (default 1), clamps, **deletes the record at zero** (the MATERIAL_CONSUME precedent); if `combat` context is present and a combat session is active, appends a `ConsumptionEntry` to `activeSession.consumptions` in the same reducer pass. Missing item = no-op. Consuming an attuned item just consumes it (flags die with the record).
  - `inventory/itemConsumptionReverted { entryId }` — finds the entry in the active session, re-adds the item by **reusing the ITEM_ACQUIRED handler logic internally** (same helper function, original `source` preserved — this keeps the design's "no new source kind, acquire semantics for restore" intent while staying atomic), restores the consumed quantity (increment if the record still exists, recreate from snapshot if it was deleted), and removes the entry. Missing entry = no-op.
- Store wrappers in `campaignStore.tsx` (additive god-node edit only), mirroring how `retagItem`/`setItemAttunement` are exposed.

## Deliverables

### 1. Types + actions + reducer (as pinned above)

### 2. UI — replace the stub `src/components/combat/action-panel/ActionPanelItemsWorkflow.tsx`

The stub ("Item system coming soon...") is already wired into `ActionPanel.tsx` (~300) behind the "Use item" workflow button. Replace its body:

- Resolve the acting participant the same way the panel's other workflows do (inspect how ActionPanel passes the selected/current participant into sibling workflows — reuse that prop path; do not invent a new selection mechanism).
- **Party participant** (`participant.partyCharacterId` set): list that character's `ItemInstance`s (name × quantity, matching the visual idiom of `CharacterInventoryPanel` rows) with a **Use** button per row — one unit per click, no quantity picker. On use: dispatch `itemConsumed` with combat context (participant id/name, current round), write a combat log entry ("<Participant> uses <Item>") through the same mechanism the panel's existing workflows use for combat log writes (find how maneuver/condition events log), and an activity changelog entry via a new small `inventoryLog.itemConsumed(itemName, characterName)` helper in `src/utils/activityLogger.ts` (additive, follow the existing helpers' shape).
- **Non-party participant**: explanatory empty state — "No linked inventory — library combatants don't carry items."
- Below the list: **"Used this encounter"** — the `consumptions` entries (item name × quantity, participant, round) each with an **"undo use"** button dispatching `itemConsumptionReverted`, which also logs the reversal to the changelog.
- Empty inventory shows a quiet "No items." row, consistent with the app's other empty states.

### 3. Tests (minimum 20 new)

- Reducer consume: decrement; default quantity 1; clamp; **delete at zero**; missing-item no-op; snapshot captured pre-decrement; entry appended only when combat context given AND session active; attuned item consumption (flags die with record).
- Reducer revert: quantity restored onto surviving record; full recreation after deletion (all snapshot fields incl. `magical`, original `source`); entry removed; missing-entry no-op; revert of an attuned-at-consume-time item returns it **un-attuned**.
- Round-trip: consume-to-zero then revert restores an equivalent record.
- Component tests (real store, style of the attunement panel tests): party participant sees items and Use dispatches with correct payload; non-party sees the empty state; consumption list renders entries; undo-use reverts and removes the entry; combat log + changelog entries written.
- Persistence: a `CombatState` without `consumptions` loads fine (optional-field tolerance).

## Hard constraints

- `strict: true` — `npx tsc --noEmit` zero errors. **No new `as any`, no `@ts-ignore`/`@ts-expect-error`.** `import type` for types.
- God nodes (`campaign.ts`, `combatTracker.ts`, `campaignStore.tsx`, `campaignReducer.ts`): strictly additive.
- **Do NOT touch `useCombatHistory`, `combatHistory.ts`, `combatReducer.ts` apply/invert logic, or any undo machinery** — consumption is deliberately outside combat undo.
- Do not touch the `CombatItem` library (`state.entities.combatItems`), the dice resolver, or effect/injury application.
- The reducer never rejects; no cap or validation paths.
- No new dependencies; do not run npm install (node_modules is a symlink, already populated).
- Preserve pre-existing bugs; report them.

## Definition of done — self-verify before finishing

```
npx tsc --noEmit
npx vitest run src/state/inventory src/components/combat 2>&1 | tail -5
npx vitest run
```

All green (full suite baseline at this commit: 3,592 tests; expect that plus yours; server-integration EPERM in the sandbox is a known environment limit). Final summary: one paragraph on implementation choices — especially how the revert path reuses the acquire logic and how the acting participant is resolved — plus any pre-existing bugs found.
