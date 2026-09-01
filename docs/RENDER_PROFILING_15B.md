# Render Profiling & Subscription Store (Phase 15b)

**Shipped 2026-09-01.** Covers the 15b roadmap item "Profile and optimize re-renders in large state updates."

## The problem (measured)

`CampaignStoreProvider` held state in `useReducer` and rebuilt the context value on every
dispatch, so **every mounted `useCampaignStore()` consumer re-rendered on every action** —
~89 component files consume the store (God node, 195 graph connections).

Baseline from the harness (`src/__tests__/renderProfiling.test.tsx`, run pre-refactor):

| Scenario | actions-only probe | single-character probe | UnifiedShell commits |
|---|---|---|---|
| 10× `addLogEntry` | 10 | 10 | 10 |
| 1× `updateCharacter(A)` (probe watches B) | 1 | 1 | — |

## The fix

`campaignStore.tsx` now keeps state in a plain subscription store (`CampaignStoreHandle`:
`getState`/`getRawState`/`dispatch`/`subscribe`). The context value is `{ store, actions }`
and **never changes**, so re-renders are driven entirely by `useSyncExternalStore`
subscriptions:

- **`useCampaignStore()`** — unchanged API, subscribes to the whole state. Existing
  consumers behave exactly as before (re-render per dispatch). No migration required.
- **`useCampaignSelector(selector, isEqual?)`** — subscribes to a slice; re-renders only
  when the selected value changes (`Object.is` default). Prefer module-level selector
  constants for cross-render memoization; inline selectors are correct but re-run per render.
- **`useCampaignActions()`** — stable action creators, no subscription, zero re-renders.

`legacy.appState` pinning (the `initialLegacyAppState` prop override) is preserved in the
snapshot layer; persistence still saves the raw reducer state (`getRawState`). The debounced
500ms save now runs off a store subscription instead of a `[state]` effect.

### Migrated to selectors in this pass (the always-mounted chrome)

`UnifiedShell`, `TimeDisplay`, `TimeControls`, `WeatherWidget`, `MealBuffWidget`,
`CombatTile`, `useCharacterSlotSummary`/`useAllCharacterSlotSummaries`, and the store's own
convenience hooks (`useCampaignCharacters`, `useSelectedCharacter(Id)`, `useLegacyAppState`).

### Post-fix numbers (same harness, now regression tests)

| Scenario | actions-only | character probe | UnifiedShell commits |
|---|---|---|---|
| 10× `addLogEntry` | 0 | 0 | **0** (was 10) |
| 1× `updateCharacter(A)` (watching B) | 0 | 0 | — |
| 1× `updateCharacter(A)` (watching A) | — | 1 | — |

## Behavioral note: synchronous notification

Dispatch now notifies subscribers synchronously. An effect that dispatches in a loop and
guards itself with component state set *after* the loop can re-enter before the guard commits
(hit in `PostCombatSummary`; fixed with a ref guard set before dispatching). If you write an
effect that dispatches based on store-derived deps, guard with a ref, not post-hoc state.

## Follow-ups

- `CombatContext.tsx` (deprecated bridge, 628 lines) whole-subscribes and rebuilds its
  context value per render — during combat, its consumers re-render on every dispatch.
  Worth migrating when combat perf comes up; out of scope here.
- ~84 remaining `useCampaignStore()` call sites still whole-subscribe. Only the ones inside
  the always-mounted chrome mattered for idle cost; the rest live in lazy tab content and can
  migrate opportunistically (`useCampaignSelector` + module-level selectors is the pattern).
- Harness: `PROFILE_RENDERS=1 npx vitest run src/__tests__/renderProfiling.test.tsx --disable-console-intercept`
  prints the counts; the assertions run in the normal suite as regression guards.
