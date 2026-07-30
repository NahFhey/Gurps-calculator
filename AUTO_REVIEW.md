# AUTO_REVIEW.md

Daily code review log produced by the `gurps-vtt-auto-review` Claude Code routine (10pm local).

## How this file works

- **Append-only.** Each daily run prepends a new dated section directly below this header. Past entries are immutable history.
- **Marker-based look-back.** Each run reads `auto-dev:` commits made since the previous `review:` commit, so missed days don't lose coverage.
- **Suppression list lives in `KNOWN_ISSUES.md`.** Items there are not re-flagged.

## Evaluation axes

Each `auto-dev:` commit is graded on:

1. **Test depth** — meaningful behavioral assertions vs snapshot fluff. Engine code (dice, damage, injury, effects, fog-of-war, LOS, weather, wounding, hit locations) gets stricter scrutiny than filters/selectors.
2. **Type discipline** — no new `:any` annotations, no `as any` casts, no `@ts-nocheck` (outside grandfathered files listed in `KNOWN_ISSUES.md`).
3. **Auto-deferral honesty** — `[!]` markers on `AUTO_QUEUE.md` items must cite reasons that match the actual current file state, not fabricated rationalizations.
4. **Scope discipline** — commit touches only what the queue item described. No "while I was here" drift.

## Verdict taxonomy

- **PASS** — rubber-stamp. No concerns above noise floor.
- **NOTE** — worth flagging but not blocking. Pattern emerging that may want attention later, or a one-off the autodev got slightly suboptimal.
- **CONCERN** — look at this before the next auto-dev run. Real risk: shallow test on engine code, type erosion, scope creep, or a deferred item that was actually doable.

The Discord roar carries the highest verdict in the day's batch plus counts (e.g., `2026-05-09 review: PASS — 4 commits (4P, 0N, 0C)`).

## End-state

When `AUTO_QUEUE.md` has zero `- [ ]` items AND seven consecutive runs find zero `auto-dev:` commits to review, the routine disables itself and roars FINAL.

---

<!-- Daily entries are prepended directly below this line, newest first. -->

## 2026-07-30 — EMPTY (no auto-dev: commits since last review)

## 2026-07-29 — EMPTY (no auto-dev: commits since last review)

## 2026-07-28 — EMPTY (no auto-dev: commits since last review)

## 2026-07-27 — EMPTY (no auto-dev: commits since last review)

## 2026-07-26 — EMPTY (no auto-dev: commits since last review)

## 2026-07-25 — no auto-dev: commits since last review

## 2026-07-24 — no auto-dev: commits since last review

## 2026-07-23 — no auto-dev: commits since last review

## 2026-07-22 — no auto-dev: commits since last review

## 2026-07-21 — PASS (1 commit: 1P, 0N, 0C)

| commit | target | verdict | notes |
| ------ | ------ | ------- | ----- |
| 58fd809 | src/hooks/useEffectiveRole.ts (test add) | PASS | — |

Non-engine hook. Five behavioral test blocks cover connected Player/GM/Spectator, the offline/no-role fallback to GM (via `it.each`), and `displayName ?? null` coalescing. Assertions track the source: `isOnline = status==='connected' && role!==null`, `canEdit = effectiveRole===GM`, undefined displayName → null. Type-clean (`vi.hoisted` mock, no `any`/`as any`/`@ts-nocheck`). Scope limited to the new test file plus the single `[ ]`→`[x]` marker flip in AUTO_QUEUE.md.

## 2026-07-20 — PASS (5 commits: 5P, 0N, 0C)

| commit | target | verdict | notes |
| ------ | ------ | ------- | ----- |
| ffea9e4 | src/utils/combatActions.ts | PASS | — |
| 475dc6e | src/utils/combatReducer.ts | PASS | — |
| 7303b49 | src/hooks/__tests__/combatUIStore.test.ts | PASS | — |
| 57f94f8 | src/hooks/__tests__/useBatchedStorageSave.test.ts | PASS | — |
| 6eb2477 | src/hooks/__tests__/useWeatherModifiers.test.ts | PASS | — |

### Notes

