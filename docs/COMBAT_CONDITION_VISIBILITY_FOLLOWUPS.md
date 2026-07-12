# Combat Condition Visibility — Followups

Discovered side-issues surfaced during the Phase 12a.6 design session (2026-05-03) that are explicitly **out of scope** for the conditions visibility phase. Recorded here to prevent loss and inform future phase planning.

See [`COMBAT_CONDITION_VISIBILITY_PLAN.md`](./COMBAT_CONDITION_VISIBILITY_PLAN.md) for the in-scope work.

---

## 1. PC-Side Eye Control

**Context:** Phase 12a.6 ships eye visibility for NPCs only. PCs always render full-visible to all viewers. The use case for PC-side eye control is real but adds permission-model complexity.

**Use cases:**
- Player wants to hide a Charm-Resisted or other meta-relevant condition from other players ("I don't want them to know I'm fighting the compulsion").
- GM wants to hide a Cursed condition from the affected player until it manifests.
- Player wants to telegraph "something's wrong with my PC" without specifying what (mid-roleplay reveal).

**Open questions:**
- Permission model — who can toggle the eye on a PC? PC owner, GM, or both?
- Default state for PC conditions — full-open like NPCs default-obvious, or a more cautious closed-by-default?
- Visibility scope — closed/half/open is GM-vs-everyone-else; do PC conditions need a third axis (visible to GM only vs visible to specific other players)?
- UI surface — does the player see the eye widget on their own PC sheet, or only in the combat tracker view?
- Does this affect the export hook (`useCombatExport`)? Player-view export currently covers PCs as fully visible.

**Notes:** Probably its own small phase once a session demonstrates the need. Not blocking 12a.6.

---

## 2. Bleeding Folded into Conditions Array

**Context:** `Participant.bleeding: { rate: number, round: number } | null` carries payload that doesn't fit the generic `ConditionInstance` shape. Phase 12a.6 leaves it as a separate field.

**Open questions:**
- Widen `ConditionInstance` with a `payload?: Record<string, unknown>` slot? Risks adding a sloppy bag for arbitrary state.
- Use the `severity` field for `rate` and `notes` for `round`? Bleeding is `rate HP/turn starting at round R`; severity could carry rate, but the round-tracking is less natural.
- Add a typed payload union: `payload?: BleedingPayload | OtherPayload`? Cleaner but invasive.
- If folded, does it gain eye control? Obvious bleeding being concealable has narrative value (wound under armor) but isn't currently expressible.

**Notes:** Defer until either (a) we add another condition with structured payload (forcing the design choice) or (b) GMs report wanting to conceal Bleeding for narrative reasons.

---

## 3. Crippled Folded into Conditions Array

**Context:** `Participant.crippled: string[]` is a list of crippled hit location keys. Phase 12a.6 leaves it as a separate field.

**Open questions:**
- Crippled is per-anatomy and effectively permanent within a combat (recovery requires GURPS B424 healing). Generic conditions are duration-bearing and removable.
- Multiple crippled locations — represented as a single condition with a list payload, or one condition per location? The latter expands the conditions array meaningfully on a heavily-injured combatant.
- Does it gain eye control? Probably not — a missing arm is visibly missing.

**Notes:** Likely permanent separation. Captured for completeness; this followup will probably resolve as "WONTFIX, keep separate."

---

## 4. `useActionResolution` Reveal-State Integration

**Context:** The `useActionResolution` hook (Phase 11a, 437 lines) already has reveal-state machinery for damage/effect processing. Phase 12a.6's eye control plans to live standalone, but there may be value in plugging into the existing reveal pipeline.

**Open questions:**
- Does `useActionResolution`'s reveal logic operate on the same shape as `combatViewFilter.js`? Quick survey at implementation start to find out.
- If yes, the eye toggle could dispatch through the same hook for consistency (one place that owns "what does the player see").
- If no, the standalone path is correct — don't force coupling that doesn't fit.
- Could be a small follow-up cleanup phase if surveying reveals duplication.

**Notes:** Survey at implementation start. Probably 30 minutes to determine direction.

---

## 5. `PostCombatSummary` Snapshot Type Drift

**Context:** `ParticipantSummary` (defined in `src/types/combatTracker.ts`) is a snapshot type populated at end-of-combat. It currently copies `isStunned`/`isUnconscious`/`isDead`/`bleeding`/`crippled` directly from the participant.

After Phase 12a.6's bool migration, the source `Participant` no longer has `isStunned` and `isUnconscious` fields. The snapshot population code switches to `hasCondition` reads. **The snapshot type itself keeps the bool fields** — snapshots are frozen records and don't migrate.

**Open questions:**
- Does keeping the snapshot fields lead to confusion? The shape diverges from `Participant` in a way that's not immediately visible.
- Should the snapshot type be migrated too, perhaps for consistency? Cost: re-walk all historical snapshots in saves; benefit: one shape to remember.
- If kept divergent, is there a doc comment on `ParticipantSummary` that explains why it has bool fields the source type doesn't?

