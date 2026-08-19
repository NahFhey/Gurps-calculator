# Phase 12a.6 — Combat Condition Visibility

**Status:** CODE COMPLETE — session 1 (data + filter + migrations) 2026-07-04; session 2 (eye widget + badge rewrite + tooltip) 2026-07-12; session 3 (two-surface popover + overflow pills) 2026-07-12. **Table-verified 2026-08-19** (browser table session, seed campaign) on the tracker and timeline surfaces: catalog-seeded eye defaults, three-state cycle, NPC-only eyes, player-view filtering (closed omitted / half → "Afflicted" / open full), log filtering, density caps 4+"+1" and 3+"+2", pills → popover — all confirmed. **The map surface is unreachable:** `combat.mapId` has no writer anywhere in src/, so CombatMainArea and the token-legend condition button are dead code until a combat↔map link exists. Design decision needed before this phase can fully close.
**Created:** 2026-05-03
**Sequence:** Inserted between Phase 12a.5 (Inventory Integration Bus, planned) and Phase 12b (GCS Import Improvements, deferred)
**Origin:** Design concept reached via grilling session 2026-05-03

---

## Implementation Status (as-built, session 1 — 2026-07-04)

Branch `phase-12a6-condition-visibility`. Everything below the display layer is
in; the UI surfaces (eye widget, badge rewrite, popover, overflow pills, map
entry point) are sessions 2–3.

**Done:**

- **Catalog flag** — already existed as `isObvious: boolean` on every entry in
  `src/constants/conditions.ts` (Phase 6 shipped it; the plan's `obvious` flag
  needed no new code). `isConditionObvious()` helper reused throughout.
- **Type consolidation** — canonical `ConditionInstance` now lives in
  `src/types/combatTracker.ts` (with `ConditionExpiry`, `ConditionRevealState`,
  `revealed?`, `placeholder?`); the inline duplicates in `ConditionsPanel.tsx`
  and `ConditionBadge.tsx` import it. New `conditionsEngine.d.ts` types the JS
  engine for TS consumers.
- **Seeding + cycle** — `createConditionInstance` seeds `revealed` from catalog
  `isObvious` (`open`/`closed`; half is never a default), honours an explicit
  override. `cycleRevealed` (closed → half → open → closed; unknown → closed)
  and `cycleConditionRevealed(combatant, instanceId)` are ready for the eye
  widget.
- **Filter layer** — `combatViewFilter.js` filters NPC conditions per instance:
  closed dropped, half replaced by an `{ conditionId: '__concealed__', label:
  'Afflicted', placeholder: true }` stand-in (truth instanceId kept for React
  keys; no name/icon/duration leak), open passed through. Legacy instances
  without `revealed` fall back to catalog obviousness. **Behavior change:**
  HP-exact reveal no longer force-shows all enemy conditions — the eye state is
  authoritative. PCs/allies always render in full. Placeholders degrade
  gracefully through the existing badge (❓ Afflicted) until the badge rewrite.
- **Bool fold** — `Participant.isStunned`/`isUnconscious` removed from the type
  and all writers/readers/init sites. `effectsEngine.applyEffect` writes
  Stunned/Unconscious conditions with **permanent duration** (sticky until
  removed — matches old bool semantics; GURPS stun recovery is a roll, not a
  timer). `getActiveEffects` no longer reports the two (they render as
  condition badges — listing both would double-display). `turnContext.js`
  derives purely from conditions (+ `isDead`). Readers switched to
  `hasCondition`: `ActionPanel` target eligibility, `InitiativeTimeline`
  unconscious styling, `PostCombatSummary` snapshot capture
  (`ParticipantSummary` keeps its frozen bools, populated via `hasCondition`
  at snapshot time).
- **Migrations** — schema **1.5.0**. One shared per-participant helper,
  `ensureParticipantConditionVisibility` (conditionsEngine), runs from three
  places: `ensureConditionVisibility` in `src/persistence/dataMigration.ts`
  wired into `hydrateCampaignState` (live session, every load, idempotent);
  `migrateTo1_5_0` in `src/utils/dataMigrations.ts` (flat legacy
  `combatActive` shape); and `migrateImportedCombatState` in
  `useCombatExport` (old exported combat JSON). Combat history and
  ParticipantSummary snapshots stay frozen, untouched.