Clean window — two Phase 15e-4 JS→TS conversions and three Phase 16t-3 hook tests, all PASS.

The `combatActions.js`→`.ts` (ffea9e4) and `combatReducer.js`→`.ts` (475dc6e) conversions are the two flagged 15e-4 items. Type discipline is exactly right: interfaces plus `unknown`/`Record<string, unknown>` throughout, zero new `:any`, `as any`, or `@ts-nocheck` — a deliberate contrast with the 2026-07-19 `combatViewFilter.ts` CONCERN. The `applyAction`/`applyInverse` dispatch tables and every `ACTION_TYPES` / action-creator export are preserved verbatim; the only removed lines are untyped signatures re-added with types. Safety-net suites (`combatActions.test.js`, `combatReducer.test.ts`) stay green and `tsc --noEmit` is clean for both files.

The three hook-test adds all assert observable behavior rather than truthiness. `useBatchedStorageSave` (57f94f8) is notably thorough — 7 cases covering delegation plus the queue-throw, flush-rejection, and storage-unavailable error paths, each verifying logger calls without a rethrow. `combatUIStore` (7303b49) covers initial state, shallow-merge, reset, and single-key preservation. `useWeatherModifiers` (6eb2477) exercises both exported hooks with happy-path modifier math and no-location/zero-effect edge cases. All 55 tests across the five files pass. No `[!]` deferrals in the window; every commit touched only its target plus the single `AUTO_QUEUE.md` marker line.

## 2026-07-19 — CONCERN (6 commits: 4P, 1N, 1C)

| commit | target | verdict | notes |
| ------ | ------ | ------- | ----- |
| d4ae57c | src/utils/combatViewFilter.ts | CONCERN | conversion deleted the typed `.d.ts` shim and replaced concrete types with 33 new `: any` on a reveal/redaction-critical filter |
| ff630bd | src/utils/combatLogFilter.ts | NOTE | params typed as `Record<string, any>` (`AnyRecord`) instead of the canonical combatTracker types; no prior shim, so not a regression |
| bc512d9 | src/utils/conditionsEngine.ts | PASS | model conversion — preserved `<T extends ConditionBearer>` generics, named types, and `unknown` over `any`; engine branches intact |
| 65e910d | src/utils/combatReveal.ts | PASS | 22 it()/85 assertions; boundary HP (0/negative/over-max/zero-max), missing-id defaults, immutability, reference-vs-value all covered |
| ee2128b | src/hooks/usePersistentState.ts | PASS | init (primitive + non-primitive), setter, debouncedSave forwarding, successive saves |
| ffcd0a5 | src/hooks/useStorage.ts | PASS | debounce-once, rapid-save coalescing edge, and error-path (logged not rethrown) with fake timers |

### Concerns to address

**d4ae57c — type erosion on `combatViewFilter.ts`.** The queue item asked to "add types for parameters/returns" on the JS→TS conversion. Instead the commit deleted the existing `combatViewFilter.d.ts` shim — which declared concrete signatures like `getCombatView(combatState: CombatState, revealState: RevealState | undefined, viewMode: ViewModeType): {...} | null` over `../types/combatTracker` — and replaced every signature with `any`/`AnyRecord` (33 new `: any` annotations; `getCombatView` is now `(combatState: any, revealState: any | undefined, viewMode: ViewModeType): AnyRecord | null`). This is a net loss of pre-existing type coverage on the player-view redaction path (the module that decides what enemy info players may see), not a neutral conversion of untyped code. The sibling conversion in this same batch, `conditionsEngine.ts` (bc512d9), shows the correct pattern: it inlined the `.d.ts` interfaces and kept the generic signatures rather than erasing them. Not suppressed by `KNOWN_ISSUES.md` — the open `:any` entry there covers `exportImport.ts` only. Recommend re-typing `getCombatView`/`hasHiddenInfo`/`filterParticipant` against `CombatState`/`Participant`/`RevealState` before this pattern is copied to the remaining conversions.

### Notes

