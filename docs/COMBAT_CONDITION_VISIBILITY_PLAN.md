# Phase 12a.6 — Combat Condition Visibility

**Status:** Planned (not started)
**Created:** 2026-05-03
**Sequence:** Inserted between Phase 12a.5 (Inventory Integration Bus, planned) and Phase 12b (GCS Import Improvements, deferred)
**Origin:** Design concept reached via grilling session 2026-05-03

---

## Problem

Conditions on NPCs are universally visible to all viewers. The combat tracker has no information-disclosure layer for conditions, so when the GM secretly poisons an enemy, charms an ally, or hexes a target, the player view shows the condition with full name, icon, and duration — same as the GM view. There is no way to telegraph "something is wrong with that ogre" without naming the specific effect.

The codebase already has a disclosure pattern for stats (`HPValue.mode: 'exact' | 'band' | 'unknown'`, `combatViewFilter.js`), but conditions never got pulled into it. The `ConditionInstance` shape has no `hidden`, `revealed`, or `gmOnly` field, and `ConditionBadge` has no concept of viewer context.

A second, related problem surfaces at the same layer: the `Participant` type carries `isStunned`, `isUnconscious`, `isDead`, `bleeding`, and `crippled` as boolean/payload fields *outside* the `conditions[]` array. These predate the conditions system (Phase 6) and have never been reconciled. The new visibility model only filters `conditions[]`, so even if a Stunned condition is set to "concealed," a `isStunned: true` flag set by the action-resolution code leaks through. The two sources of truth need to be reconciled for the filter to actually work.

---

## Solution Shape

### Catalog-Level Default

Each condition definition in `src/constants/conditions.ts` gains an `obvious: boolean` flag. This encodes the table-level convention for whether a condition is normally visible to players. Examples:

- **Obvious:** Prone, On Fire, Stunned, Bleeding, Unconscious
- **Concealed:** Poisoned, Charmed, Hexed, Aimed-at, Invisible-target

The flag is the *default* eye state for new instances, not a hard rule.

### Per-Instance Three-State Eye

`ConditionInstance` gains a `revealed?: 'closed' | 'half' | 'open'` field. The GM cycles through three states via an eye-icon control:

- **Closed eye** — invisible to players. Player view shows nothing for this instance.
- **Half-open eye** — telegraphed as a generic "afflicted" placeholder badge. Player knows *one* effect exists on this NPC but not its name, icon, or duration.
- **Full-open eye** — fully visible to players. Player view shows the standard `ConditionBadge`.

When a condition is added, `revealed` is seeded from the catalog `obvious` flag: `obvious: true` → `'open'`, `obvious: false` → `'closed'`. Half-open is never the default; it's always a deliberate GM choice.

The eye control is **NPC-only** in this phase. PCs always render full-visible to all viewers (no eye widget on PC participants). Per-PC visibility is deferred — see followups.

### Player View Filter

`src/utils/combatViewFilter.js` learns the eye filter. When filtering a participant's conditions for player view:

- Drop instances with `revealed === 'closed'`.
- Replace instances with `revealed === 'half'` with an anonymous "afflicted" placeholder badge — one placeholder per half-open instance (so count *is* exposed; this is the deliberate trade-off for letting the GM telegraph individual effects).
- Pass through instances with `revealed === 'open'` unchanged.

The GM view never applies the filter. GMs always see all conditions and the eye state.

### Display Layer

`ConditionBadge` is rewritten to:

- **Icon-only by default** — the simple icon from the catalog, no inline label.
- **Rich React tooltip on hover** — formatted name, severity, duration, and effect description (currently `formatConditionTooltip` returns plain text; this phase upgrades to a proper React tooltip component).
- **Placeholder mode** — a separate render mode (or sibling `ConditionPlaceholderBadge` component) renders a generic grey "?" / "afflicted" badge with a generic tooltip ("This NPC has an unknown effect").
- Existing Phase 11b features preserved: urgency colors (red/orange/purple), countdown text, severity multiplier display, quick-remove X.

### Two-Surface Assignment

The condition-add UI is extracted from `ConditionsPanel.tsx` into a reusable popover (`ConditionAddPopover.tsx` or similar). Two entry points open the same popover:

- **Combat tracker** — clicking on a participant row's "+" / add-condition button.
- **Map** — clicking on a token. The exact integration point in `MapPanel`/`MapGrid` is a survey-at-implementation-start item; the click handler dispatches an "open condition popover for this participant" action.