- **Tests** — seeding/cycle/fold/backfill units in `conditionsEngine.test.js`;
  eye-state filter matrix in `combatViewFilter.test.js`; condition-write tests
  in `effectsEngine.test.js`; bool-ignored tests in `turnContext.test.js`;
  state-level migration tests in `dataMigration.test.ts`; hydrate round-trip
  (pre-12a.6 payload → migrated, reload no-op) in `campaignStorage.test.ts`;
  1.4.0→1.5.0 handler tests in `schemaVersioning.test.ts`. Stale duplicate
  `schemaVersioning.test.js` deleted (its unique history malformed-input tests
  ported to the `.ts` suite). Two pre-existing test-authoring bugs fixed in
  passing (`useCombatStore` functional-update `round`→`currentRound` key,
  `CombatComponents` badge-duration expectation stale since Phase 11b).

## Implementation Status (as-built, session 2 — 2026-07-12)

**Done:**

- **Tooltip primitive** — new `src/components/ui/Tooltip.tsx`, exported from
  the ui barrel. Hover/focus trigger, portal to `document.body` (escapes
  overflow-clipped containers), position computed once on open (top, flipping
  to bottom near the viewport top), `role="tooltip"`. 5 unit tests.
- **`ConditionBadge` rewrite** — new `mode: 'full' | 'icon' | 'placeholder'`
  prop (default `'icon'` per the new design). Icon mode renders icon-only
  (urgency border/pulse retained; label, severity, countdown live in the
  tooltip). Placeholder rendering is **auto-forced** whenever the condition
  carries the player-view `placeholder: true` flag, so filtered view data is
  safe regardless of call-site mode; explicit `mode="placeholder"` renders at
  full density. Placeholders are grey, urgency-free, never show
  severity/duration/quick-remove, and get the generic tooltip ("This character
  has an unknown effect."). Rich React tooltip (name/severity, duration,
  source, catalog description, notes) replaces the `title=` attribute. Badge
  root carries `aria-label={label}` for icon-mode discoverability. Phase 11b
  urgency colors, countdown, pulse, and quick-remove X all preserved.
  Call sites: `ConditionsPanel` passes `mode="full"`; `ParticipantListView`
  takes the icon default. Test suite rewritten (33 tests) + CombatComponents
  badge tests updated for the mode API.
- **Eye toggle widget** — `EyeToggle` in `ConditionsPanel.tsx`: three-state
  button per condition row (closed `EyeOff` gray → half `Eye` amber/dimmed →
  open `Eye` green), title/aria-label describing state + next action.
  NPC-only (`category !== 'player' && !== 'ally'`; missing category = NPC,
  matching `filterConditions`). Legacy instances without `revealed` fall back
  to catalog obviousness for display. 9 panel tests.
- **Dispatch path** — `handleCycleConditionRevealed(conditionInstanceId)`
  added to `useCombatConditions`: cycles via `cycleRevealed`, records an
  undoable `UPDATE_CONDITION` action, deliberately writes **no combat-log
  entry** (reveal state is GM-secret; the log reaches player view). Threaded
  CombatTracker → ActionPanel (`onCycleRevealed`, passed to the panel only
  when `viewMode === ViewMode.GM`) → ConditionsPanel. 7 hook tests.
- **Browser-verified** (dev server, GM + player view): Poisoned on an enemy
  seeds eye-closed; cycling closed→half→open works from the tracker; player
  view shows nothing / one anonymous ❓ "Afflicted" placeholder / the full
  ☠️ badge respectively, with zero name leakage; tooltip renders structured
  content on hover. No console errors.
- **Discovered in passing:** pre-existing CharacterLibrary bug — `category`
  dropped on save, so library characters never appear in EncounterSetup.
  Recorded as followup #10; out of scope here.