**ff630bd — `combatLogFilter.ts` uses `AnyRecord`.** The conversion types its params as `Record<string, any>` via an `AnyRecord` alias (plus one bare `: any` on a `.some()` callback). Because `combatLogFilter.js` had no `.d.ts` shim (untyped JS), this is not a regression, and return types/type-guards (`entry is AnyRecord`, `string`, `boolean`) are properly annotated. Flagging only so the pattern doesn't harden: the canonical `combatTracker` types would be a stronger fit for `log`/`entry`/`combatState` if a follow-up wants to tighten it.

## 2026-07-18 — NOTE (5 commits: 3P, 2N, 0C)

| commit | target | verdict | notes |
| ------ | ------ | ------- | ----- |
| 6249db1 | src/utils/taskResolution.ts | NOTE | JS→TS conversion preserves the deleted `.d.ts` shim's `any` contract (not a regression); 3 net-new internal `any` left untightened |
| 568a91d | src/components/combat/ActionPanel.tsx | NOTE | item marked done but its "~150 lines or less" target unmet — router landed at 300 (from 361) |
| d1c778e | src/components/combat/action-panel/ | PASS | — |
| 80b1ef0 | src/components/combat/action-panel/ActionPanelConditionsWorkflow.tsx | PASS | — |
| 3d5c83f | src/components/combat/action-panel/ActionPanelDamageWorkflow.tsx | PASS | three `as any` casts relocated verbatim from parent, not introduced |

### Notes

- **6249db1 (taskResolution → TS).** The conversion is faithful, not a type regression: the now-deleted `src/utils/taskResolution.d.ts` shim already declared `payload/task/leader/environment/tools/species/categories/items/tables` as `any`, and the `.ts` file carries those forward — the same situation `KNOWN_ISSUES.md` parks for `exportImport.ts` ("not a regression from the JS source"). Three genuinely net-new `any` slipped in beyond the shim's surface: `_categories?: any` (taskResolution.ts:56), `item?: any` (taskResolution.ts:102), and the local `const yields: any = calculateFishYields(...)` (taskResolution.ts:231). These are internal to an already-`any`-boundaried module, so this is a missed opportunity to tighten types during the migration, not fresh erosion — flagging once rather than blocking. taskResolution is not on the strict engine-code list.
- **568a91d (WorkflowSelector + ManeuverPrompts, slim router).** The queue item's stated acceptance criterion was "ActionPanel.tsx ends as a thin router (~150 lines or less)"; the item was marked `[x]` complete, but the file landed at 300 lines (down from 361 before the extraction series). The extraction itself is legitimate — logic moved cleanly into `action-panel/` components and a shared `types.ts` — and the one cross-file edit (ActionPanelDamageWorkflow.tsx switching its `HitLocation`/`LocationRoll` import from `../ActionPanel` to `./types`) is in-scope plumbing for the shared types module. The only gap is the optimistic line-count target: 300 vs ~150 claimed. Worth noting for deferral/completion honesty; the refactor is sound.

## 2026-07-17 — PASS (4 commits: 4P, 0N, 0C)

| commit | target | verdict | notes |
| ------ | ------ | ------- | ----- |
| 470263c | AUTO_QUEUE.md (defer campaignStorage) | PASS | honest deferral — cited casts verified |
| 42f4fd8 | src/state/map/mapReducer.ts | PASS | 10 `as any` cleanly removed, no new casts |
| dac29db | src/components/combat/__tests__/ActionPanel.test.tsx | PASS | 6 behavior tests, dispatch payloads + edge paths |
| 87a885c | src/components/combat/ActionPanel.tsx | PASS | pure extraction, covered by parent tests |

### Notes
No concerns or notes this window. The `campaignStorage.ts` deferral (470263c) is honest: the cited casts at :90 (`(payload as any).maps`), :141-146 (six gathering fields), :148 (`alchemyReagents`), and :151 (`cookingSkills`) all exist as described, and the Extended-vs-state-type mismatch on the gathering/alchemy entities is a genuine design decision, not a doable-item punt. The loop correctly noted that :90 and :151 are individually removable but the item is all-9, so it defers as a unit — consistent with the same-day useCombatHistory.ts deferral. The `mapReducer.ts` cast removal (42f4fd8) strips exactly the 10 `as any` the item named and adds none; extractions (87a885c) are presentational-only and exercised indirectly by the ActionPanel.test.tsx safety net added in dac29db.

