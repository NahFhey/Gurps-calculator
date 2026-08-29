# Research/Study (13c) — Design Concept

**Status:** Designed 2026-08-28 (grill-me session, 6 questions + 6 batched
calls). Spec `2026-08-28-study-13c.md` written same day; **dispatch queued
behind the trading lane** (same touchpoint files — no parallel Codex runs).
**Origin:** ROADMAP.md Phase 13c bullet "Research/Study (skill improvement
during downtime)".

## Problem

Downtime has no path from time spent to character advancement. Skill
advancement exists only as a manual character-sheet edit ("Record Advancement"
in `SkillHistorySection`), disconnected from campaign time; `TaskResults.
experienceGained` is a dead hook set to 0 everywhere; no XP or point-budget
system exists.

## Decisions (all locked in grilling)

1. **Scope: skill improvement only.** Information/lore research is GM narration
   — no mechanics, explicitly out of scope. Tile is named **Study**.
2. **Award model: GM-ratified, one click.** Progress (hours) accrues
   automatically; at threshold a "ready to award" badge appears and the GM
   clicks **Award point** — which programmatically runs the existing Record
   Advancement mechanics (appends `SkillAdvancementEntry`, recomputes the
   skill's points/level/relativeLevel). First programmatic creator of those
   entries; session label stamps campaign time ("Study — Day N").
3. **Pacing: hours-based, configurable threshold.** `studyConfig.hoursPerPoint`
   (default **200**, GURPS B292 RAW) in `entities` with the foragingConfig
   read-fallback pattern; edited from a GM control in the Study view header.
   A study slot = **4 hours** (constant). Self-study = **half rate** (2h).
4. **Full rate sources:** a **teacher** (a real helper on the task —
   slot-locked, must have the studied skill at a level above the student's
   current; enforced at creation) OR **good study materials** (GM checkbox,
   narrative — no book entity exists and none is built). Either → 4h; neither
   → 2h; both → nothing extra.
5. **New skills learnable.** Free-text name + difficulty (E/A/H/VH) + governing
   attribute on the form; existing skills prefill from the sheet. The sheet
   `Skill` entry is created on the FIRST ratified point (1 point, computed
   level). Typo-divergence from GCS names accepted (same class as dietary
   restrictions' explicit-config decision).
6. **No roll, no ceremony.** Study is deterministic time accounting (RAW).
   Resolution is a one-click **Complete** on the task card (auto-computes
   hours, no panel) plus a **"Complete all pending study"** bulk button in the
   view header. (Grilled as "auto-resolve at time advance"; adjusted to
   card/bulk click at implementation survey — the reducer's time-advance path
   deliberately ticks nothing, and fishing/mining auto-resolve is per-card
   mode, not a clock hook. The no-friction substance stands.)

### Batched calls

- **StudyProject entity** (the multi-day accumulator, following the
  Craft/AlchemyBatch precedent of slot-bounded tasks + persistent
  `state.entities` project): created implicitly on a character's first study
  task for a skill; multiple concurrent projects per character (one skill per
  task); hours **roll over** after an award (accumulated − hoursPerPoint);
  persists until explicitly abandoned (deleted) from its card.
- **Award surface:** project cards with progress bars in the Study view.
- **Changelog:** `study` family — session logged, point awarded.
- **Sequencing:** dispatch after trading merges (shared files: downtime types,
  TileGrid, DowntimePanel, activityLogger, ChangelogTab).

## Out of scope (recorded followups)

- Information/lore research mechanics.
- Book/manual items and library facilities — a library becomes a natural
  Facility type or `activityCategories.study` bonus when Phase 14c
  location-based facilities land.
- Teaching skill (GURPS) refinements; multi-student classes.
- Point-budget/XP economy enforcement (no unspent-point pool exists anywhere;
  building one is its own feature).
- Attribute, spell, and trait advancement — skills only.
- Study-quality variance rolls.

## Testing decisions

Pure engine tests (hour crediting full/half rate, threshold detection,
rollover math, award computation incl. new-skill creation and denormalized
level recomputation); reducer tests (studyProjects CRUD, studyConfig fallback,
award action idempotence); component tests (form incl. teacher eligibility
error, card complete-click, bulk complete, award click writes history +
sheet); changelog family assertions. Existing `SkillHistorySection` tests must
stay green.