## Implementation Status (as-built, session 3 — 2026-07-12)

**Done:**

- **Generalized dispatch** — `useCombatConditions` gained participant-targeted
  handlers (`addConditionTo` / `removeConditionFrom` /
  `cycleConditionRevealedOn`); the original actor-bound handlers are now thin
  wrappers over them. The hook accepts `combat: null` so `CombatContext` can
  call it before its no-combat early return.
- **`ConditionAddPopover`** — floating portaled card (viewport-clamped,
  outside-mousedown + Escape + header-X close) that **reuses `ConditionsPanel`
  whole** (badges + eye toggles + add form) rather than extracting just the
  form — less duplication, same two-surface reuse the plan wanted. Hosts keep
  the popover open across combat saves (unlike the ActionPanel workflow,
  which resets), so multi-add flows work.
- **Tracker surface** — `ParticipantListView` cards: urgency-sorted icon
  badges capped at 4 + "+N" pill + a GM-only "+" manage button (rendered even
  on condition-free participants). `sortConditionsByUrgency` exported from
  `ConditionBadge`; new `ConditionOverflowPill` renders as a button on GM
  surfaces and a static count in player view. Card memo comparator now also
  checks `conditions` reference + the new callback.
- **Timeline surface** — tokens show up to 3 urgency-sorted condition icons
  (emoji via `getConditionIcon`, ❓ for player-view placeholders) + a compact
  "+N" pill; pill clicks stopPropagation so they don't jump the turn.
- **Map surface** — `CombatContext` exposes the targeted handlers;
  `CombatMainArea` hosts the popover; `CombatMapPanel`'s token legend rows
  get a GM-gated per-token button. **Deviation from plan:** the entry point
  is the legend row control, not a grid-token click — `MapGrid` has no
  token-level click API (tile clicks carry movement/placement semantics and
  no mouse coords), so hooking tile clicks would have broken movement UX.
  Revisit only if the legend affordance proves unfindable at the table.
- **Hosting** — `CombatTracker` and `CombatMainArea` each own popover state
  `{instanceId, x, y}`; both look up the **truth** participant at render and
  gate entry points on GM view (`viewMode === GM` / `ctx.gmMode`).
- **Tests** — popover suite (portal, add-dispatch, eye forwarding, all three
  close paths); ParticipantListView suite (cap 4, urgency displacement, pill
  → popover, manage-button gating, static player pill); timeline additions
  (cap 3, urgency, pill-vs-jump propagation, static player pill); hook
  additions (targeted handlers hit the right participant + log, unknown-id
  and null-combat no-ops). ~30 new tests.
- **Browser-verified** (GM + player view): manage button and both pills open
  the same popover for the same participant; five conditions render 4+"+1"
  in the tracker card and 3+"+2" in the timeline; adds through the popover
  land immediately on both surfaces; Escape/outside-click close; player view
  shows no GM entry points and eye-filtered counts only. No console errors.

**Remaining:** the map surface — table verification 2026-08-19 found it
unreachable (no writer for `combat.mapId` in src/; no UI links a combat to a
map, so the token-legend entry point cannot render). Needs a combat↔map link
design decision. Tracker + timeline surfaces are fully verified.

**Update (2026-08-19, later):** 6cea50a added a GM-only Battle Map selector, so
the `combat.mapId` writer now exists. Linking a map exposed a latent crash —
CombatMapPanel's `useEffectiveRole` threw `useSyncContext must be used inside
<SyncProvider>` because no SyncProvider is mounted anywhere; fixed by adding
`useSyncContextOptional` and falling back to offline-GM defaults. Re-verified:
the map layout now mounts and renders, but the condition entry point is STILL
unreachable — CombatMainArea gates `onOpenConditions` on `ctx.gmMode`
(CombatContext-local state, default false) and nothing in the map layout calls
`setGmMode`, so the layout is permanently player-locked (the GM also sees
anonymized enemy names there). Needs a decision on which GM-mode source the
map layout respects (`ui.gmModeEnabled` vs combatUIStore view mode) before the
map surface can be table-verified.

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