## 2026-07-16 — NOTE (6 commits: 4P, 2N, 0C)

| commit | target | verdict | notes |
| ------ | ------ | ------- | ----- |
| 71a60cc | src/utils/injuryEngine.ts | NOTE | conversion clean; consumer InjuryResolutionPanel.tsx:277 rewrites `as DamageBreakdown` into a double `as unknown as` launder over a disclosed pre-existing field-name mismatch |
| 08448d6 | src/utils/combatItemEffects.ts | PASS | — |
| 33f8f12 | src/utils/combatValidation.ts | PASS | — |
| 5b6bb5a | src/utils/dayPlanner.ts | NOTE | 4 `any[]` types (dayPlanner.ts:120,121,367,368) preserved verbatim from the deleted `.d.ts` shim rather than tightened |
| 8689a39 | src/utils/effectsEngine.ts | PASS | — |
| cf5fc5b | AUTO_QUEUE.md (Phase 16y defer) | PASS | deferral reason accurate — all 6 `as any` line refs and both cited signatures verified |

### Notes

**71a60cc (injuryEngine → TS).** The engine conversion itself is faithful — precise `InjuryResolution`/`InjuryBreakdown` interfaces, logic unchanged, no `as any`. The only out-of-target edit is the consumer at [InjuryResolutionPanel.tsx:277](src/components/combat/InjuryResolutionPanel.tsx:277), where the prior `createInjuryBreakdown(injuryResult) as DamageBreakdown` became `createInjuryBreakdown(injuryResult as unknown as ReturnType<typeof resolveInjury>) as unknown as DamageBreakdown`. This is inherent to the conversion (needed to keep tsc green) and honestly disclosed in the commit message as papering over a "pre-existing latent field-name mismatch." It is not `as any`, so it clears axis (b); noted only because a double `as unknown as` launder hides a real field-name divergence between the engine's return type and the panel's local `DamageBreakdown` that would be better resolved at the type source.

**5b6bb5a (dayPlanner → TS).** `CommitResult.updatedFoods/updatedMaterials` and `commitPendingDayLedger`'s `currentFoods/currentMaterials` params are typed `any[]`. These are **not** new — the deleted `src/utils/dayPlanner.d.ts` shim declared exactly these four `any[]` signatures, so the conversion preserved the prior public type contract verbatim (correct per Phase 15e-2's "preserve all existing exports"). No `FoodItem`/`MaterialItem` type exists in `src/types/` to tighten to without a design decision, so this is not a regression and does not trip axis (b)'s ≥3 threshold as a *new* introduction. Flagged as a NOTE only to record that the loose typing survived the migration and remains a future tightening opportunity.

## 2026-07-15 — NOTE (5 commits: 3P, 2N, 0C)

| commit | target | verdict | notes |
| ------ | ------ | ------- | ----- |
| c1df615 | src/utils/turnContext.ts | NOTE | clean conversion, but also edited src/types/combatTracker.ts (type support outside strict target scope) |
| 5a25bd2 | src/utils/combatViewSelectors.ts | NOTE | introduced `type AnyRecord = Record<string, any>` + several `as AnyRecord` casts |
| f5c3a26 | src/utils/maneuverFilter.ts | PASS | — |
| 058a763 | src/utils/combatItemFilter.ts | PASS | — |
| d1518ec | src/utils/itemTags.ts | PASS | — |

### Notes

**c1df615** — Beyond renaming `turnContext.js` → `.ts` and deleting the `turnContext.d.ts` shim (both anticipated by the queue item), the commit also edited `src/types/combatTracker.ts`: added `canAct` and `moveAvailable` to the `TurnContext` interface, and `isProne`/`isGrappled` (as documented legacy back-compat flags) to `Participant`. These are pure type declarations with no runtime-logic change and are genuinely required — `const DEFAULT_TURN_CONTEXT: TurnContext` won't typecheck without the two missing fields. Flagged only for transparency that a shared types file was touched; not a scope violation in substance.