The popover takes a participant ID and dispatches the same `addCondition` action regardless of entry point.

### Density Cap

When a participant has many conditions visible to the current viewer:

- **Combat tracker participant row:** show first 4 condition icons inline, sorted by urgency (the existing `getUrgency` ordering — expiring first, then low, then normal/none). If more than 4, append a "+N" overflow pill that opens the conditions popover.
- **Initiative timeline strip:** show first 3 icons (tighter horizontal constraint), sorted same way. If more than 3, append "+N" overflow pill that opens the same popover.

Always-visible status (Bleeding, Crippled, Dead) renders in its own section of the participant row, not in the conditions count. Out of scope to fold them in; see followups.

### Bool Field Migration (Bundled)

Two participant bool fields fold into the `conditions[]` array as the single source of truth:

- `Participant.isStunned` → represented as a Stunned condition (`ConditionId.STUNNED`).
- `Participant.isUnconscious` → represented as an Unconscious condition (`ConditionId.UNCONSCIOUS`).

Three fields stay as-is:

- `Participant.isDead` — kept as a boolean. Heavy hot-path use in `InitiativeTimeline` (ring color, opacity, line-through, label, badge color, token gating) and `PostCombatSummary` (death counts, victory checks, party-deaths rollup). Death is also categorically uncoverable — eye-closed on Dead makes no narrative sense.
- `Participant.bleeding: { rate, round } | null` — payload doesn't fit generic `ConditionInstance` shape. Renders as its own status badge in PostCombatSummary.
- `Participant.crippled: string[]` — per-anatomy injury record, not a duration-bearing condition. Stays as own field.

---

## In-Scope User Stories

- As a GM, I assign a Poisoned condition to an NPC; players see only an "afflicted" placeholder badge, not the poison name or duration.
- As a GM, when the party rolls Diagnosis and identifies the poison, I click the eye icon to flip that one instance from half-open to full-open; the players' view updates to show the full Poisoned badge.
- As a GM, I assign Bleeding (catalog-default obvious) to an NPC; players see the full Bleeding badge immediately without my needing to toggle anything.
- As a GM, I want to hide a normally-obvious condition for narrative reasons (Bleeding under heavy armor); I cycle the eye to closed.
- As a GM, I click a token on the map and add a condition without leaving the map view; the same condition appears in the combat tracker.
- As a GM, when an NPC accumulates many conditions, I see the first 4 (or 3 in the timeline) plus a "+N" pill; clicking the pill opens the full conditions panel.
- As a player, when an NPC has multiple half-open conditions, I see one anonymous badge per concealed effect — letting me know the NPC has, e.g., two unidentified afflictions without revealing what they are.
- As a GM, after the bool migration, I cannot accidentally bypass the visibility filter — Stunned set by an attack appears in the conditions array and respects the eye state I configure.

---

## Out of Scope

These are the boundaries that define done.

- **PC-side eye control.** PCs always render full-visible in this phase. The "player wants to hide their own status from other players" use case is real but adds permission-model complexity (who can toggle whose eye?). Deferred to followups.
- **Bleeding folded into conditions array.** The `{ rate, round }` payload is richer than the generic `ConditionInstance` shape; folding it requires either widening `ConditionInstance` (scope creep) or losing the rate-per-round semantics. Stays as own field. See followups.
- **Crippled folded into conditions array.** Per-anatomy permanent injury, not a condition in the GURPS sense. Stays as own field.
- **`isDead` migrated.** Heavy hot-path consumer footprint (12+ direct reads in `InitiativeTimeline` and `PostCombatSummary`), and Death is categorically uncoverable. Stays as own field.
- **Per-table override of catalog `obvious` flags.** The flag is hardcoded in `src/constants/conditions.ts`. A future phase could expose a settings UI to let the GM rebalance defaults per-table. See followups.
- **`useActionResolution` reveal-state machinery integration.** The hook already has reveal-state logic for damage/effects. Whether the eye control should plug into that hook vs. live standalone is a survey-at-implementation-start item; default plan is standalone. See followups.
- **`PostCombatSummary` snapshot type migration.** The `ParticipantSummary` snapshot copies `isStunned`/`isUnconscious`/`isDead`/`bleeding`/`crippled` at end-of-combat. Snapshots are by definition frozen-in-time records; they keep their existing shape. New combats produce snapshots that will (post-migration) only have `isStunned`/`isUnconscious` set if a Stunned/Unconscious condition is in the array. Display logic stays the same.
- **Unifying the dual turn/maneuver/dice logic** in `CombatTracker` vs `useCombatSession`. Pre-existing tech debt, flagged in the resume skill, not addressed here.
- **Animations** for eye-state transitions, placeholder reveal, etc. Static UI for v1.

