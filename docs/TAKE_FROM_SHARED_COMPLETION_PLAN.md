# Take-from-Shared — Completion Design (Followup #3 remaining scope)

**Status:** Designed 2026-08-25 (grill-me session, Devin + Fable). Not yet implemented.
**Origin:** [`INVENTORY_INTEGRATION_FOLLOWUPS.md`](./INVENTORY_INTEGRATION_FOLLOWUPS.md) item #3;
first slice (per-row "Give to…" quick-assign) shipped earlier the same day.

## Decisions

1. **Items-only scope.** Pooled materials/food are excluded — "give all herbs to A"
   would either relabel advisory refs that nothing enforces (a trap; see followup #8's
   pool-is-authoritative resolution) or reopen owner-attributed consumption, which is
   a phase, not a followup (recorded as followup #11). At the table, the communal herb
   pool matches how gathering works; crafted gear and loot are what people claim.
2. **Bulk = checkbox multi-select + contextual action bar** on party-stash item rows:
   checkbox per row; when ≥1 checked, a bar appears ("3 selected — Give to
   [character ▾] [Give]") looping the always-succeed `retagItem` over the selection.
   Single-item quick-assign stays. Tools/currency stay out (no bus action).
3. **Crafter plumbing:** new optional `crafterId?: Id` on `ItemInstance`, written at
   the crafting completion dispatch (`CraftingWorkbench` — the name→id lookup already
   exists in the component; the completion dispatch currently drops crafter identity
   entirely). **Crafter of record = the worker of the completing shift.** Ownership
   still defaults to party (12a.5 decision undisturbed).
4. **Preselection:** for items with `source: 'crafting'` and a `crafterId`, the
   quick-assign select and the bulk bar preselect that character. Pure UI sugar.
5. **Dedicated claim view: WONTFIX.** The stash tab with quick-assign + bulk IS the
   claim surface. A "new arrivals" grouping needs acquisition timestamps — that's
   followup #6 (structured provenance) territory; a note is recorded there.

## Out of scope

- Materials/food giving in any form (→ followup #11, owner-attributed holdings).
- Drag-and-drop, modal claim workflows, a separate loot-pile view.
- Acquisition timestamps / new-arrivals grouping (→ followup #6).
- Bulk operations on tools or currency.

## Testing decisions

- Bulk bar: appears at ≥1 selection; loops retagItem with correct ids; clears
  selection after give; mixed selection with a mid-loop-removed item is a no-op for
  the missing one (always-succeed).
- crafterId: written on completion with the completing shift's worker id; absent when
  the worker can't be resolved; preserved through retag and (if consumables has
  merged) consumption snapshots.
- Preselection: crafting-sourced item rows preselect the crafter in quick-assign and
  bulk bar; loot/gathered items stay neutral.

## Next step

One codex-shepherd lane. Touches PartyStashView (+ the inventory router),
CraftingWorkbench's completion dispatch, and `ItemInstance` (additive optional
field). Sequence after the consumables lane merges — same files.