**5a25bd2** — The conversion keeps the public parameter types as `unknown` (`CombatStateLike`/`RevealStateLike`), which is good, but then reaches property access via a new `type AnyRecord = Record<string, any>` alias and casts (`combatState as AnyRecord`, `(p: AnyRecord) => ...`, `revealState as AnyRecord`). This is one new `any`-bearing annotation plus several casts — pragmatic for the conversion but it drops type safety on `participants`/`defender` field access (`combatViewSelectors.ts:15`, `:34`, `:70`). A follow-up could narrow these against `CombatState`/`Participant` from `src/types/combatTracker.ts`. Not engine code, so NOTE rather than CONCERN. Not suppressed by KNOWN_ISSUES (which only grandfathers `exportImport.ts`).

## 2026-07-14 — CONCERN (30 commits: 29P, 0N, 1C)

_First run on draken. Cleared the bootstrap backlog: `auto-dev:` commits merged unreviewed via PR #25/#26/#27 (2026-05-15 → 2026-05-20) plus the fresh 2026-07-13/14 batch. All 30 evaluated normally within budget._

| commit | target | verdict | notes |
| ------ | ------ | ------- | ----- |
| 9799314 | src/components/combat/views/CombatLogView.tsx | PASS | 2 aria-labels on interactive elements; scope-clean a11y add |
| ffe1ef2 | src/state/character/characterReducer.ts | PASS | 12 cases / 20 assertions; behavioral |
| 3d2998e | src/state/alchemy/alchemyReducer.ts | PASS | 20 cases / 29 assertions |
| 5d5d121 | src/state/crafting/craftingReducer.ts | PASS | 16 cases / 22 assertions |
| e81cc19 | src/state/gathering/gatheringReducer.ts | CONCERN | 33 cases w/ no-op edge paths (good depth) but 4 `as any` casts in assertions — see Concerns |
| d81b6f7 | src/state/inventory/inventoryReducer.ts | PASS | 33 cases / 45 assertions |
| d6a8963 | src/state/map/mapReducer.ts | PASS | 36 cases / 61 assertions |
| fe9f54d | src/state/character/characterActions.ts | PASS | action-creator shape coverage |
| 21761ec | src/state/alchemy/alchemyActions.ts | PASS | 11 cases / 39 assertions |
| 78ca76a | src/state/combat/combatActions.ts | PASS | 13 cases / 43 assertions |
| 1579096 | src/state/crafting/craftingActions.ts | PASS | 9 cases / 31 assertions |
| 1aab556 | src/state/gathering/gatheringActions.ts | PASS | 12 cases / 49 assertions |
| 9d9375c | src/state/inventory/inventoryActions.ts | PASS | 11 cases / 39 assertions |
| b0460ce | src/state/map/mapActions.ts | PASS | 14 cases / 43 assertions |
| 6e66f68 | src/state/downtime/downtimeActions.ts | PASS | 12 cases / 27 assertions |
| 0d682c1 | src/state/selectors/alchemySelectors.ts | PASS | selector coverage |
| 374ce52 | src/state/selectors/characterSelectors.ts | PASS | selector coverage |
| 50b05b0 | src/state/selectors/combatSelectors.ts | PASS | 31 cases / 36 assertions |
| 089a035 | src/state/selectors/craftingSelectors.ts | PASS | selector coverage |
| 2e156f8 | src/state/selectors/gatheringSelectors.ts | PASS | 25 cases / 75 assertions |
| dbc1ed8 | src/state/selectors/inventorySelectors.ts | PASS | 19 cases / 54 assertions |
| 9bf646f | src/state/selectors/locationSelectors.ts | PASS | 25 cases / 38 assertions |
| 6a5f27f | src/state/campaignUtils.ts | PASS | 35 cases / 48 assertions |
| fe2ac5d | src/persistence/dataMigration.ts | PASS | migration path coverage |
| b730cd6 | AUTO_QUEUE.md (defer db.ts) | PASS | honest deferral — see Notes |
| c559120 | src/utils/combatHistory.ts | PASS | 30 cases / 83 assertions |
| d8f53bf | src/utils/characterImport.ts | PASS | strong malformed/partial-payload edge coverage |
| 5f56abd | src/utils/batchedStorageManager.ts | PASS | batching, flush ordering, write-failure paths |
| b3cdeb3 | src/utils/cryptoLock.ts | PASS | wrong-password, corrupted-ciphertext, KDF/cipher/iteration validation — solid error paths for security code |
| 75d0fde | src/utils/logger.ts | PASS | 6 cases / 13 assertions |

