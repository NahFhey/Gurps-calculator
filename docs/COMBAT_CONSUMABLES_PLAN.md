# Combat Consumables Consumption Path — Design Concept

**Status:** Designed 2026-08-25 (grill-me session, Devin + Fable). Not yet implemented.
**Origin:** [`INVENTORY_INTEGRATION_FOLLOWUPS.md`](./INVENTORY_INTEGRATION_FOLLOWUPS.md) item #4.

## Problem

Healing potions, traps, bombs, and ammo used during combat never touch inventory —
nothing consumes an `ItemInstance` anywhere, and the combat UI's "Use item" button
opens a placeholder (`ActionPanelItemsWorkflow.tsx`: "Item system coming soon...").

## Decisions

1. **Model: the character's `ItemInstance` inventory.** The legacy `CombatItem`
   library (`state.entities.combatItems`) is untouched and stays legacy — a
   deprecation candidate for a future followup, not this one.
2. **Party participants only in v1.** The Items workflow resolves the acting
   participant's inventory via `Participant.partyCharacterId`; library
   monsters/NPCs get an explanatory empty state. NPC loadouts belong with the
   Phase 12c NPC generator work.
3. **No combat-undo coupling in v1 — manual restore instead.** Combat undo is
   component-local and structurally blind to inventory (replay/invert over
   `CombatState` only); entangling them would cross the decoupling 12a.5 chose
   deliberately. Instead: every consumption is listed for the current encounter
   with a per-entry **"undo use"** that dispatches a compensating restore. This is
   deliberate: targeted, visible mistake-recovery that works even after the undo
   history is gone. Accepted cost: undoing an attack does not silently refund ammo.
   Full undo integration is a recorded followup that should ride any future
   "combat history into the store" refactor.
4. **Action: `inventory/itemConsumed { itemId, quantity? }`** (default 1),
   always-succeed bus idiom — missing item no-op, over-consumption clamps to zero,
   **record deleted at zero** (matches the pooled MATERIAL/FOOD_CONSUME precedent).
   Safe because restore is snapshot-based, not row-based.
5. **Restore = re-dispatch `itemAcquired` from a snapshot** captured in the
   consumption entry at consume time (full item fields, original `source`
   preserved). No new restore action, no new source kind.
6. **Surface — fill the existing `ActionPanelItemsWorkflow` stub:** the acting
   participant's full item list (name × quantity), a **Use** button per row, one
   unit per click (no quantity picker). No `consumable` flag, no filtering — GM
   judgment; a flag is cheap later if lists get noisy. Below: the encounter's
   consumption entries with "undo use".
7. **No effect automation.** Using a potion writes the combat log + inventory
   changelog and decrements; the GM applies healing/effects through existing
   injury/condition tools. Same v1-is-bookkeeping philosophy as the meal buff and
   attunement.
8. **Attunement interaction resolves itself:** consuming an attuned item deletes
   the record and the attunement with it. No special case.

## Out of scope

- Combat-undo integration (followup; rides a history-into-store refactor).
- NPC/monster inventories and per-encounter loadouts (Phase 12c territory).
- Effect automation (auto-healing, condition application from items).
- Quantity picker / ammo burst consumption; auto-decrement from the dice resolver.
- `consumable` flag / item filtering.
- `CombatItem` library deprecation.

## Testing decisions

- Reducer: consume decrements; default quantity 1; clamp at zero deletes the
  record; missing-item no-op; idempotence of repeated consumes down a stack.
- Restore: snapshot re-add round-trip, including after record deletion; original
  `source` preserved; attuned item consumed → attunement gone, restore returns it
  un-attuned.
- Workflow: party participant sees their items; NPC sees empty state; Use
  dispatches with the right ids; consumption list renders; undo-use restores and
  removes the entry; combat log + changelog entries written.

## Next step

Sized for a single codex-shepherd delegation once the attunement lane has merged
(both touch `ItemInstance` and the inventory reducer — sequence, don't parallelize).
