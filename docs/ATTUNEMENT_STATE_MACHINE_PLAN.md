# Attunement State Machine — Design Concept

**Status:** Designed 2026-08-25 (grill-me session, Devin + Fable). Not yet implemented.
**Origin:** [`INVENTORY_INTEGRATION_FOLLOWUPS.md`](./INVENTORY_INTEGRATION_FOLLOWUPS.md) item #2.

## Premise correction (recon finding, 2026-08-25)

The followup doc claimed "Phase 12a.5's acquire path writes magic items with
`attuned: false`" — **this was never true.** No `attuned` field, no magic/mundane
discriminator, and zero "attun" references existed anywhere in `src/` before this
design. Both fields are introduced here from scratch.

## Rule (table canon, confirmed this session)

A character may be attuned to at most **Magery + 1** magic items. Having the Magery
advantage at all is required: Magery 0 → 1 slot, Magery 2 → 3 slots, no Magery → 0.
The item must be in that character's own inventory to be attuned.

## Decisions

1. **Model:** attunement lives on the inventory-bus `ItemInstance`, character-owned
   records only. A party-stash item must be given to the character first (the shipped
   "Give to…" / Transfer Console flows). Not the GCS character-sheet `Equipment` list.
2. **Magical flag:** new optional `magical?: boolean` on `ItemInstance`; absent =
   mundane. Set via a per-row "mark magical" wand toggle in the inventory UI and a
   "Magical" checkbox on the loot add-form (carried through `itemAcquired` so looted
   artifacts arrive pre-flagged).
3. **Magery detection convention (first in codebase):** case-insensitive **prefix
   match** — any `gcsData.advantages` entry whose name starts with "magery", level
   `level ?? 0` (bare "Magery" behaves as Magery 0 → 1 slot). No match → capacity 0.
   One selector owns the rule.
4. **Action:** single explicit-set `inventory/itemAttunementSet { itemId, attuned }`.
   Always-succeed, idempotent (explicit set, not toggle — safer under sync replays).
5. **Cap enforcement lives in selectors + UI only:** `selectAttunementCapacity`
   (Magery + 1 or 0) and `selectAttunedItems`; the UI disables the attune control at
   cap. The reducer never rejects. Accepted consequence: an over-cap state can arrive
   via import or stale sync — the UI just won't create one. Matches the Phase 12a.5
   always-succeed idiom throughout the bus.
6. **Retag clears attunement.** `ITEM_RETAGGED` sets `attuned` to false as part of
   the move — invariant maintenance inside an always-succeed write (same spirit as
   auto-creating inventory records), not validation. The receiver re-attunes against
   their own capacity. "Give it away" is therefore also a natural un-attune path.
7. **UI surface — `CharacterInventoryPanel`:** sparkle/star attune toggle on rows of
   `magical` items (filled = attuned; disabled at cap unless already attuned, tooltip
   explains); "Attuned 2/3" capacity line in the panel header, shown only when the
   character has Magery or any magical item; wand mark-magical icon on every row (no
   permission gating in v1, consistent with the inventory UI having none).
8. **Stacks:** one attunement slot per item **record**, quantity ignored. Attuned
   items are typically singletons; consumable magic belongs to followup #4.
9. **Persistence:** plain flags — survive save/reload, no day or combat expiry; state
   ends only by un-attune or retag. **No schema bump needed**: both new fields are
   optional booleans where absent = false; old saves simply lack them.
10. **v1 is bookkeeping/display only.** Attunement tracks which items are in use;
    it applies no mechanical effects anywhere.

## Out of scope

- Mechanical effects of attuned items (bonuses, abilities) — item-specific, GM
  territory, future design.
- Multi-attuner / co-attunable homebrew items (per original followup: only if a
  specific item needs it).
- Combat consumables interaction — followup #4 owns consumption.
- Permission gating (player vs GM control of the toggles).
- Name-convention magic detection ("Ring of…") — rejected outright.
- Per-item attunement requirements (GURPS gadget-style limitations).
- A magical flag on the crafting output path — crafted magic items use the per-row
  wand toggle until crafting grows its own flag.

## Testing decisions

- Reducer: attunement set/unset; idempotent re-set; `ITEM_RETAGGED` clears the flag
  (both character→character and character→party); mundane items accept the flag write
  (always-succeed) even if UI never offers it.
- Selectors: capacity for Magery 0 / Magery 2 / bare "Magery" / "Magery (One
  College)" / no Magery; prefix match case-insensitivity; attuned count per character.
- UI: toggle only on magical rows; disabled at cap with existing attunements intact;
  capacity line visibility rules; loot checkbox carries `magical` through acquire.
- Persistence: round-trip of magical+attuned flags; old save without fields loads
  with both treated as false.

## Next step

Sized for a single codex-shepherd delegation: type fields + action + retag-clear +
selectors + panel UI + loot checkbox + tests.