### Concerns to address

**e81cc19 — `as any` casts in `gatheringReducer.test.ts`.** Four `as any` casts slipped into the test assertions: reaching into entity-union fields (`src/state/gathering/__tests__/gatheringReducer.test.ts:193` `gatheringSessions['sess-1'] as any).status`, `:281` `forageZoneProfiles['z1'] as any).name`, `:319` `forageItems['f1'] as any).name`) and one on reducer input (`:374` `handleGatheringAction(state as any, …)`). Per the type-discipline axis, ≥3 `as any` casts = CONCERN. Real risk is low — these are test-only union-narrowing/edge-input casts, not production code, and the suite is otherwise the deepest in the batch (33 cases including no-op-for-unknown-id edge paths). Fix is mechanical: replace with the concrete member type (`as GatheringSession`, `as ForageZoneProfile`, `as ForageItem`) and a typed partial for the crafted state. Not a blocker; worth a cleanup pass.

### Notes

**b730cd6 deferral verified honest.** The `[!]` marker on the `db.ts` queue item cites "db.ts is a non-functional placeholder — `kvStore = {}` and 'TODO: Install dexie' at line 11; every exported function throws at runtime." Confirmed against the file state at that commit: `src/persistence/db.ts` carried `// TODO: Install dexie package: npm install dexie` at line 11 with a placeholder `GurpsDB` class, and dexie is absent from `package.json`. The deferral correctly flagged this as needing a human decision; a human subsequently deleted the dead placeholder (`335612a "Delete dead db.ts Dexie placeholder"`), so the item is now moot.

## 2026-05-15 — PASS (4 commits: 4P, 0N, 0C)

| commit | target | verdict | notes |
| ------ | ------ | ------- | ----- |
| 71a6e0c | src/components/combat/views/CombatHeaderView.tsx | PASS | 10/10 buttons labeled; Export button also got `aria-haspopup="menu"` + `aria-expanded` — appropriate enhancement, still within scope |
| 79ab16a | src/components/combat/views/DicePanelView.tsx | PASS | 4/4 buttons labeled; toggle button got dynamic label + `aria-expanded` |
| 8ffc6ee | src/components/combat/views/TurnControlsView.tsx | PASS | 2/2 buttons labeled (Prev/Next turn) |
| 1294fc6 | src/components/combat/views/InitiativeTimeline.tsx | PASS | 2/2 buttons labeled (Prev/Next turn) |

All four commits are scope-clean a11y label additions: target `.tsx` file + single `[ ] → [x]` line in `AUTO_QUEUE.md`. No new `:any`, `as any`, or `@ts-nocheck`. No deferrals to validate. Labels match button intent and, where state is involved, include `aria-expanded` (DicePanelView toggle, CombatHeaderView Export). Engine-test scrutiny does not apply — these are pure JSX attribute additions on view components.

## 2026-05-13 — empty (0 commits) — no auto-dev: commits since last review (empty-run streak: 1/7; queue open items: 0)

## 2026-05-12 — PASS (10 commits: 10P, 0N, 0C)

Test-coverage sweep across `src/utils/`. Every commit confined to a single new co-located test file plus a one-line `[ ] → [x]` flip in `AUTO_QUEUE.md`. No production source touched, no `:any`/`as any`/`@ts-nocheck` introduced in `src/` outside `__tests__/`. No deferrals (`[!]`) in this batch, so no honesty checks required. Engine targets (`damage`, `dice`, `effectsEngine`, `fogOfWar`, `hitLocations`, `injuryEngine`) all exercise non-trivial branches and edge cases, not just happy paths.