---

## Implementation Decisions

### Data Layer

- **Catalog flag** lives on each entry in `src/constants/conditions.ts`. Required field on every entry — TypeScript signals if any entry is missing it.
- **Instance flag** added to the `ConditionInstance` interface (currently defined inline in `src/components/combat/ConditionBadge.tsx` and `src/components/combat/ConditionsPanel.tsx`; consolidate to one definition in `src/utils/conditionsEngine.ts` or `src/types/combatTracker.ts`). Field: `revealed?: 'closed' | 'half' | 'open'`. Optional because legacy data needs migration.
- **Eye-state cycle helper** in `src/utils/conditionsEngine.ts`: `cycleRevealed(state)` returns the next state in `closed → half → open → closed`.
- **Default seeding** at instance creation — `createConditionInstance` reads catalog `obvious` and seeds `revealed` accordingly.

### Display Layer

- **`ConditionBadge`** rewritten:
  - New prop: `mode: 'full' | 'icon' | 'placeholder'` (default `'icon'` for the new design).
  - Icon mode: render only the icon, hide label inline.
  - Placeholder mode: render a generic grey "?" badge with no severity/duration/quick-remove.
  - Tooltip: replace HTML `title=` attribute with a proper React tooltip wrapper. If the project already has a tooltip primitive in `src/components/ui/`, reuse it; otherwise add a lightweight one.
- **Eye toggle widget** lives next to each condition row in `ConditionsPanel.tsx` (and in the new condition-add popover). Three icons cycled on click — closed eye, half-open eye, open eye. Use `lucide-react` icons (`EyeOff`, `Eye`, with a half-state or custom variant — survey existing icon use at implementation start).
- **"+N" overflow pill** new component (`ConditionOverflowPill.tsx` or inline in `ParticipantListView` / `InitiativeTimeline`). Click opens the conditions popover for that participant.

### Filter Layer

- **`src/utils/combatViewFilter.js`** extends the existing per-participant filter with eye logic:
  - Walk `participant.conditions[]`; drop closed, replace half with placeholder, pass open through.
  - Continue dropping/passing existing fields (`isDead`, `bleeding`, `crippled`) per current behavior.
  - Drop the lines that propagate `isStunned`/`isUnconscious` (those fields no longer exist).

### Two-Surface Popover

- **Extract** condition-add UI from `ConditionsPanel.tsx` into `ConditionAddPopover.tsx` (new file in `src/components/combat/`).
- **Tracker entry point:** participant row "+" button or current `ConditionsPanel` integration calls into the popover.
- **Map entry point:** survey at implementation start — likely a click handler on token in `MapPanel` / `MapGrid` opens the popover positioned over the click point. Selected participant ID is the token's bound combatant.
- The popover dispatches the same `addCondition` action through `useCombatConditions` regardless of entry point.

### Bool Migration

Files modified for the migration:

- **Writers (effectsEngine):**
  - `src/utils/effectsEngine.js:266` — replace `updates.isStunned = effectData.stunned` with `addCondition(updates, ConditionId.STUNNED, { ... })` or equivalent.
  - `src/utils/effectsEngine.js:270` — same for `unconscious`.
  - `src/utils/effectsEngine.js:324, 328` — display formatters that read the bools; switch to `hasCondition` selector.

- **Readers:**
  - `src/components/combat/ActionPanel.tsx:162` — `t.isDead || t.isUnconscious || t.isStunned` → `t.isDead || hasCondition(t, ConditionId.UNCONSCIOUS) || hasCondition(t, ConditionId.STUNNED)`.
  - `src/components/combat/views/InitiativeTimeline.tsx:103` — `participant.isUnconscious` → `hasCondition(participant, ConditionId.UNCONSCIOUS)`. Cascade to lines 125, 149, 158.
  - `src/components/combat/PostCombatSummary.tsx:81-82, 181, 200` — switch reads to `hasCondition`. Note: the snapshot type `ParticipantSummary` still has the bool fields; populate from `hasCondition` at snapshot time.
  - `src/components/combat/CombatTracker.tsx:438, 441, 614` — switch from `turnContext.isStunned/isUnconscious` to selector calls (or simplify turnContext, see below).
  - `src/components/combat/CombatContext.tsx:306, 309` — same.
  - `src/hooks/useCombatSession.ts:301, 304` — same.
  - `src/utils/combatViewFilter.js:152, 153, 160` — drop these lines; conditions array carries the info now (filtered through the eye logic).

