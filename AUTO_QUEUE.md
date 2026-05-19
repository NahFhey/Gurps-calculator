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
- When this file has zero `- [ ]` items, the loop disables itself and roars COMPLETE.

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
- [ ] Add tests for src/state/selectors/gatheringSelectors.ts.
- [ ] Add tests for src/state/selectors/inventorySelectors.ts.
- [ ] Add tests for src/state/selectors/locationSelectors.ts.

### State utilities and persistence

- [ ] Add tests for src/state/campaignUtils.ts.
- [ ] Add tests for src/persistence/dataMigration.ts.
- [ ] Add tests for src/persistence/db.ts (Dexie wrapper; use the `fake-indexeddb` polyfill already wired in `src/test/setup.ts`).

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
