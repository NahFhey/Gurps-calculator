# AUTO_QUEUE.md

Work queue drained by the `gurps-vtt-auto-dev` scheduled task (every 4 hours).

## Format

- `- [ ]` — pending, eligible for next run
- `- [x]` — completed (by the loop or by human edit)
- `- [!]` — auto-deferred after a failed attempt; needs human review. Reason follows on the same line in `[brackets]`.

## Rules

- The loop drains items top-to-bottom. The first `- [ ]` it sees is the next item.
- Items must be small enough to fit in one ~30-minute run with **one commit max**.
- Items must NOT require new dependencies, design decisions, or human judgment.
- The loop never reorders or rewrites items beyond the `[ ]` → `[x]` / `[!]` mark on the line it picked.
- When this file has zero `- [ ]` items, the loop runs ONE self-refill cycle (inventory sweep → at most 15 verified mechanical items → queue-only commit → roar REFILLED), guarded by a merge-debt cap (>40 unmerged auto-dev commits → disable + roar COMPLETE for review-merge instead) and a misfire cap (≥3 recent `- [!]` deferrals → disable + roar COMPLETE). See the task's TERMINATION → SELF-REFILL protocol (2026-07-13).

## Phase 10d — Defensive JSON.parse hardening

Pattern: wrap the call in try/catch, log via existing logger (or `console.warn` if none), return a documented safe default. Add a unit test in the file's nearest `__tests__/` dir (or co-located `*.test.ts`) that feeds malformed JSON and asserts the safe default is returned.

- [x] Wrap JSON.parse in try/catch at src/state/campaignReducer.ts:937; safe default = unchanged state. Add unit test for malformed input.
- [x] Wrap JSON.parse in try/catch at src/utils/storage.ts:123; safe default = null. Add unit test for malformed input.
- [x] Wrap both JSON.parse calls in src/utils/combatHistory.js (lines 246, 282); safe default = empty history. Add unit tests for malformed input. [resolved 2026-05-13: file migrated to combatHistory.ts under Phase 15e and contains zero JSON.parse calls; the original line refs were safeDeepClone usages, which live in helpers.ts and are already try/caught.]
- [x] Wrap all four JSON.parse calls in src/utils/combatReveal.js (lines 211, 264, 279, 312); safe default = no reveal applied. Add unit tests for malformed input. [resolved 2026-05-13: file migrated to combatReveal.ts under Phase 15e and contains zero JSON.parse calls; original line refs were safeDeepClone usages, covered by helpers.ts.]
- [x] Wrap JSON.parse in try/catch at src/utils/helpers.js:26; safe default = null. Add unit test for malformed input. [resolved 2026-05-13: helpers.ts safeParse (line 12) and safeDeepClone (line 20) both already try/caught with documented fallbacks; helpers tests cover the malformed-input path.]
- [x] Wrap JSON.parse in try/catch at src/utils/schemaVersioning.js:198; safe default = no migration applied. Add unit test for malformed input. [2026-05-03: getMigrationHistory and logMigration JSON.parse calls already wrapped in try/catch with safe default; added 3 malformed-input tests covering both functions]
- [x] Wrap all three JSON.parse calls in src/utils/dataMigrations.js (lines 220, 235, 255); safe default = skip migration with warning. Add unit tests for malformed input. [2026-05-03: all three JSON.parse calls already wrapped in try/catch with safe defaults (null/skipped entry); added 8 malformed-input tests covering getLastBackup, restoreFromBackup, listBackups]

## Phase 10e — Memory leak fixes

- [x] Fix setTimeout race in src/components/character-management/CharacterContextMenu.tsx (lines 47-50) using a `cancelled` ref flag inside the setTimeout callback. Add unit test simulating unmount-before-timeout.
- [x] Fix setTimeout race in src/components/map/views/MapContextMenu.tsx using the `cancelled` ref flag pattern. Add unit test simulating unmount-before-timeout. [resolved 2026-05-13: file has zero setTimeout/setInterval calls; event listeners are registered synchronously inside useEffect with matching cleanup — no race exists to fix.]
- [x] Fix setTimeout race in src/components/ui/Toast.tsx using the `cancelled` ref flag pattern. Add unit test simulating unmount-before-timeout. [retargeted 2026-05-03: ConfirmDialog has no setTimeout; race actually lived in Toast.tsx duration timer + exit-animation timer]
- [x] Fix socket listener duplication in src/net/ConnectionManager.ts (lines 243-302) — call `socket.off(event)` before each `socket.on(event, ...)` in `connectSocket()`. All existing net tests still green.

## Phase 15e — JS → TS migration (one file per run)