- **Init defaults (drop bool fields):**
  - `src/components/combat/EncounterSetup.tsx:122-123, 299-300` — drop `isStunned: false, isUnconscious: false` from the init.
  - `src/hooks/useCombatReinforcements.ts:86-87` — same.
  - `src/utils/combatHelpers.ts:645-646` — same.

- **Type cleanup:**
  - `src/types/combatTracker.ts:65-66` — remove `isStunned?: boolean` and `isUnconscious?: boolean` from `Participant`.
  - `src/types/combatTracker.ts:235, 238, 429-430` — these are the `ParticipantSummary` and other types. `ParticipantSummary` keeps the fields (it's a frozen snapshot). Confirm at implementation time.

- **Simplify `turnContext.js`:**
  - Lines 29 and 32 currently union the bool with the condition. After migration, the bool is gone; simplify to `hasCondition(combatant, ConditionId.STUNNED)` and `hasCondition(combatant, ConditionId.UNCONSCIOUS) || combatant.isDead`.

---

## Migration & Backward Compatibility

This phase changes persisted data shapes. Two migrations are required.

### Migration 1: `ConditionInstance.revealed` Backfill

**Problem:** Existing combat saves have `ConditionInstance` records without a `revealed` field.

**Fix:** On combat-state load, walk every participant's `conditions[]`. For each instance with `revealed === undefined`, set it from the catalog: `revealed = catalogObvious(conditionId) ? 'open' : 'closed'`.

**Rationale:** Default to the catalog default. Legacy GMs who'd been mentally tracking visibility get their conditions seeded with the conventional default; they can re-toggle as needed.

**Idempotency:** Re-running migration on already-migrated data is a no-op (every instance already has `revealed` set).

### Migration 2: Bool → Condition Fold

**Problem:** Existing saves have `Participant.isStunned: true` and `Participant.isUnconscious: true` as boolean fields. After this phase, those fields don't exist.

**Fix:** On combat-state load, walk every participant:

1. If `isStunned === true` and no Stunned condition exists in `conditions[]`, insert one (default permanent duration, no severity, no source). Set `revealed: 'open'` (Stunned is catalog-obvious).
2. Same for `isUnconscious === true` → insert Unconscious condition.
3. After insertion, delete the bool fields from the participant object.

**Schema version bump:** The combat-state shape gets a new schema version. Existing version comparison logic in `src/utils/schemaVersioning.js` handles the bump.

**Idempotency:** Re-running is a no-op — bool fields are gone after first run, and the `hasCondition` check prevents double-insertion if both the bool and a condition existed in legacy data.

**Edge case:** Participant with `isStunned: true` AND a Stunned condition already in the array. Migration sees the existing condition, skips the insert, drops the bool. Net result: one Stunned condition, consistent state.

**Edge case:** Combat snapshots in `PostCombatSummary`'s `ParticipantSummary` records. These are frozen end-of-combat captures, not live combat state. They keep their bool fields and don't need migration. New snapshots produced post-migration populate the bools from `hasCondition` at snapshot time.

### Tests

- **Round-trip:** Load a representative pre-12a.6 save through migration; verify (a) `ConditionInstance.revealed` is populated per catalog defaults, (b) `isStunned: true` participants now have a Stunned condition and no `isStunned` field, (c) re-running migration produces no further changes.
- **Idempotency:** Run migration twice; second run is a no-op.
- **Mixed legacy:** Participant with both `isStunned: true` and an existing Stunned condition → one condition, no double-insert.
- **New save format:** Saves produced post-migration load cleanly without re-running migration.

**Scope impact:** Migration adds roughly half a session of work (migration code + idempotency + round-trip + mixed-legacy tests). Already counted in the total estimate.

---

## Testing Decisions

- **Catalog:** TypeScript-level check that every entry in `src/constants/conditions.ts` has the `obvious` field. No runtime test needed (compile-time guarantee).
- **Eye-state filter:** Pure-function unit tests on the filter logic in `combatViewFilter.js`. Cover all three eye states, GM vs player viewer context, mixed-state participants, empty conditions array.
- **Catalog default seeding:** Unit test on `createConditionInstance` — adding a Bleeding instance seeds `revealed: 'open'`; adding a Poisoned instance seeds `revealed: 'closed'`.
- **`cycleRevealed` helper:** Unit test the three-state cycle.
- **Bool migration:** As described above (round-trip, idempotency, mixed legacy, new format).
- **`hasCondition` consumers:** Render tests for ActionPanel target eligibility, InitiativeTimeline visual styling on unconscious participants, PostCombatSummary status badges.
- **`ConditionBadge` modes:** Render tests for `mode: 'full'`, `mode: 'icon'`, `mode: 'placeholder'`. Hover-tooltip behavior.
- **Two-surface popover:** Integration test — opening the popover from a tracker click vs. a token click results in the same dispatch and same condition added to the same participant.
- **"+N" overflow:** Render test — participant with 6 conditions in a tracker row shows 4 icons plus "+2" pill; participant with 5 in timeline shows 3 icons plus "+2".
- **Run tests individually** with `NODE_OPTIONS="--max-old-space-size=256"` per Cowork VM memory limit (per `project_test_memory_limits.md`).

---

## Definition of Done

- [ ] `obvious: boolean` added to every entry in `src/constants/conditions.ts`.
- [ ] `revealed?: 'closed' | 'half' | 'open'` added to `ConditionInstance` type (consolidated definition).
- [ ] `createConditionInstance` seeds `revealed` from catalog default.
- [ ] `cycleRevealed` helper implemented and unit-tested.
- [ ] `ConditionBadge` rewritten with `mode` prop and React tooltip.
- [ ] Placeholder render mode (or sibling component) implemented.
- [ ] `combatViewFilter.js` extended with eye-state filtering for player view.
- [ ] Eye toggle widget in `ConditionsPanel` and condition-add popover.
- [ ] `ConditionAddPopover` component extracted and reusable from two surfaces.
- [ ] Map token click opens the popover at the click position.
- [ ] "+N" overflow pill in tracker row (cap 4) and initiative timeline (cap 3).
- [ ] `Participant.isStunned` and `isUnconscious` removed; all consumers switched to `hasCondition`.
- [ ] `effectsEngine.js` writes Stunned/Unconscious conditions instead of bools.
- [ ] `turnContext.js` simplified after bool removal.
- [ ] Migration 1 (`revealed` backfill) implemented and round-trip tested.
- [ ] Migration 2 (bool → condition) implemented and round-trip tested.
- [ ] Schema version bump on combat-state shape.
- [ ] All combat tests passing.
- [ ] `tsc --noEmit` clean.
- [ ] `ROADMAP.md` updated to insert Phase 12a.6 section between 12a.5 and 12b.
- [ ] A live session at the table where the GM uses the eye control to telegraph a hidden condition and the player view reflects the change.

---

## Roadmap Placement

Insert as **Phase 12a.6 — Combat Condition Visibility** between planned 12a.5 (Inventory Integration Bus) and deferred 12b (GCS Import Improvements).

**Why this is wedged here:**

- Combat is in active use every session. The visibility gap is currently worked around by GM verbal narration ("the ogre looks afflicted, you don't know with what"), which is fragile and inconsistent.
- The phase is small and contained (no dependencies on inventory or GCS work). Slotting it next to the other combat-polish phases (11a–11c, 12a combat integration) keeps that work grouped.
- The bundled bool migration is overdue tech-debt cleanup that's been hanging since Phase 6. Doing it now, while the visibility model needs it, avoids paying the migration cost twice.
- 12b (GCS import) is a chunkier topic that benefits from being approached fresh. Wedging this smaller phase in front doesn't extend the path to 12b meaningfully.

**Estimated effort:** 2–3 sessions. Includes design refinement (already done), implementation across ~10–12 source files, two migrations with round-trip tests, render tests for new modes, and table verification.

---

## Followups

See [`COMBAT_CONDITION_VISIBILITY_FOLLOWUPS.md`](./COMBAT_CONDITION_VISIBILITY_FOLLOWUPS.md) for discovered side-issues surfaced during this design session that are explicitly out of scope for Phase 12a.6.
