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
- [!] Wrap both JSON.parse calls in src/utils/combatHistory.js (lines 246, 282); safe default = empty history. Add unit tests for malformed input. [auto-deferred 2026-05-01: no JSON.parse calls in this file; lines 246/282 are safeDeepClone usages — premise stale, helpers.js item covers the underlying JSON.parse]
- [!] Wrap all four JSON.parse calls in src/utils/combatReveal.js (lines 211, 264, 279, 312); safe default = no reveal applied. Add unit tests for malformed input. [auto-deferred 2026-05-01: no JSON.parse calls in this file; lines 211/264/279/312 are safeDeepClone usages — premise stale, helpers.js item covers the underlying JSON.parse]
- [!] Wrap JSON.parse in try/catch at src/utils/helpers.js:26; safe default = null. Add unit test for malformed input. [auto-deferred 2026-05-01: safeParse already wraps JSON.parse in try/catch with fallback; helpers.test.js:246 already covers malformed input]
- [x] Wrap JSON.parse in try/catch at src/utils/schemaVersioning.js:198; safe default = no migration applied. Add unit test for malformed input. [2026-05-03: getMigrationHistory and logMigration JSON.parse calls already wrapped in try/catch with safe default; added 3 malformed-input tests covering both functions]
- [x] Wrap all three JSON.parse calls in src/utils/dataMigrations.js (lines 220, 235, 255); safe default = skip migration with warning. Add unit tests for malformed input. [2026-05-03: all three JSON.parse calls already wrapped in try/catch with safe defaults (null/skipped entry); added 8 malformed-input tests covering getLastBackup, restoreFromBackup, listBackups]

## Phase 10e — Memory leak fixes

- [x] Fix setTimeout race in src/components/character-management/CharacterContextMenu.tsx (lines 47-50) using a `cancelled` ref flag inside the setTimeout callback. Add unit test simulating unmount-before-timeout.
- [ ] Fix setTimeout race in src/components/map/views/MapContextMenu.tsx using the `cancelled` ref flag pattern. Add unit test simulating unmount-before-timeout.
- [ ] Fix setTimeout race in src/components/ui/ConfirmDialog.tsx using the `cancelled` ref flag pattern. Add unit test simulating unmount-before-timeout.
- [ ] Fix socket listener duplication in src/net/ConnectionManager.ts (lines 243-302) — call `socket.off(event)` before each `socket.on(event, ...)` in `connectSocket()`. All existing net tests still green.

## Phase 15e — JS → TS migration (one file per run)

For each: rename `.js` → `.ts` (or `.tsx` if JSX), add types for parameters/returns, preserve all existing exports and runtime behavior, remove any matching `.d.ts` shim, all tests still green, no `as any` introduced.

- [ ] Convert src/utils/cryptoLock.js to TypeScript.
- [ ] Convert src/utils/helpers.js to TypeScript.
- [ ] Convert src/utils/schemaVersioning.js to TypeScript.
- [ ] Convert src/utils/dataMigrations.js to TypeScript.
- [ ] Convert src/utils/combatReveal.js to TypeScript (~300 lines).
- [ ] Convert src/utils/combatHistory.js to TypeScript (~600 lines); remove the existing combatHistory.d.ts shim.
- [ ] Convert src/utils/exportImport.js to TypeScript (~500 lines).

## Phase 15d — Accessibility (low-risk, no behavior change)

- [ ] Add aria-label to every interactive element (button/link/input lacking one) in src/components/combat/CombatTracker.tsx. No behavior change.
- [ ] Add aria-label to every interactive element (button/link/input lacking one) in src/components/combat/ActionPanel.tsx. No behavior change.

### Per-modal a11y sweep

Pattern: ensure the root element has `role="dialog"` (or `role="alertdialog"` for confirm prompts) and `aria-modal="true"`, the title has an id and is referenced via `aria-labelledby`, the description (if any) is referenced via `aria-describedby`, focus is trapped inside the dialog while open, and Escape closes the dialog. Do not change visual styling. All existing tests still green.

- [ ] A11y sweep for src/components/ui/ConfirmDialog.tsx.
- [ ] A11y sweep for src/components/RulesModal.tsx.
- [ ] A11y sweep for src/components/ConnectionDialog.tsx.
- [ ] A11y sweep for src/components/GMLockModal.tsx.
- [ ] A11y sweep for src/components/character-management/CharacterCreationModal.tsx.
- [ ] A11y sweep for src/components/combat/GCSImportModal.tsx.
- [ ] A11y sweep for src/components/combat/ReinforcementsModal.tsx.
- [ ] A11y sweep for src/components/crafting/SaveDesignModal.tsx.
- [ ] A11y sweep for src/components/map/views/TerrainAssignmentModal.tsx.
- [ ] A11y sweep for src/components/map/views/MapCreateDialog.tsx.
- [ ] A11y sweep for src/components/map/views/TravelWizard.tsx (multi-step dialog — apply to the wrapping container).

## Phase 10c — Test coverage (one utility per run)

Bar: each item produces a co-located `*.test.ts` (or `*.test.js` for `.js` sources) in `src/utils/__tests__/` covering the **happy path** plus **at least one error/edge path** (malformed input, empty input, boundary value, etc.). Use existing test fixtures and patterns from the already-tested utilities. No mocks beyond what the file naturally requires. All existing tests still green; new tests pass.

- [ ] Add tests for src/utils/activityLogger.ts.
- [ ] Add tests for src/utils/characterManagement.ts.
- [ ] Add tests for src/utils/combatActions.js.
- [ ] Add tests for src/utils/combatHelpers.ts.
- [ ] Add tests for src/utils/combatInventoryBridge.js.
- [ ] Add tests for src/utils/combatItemEffects.js.
- [ ] Add tests for src/utils/combatItemFilter.js.
- [ ] Add tests for src/utils/combatLogFilter.js.
- [ ] Add tests for src/utils/combatValidation.js.
- [ ] Add tests for src/utils/combatViewFilter.js.
- [ ] Add tests for src/utils/combatViewSelectors.js.
- [ ] Add tests for src/utils/conditionsEngine.js.
- [ ] Add tests for src/utils/createAutoResolvedTask.ts.
- [ ] Add tests for src/utils/damage.ts.
- [ ] Add tests for src/utils/dayPlanner.js.
- [ ] Add tests for src/utils/dice.ts.
- [ ] Add tests for src/utils/effectsEngine.js.
- [ ] Add tests for src/utils/fogOfWar.ts.
- [ ] Add tests for src/utils/hitLocations.ts.
- [ ] Add tests for src/utils/importSchemas.ts.
- [ ] Add tests for src/utils/injuryEngine.js.
- [ ] Add tests for src/utils/itemTags.js.
- [ ] Add tests for src/utils/losUtils.ts.
- [ ] Add tests for src/utils/maneuverFilter.js.
- [ ] Add tests for src/utils/mapRouter.ts.
- [ ] Add tests for src/utils/mapTravelValidation.ts.
- [ ] Add tests for src/utils/mapUtils.ts.
- [ ] Add tests for src/utils/modifiers.ts.
- [ ] Add tests for src/utils/taskResolution.js.
- [ ] Add tests for src/utils/turnContext.js.
- [ ] Add tests for src/utils/weatherSystem.ts.
- [ ] Add tests for src/utils/wounding.ts.

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