For each: rename `.js` → `.ts` (or `.tsx` if JSX), add types for parameters/returns, preserve all existing exports and runtime behavior, remove any matching `.d.ts` shim, all tests still green, no `as any` introduced.

- [x] Convert src/utils/cryptoLock.js to TypeScript.
- [x] Convert src/utils/helpers.js to TypeScript.
- [x] Convert src/utils/schemaVersioning.js to TypeScript.
- [x] Convert src/utils/dataMigrations.js to TypeScript.
- [x] Convert src/utils/combatReveal.js to TypeScript (~300 lines).
- [x] Convert src/utils/combatHistory.js to TypeScript (~600 lines); remove the existing combatHistory.d.ts shim.
- [x] Convert src/utils/exportImport.js to TypeScript (~500 lines).

## Phase 15d — Accessibility (low-risk, no behavior change)

- [x] Add aria-label to every interactive element (button/link/input lacking one) in src/components/combat/CombatTracker.tsx. No behavior change. [resolved 2026-05-13: CombatTracker.tsx contains zero direct button/link/input/select/textarea elements — all interactive controls are delegated to subviews; per-subview items below cover the actual gaps.]
- [x] Add aria-label to every interactive element (button/link/input lacking one) in src/components/combat/ActionPanel.tsx. No behavior change.
- [x] Add aria-label to every interactive element (button/link/input lacking one) in src/components/combat/views/CombatHeaderView.tsx (10 `<button>` elements, zero aria-labels). No behavior change.
- [x] Add aria-label to every interactive element (button/link/input lacking one) in src/components/combat/views/DicePanelView.tsx (4 `<button>` elements, zero aria-labels). No behavior change.
- [x] Add aria-label to every interactive element (button/link/input lacking one) in src/components/combat/views/TurnControlsView.tsx (2 `<button>` elements, zero aria-labels). No behavior change.
- [x] Add aria-label to every interactive element (button/link/input lacking one) in src/components/combat/views/InitiativeTimeline.tsx (2 `<button>` elements, zero aria-labels). No behavior change.
- [x] Add aria-label to every interactive element (button/link/input lacking one) in src/components/combat/views/CombatLogView.tsx (1 `<button>` element, zero aria-labels). No behavior change.

### Per-modal a11y sweep

Pattern: ensure the root element has `role="dialog"` (or `role="alertdialog"` for confirm prompts) and `aria-modal="true"`, the title has an id and is referenced via `aria-labelledby`, the description (if any) is referenced via `aria-describedby`, focus is trapped inside the dialog while open, and Escape closes the dialog. Do not change visual styling. All existing tests still green.

- [x] A11y sweep for src/components/ui/ConfirmDialog.tsx.
- [x] A11y sweep for src/components/RulesModal.tsx.
- [x] A11y sweep for src/components/ConnectionDialog.tsx.
- [x] A11y sweep for src/components/GMLockModal.tsx.
- [x] A11y sweep for src/components/character-management/CharacterCreationModal.tsx.
- [x] A11y sweep for src/components/combat/GCSImportModal.tsx.
- [x] A11y sweep for src/components/combat/ReinforcementsModal.tsx.
- [x] A11y sweep for src/components/crafting/SaveDesignModal.tsx.
- [x] A11y sweep for src/components/map/views/TerrainAssignmentModal.tsx.
- [x] A11y sweep for src/components/map/views/MapCreateDialog.tsx.
- [x] A11y sweep for src/components/map/views/TravelWizard.tsx (multi-step dialog — apply to the wrapping container).

## Phase 10c — Test coverage (one utility per run)

Bar: each item produces a co-located `*.test.ts` (or `*.test.js` for `.js` sources) in `src/utils/__tests__/` covering the **happy path** plus **at least one error/edge path** (malformed input, empty input, boundary value, etc.). Use existing test fixtures and patterns from the already-tested utilities. No mocks beyond what the file naturally requires. All existing tests still green; new tests pass.

