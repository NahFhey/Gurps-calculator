# Phase 12a.5 — Inventory Integration Bus

**Status:** Planned (not started)
**Created:** 2026-04-28
**Sequence:** Inserted between Phase 12a (complete) and Phase 12b (deferred)
**Origin:** Design concept reached via grilling session 2026-04-28

---

## Problem

Four subsystems (crafting, gathering, cooking, loot) record intent without writing to inventory state. Crafting and gathering are exercised every session; the gap currently bites at the table and is worked around by hand-editing inventory after every event.

Diagnostically this is **one shared problem**, not four. The trigger conditions differ per subsystem, but the thing being committed always has the same shape: "this character (or the party) now owns this item." A single primitive write action plus three dispatch sites resolves the cases. Cooking is excluded — see Out of Scope.

---

## Solution Shape

### Reducer Actions

Two new actions on the existing inventory store:

```ts
inventory/itemAcquired { item, owner, source }
inventory/itemRetagged  { itemId, newOwner }
```

- `itemAcquired` appends or merges (per existing stack rules) into the inventory under `owner`.
- `itemRetagged` rewrites the `owner` field on an existing item by `itemId`.

Both actions are **always-succeed**. No validation paths. No rejection.

### Single Store, Ownership Tag

All items live in one inventory store. Each item carries an `owner` field of type `"party" | CharacterId`.

- Shared inventory is the slice where `owner === "party"`.
- Individual inventory is the slice where `owner === <characterId>`.
- Moving items between shared and individual is a tag rewrite — no transfer between separate stores.

### Dispatch Sites

| Subsystem | Trigger | Action | Owner |
|---|---|---|---|
| Crafting | Project completion | `itemAcquired` | `"party"` |
| Gathering | Success roll | `itemAcquired` | `"party"` |
| Loot | Item present in distribution UI | `itemAcquired` | `"party"` |
| Loot | Recipient assigned in distribution UI | `itemRetagged` | recipient `CharacterId` |

### Field Shapes

- `item` — existing inventory Item type.
- `owner` — `"party" | CharacterId`.
- `source` — string literal: `"crafting" | "gathering" | "loot"`. Extensible. Read-only metadata; the reducer does not branch on it. UI may filter/group by it.

---

## In-Scope User Stories

- As a player, completing a crafting project produces a visible item in shared inventory without hand-editing.
- As a player, succeeding on a gathering roll produces a visible item in shared inventory without hand-editing.
- As a GM, distributing loot through the post-combat UI lands items in the assigned characters' individual inventories.
- As a GM, until a dedicated "take from shared" UI ships, hand-retagging crafted/gathered items from `"party"` to a `characterId` works through the same `itemRetagged` action.

---

## Out of Scope

These are the boundaries that define done.

- **Cooking → inventory write.** Cooking applies a temporary daily party-wide buff; cooked food is never stored. Buff write path is its own work item — see followups.
- **Prepared-meals bucket.** Possible future scope, deferred until a concrete need arises.
- **Combat-undo coupling for inventory writes.** Exploit the existing post-combat boundary instead — combat undo is gated to before the post-combat phase commits. Inventory writes happen post-commit and are not reversible via combat history.
- **"Take from shared to individual" UI** for crafted/gathered items. Hand-retag for now; proper UI in a later phase.
- **Combat consumables consumption path.** Healing potions / traps / bombs / ammo consume from individual inventory during combat. Separate write path.
- **Attunement state machine.** Magic items land with `attuned: false`. Toggling attunement and enforcing the `1 + Magery` cap is a separate write path.
- **Write-rejection / capacity validation.** Always-succeed reducer. Encumbrance reactively recomputes via existing pure calculation layer (`src/utils/encumbrance.ts`).
- **Structured per-item provenance.** `source` is a string label only; widen to a discriminated union later if UX surfaces it.
- **Phase 15 cross-cutting work** (performance, accessibility, JS→TS migration) stays in Phase 15.

---

## Implementation Decisions

