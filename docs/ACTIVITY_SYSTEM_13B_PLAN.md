# Phase 13b: Activity System Improvements — Design Concept (Bundle)

**Status:** ✅ ALL FOUR LANES SHIPPED — 13b COMPLETE. Designed 2026-08-26 (grill-me
session); lanes 1–3 shipped 2026-08-26, lane 4 (chaining) shipped 2026-08-27 (spec
`2026-08-27-chaining-13b-lane4.md`, merge `codex/chaining`).
**Origin:** ROADMAP.md Phase 13b (five bullets), reconciled against recon findings
(crafting preview already existed; tool-conflict UX half-built; result records in
three silos; batch/chaining green-field; cooking is not a downtime task).

## Structure: a bundle of four lanes, not one phase

1. **Parity lane — ✅ SHIPPED 2026-08-26** (codex-shepherd, spec
   `2026-08-26-downtime-parity-13b-lane1.md`): shared `ToolSelector` wired into
   Mining/Foraging (proactive reserved-tool greying via
   `selectReservedToolIdsForSlot`, Fishing untouched); crafting-style green/red
   requirement previews in alchemy's new-batch panel (vs reagent stock) and
   cooking's CreateMealView (vs party food holdings), start/confirm disabled when
   short. Closes roadmap bullets "material requirement previews" and "better tool
   reservation UX".
2. **Result history lane — ✅ SHIPPED 2026-08-26** (codex-shepherd, spec
   `2026-08-26-result-history-13b-lane2.md`) — closes "activity result history
   with searchable log".
3. **Batch operations lane — ✅ SHIPPED 2026-08-26** (codex-shepherd, spec
   `2026-08-26-batch-ops-13b-lane3.md`) — closes "batch operations".
4. **Chaining lane — ✅ SHIPPED 2026-08-27** (codex-shepherd, spec
   `2026-08-27-chaining-13b-lane4.md`) — closes "activity chaining". As built:
   one-shot `ui.pendingIntent` (`cook`/`craft`/`promote`) nulled on hydrate and
   in both export halves; optional `InventoryDelta.kind` stamped at all six
   fishing/foraging/mining resolution sites (manual + auto); shared
   `ChainingAffordances` on the three gathering task cards; ManagerTab →
   ReagentsView promotion picker preselects first matching source by name.
   Bonus fix: foraging deltas now record the acquired inventory id (was the
   catalog id — cook prefill would have pointed at non-existent foods).

Sequencing: history ∥ batch (disjoint footprints), chaining last (touches the
most surfaces; its lab prefill builds on the reagent-promotion picker).

## Lane 2: Result history = structured changelog upgrade

- **Model:** upgrade the existing `state.logs.entries` changelog — NOT a new
  result store (would be a fourth silo) and NOT a resolved-task query view
  (can't see cooking/combat/inventory). The changelog is the one stream every
  system already writes, and it already has GM/player visibility masking.
- **Game-time stamping:** the reducer stamps `dayKey`/`slot` from `state.time`
  onto every appended entry — zero call-site churn, all creators covered.
- **Structured `meta` (optional):** `{ characterIds?, characterNames?,
  itemNames?, quantity?, taskId? }`. All six creator families
  (alchemy/cooking/crafting/gathering/inventory/combat) adopt it in one
  mechanical pass, passing only data already in scope at each call site (ids
  where available, names where that's all the site has). No new data threading.
- **No backfill:** legacy entries stay message-only, reachable via text search.
- **Retention:** hard cap 2,000 entries, reducer trims oldest on append. No
  archive mechanism (campaign exports already snapshot the log).
- **ChangelogTab filters (client-side, useMemo over capped array):** text search
  (case-insensitive, works on legacy entries), category (existing `type`
  values), day range (stamped dayKey), character (party roster; matches ids
  first, names fallback). Visibility masking applies BEFORE filtering.

## Lane 3: Batch operations = N parallel single-leader tasks

- **Model:** batch is a creation-time convenience only. One submit fans out N
  normal `DowntimeTask`s, one leader each — no multi-leader task shape, no
  resolution changes.
- **Coverage:** fishing, foraging, mining, rest. NOT alchemy/crafting (per-task
  config is the substance there; batch saves nothing).
- **Entry point:** a "batch assign" toggle inside each covered activity's
  existing task form — swaps the leader picker for a character multi-select
  plus per-row compact `ToolSelector`s. Shared config (zone/site/day/slot)
  entered once. Rest gets a minimal form if it lacks one.
- **Intra-batch tool exclusivity:** each row's reserved set = committed slot
  reservations PLUS tools picked by other rows in the draft — double-booking is
  unpickable. Submit-time validation applies the same rule (validate each
  constructed task against state + earlier batch rows) so UI and validator
  cannot disagree.
- **Submit semantics: all-or-nothing.** Any row failing validation blocks the
  whole batch with per-row errors; no partial creation.

## Lane 4: Chaining = follow-on affordances

- **Model:** UX shortcut, not a data feature and not automation. When a
  gathering-type task resolves, its results footer offers contextual next steps
  (secondary-styled buttons, shown only when the matching output kind is
  present):
  - food in haul → **"Cook with these"** (CreateMealView, matching ingredient
    rows preselected)
  - materials in haul → **"Craft with these"** (designs view, no prefill — the
    preview already shows affordability) and **"Send to lab"** (Manager
    ReagentsView promotion picker, hauled entry preselected)
- **Mechanism:** one-shot `pendingIntent` in the UI slice
  (`{ kind: 'cook' | 'craft' | 'promote', payload }`), dispatched with the
  module switch; target surface consumes and clears it on mount. Never
  persisted across reload. No bridge contexts, no prop drilling.
- **Not offered:** alchemy completion (end products), crafting completion
  (stash "Give to…" covers it), rest, combat loot.

## Out of scope (whole bundle)

- Item→material bridge for crafted components feeding later crafts — RECORDED
  followup, contingent on the table actually wanting component-then-assembly
  crafts. Structural cousin of reagent promotion; do not build on symmetry
  alone.
- Pipeline automation (auto-triggering chains) — rejected outright; fights GM
  adjudication.
- Making cooking a real `DowntimeTask` (slot/status/leader) — observed seam,
  explicitly untouched by all four lanes (history covers cooking via the
  changelog; batch excludes it; chaining targets CookingTab directly).
- Batch for alchemy/crafting; saved filter presets / log export / pagination;
  log backfill; archive mechanism.
- `DayPlannerTab` + `src/components/dayplanner/**` dead-code removal
  (unreachable legacy system; recorded as a cleanup candidate, not 13b work).
- Per-activity consumption source picker / gathering leader attribution
  (inventory followup #12 "personal-stake activities" — unchanged).

## Testing decisions

- History: reducer tests for dayKey/slot stamping and 2,000-cap trim; filter
  tests incl. masking-before-filter; legacy entries render + text-search.
- Batch: fan-out creates N well-formed tasks; intra-batch exclusivity in UI
  and validator; all-or-nothing on a failing row.
- Chaining: affordances render only for matching output kinds; intent is
  consumed once and cleared; each target lands with specced prefill.
- Browser pass per lane (gurps-verify norm).

## Next step

Spec lanes 2 and 3 for codex-shepherd (parallel, disjoint files); lane 4 after
they merge.
