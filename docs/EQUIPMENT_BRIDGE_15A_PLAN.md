# Inventory → Sheet Equipment Bridge (Phase 15a)

**Designed:** 2026-09-01 (grill-me session, 13 decisions)
**Status:** Designed — ready for codex-shepherd spec
**Problem:** Crafted, looted, and bought gear lands in `entities.inventories` as `ItemInstance`s, which carry no weight/category/stats and have zero linkage to `Character.gcsData.equipment`. A crafted sword tagged to a character appears in InventoryTab and nowhere else — it never affects encumbrance, DR, weapon options, or combat stats. Largest gap from the 2026-09-01 15a audit.

## Solution shape

Explicit **promotion with move semantics**: the two stores remain, and a pair of atomic transfer verbs moves an item between them. At any moment an item lives in exactly one ledger — inventory ("in the pack / stash") or sheet equipment ("on the body"). No mirroring, no two-way sync, no unification (unification stays a possible Phase 16+ ambition).

## Decisions

1. **Architecture: promotion, not unification or sync.** `gcsData.equipment` stays authoritative for encumbrance/DR/combat. Blast radius through the `Character` god node and GCS import stays untouched.
2. **Move, not mirror.** Promotion splices/decrements the `ItemInstance`; the item then exists only as sheet `Equipment`. Promoted gear is deliberately invisible to trading sell, combat consumption, and retag — those cascades cannot drift because there is nothing to cascade to. Demotion is the reverse verb.
3. **Cargo blob for round-trip fidelity.** `ItemInstance.equipmentData?: Partial<Equipment>` (excluding id/quantity/equipped) preserves sheet stats while an item is off-sheet. Inventory treats it as opaque cargo — no inventory-side editing UI. Give-to/retag ferries it for free.
4. **Confirm form at promote time.** "Equip to sheet" opens a small pre-filled Equipment form (name, quantity, value→cost carried; weight/category/stats editable; defaults per `EquipmentSection.handleAdd`: weight 0, category general, equipped true). Pre-filled from the cargo blob when present → one-click fast path. No silent zero-weight adds (that would disguise the gap instead of closing it).
5. **Crafting stamps a starter blob at completion.** `CraftingWorkbench` already knows `finalWeight` and template damage/reach; completion dispatch adds `equipmentData: { weight, category (templateType-mapped: weapons/ranged→weapon, armor→armor, explosives→general), damage, reach }`. Loot/trade items stay bare — the form catches them.
6. **Units: `Equipment.cost` reinterpreted as campaign base currency** (13c currency config, default cp), same denomination as `ItemInstance.value`. Carried 1:1 both directions; sheet cost column relabeled from `$` to the config's base unit. GCS-imported numbers grandfathered as-is. No exchange-rate feature.
7. **Partial-stack promotion.** Form quantity field defaults to full stack; partial promote decrements the inventory instance (`ITEM_CONSUMED`-style). `Equipment` records the source instance id (`sourceItemId`); demotion re-stacks onto a surviving remainder by that id instead of minting a same-name duplicate row.
8. **Demotion targets the character's own inventory** — body→pack, never a silent ownership change. Ownership moves have exactly one verb (retag/Give-to). Sell-equipped-gear flow: demote → visible to trading.
9. **UI: inventory-side entry point now.** Row action on InventoryTab item rows beside the 12a.5 Give-to quick-assign (party-owned → character picker; character-owned → direct). Demotion: "send to pack" row action in `EquipmentSection`. Sheet-side "Add from inventory" picker is a follow-up.
10. **Atomic bus actions.** `inventory/itemPromoted { itemId, characterId, equipment, quantity }` and `inventory/itemDemoted { characterId, equipmentId, quantity? }`, each one reducer pass touching both slices; always-succeed semantics per bus convention (unknown id → no-op); reducer ensures `gcsData` via `createDefaultGCSData`. No component-orchestrated multi-dispatch (torn-state data loss risk).
11. **Items only.** `Inventory.items` (`ItemInstance`) is the bridge's whole domain. Tools carry 13b activity-reservation semantics that move-semantics would silently break — tool-weight-on-sheet is its own design pass if ever wanted. Materials/food are out by nature.
12. **Grandfather, no backfill.** Existing sheet equipment is already the "on the body" ledger under move semantics; it merely gains the option of demotion (mints a fresh linked `ItemInstance` with packed blob). New fields all optional; schema patch bump with no-op migration entry per convention.
13. **Vehicle: codex-shepherd, single lane.** Spec from this design; independent verification per below.

## Testing / verification bar

- Reducer tests: promote/demote round trip (blob fidelity), partial-stack promote + re-stack by `sourceItemId`, whole-stack splice, always-succeed no-ops (unknown item/character), `gcsData` ensure-on-promote, value↔cost carry.
- Component test: confirm form pre-fill from cargo blob; crafting completion stamps blob.
- Shepherd browser verification of the flagship loop end-to-end: craft sword (workshop bonus) → promote via confirm form → encumbrance/carried-weight shift visible on sheet → demote → item sellable in TradingResolutionPanel.

## Out of scope

- Unification of the two stores (possible Phase 16+).
- Sheet-side "Add from inventory" picker (follow-up).
- Tools/materials/food promotion (tools need their own design pass vs reservation semantics).
- Mid-combat propagation: participants snapshot `gcsData.equipment` at EncounterSetup add-time; promoting mid-combat does not update live participants.
- Combat ammo decrement against sheet equipment.
- Backfill/migration of existing sheet equipment into inventory.
- Exchange rates between currency denominations.
- `CharacterInventoryPanel`'s direct `updateInventory` writers bypassing the bus (pre-existing; separate cleanup).
- `entities.combatItems` (third, largely inert item system — separate dead-code audit candidate).