**Notes:** Decide at implementation start whether to add the doc comment now or leave for a future cleanup. Either way, the snapshot stays bool-bearing for this phase.

---

## 6. Configurable Per-Table Catalog `obvious` Defaults

**Context:** Phase 12a.6 hardcodes the `obvious: boolean` flag in `src/constants/conditions.ts`. Different GMs and tables may disagree on what's "obvious" — one table may want Stunned to be telegraphed-only (half-open default), another may want Poisoned obvious because their PCs are all medics.

**Open questions:**
- Where would the per-table override live — campaign settings, GM preferences, or a separate "house rules" config?
- Migration impact — changing the catalog default affects future condition instances' seeded `revealed`, but does it touch existing instances? (Probably not; existing instances are seeded once at creation.)
- UI shape — settings panel with a toggle per condition? Table view with bulk override? Search-and-edit?
- Plays into the broader "house rules" conversation that hasn't started yet.

**Notes:** Wait for GM feedback on whether the hardcoded defaults are wrong for any table. If multiple tables want different defaults, this becomes a real phase.

---

## 7. Unified Status Display Layer

**Context:** Phase 12a.6 keeps `isDead`, `bleeding`, and `crippled` rendering in their own section of the participant card, separate from the conditions row. The result is two status display systems on one participant.

**Open questions:**
- Worth unifying into a single status strip that visually distinguishes "always-visible status" from "conditions"? E.g., a single horizontal strip with section dividers.
- Does the eye-control-doesn't-apply distinction for Dead/Bleeding/Crippled need to remain visually obvious to the GM (so they don't try to toggle visibility on a Dead participant)?
- The "+N" overflow already grows the conditions row vertically when expanded; merging in always-visible status would make the row taller still.
- Cosmetic, not blocking.

**Notes:** Defer. The current two-section layout is functional; unification is a polish phase if/when participant rows feel cluttered.

---

## 8. `ConditionInstance` Type Consolidation

**Context:** During the design survey, two separate inline `ConditionInstance` interfaces were observed in `ConditionBadge.tsx` and `ConditionsPanel.tsx`. The canonical type definition (if it exists) is in `src/utils/conditionsEngine.ts` or should be promoted to `src/types/combatTracker.ts`.

**Open questions:**
- Is there already a canonical `ConditionInstance` type that the inline ones drifted from, or are these the only definitions?
- If consolidating into one definition, do consumers all fit cleanly, or do some have additional fields the others don't?
- Phase 12a.6 will need to add `revealed` to *the* canonical type — opportunity to consolidate during this work.

**Notes:** Address during Phase 12a.6 implementation as part of adding the `revealed` field. Bumped here as a "while you're in there" item rather than a separate followup.

---

## 9. CombatTracker / useCombatSession Logic Overlap (Pre-existing)

**Context:** Not specific to this design session, but flagged in the `gurps-vtt-resume` skill and previously in the inventory followups. CombatTracker and `useCombatSession` have overlapping turn/maneuver/dice logic. Several of the bool-migration consumer-update sites (CombatTracker.tsx, CombatContext.tsx, useCombatSession.ts) live on both sides of this duplication.

**Notes:** Independent of conditions visibility work. Address opportunistically when a combat feature touches both paths. Don't expand 12a.6 scope to fix it.

---

## 10. CharacterLibrary Drops `category` on Save (Pre-existing, discovered session 2 — 2026-07-12)

**Context:** Discovered during session 2 browser verification. `libraryCharacterToCombat()` in `src/components/combat/CharacterLibrary.tsx` maps the form's four-value `category` ('player' | 'ally' | 'enemy' | 'object') to `isNPC: char.category === 'npc'` — a value the form never produces — and drops the category string entirely. The stored `CombatCharacter` record has no `category` field, so `EncounterSetup`'s "Add from Library" groups (which filter on `c.category === 'enemy'` etc.) never show manually created characters. The reverse mapping `combatCharacterToLibrary()` invents `'npc' | 'player'`, which isn't even a legal form value.

**Impact:** Any character created via the library's New Character form is invisible in Encounter Setup. Verification worked around it by patching `category` into localStorage directly.

**Fix shape:** Persist `category` on `CombatCharacter` (type + both mapping functions), derive `isNPC` from it or drop `isNPC`, and backfill existing records (default `'enemy'` when `isNPC` true-ish semantics are absent — or infer from nothing and default `'player'`? decide at fix time). Small migration; entity shape change.

**Notes:** Not 12a.6 scope — it's a library/encounter data-flow bug that predates conditions visibility. Worth its own small fix session before 12c (NPC generator writes into the same shape).

**Resolution:** Fixed in `claude/awesome-montalcini-b98e14` (schema 1.5.1). `category` is now a **required** field on `CombatCharacter`, so new writers (e.g. the 12c NPC generator) are compiler-forced to set it.
