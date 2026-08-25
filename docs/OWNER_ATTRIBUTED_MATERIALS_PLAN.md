# Owner-Attributed Material Holdings — Design Concept (Phase)

**Status:** Designed 2026-08-25 (grill-me session, Devin + Fable). Not yet implemented.
**Origin:** [`INVENTORY_INTEGRATION_FOLLOWUPS.md`](./INVENTORY_INTEGRATION_FOLLOWUPS.md) item #11
(the deferred half of followup #8's resolution, formally parked by #3's completion design).

## Recon findings that reshaped the design (2026-08-25)

- **`MATERIAL_CONSUME`/`FOOD_CONSUME` are dead code** — never dispatched from any
  component. Real consumption in crafting (`CraftingWorkbench` ~287-302) and cooking
  (`CookingTab` ~127-137, ~254-265) recomputes the whole array client-side and
  dispatches wholesale `MATERIAL_SET`/`FOOD_SET`. The followup #8 doc comments
  claiming the consume actions are in use are false and must be corrected.
- Alchemy has **no material-consumption code at all** — a design gap, not a
  refactor target here.
- Gathering sites know `task.leaderId` but hardcode owner `'party'`; loot already
  attributes material owners per recipient.
- The advisory refs are write-only (never decremented) and **cannot** reconstruct
  real per-owner holdings.

## Decisions

1. **Possession, not accountability.** Characters genuinely hold materials — the
   model that makes "give herbs to A" mean something, mirroring the proven
   owner-scoped item system. A consumption-ledger-over-communal-pool alternative
   was considered and rejected (leaves "whose herbs are these" unanswerable).
2. **Shape: promote `Inventory.materials`/`Inventory.food` from advisory to
   authoritative.** All possessions live on the per-owner `Inventory` records
   (same home as items/tools/currency). The global pools
   (`entities.materials`/`entities.foods`) are **deleted**; totals-style reads go
   through a compat selector summing across inventories. Stacking within an owner
   by name+type.
3. **Migration (schema → 1.5.4):** global pool contents land in the party
   inventory as authoritative holdings; the drifted character refs are
   **discarded, not trusted** — every character starts at zero materials and the
   table redistributes via the give flows. Provenance stays the acquisition log's
   job.
4. **Consumption: party-only in v1, via a real owner-aware action.** New
   always-succeed `inventory/materialsConsumed { owner, entries }` (and food
   equivalent) replaces the wholesale SET recomputes in crafting and cooking —
   semantically identical to today (the old global pool IS the party stock).
   Personal materials are spent by first giving them to the party (bulk-give makes
   that cheap). The dead legacy consume actions are removed; stale doc comments
   corrected. A per-activity source picker is a recorded followup.
5. **Gathering keeps the party default.** Leader-owned hauls would force manual
   give-to-party before every craft — friction on the app's most common loop.
   Leader attribution rides the same "personal-stake activities" followup as the
   source picker. The activity log already records who gathered.
6. **UI surface:** PartyStashView gains Materials/Food sections (party holdings);
   CharacterInventoryPanel renders character holdings (no longer hidden — they're
   real now); **giving stackables goes through the Transfer Console** extended
   with a quantity input (the currency-amount pattern) — no one-click quick-assign
   for materials (a click can't carry a quantity honestly), bulk-give checkboxes
   stay items-only; the Raw Materials / Food Supplies overview tabs keep totals
   via the compat selector with a per-owner breakdown badge per row
   ("24 — party 20, Rina 4").

## Out of scope

- Alchemy consumption path (own design gap, own future phase).
- Per-activity consumption source picker; gathering leader attribution
  ("personal-stake activities" followup — record it).
- Inline quick-assign / bulk-give for stackables.
- Encumbrance coupling for carried materials.
- Any attempt to reconstruct historical per-character holdings from the refs.

## Testing decisions

- Migration: pool → party holdings preserves exact quantities; refs discarded;
  idempotent re-run; round-trip; old saves load clean.
- Reducer: owner-aware consume decrements the right owner, clamps, removes
  zero-quantity entries; acquire stacks within owner; material/food transfer
  moves quantity between owners (partial and full).
- Compat selector: totals equal sum across owners; existing quantity-check call
  sites behave identically pre/post migration for a party-only world.
- Crafting/cooking: consumption dispatches the new action with owner 'party';
  results identical to the old SET path for same inputs; insufficient-stock
  behavior unchanged.
- UI: stash and character panels render holdings; Transfer Console quantity
  transfer for materials; overview badges.

## Next step

One codex-shepherd lane — the largest of the pipeline (~15 direct files). Nothing
else may run in parallel with it.