- [x] Add tests for src/utils/activityLogger.ts.
- [x] Add tests for src/utils/characterManagement.ts.
- [x] Add tests for src/utils/combatActions.js.
- [x] Add tests for src/utils/combatHelpers.ts.
- [x] Add tests for src/utils/combatInventoryBridge.js.
- [x] Add tests for src/utils/combatItemEffects.js.
- [x] Add tests for src/utils/combatItemFilter.js.
- [x] Add tests for src/utils/combatLogFilter.js.
- [x] Add tests for src/utils/combatValidation.js.
- [x] Add tests for src/utils/combatViewFilter.js.
- [x] Add tests for src/utils/combatViewSelectors.js.
- [x] Add tests for src/utils/conditionsEngine.js.
- [x] Add tests for src/utils/createAutoResolvedTask.ts.
- [x] Add tests for src/utils/damage.ts.
- [x] Add tests for src/utils/dayPlanner.js.
- [x] Add tests for src/utils/dice.ts.
- [x] Add tests for src/utils/effectsEngine.js.
- [x] Add tests for src/utils/fogOfWar.ts.
- [x] Add tests for src/utils/hitLocations.ts.
- [x] Add tests for src/utils/importSchemas.ts.
- [x] Add tests for src/utils/injuryEngine.js.
- [x] Add tests for src/utils/itemTags.js.
- [x] Add tests for src/utils/losUtils.ts.
- [x] Add tests for src/utils/maneuverFilter.js.
- [x] Add tests for src/utils/mapRouter.ts.
- [x] Add tests for src/utils/mapTravelValidation.ts.
- [x] Add tests for src/utils/mapUtils.ts.
- [x] Add tests for src/utils/modifiers.ts.
- [x] Add tests for src/utils/taskResolution.js.
- [x] Add tests for src/utils/turnContext.js.
- [x] Add tests for src/utils/weatherSystem.ts.
- [x] Add tests for src/utils/wounding.ts.

## Phase 10c-2 — Test coverage for state/ and persistence/ (one file per run)

Same bar as Phase 10c: co-located `*.test.ts` covering happy path plus at least one error/edge case. Mirror the established patterns from `src/state/downtime/__tests__/downtimeReducer.test.ts` and `src/state/combat/__tests__/combatReducer.test.ts`. No mocks beyond what the file naturally requires. All existing tests still green; new tests pass.

### Reducers

- [x] Add tests for src/state/character/characterReducer.ts.
- [x] Add tests for src/state/alchemy/alchemyReducer.ts.
- [x] Add tests for src/state/crafting/craftingReducer.ts.
- [x] Add tests for src/state/gathering/gatheringReducer.ts.
- [x] Add tests for src/state/inventory/inventoryReducer.ts.
- [x] Add tests for src/state/map/mapReducer.ts.

### Action creators

- [x] Add tests for src/state/character/characterActions.ts.
- [x] Add tests for src/state/alchemy/alchemyActions.ts.
- [x] Add tests for src/state/combat/combatActions.ts.
- [x] Add tests for src/state/crafting/craftingActions.ts.
- [x] Add tests for src/state/gathering/gatheringActions.ts.
- [x] Add tests for src/state/inventory/inventoryActions.ts.
- [x] Add tests for src/state/map/mapActions.ts.
- [x] Add tests for src/state/downtime/downtimeActions.ts.

### Selectors

- [x] Add tests for src/state/selectors/alchemySelectors.ts.
- [x] Add tests for src/state/selectors/characterSelectors.ts.
- [x] Add tests for src/state/selectors/combatSelectors.ts.
- [x] Add tests for src/state/selectors/craftingSelectors.ts.
- [x] Add tests for src/state/selectors/gatheringSelectors.ts.
- [x] Add tests for src/state/selectors/inventorySelectors.ts.
- [x] Add tests for src/state/selectors/locationSelectors.ts.

### State utilities and persistence

- [x] Add tests for src/state/campaignUtils.ts.
- [x] Add tests for src/persistence/dataMigration.ts.
- [x] Add tests for src/persistence/db.ts (Dexie wrapper; use the `fake-indexeddb` polyfill already wired in `src/test/setup.ts`). [auto-deferred 2026-05-20: db.ts is a non-functional placeholder — kvStore = {} and "TODO: Install dexie" at line 11; every exported function throws at runtime. Needs human decision (install dexie or rewrite without it) before tests can be written.] [resolved 2026-06-09: human decision — db.ts deleted; nothing imported it and the app persists via the localStorage wrapper in src/utils/storage.ts. IndexedDB migration can be re-planned if storage limits ever bite.]

## Phase 16t — Test coverage for untested core utils (one file per run) _(refill 2026-07-13)_

Pattern: add `__tests__/<name>.test.ts` beside the file. Cover the exported API: happy path + at least one error/edge path per exported function group. Use real data patterns (see `src/__tests__/combatIntegration.test.ts`), not synthetic-clean fixtures. No `as any` in tests. Verify with a targeted vitest run.

- [x] Add tests for src/utils/combatHistory.ts (440 lines, zero coverage).
- [x] Add tests for src/utils/characterImport.ts (494 lines, zero coverage; malformed and partial import payloads are the priority edge cases).
- [x] Add tests for src/utils/batchedStorageManager.ts (253 lines, zero coverage; cover batching/flush ordering and the write-failure path).
- [x] Add tests for src/utils/cryptoLock.ts (167 lines, zero coverage).
- [x] Add tests for src/utils/logger.ts (59 lines, zero coverage).

## Phase 15e-2 — JS → TS migration, second batch (one file per run) _(refill 2026-07-13)_

