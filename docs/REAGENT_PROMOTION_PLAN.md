# Reagent Promotion — Design Concept (Phase)

**Status:** Designed 2026-08-26 (grill-me session). Not yet implemented.
**Origin:** [`INVENTORY_INTEGRATION_FOLLOWUPS.md`](./INVENTORY_INTEGRATION_FOLLOWUPS.md) item #12's
alchemy-gap note (2026-08-26 precision correction: alchemy consumes from its own
reagent silo; the gap is the missing bridge between gathered stock and that silo).

## Problem

Gathered herbs/materials land in party inventory via the `itemAcquired` bus, but
there is no path for them to become brewable `AlchemyReagent` stock — reagent
creation is manual GM entry in ReagentsView only. The gather→brew loop breaks at
the lab door. (Recon: `ForagingResolutionPanel.tsx` writes `'food'|'material'`
kinds only; no `'reagent'` kind exists; no code writes `entities.alchemyReagents`
from gathering.)

## Decisions

1. **Anchor: the gather→reagent bridge.** Reagent ownership ("whose reagents")
   stays party-scoped global lab stock — no owner attribution; reopen only on a
   real table moment. Write-path hygiene rides along only where the bridge
   touches.
2. **Model: promotion, one-way.** Gathered stock lands in inventory exactly as
   today (gathering untouched). A new explicit GM action converts N units of a
   party material/food entry into reagent stock: decrement the entry, upsert the
   reagent. No direct-to-silo gathering writes; no reference/dual-view model.
   The conversion step doubles as the enrichment step the engine requires
   (forage outputs carry no aspects/refinement/potency).
3. **Eligibility: any material or food entry.** No `reagentEligible` flag, no
   curated list — the GM performing the enrichment is the gate. A hide-button
   flag can be added later without migration if needed.
4. **Surface: alchemy side, GM-only by placement.** An "Import from inventory"
   picker in ReagentsView (Manager), opening the existing New Reagent form
   pre-filled. No inventory-side affordance this phase (a stash-row deep-link is
   a cheap later nicety).
5. **Quantity: partial promotion, fixed 1:1.** Quantity input capped at on-hand
   units; 1 material/food unit = 1 reagent unit; no ratio config ("render-down"
   fiction is expressible by promoting fewer units).
6. **Stacking: per-promotion GM choice.** "Add to existing" (quantity increases,
   existing profile — aspects/refinement/identityId/falseProfile — untouched) vs
   "create new" (full enrichment form). Default add-to-existing on exact name
   match, create-new otherwise. Identity merging is always an explicit decision.
7. **Action: single atomic `inventory/reagentPromoted`.** Always-succeed, homed
   in the inventory domain (where bus semantics live; alchemy's native actions
   are legacy wholesale-SETs we're not extending). Payload:
   `{ source: { entryId/name, kind: 'material'|'food', owner: 'party', quantity },
      target: { mode: 'existing', reagentId } | { mode: 'new', reagent } }`.
   Decrement + upsert in one Immer pass; clamp at zero; remove source row at
   zero quantity (matches `materialsConsumed` semantics).
8. **Hygiene deferral:** batch-start consumption and the refinement/analysis
   views keep their wholesale `saveReagents` SETs. "Alchemy write-path
   modernization" is a recorded followup whose trigger is concurrent multi-client
   reagent writes (multiplayer); single-client stale-snapshot clobber risk was
   assessed and is theoretical (synchronous handlers, store-derived props).
9. **Create-new defaults:** name + quantity pre-filled from source entry,
   `refinement: 'crude'` (field stock arrives crude — gives RefinementView a job
   in the loop), source auto-filled, aspects/potency/roles/hazards start blank
   as in the existing form. No invented aspect data.
10. **Provenance, two trails:** create-new auto-fills the reagent's free-text
    `source` ("Promoted from party stock: <entry name>"); every promotion logs
    one activity-log entry (`alchemyLog.reagentPromoted(name, qty)`).
    Add-to-existing touches nothing but quantity. No structured provenance
    (stays parked in inventory followup #6).
11. **Player visibility: no special handling.** Players see the stash decrease
    plus the changelog entry; what the stock became stays behind the existing
    identificationLevel export masking. Accepted limitation: no secret
    promotions — the log always speaks ("quiet promotion" toggle only if a table
    moment demands it).
12. **No undo affordance** (consistent with the rest of the inventory bus);
    manual correction via existing edit forms. **No schema bump** (no entity
    shape changes).

## Out of scope

- Reagent ownership / owner-attributed reagent holdings.
- Any change to gathering write sites or forage tables (no `'reagent'` kind).
- Migrating alchemy's existing wholesale-SET write paths (recorded followup,
  multiplayer-triggered).
- Inventory-side promotion affordance / stash-row deep-link.
- Conversion ratios, `reagentEligible` flags, reverse (reagent→material) path.
- Secret/unlogged promotions.
- Reagent weight/value/encumbrance (undecided for materials too).
- Herb Lore skill mechanics (Alchemy_Rules_Comparison.md) — not implemented.

## Testing decisions

- Reducer: partial decrement; clamp; source row removed at zero; food and
  material sources; add-to-existing increments quantity and leaves every profile
  field untouched; create-new lands with `refinement: 'crude'` and auto-filled
  source; always-succeed (no rejection paths).
- UI: picker lists party materials + food with on-hand caps; name-match default
  targeting; log entry emitted.
- Browser pass: forage → stash → promote (both modes) → reagent visible in
  ReagentsView → batch consumes it (existing path).

## Next step

One codex-shepherd lane (small: one action + reducer branch, ReagentsView picker
UI, activityLogger helper, tests). No parallel-lane restrictions — touches
inventory reducer + alchemy views only.