| commit | target | verdict | notes |
| ------ | ------ | ------- | ----- |
| 8849b3f | src/utils/damage.ts | PASS | low/mid/cap rows on swing & thrust tables, modifier cancellation, DR floor, runtime-guard throw |
| cb0a75a | src/utils/dayPlanner.js | PASS | 32 cases covering planner state transitions |
| 2d83b4a | src/utils/dice.ts | PASS | bounds rejection (>100 dice, sides <2 / >100), malformed, negative constants, deterministic-RNG total |
| 68d1740 | src/utils/effectsEngine.js | PASS | 41 cases over 364 lines |
| f0b1701 | src/utils/fogOfWar.ts | PASS | radius 0, 8-dir radius 1, edge clipping, multi-source union, off-grid start |
| 649f5e2 | src/utils/hitLocations.ts | PASS | 20 cases |
| 7e46828 | src/utils/importSchemas.ts | PASS | 32 cases over 258 lines |
| abb8a46 | src/utils/injuryEngine.js | PASS | DR floor, per-location DR, skull-imp x4 stacking, lite-preset multiplier disable |
| f5ac437 | src/utils/itemTags.js | PASS | 30 cases |
| 1c23698 | src/utils/losUtils.ts | PASS | source is an explicit Phase-14 stub; tests assert stub contract (always-unblocked, two-tile path, fresh array, no map read) and are labeled `(stub)` |

## 2026-05-09 — NOTE (44 commits: 43P, 1N, 0C)

Bootstrap run — first review since the daily-review system was scaffolded. Window: parent of first `auto-dev:` commit through HEAD. All 6 deferrals verified honest against parent-commit file state. Type-erosion findings in `exportImport.ts` (33 `:any`) and `combatHelpers.test.ts` (`@ts-nocheck` + 20 `as any`) suppressed by `KNOWN_ISSUES.md`. Modal focus-trap gaps across 11 a11y sweeps suppressed by deferred entry.

