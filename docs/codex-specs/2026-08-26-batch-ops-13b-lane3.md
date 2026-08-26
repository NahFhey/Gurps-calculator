# SPEC: Batch Operations — N-Parallel Task Creation (Phase 13b, lane 3)

## Background

React 18 + TypeScript (strict) GURPS campaign manager. Downtime task system:
`DowntimeTask` (`src/types/downtime.ts:374-400`, one `leaderId` + `helperIds`,
per-activity `activityData` union), created via per-activity forms under
`src/components/downtime/views/` that call `onSubmit(payload)`; the parent flow
runs `validateTaskCreation` (`src/state/downtime/downtimeValidation.ts:227`) and
dispatches `createTask` through `src/components/downtime/DowntimeContext.tsx`
(~line 306). Tool exclusivity: `validateToolExclusivity`
(`downtimeValidation.ts:180`) blocks a creation whose tools are already reserved
in the same (dayKey, slot); forms grey reserved tools proactively via the shared
`ToolSelector` (`src/components/downtime/views/shared/ToolSelector.tsx`) fed by
`selectReservedToolIdsForSlot`.

Full design: `docs/ACTIVITY_SYSTEM_13B_PLAN.md` §"Lane 3" (in this worktree) —
READ IT FIRST; this spec implements it exactly.

## Deliverable — "Batch assign" mode in four activity forms

**Model (fixed by design — do not deviate):** batch is a creation-time
convenience. One submit fans out N normal single-leader tasks — no new task
shape, no resolution changes, no multi-leader anything.

1. **Batch toggle in `FishingTaskForm.tsx`, `MiningTaskForm.tsx`,
   `ForagingTaskForm.tsx`:**
   - A toggle ("Batch assign") swaps the single leader picker for a character
     multi-select (same availability source the leader picker uses —
     `selectAvailableCharacterIdsForSlot`).
   - Shared config (zone/site/spot, modifiers, day/slot — everything the form
     already collects) is entered ONCE and applies to every generated task.
   - Below the multi-select, one compact row PER selected character with that
     character's name and a `ToolSelector` for their tools.
   - **Intra-batch exclusivity:** each row's `reservedToolIds` = the slot's
     committed reservations PLUS every tool selected in the OTHER rows of the
     draft — recomputed live so double-booking is unpickable.
   - Helpers: in batch mode there are no helpers (each character leads their own
     task; `helperIds: []`). The helper picker is hidden in batch mode.
   - Submit builds N payloads (shared config + per-row leader/tools) and hands
     them to the batch submit path (below).

2. **Minimal `RestTaskForm.tsx` (new):** `'rest'` is a `DowntimeActivityType`
   with `RestActivityData` (`src/types/downtime.ts` ~281-290) but has no form
   today. Create a minimal form: leader picker (or batch multi-select via the
   same toggle), rest-type field per `RestActivityData`, no tools. Wire it into
   the same task-creation flow the other forms use (find where TileGrid /
   DowntimePanel routes activity tiles to forms and follow that pattern; if no
   rest tile exists, add one alongside the others).

3. **Batch submit path:** extend the creation flow (DowntimeContext or the
   parent that currently validates + dispatches — follow the existing seam) with
   a batch submit that:
   - Validates ALL N payloads first: each via `validateTaskCreation` against
     current state, PLUS an intra-batch tool-exclusivity check of each payload
     against the tools of payloads earlier in the batch (mirror of the UI rule —
     add a small pure helper in `downtimeValidation.ts` for this, e.g.
     `validateBatchToolExclusivity(payloads)`).
   - **All-or-nothing:** if ANY payload fails, dispatch NOTHING; return the
     per-payload errors so the form renders them on the offending rows (reuse
     the existing `ValidationError` rendering per row).
   - If all pass, dispatch `createTask` for each payload in order.

## Constraints

- `strict: true` clean; NO new `as any`; `import type` for types. No new deps.
  Do not commit to git.
- Files you may edit: the three gathering `*TaskForm.tsx` files, new
  `RestTaskForm.tsx` (+ its Card if the tile pattern needs one), `TileGrid.tsx`
  / `DowntimePanel.tsx` (only for rest wiring), `DowntimeContext.tsx` (batch
  submit), `downtimeValidation.ts` (batch helper), `downtimeActions.ts` /
  `downtimeSelectors.ts` only if genuinely needed, shared `ToolSelector.tsx`
  only for additive prop needs, plus test files.
- **Do NOT touch:** `src/utils/activityLogger.ts`, `ChangelogTab.tsx`,
  `campaignReducer.ts` log handling, or any resolution panel — a parallel lane
  owns those. Existing single-task behavior must be byte-for-byte unchanged
  when the batch toggle is off.
- Match existing form styling (Tailwind dark slate; copy the parity-lane
  ToolSelector usage in MiningTaskForm as the reference).

## Definition of done — self-verify before finishing

1. Validation tests (`src/state/downtime/__tests__/`): batch helper flags a
   payload whose tools collide with an earlier payload's; passes disjoint
   tools; all-or-nothing — one bad payload → zero tasks created.
2. Form component tests (follow the existing *TaskForm test conventions):
   toggle swaps leader picker for multi-select; per-row ToolSelector excludes
   tools picked in other rows (live intra-batch rule); submit with N valid rows
   calls the batch path with N payloads; single-task mode still submits exactly
   as before (regression assertions on the existing tests must stay untouched
   and passing).
3. RestTaskForm: creates a valid rest task; batch mode creates N.
4. Run and pass, fixing failures yourself:
   `npx vitest run src/state/downtime/ src/components/downtime/` and
   `npx tsc --noEmit`.
5. Final summary: one paragraph — where the batch submit seam landed
   (DowntimeContext vs parent), the shape of the batch validation helper, and
   any ToolSelector prop additions.