- Action names and shapes as specified above. Locked.
- `owner: "party" | CharacterId` discriminated value. No separate party-shared store at the data layer.
- `source` is a string literal, not a structured object.
- Always-succeed reducer; no validation paths.
- No combat-history wiring.
- Existing Phase 11c `LootDistribution.tsx` UI is rewired to dispatch `itemRetagged` instead of just logging distribution intent.
- Existing inventory subsystem's stack/merge logic for materials vs equipment is presumed sufficient. No new abstraction added.

---

## Migration & Backward Compatibility

Phase 12a.5 adds an `owner` field to inventory items. Existing saves predate this field and require migration on load.

**Recommended migration:**

- Schema version bump in the existing schema versioning system (`src/utils/schemaVersioning.js`).
- On-load migration step: walk all inventory items; set `owner` if absent.
- Default ownership rule:
  - **Equipped items** → `owner: <equippedCharacterId>` (the character with the item equipped). Migrates into that character's individual inventory.
  - **Unequipped items** → `owner: "party"`. Migrates into shared bag.
  - Rationale: preserves player intent — items a character was using stay with that character; loose items go to the party pool.

**Edge cases:**

- Loot logged in pre-12a.5 sessions that was never materialized as inventory items: lost data, not a migration target. Out of scope.
- **[DECISION NEEDED — grill at implementation start]** Items unequipped but with an implicit owner under the legacy model (e.g., a character's personal backpack) — do those default to that character's individual inventory, or to shared? Answer changes the migration heuristic. Default in plan: shared, unless an "owned" flag exists.

**Tests:**

- Round-trip a representative pre-12a.5 save through migration; verify equipped items land in the equipper's individual inventory and unequipped items land in shared.
- Migration is idempotent (running twice produces the same result).
- New save format loads cleanly without re-running migration.

**Scope impact:** This adds roughly half a day to the carve-out (migration code + idempotency test + round-trip test). Total carve-out estimate revises from "1–2 days" to "2 days plus a session of integration verification."

---

## Testing Decisions

- Unit tests on both reducer actions: stack/merge behavior, ownership rewrites, idempotency, always-succeed contract.
- Integration tests on the three dispatch sites:
  - Crafting completion → shared write fires.
  - Gathering success → shared write fires.
  - Loot distribution → retag fires per recipient.
- No new combat-history tests (coupling out of scope).
- No tests for attunement, cooking buff, or combat consumables (out of scope).
- Render/behavior tests for any UI changes in `LootDistribution.tsx` (per session-retrospective convention: write render tests for new components and behavioral changes to shared functions).
- Run tests individually with `NODE_OPTIONS="--max-old-space-size=256"` per Cowork VM memory limit.

---

## Definition of Done

- [ ] Two reducer actions implemented with always-succeed semantics.
- [ ] Three dispatch sites firing writes correctly (crafting completion, gathering success, loot distribution).
- [ ] `LootDistribution.tsx` wired to dispatch `itemRetagged`.
- [ ] Unit tests on reducer actions passing.
- [ ] Integration tests on dispatch sites passing.
- [ ] Migration step implemented; pre-12a.5 saves load correctly with `owner` defaults.
- [ ] Migration round-trip test + idempotency test passing.
- [ ] `tsc --noEmit` clean.
- [ ] `ROADMAP.md` updated to insert Phase 12a.5 section between 12a and 12b.
- [ ] A live session at the table where crafting / gathering / loot all produce visible inventory changes without hand-editing.

---

## Roadmap Placement

Insert as **Phase 12a.5 — Inventory Integration Bus** between completed 12a (Character Sheet Enhancement) and deferred 12b (GCS Import Improvements). After 12a.5 ships, resume Phase 12b as originally scoped.

---

## Followups

See [`INVENTORY_INTEGRATION_FOLLOWUPS.md`](./INVENTORY_INTEGRATION_FOLLOWUPS.md) for discovered side-issues surfaced during this design session that are explicitly out of scope for Phase 12a.5.
