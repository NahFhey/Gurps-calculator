# Inventory Integration — Followups

Discovered side-issues surfaced during the Phase 12a.5 design session (2026-04-28) that are explicitly **out of scope** for the inventory integration bus. Recorded here to prevent loss and inform future phase planning.

See [`INVENTORY_INTEGRATION_PLAN.md`](./INVENTORY_INTEGRATION_PLAN.md) for the in-scope work.

---

## 1. Cooking Buff Write Path — ✅ SHIPPED 2026-08-25

**Design complete:** all five open questions below resolved in a grill-me session — see
[`COOKING_BUFF_WRITE_PATH_PLAN.md`](./COOKING_BUFF_WRITE_PATH_PLAN.md) for the full
decision list (flat +1 per `Recipe.skills` entry, party-wide, one slot latest-wins,
calendar-day lazy expiry, top-level nullable snapshot field, display-only banner,
cook = eat). Implemented same day via codex-shepherd (schema 1.5.2, 18 tests, browser-verified). A new side-followup came out of the
session: **dietary restrictions** (see item #10 below).

**Context:** Cooking applies a temporary daily party-wide buff. Cooked food is never stored as an inventory item. The buff write path itself does not exist yet (or is partial).

**Open questions:**
- Where does the buff state live — per-character buff list, party-level effects bucket, or a dedicated `effects` slice on the campaign store?
- When does the buff expire — at end of day, at next sleep, on a timer?
- What triggers application — moment of cooking, moment of "the party eats", or implicit on cook completion?
- Does the buff stack with other cooking outputs from the same day?
- Does the buff persist across save/reload, or recompute on demand?

**Notes:** Probably its own small phase. Candidate name: "Cooking Buff State Path."

---

## 2. Attunement State Machine — ✅ SHIPPED 2026-08-25

**Design complete:** all open questions resolved in a grill-me session — see
[`ATTUNEMENT_STATE_MACHINE_PLAN.md`](./ATTUNEMENT_STATE_MACHINE_PLAN.md). Key calls:
cap = Magery + 1 (Magery required; prefix-match detection, level ?? 0), new
`magical`/`attuned` optional flags on ItemInstance (no schema bump), explicit-set
always-succeed action with cap in selectors/UI only, retag clears attunement,
CharacterInventoryPanel surface. **Premise correction:** the claim below that the
acquire path writes `attuned: false` was never true — no such field existed.
Shipped same day via codex-shepherd (commits 2665360/93077fd, followup closed 51e1001).

**Context:** Magic items can be possessed in any quantity but only `1 + Magery` of them can be attuned at a time (use limit, not possession limit). Phase 12a.5's acquire path writes magic items with `attuned: false`. The toggle path is separate.

**Open questions:**
- Action shape — `inventory/itemAttuned { itemId }` and `inventory/itemUnattuned { itemId }`, or a single toggle action?
- Cap enforcement — reducer rejects attune at cap, or UI prevents the action via a selector that returns "is attune-able"? Phase 12a.5 reducers are always-succeed, so cap probably lives in UI / selector.
- Magery sourcing — read from the character's traits/advantages? Specific advantage ID convention?
- Multi-attuner items (rare): some homebrew magic items might be co-attunable across characters. Out of scope unless a specific item needs it.
- UI feedback at cap — toast, disabled button, modal warning?
- Persistence of attunement across combat / day boundaries?

---

## 3. "Take from Shared" UI for Crafted / Gathered Items — ✅ SHIPPED IN FULL 2026-08-25

**Shipped (2026-08-25, codex-shepherd):** inline "Give to…" select on every party-stash item row (sorted party characters, no default preselect) dispatching `retagItem` + transfer log. One-click party→character assignment, browser-verified. **Remainder designed same day** — see [`TAKE_FROM_SHARED_COMPLETION_PLAN.md`](./TAKE_FROM_SHARED_COMPLETION_PLAN.md): items-only scope (materials → followup #11), checkbox+action-bar bulk give, `crafterId` plumbing with completing-shift attribution and preselection, dedicated claim view WONTFIXed (needs timestamps → note in #6).

**Context:** Phase 12a.5 ships acquire + retag at the data layer, but only loot has a UI that wires retag end-to-end (the existing `LootDistribution.tsx`). Crafted and gathered items land in shared inventory and require manual retag for now.

**Open questions:**
- UX shape — a button per shared-item row that opens a recipient picker? Drag-and-drop from shared to a player slot? A modal "claim items" workflow?
- Should crafted items default to the crafter as a UI preselection, or stay neutral (party-owned by default)?
- Bulk operations — "give all of these herbs to Player A"?
- Where in the navigation does this live — the inventory tab, the day planner summary, or a dedicated "loot pile" view?

---

## 4. Combat Consumables Consumption Path — ✅ SHIPPED 2026-08-25

**Design complete:** see [`COMBAT_CONSUMABLES_PLAN.md`](./COMBAT_CONSUMABLES_PLAN.md).
Key calls: ItemInstance model (CombatItem library stays legacy), party participants
only, NO combat-undo coupling in v1 — per-entry manual "undo use" with snapshot-based
restore via itemAcquired instead; itemConsumed always-succeed with delete-at-zero;
fills the existing ActionPanelItemsWorkflow stub; no effect automation. Implement
AFTER the attunement lane merges (same reducer surface).

**Context:** Healing potions, traps, bombs, ammo are consumed from **individual** inventory during combat. Phase 12a.5 does not touch this — it's a separate write path.

**Open questions:**
- Action shape — `inventory/itemConsumed { itemId, quantity? }`. Stackable consumables (ammo) need a quantity; instance items (a single trap) don't.
- **Combat-history coupling** — should consumption be reversible by combat undo? **Probably yes** — combat undo without inventory rollback creates duplicate ammo / unconsumed potions. This is a meaningful difference from the acquire path (which deliberately decoupled per Phase 12a.5).
- Where does dispatch fire — from the maneuver UI? From a dedicated "use item" action panel? From the dice resolver after a successful attack with ranged ammo?
- What happens when a stackable runs to zero — auto-remove the entry, or leave a zero-quantity entry?
- How does this interact with attunement (using an attuned magic potion)?

---

## 5. Prepared Meals Bucket (Future)

**Context:** Currently cooking applies a buff and the food is treated as consumed at production. A future feature might allow cooked meals to be stored and consumed later (rations, packed lunches, traveler food). Explicitly deferred — no current need.

**Open questions when picked up:**
- Inventory item type for prepared meals?
- Spoilage timer (raw materials don't spoil; cooked meals might)?
- Distinct from raw food materials in UI / categorization?
- Does eating a stored meal apply the same buff as fresh cooking, or a reduced version?

---

## 6. Structured Per-Item Provenance (Future)

**Context:** Phase 12a.5 stores `source` as a string label (`"crafting" | "gathering" | "loot"`). If future UX surfaces "click an item to see where it came from in detail" — e.g., which crafting project, which gather session, which encounter — the field needs to widen.

**Migration path:**
- Existing items default to `{ kind: "legacy" }` or read the string label as a kind discriminator on a discriminated union.
- Append-only metadata; old consumers that read `source` as a string break, so the migration includes consumer updates.
- No current UX need; do not pre-build.
- Note (2026-08-25, from followup #3's completion design): an `acquiredAt` timestamp
  here would unlock a "new arrivals" claim grouping in the stash view — record it as
  part of any structured-provenance widening.

---

## 7. CombatTracker / useCombatSession Logic Overlap (Pre-existing)

**Context:** Not surfaced by the Phase 12a.5 session, but flagged in the `gurps-vtt-resume` skill. CombatTracker and `useCombatSession` have overlapping turn/maneuver/dice logic. Recording here so it stays visible during planning.

**Notes:** Independent of inventory work. Address opportunistically when a combat feature touches both paths.

---

## 8. Owner-Record Quantity Refs Can Drift From Pool Totals (Discovered at implementation, 2026-06-09) — ✅ RESOLVED 2026-07-04 (advisory)

**Context:** `itemAcquired` for materials/foods stacks the global pool AND upserts a `{ id, quantity }` ref in the owner's `Inventory` record. But the consumption paths (`MATERIAL_CONSUME` / `FOOD_CONSUME`, used by crafting/cooking/alchemy) decrement only the pool — refs are never decremented. Refs are therefore provenance-grade ("this owner has received N of X"), not authoritative holdings.

**Resolution (2026-07-04):** Took option (b) — formally declared the refs advisory/provenance-grade rather than making consume decrement them. Verified first that nothing reads the refs as authoritative quantities: the material/food *quantity* selectors (`selectMaterialQuantityByType`, etc.) read the global pool, and `CharacterInventoryPanel` renders only `.items`/`.tools` (authoritative), never `.materials`/`.food`. Documented the invariant on `MaterialEntry`/`FoodEntry`/`Inventory` in `src/types/campaign.ts` and at the `upsertEntryRef` write site in `inventoryReducer.ts`: **pool total is authoritative; refs may drift; do not sum them as holdings**.

**Why not option (a) (decrement refs on consume):** `MATERIAL_CONSUME`/`FOOD_CONSUME` carry no owner attribution — crafting/cooking consume from the global pool with no notion of *whose* materials were spent. Owner-attributed consumption is real design work that belongs with followup #3 (take-from-shared UI), which is the first consumer that would make refs load-bearing. Deferred to that phase; the advisory contract prevents misreads until then.

---

## 9. Loot Materials Have No Material Type (Discovered at implementation, 2026-06-09) — ✅ RESOLVED 2026-07-04

**Context:** The loot form has no material-type picker, so loot-sourced materials are written with `type: 'loot'`. They stack by name within that type and don't reference any `MaterialType` (no HT/DR/weight modifiers).

**Resolution (2026-07-04):** Added a material-type dropdown to the loot add-form in `LootDistribution.tsx`, populated from `entities.materialTypes` and shown only when loot type is `material`. The picked `MaterialType.name` is carried on `LootItem.materialType` and used as the acquired material's `type`; leaving it at the default "Untyped loot material" preserves the legacy `type: 'loot'` fallback. Two render tests added (typed pick → `type: 'Steel'`; default → `type: 'loot'`). A post-hoc retype affordance in InventoryTab remains a separate nicety if needed.

---

## 10. Dietary Restrictions on Meal Buffs (Discovered during cooking-buff design, 2026-08-25)

**Context:** GURPS has diet-related traits (vegetarianism, allergies, restricted diets
as disadvantages/features). Certain characters can't or won't eat certain meals, which
should exclude them from that meal's buff. Surfaced while designing the cooking buff
write path; explicitly deferred so v1 keeps its "everyone eats" invariant.

**Design complete:** see [`DIETARY_RESTRICTIONS_PLAN.md`](./DIETARY_RESTRICTIONS_PLAN.md).
Key calls: explicit two-list per-character config (excluded types + required
any-of types) with trait parsing demoted to a nudge, character-sheet UI,
cook-time snapshot of excluded characters onto the MealBuff, display-only
"(X abstains)" banner clause. Sequence after take-from-shared merges.

**Original open questions (all resolved):**
- Trait detection — match against free-text advantage/disadvantage names in
  `gcsData`? Naming convention? (Same fragility class as attunement's
  Magery-sourcing question, followup #2.)
- Recipe tagging — derive "contains meat" etc. from ingredient `Food.types`
  (fruit/vegetable/... already exist), or explicit per-recipe diet flags?
- Effect shape — excluded character simply doesn't get the buff, or per-character
  buff record replaces the party-level single slot?
- Won't-eat vs can't-eat — player choice surface, or automatic from traits?

**Notes:** Depends on the cooking buff write path shipping first. Pairs naturally
with the who-ate-subset question parked in followup #5's orbit.

---

## 11. Owner-Attributed Material Holdings — ✅ SHIPPED 2026-08-25 (recorded, designed, and implemented same day)

**Context:** Pooled materials/food have advisory owner refs only; the pool is
authoritative and consumption is owner-blind (followup #8's resolution, which parked
owner-attributed consumption here via #3). Followup #3's completion design scoped
itself to items-only, so the question is now its own future phase: real per-owner
material holdings, owner-attributed `MATERIAL_CONSUME`/`FOOD_CONSUME`, and the
crafting/cooking/alchemy consume-path changes that follow. Designed same day — see
[`OWNER_ATTRIBUTED_MATERIALS_PLAN.md`](./OWNER_ATTRIBUTED_MATERIALS_PLAN.md):
possession model, Inventory.materials/.food promoted to authoritative (global
pools deleted, compat summing selector), party-seeded migration with refs
discarded (schema 1.5.4), party-only consumption via a real owner-aware action
replacing the wholesale SET recomputes (recon found MATERIAL_CONSUME/FOOD_CONSUME
were dead code — never dispatched), Transfer Console quantity-give for
stackables. New followup: "personal-stake activities" (source picker + gathering
leader attribution). Alchemy's missing consumption path noted as its own gap.

---

## 12. Personal-Stake Activities (Recorded during followup #11 design, 2026-08-25)

**Context:** Two deferred faces of one feature: a per-activity consumption source
picker (spend a character's personal materials instead of party stock) and
gathering leader attribution (hauls land on `task.leaderId` instead of party).
Both deliberately excluded from the owner-attributed-materials phase to keep the
gather→craft loop frictionless. Design when a table moment wants personal stock
spent directly. Also noted there: alchemy has NO material-consumption path at all
— its own gap, not part of this item.

**Precision on the alchemy gap (recon 2026-08-26):** alchemy DOES consume — but
from its own siloed reagent pool, not the inventory materials system.
`BatchesView.tsx` (~lines 258–363) checks reagent sufficiency, decrements
`AlchemyReagent.quantity`, and persists via wholesale `saveReagents`/
`setAlchemyReagents` — the same legacy SET-recompute pattern crafting/cooking were
migrated off in followup #11. The real design question is whether reagents should
integrate with owner-attributed `Inventory.materials` (and whether gathered herbs
should land in the reagent silo or inventory), not whether consumption exists.
**Design complete (grill-me session, 2026-08-26):** see
[`REAGENT_PROMOTION_PLAN.md`](./REAGENT_PROMOTION_PLAN.md) — promotion model
(one-way inventory→reagent conversion, GM-only via ReagentsView picker, 1:1
partial, single atomic `inventory/reagentPromoted` action), gathering untouched,
reagents stay a party-scoped silo, alchemy write-path modernization recorded as a
multiplayer-triggered followup. **SHIPPED 2026-08-26** (codex-shepherd, live-verified).