Same pattern as Phase 15e: rename `.js` → `.ts` (or `.tsx` if JSX), add types for parameters/returns, preserve all existing exports and runtime behavior, remove any matching `.d.ts` shim, all tests still green, no `as any` introduced.

- [x] Convert src/utils/turnContext.js to TypeScript (47 lines; delete the src/utils/turnContext.d.ts shim).
- [x] Convert src/utils/combatViewSelectors.js to TypeScript (51 lines).
- [x] Convert src/utils/maneuverFilter.js to TypeScript (65 lines).
- [ ] Convert src/utils/combatItemFilter.js to TypeScript (83 lines).
- [ ] Convert src/utils/itemTags.js to TypeScript (122 lines).
- [ ] Convert src/utils/injuryEngine.js to TypeScript (139 lines).
- [ ] Convert src/utils/combatItemEffects.js to TypeScript (337 lines).
- [ ] Convert src/utils/combatValidation.js to TypeScript (345 lines).
- [ ] Convert src/utils/dayPlanner.js to TypeScript (348 lines).
- [ ] Convert src/utils/effectsEngine.js to TypeScript (357 lines).

## Phase 16y — `as any` reduction (one file per run) _(refill 2026-07-13)_

Pattern: remove every `as any` in the target file by fixing the types at the source (`src/types/` or the relevant domain type file) per the CLAUDE.md rule. Zero runtime behavior change; tsc clean; existing tests green. If a specific cast genuinely requires a design decision, defer the item citing that cast's file:line.

- [ ] Remove the 6 `as any` casts in src/hooks/useCombatHistory.ts.
- [ ] Remove the 9 `as any` casts in src/persistence/campaignStorage.ts.
- [ ] Remove the 10 `as any` casts in src/state/map/mapReducer.ts.

## Phase 16z — ActionPanel decomposition, test-first (one extraction per run) _(refill 2026-07-13)_

A reference decomposition exists on branch `migration/home-test-claude-ws` at `src/components/combat/action-panel/` (April 2026 spike). It is REFERENCE ONLY — three months stale against current combat state; adapt names/props/state access to today's code, never copy blindly. Target pattern: thin router + view (the Phase 6 convention). Every extraction: behavior identical, ActionPanel tests green, tsc clean.

- [ ] Add behavior tests for src/components/combat/ActionPanel.tsx (375 lines, currently ZERO coverage): workflow selection and switching, damage workflow dispatching the expected action, conditions workflow toggling, note workflow adding a note, collapsed vs expanded rendering. This is the safety net for the extractions below.
- [ ] Extract ActionPanelHeader and ActionPanelCollapsedView from ActionPanel.tsx into src/components/combat/action-panel/. Precondition: ActionPanel tests exist (previous item); if absent, defer with reason "prerequisite tests missing".
- [ ] Extract ActionPanelDamageWorkflow from ActionPanel.tsx into src/components/combat/action-panel/. Same precondition.
- [ ] Extract ActionPanelConditionsWorkflow from ActionPanel.tsx into src/components/combat/action-panel/. Same precondition.
- [ ] Extract ActionPanelNoteWorkflow and ActionPanelItemsWorkflow from ActionPanel.tsx into src/components/combat/action-panel/. Same precondition.
- [ ] Extract ActionPanelWorkflowSelector and ActionPanelManeuverPrompts; ActionPanel.tsx ends as a thin router (~150 lines or less). Same precondition.

## Out of scope for the loop (do NOT add these)

The following are tracked elsewhere because they require design judgment or coordinated multi-file changes the loop should not attempt autonomously:

- Phase 12a.5 Inventory Integration Bus (active human-driven phase; spans state + types + dispatch + UI + tests)
- Phase 12b GCS import improvements (format judgment)
- Phase 12c character creation wizard (UX design)
- Phase 13b/c new activity types and chaining (system design)
- Phase 14 map and travel work (multi-system coordination)
- Phase 15a cross-system integration (multi-system coordination)
- Phase 15b bundle/perf optimization (needs profiling + measurement)
- Phase 15c keyboard shortcuts, dark mode (UX design)
- Phase 16 Electron packaging, delta sync, file format (architecture)
- Items in docs/INVENTORY_INTEGRATION_FOLLOWUPS.md (each has open design questions)
- The 60 `as any` casts across the three Fishing views (FishingResolutionPanel/FishingActivity/FishingTaskForm) — they share a fishing type-model problem that needs human type design, not per-cast fixes
- JS → TS conversion of taskResolution.js (417), combatViewFilter.js (441), combatLogFilter.js (551), conditionsEngine.js (582) — 400+ lines each; queue as a third batch only after 15e-2 completes cleanly