| commit | target | verdict | notes |
| ------ | ------ | ------- | ----- |
| 33140af | src/state/__tests__/campaignReducer.test.ts | NOTE | one `as any` cast on `circular` snapshot fixture in test code |
| 7a385fa | src/utils/storage.ts | PASS | try/catch around JSON.parse with logger.warn + null safe default; malformed-input test added |
| b3f2af4 | AUTO_QUEUE.md (defer) | PASS | verified: combatHistory.js (parent commit) had zero JSON.parse calls |
| 05eae53 | AUTO_QUEUE.md (defer) | PASS | verified: combatReveal.js (parent commit) had zero JSON.parse calls |
| a9e2f51 | AUTO_QUEUE.md (defer) | PASS | verified: helpers.js safeParse already wraps JSON.parse in try/catch with fallback |
| f6420520 | src/utils/__tests__/schemaVersioning.test.js | PASS | 3 malformed-input tests for getMigrationHistory and logMigration |
| 4a83b1b | src/utils/__tests__/dataMigrations.test.js | PASS | 8 malformed-input tests across getLastBackup/restoreFromBackup/listBackups |
| 7a634339 | src/components/character-management/CharacterContextMenu.tsx | PASS | cancelled-ref guard on setTimeout + unmount-before-timeout test |
| 334153c | AUTO_QUEUE.md (defer) | PASS | verified: MapContextMenu had zero setTimeout calls |
| 1ddd066 | AUTO_QUEUE.md (defer) | PASS | verified: ConfirmDialog had zero setTimeout calls (race retargeted to Toast) |
| 23674330 | src/components/ui/Toast.tsx | PASS | cancelled-ref guard on duration + exit-animation timers + tests |
| 6c327ba | src/net/ConnectionManager.ts | PASS | defensive socket.off() before each socket.on() |
| d5061c8 | src/utils/cryptoLock.ts | PASS | JS→TS, no `as any` introduced, .js removed |
| ac14447 | src/utils/helpers.ts | PASS | JS→TS, .d.ts shim removed, no `as any` |
| 3f74f60 | src/utils/schemaVersioning.ts | PASS | JS→TS, no `as any` |
| 868cec4 | src/utils/dataMigrations.ts | PASS | JS→TS, rename + types, no `as any` |
| 0ea000e | src/utils/combatReveal.ts | PASS | JS→TS, no `as any` |
| 6f1288c | src/utils/combatHistory.ts | PASS | JS→TS, .d.ts shim removed; +13 lines in src/types/combatTracker.ts to compensate (within stated scope) |
| 95eee67 | src/utils/exportImport.ts | PASS | JS→TS conversion; the 33 `:any` annotations are suppressed by KNOWN_ISSUES tracked entry — not a regression from JS source |
| ffa5d96 | AUTO_QUEUE.md (defer) | PASS | verified: CombatTracker.tsx delegates all interactive elements to subview components |
| 66271a6 | src/components/combat/ActionPanel.tsx | PASS | aria-labels added to interactive elements |
| 4939de4 | src/components/ui/ConfirmDialog.tsx | PASS | aria-describedby wired to message id |
| 72df709 | src/components/RulesModal.tsx | PASS | role/aria-modal/labelledby + Escape close (focus trap deferred) |
| 72772cd | src/components/ConnectionDialog.tsx | PASS | role/aria-modal/labelledby + Escape close |
| f69d7d5 | src/components/GMLockModal.tsx | PASS | role/aria-modal/labelledby + Escape close |
| ffe9762 | src/components/character-management/CharacterCreationModal.tsx | PASS | role/aria-modal/labelledby |
| e4ec8d0 | src/components/combat/GCSImportModal.tsx | PASS | role/aria-modal/labelledby |
| 5cd2602 | src/components/combat/ReinforcementsModal.tsx | PASS | role/aria-modal/labelledby + Escape close |
| 4fbd0b8 | src/components/crafting/SaveDesignModal.tsx | PASS | role/aria-modal/labelledby + Escape close |
| 23b0277 | src/components/map/views/TerrainAssignmentModal.tsx | PASS | role/aria-modal/labelledby + Escape close |
| 5f02cd0 | src/components/map/views/MapCreateDialog.tsx | PASS | role/aria-modal/labelledby + Escape close |
| 3955a06 | src/components/map/views/TravelWizard.tsx | PASS | role/aria-modal/labelledby on wrapping container |
| f843a30 | src/utils/__tests__/activityLogger.test.ts | PASS | 148 lines, happy + edge cases |
| 2bf2c4e | src/utils/__tests__/characterManagement.test.ts | PASS | 142 lines, happy + edge cases |
| 9a39315 | src/utils/__tests__/combatActions.test.js | PASS | 312 lines, multiple branches exercised |
| 672968f | src/utils/__tests__/combatHelpers.test.ts | PASS | 504 lines; `@ts-nocheck` + 20 `as any` suppressed by KNOWN_ISSUES grandfathered entry |
| a080bf7 | src/utils/__tests__/combatInventoryBridge.test.js | PASS | 196 lines |
| d3cedbd | src/utils/__tests__/combatItemEffects.test.js | PASS | 243 lines |
| ed0250d | src/utils/__tests__/combatItemFilter.test.js | PASS | 134 lines |
| f66e0f4 | src/utils/__tests__/combatLogFilter.test.js | PASS | 253 lines |
| 7d11d2d | src/utils/__tests__/combatValidation.test.js | PASS | 218 lines |
| ac3ecc7 | src/utils/__tests__/combatViewFilter.test.js | PASS | 373 lines |
| 7ef5c94 | src/utils/__tests__/combatViewSelectors.test.js | PASS | 195 lines |
| 2f3f349 | src/utils/__tests__/conditionsEngine.test.js | PASS | 386 lines (engine-adjacent — branch coverage looks substantive at line count) |
| ce04967 | src/utils/__tests__/createAutoResolvedTask.test.ts | PASS | 167 lines |

### Notes

- **33140af** — a single `as any` cast on a `circular` snapshot fixture in `campaignReducer.test.ts`. Acceptable for constructing intentionally-malformed test inputs but worth noting as a precedent: prefer typed builders when the malformed shape can be expressed as `Partial<CampaignState>`. Not a CONCERN given test scope.

