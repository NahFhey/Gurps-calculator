# Spec: Phase 14 Lane 0 — Delete dead location-graph travel; unify travel into advanceTime; schema groundwork

**Date:** 2026-08-31
**Repo:** GURPS VTT (React 18 + TypeScript strict + Vite, Redux-style state with Immer, Vitest/jsdom)
**Branch:** you are on `codex/lane0-travel-unify`. Commit nothing; leave changes in the working tree.

## Background (why)

Phase 14 rebuilds travel around map-tile journeys (design: `docs/MAP_TRAVEL_14_PLAN.md`, decisions D1 and D14). Two pieces of demolition/unification must land first:

1. The app has a **dead second travel system** on the location graph: `TravelPanel` lists location connections with travel times, but its "travel" button just calls `setCurrentLocation` — no time, no rolls. Its supporting types, reducer cases, store methods, and selectors are write-only or never-invoked. It all goes.
2. The **working** map-tile travel (`map/executeTravel`) advances time via a **copy-paste divergence** from the `advanceTime` reducer case: it skips the paused-activities guard, the undo checkpoint, and the weather expiration/regeneration loop. This is a real bug (travel can advance time without weather ever changing). The two paths must become one code path.

Plus a schema version bump so old saves shed the removed fields cleanly.

## Architecture rules (non-negotiable)

- `strict: true` must stay clean: `npx tsc --noEmit` → 0 errors.
- **No new `as any` casts.** The existing reservation-manager stub cast inside the time-advance code may move as-is, but do not introduce new ones. Prefer fixing types at the source.
- `import type` for type-only imports.
- State logic lives in reducers/utils, not components. Follow existing file conventions.
- Do not run `npm install`. Do not touch files outside the scope below except as forced by compile/test breakage from the deletions.

---

## Part A — Delete the dead location-graph travel system

### A1. Components
- Delete `src/components/location/TravelPanel.tsx`.
- Delete `src/components/location/views/TravelView.tsx`.
- `src/components/location/index.ts:8`: remove the `TravelPanel` export.
- `src/components/location/LocationManager.tsx`: remove the `TravelPanel`/`TravelView` imports (lines ~20, 26), the `case 'travel'` view branch (~235-239), the `onTravel={() => setView('travel')}` prop (~213), and the `'travel'` entry in the `!['travel', 'editWeatherTable']` check (~306).
- `src/components/location/managerTypes.ts:9`: remove `'travel'` from the manager view union.
- Follow the `onTravel` prop into whichever child view receives it (a Travel button in the location list view) and remove that button + prop entirely.

### A2. Types — `src/types/location.ts`
- Delete `interface TravelAction` (~line 270) and `interface LocalTravel` (~286).
- Delete `LocationState.activeTravels` (~308).
- On `LocationConnection` (~lines 214-215): delete `travelTime` and `travelDifficulty`, and delete `requirements` if present. **Keep `LocationConnection` itself** (id/target fields) — connections survive as plain "related places" links; only the travel semantics die.

### A3. State plumbing
- `src/state/campaignReducer.ts`: remove the four action types `addTravel` / `updateTravel` / `completeTravel` / `cancelTravel` (~lines 717-720) and their switch cases (~1344-1390). Remove the now-unused `TravelAction` import (~line 58).
- `src/state/campaignStore.tsx`: remove the `TravelAction` import (~65), the four method signatures (~302-305), and the four implementations (~648-652).
- `src/state/selectors/locationSelectors.ts`: remove the `TravelAction` import and every `activeTravels` selector (`selectActiveTravels`, `selectTravelById`, `selectTravelsByDestination`, `selectTravelsByOrigin`, and the count/has-active selectors, ~lines 129-163).
- `src/utils/weatherSystem.ts:867`: remove `activeTravels: []` from `createInitialLocationState` (or wherever that initializer lives).

### A4. Dead map-side wizard state (a separate dead limb, same demolition)
`MapState.travelWizard` is written but never read: `MapPanel` keeps wizard state in local `useState` and never dispatches these actions.
- `src/types/map.ts`: delete the `TravelWizardState` type, `MapState.travelWizard` (~366), and its `initialMapState` entry (~409).
- `src/state/map/mapActions.ts`: delete `MAP_SET_TRAVEL_WIZARD` / `MAP_CLEAR_TRAVEL_WIZARD` (~71-72) and their action types (they appear in the `MapAction` union).
- `src/state/map/mapReducer.ts`: delete their cases (~443, 448) and the `maps.travelWizard = null` line inside the executeTravel case (~487).
- `src/state/campaignStore.tsx`: delete `mapSetTravelWizard` / `mapClearTravelWizard` (~715-716) — both the implementations and their interface signatures.
- Delete the orphaned `src/components/map/views/TravelBlockerList.tsx` (only referenced by `views/index.ts:14` and its own tests — `TravelStep3Confirm.tsx` renders blockers inline). Remove the export and its test block(s) in `src/components/map/views/__tests__/MapViewComponents.test.tsx`.

### A5. Test fallout
Update existing tests that reference removed symbols (`LocationManager.test.tsx`, `LocationComponents.test.tsx`, `locationSelectors.test.ts`, `mapReducer.test.ts`, `mapActions.test.ts`, `MapViewComponents.test.tsx`, and any others tsc/vitest flag). Remove or rewrite only what the deletions force; do not weaken unrelated assertions.

After Part A: `grep -rn "TravelAction\|LocalTravel\|activeTravels\|TravelPanel\|TravelBlockerList\|TravelWizardState\|setTravelWizard\|clearTravelWizard\|travelDifficulty" src/` must return zero hits (excluding this spec's filename if it appears anywhere).

---

## Part B — Unify travel time-advance into the real advanceTime path

Current state, both in `src/state/campaignReducer.ts`:
- `case 'advanceTime'` (~1031-1101): paused-activities guard → undo checkpoint → `advanceTimeSlot` (with an inline no-op reservation-manager stub cast `as any`) → slot/day update + history + `time.advance` log → `blockingError = null` → weather expiration/regeneration loop over all locations.
- The `map/executeTravel` cross-slice branch (~803-825): a trimmed copy that does ONLY `advanceTimeSlot` + slot/day + history + log. **No guard, no checkpoint, no weather regen.**

### Required behavior after refactor
Extract the shared logic into one place — recommended: a new module `src/state/time/advanceTimeCore.ts` exporting small pure-ish helpers operating on the Immer draft (e.g. `guardTimeAdvance(draft): boolean`, `pushTimeCheckpoint(draft, label)`, `advanceSlotAndRegenerateWeather(draft, logMessage: (day, slot, label) => string)`), or module-level functions inside `campaignReducer.ts` if a new module fights the existing structure. The hard requirement: **the slot-advance code and the weather-regeneration loop each exist exactly once.**

1. `case 'advanceTime'` behavior is **byte-for-byte unchanged** from the user's perspective: same guard, same checkpoint label (`'Before time advance'`), same log message format, same weather behavior. Existing tests must pass unmodified (except mechanical import changes if any).
2. `map/executeTravel` now:
   - **Guard first, before any movement**: if `draft.activities.pausedSessionIds.length > 0`, set the same `blockingError` shape (`type: 'pausedActivities'`, `system: 'time'`) and return **without moving the party, revealing tiles, syncing terrain, or advancing time**. (Today the map movement happens in `handleMapAction` before the cross-slice code — you will need to special-case `map/executeTravel` so the guard runs before delegation.)
   - Pushes one undo checkpoint labeled `'Before travel'` capturing the **pre-travel** state (so undo restores the party's position), respecting `checkpoints.maxSize` exactly like advanceTime does.
   - Then: map movement (existing `handleMapAction`), terrain sync (existing cross-slice block, unchanged), then the shared slot-advance + weather-regen helper with the travel-flavored log message (`Travel completed — advanced to Day ${day}, Slot ${slot + 1} (${label})`).
   - Clears `blockingError` on success (the shared helper already does this for advanceTime).
3. `map/setPartyTile` keeps its terrain sync and does NOT gain a time advance (unchanged).
4. The reservation-manager stub: consolidate to one place. If you can type it without `as any` cheaply (e.g. widen `advanceTimeSlot`'s parameter type or build a typed no-op object), do so; otherwise keep the single existing cast with a brief comment. Do not create a second cast.

### New tests (required — this branch currently has ZERO coverage)
Add reducer-level tests (suggested: `src/state/__tests__/travelTimeAdvance.test.ts`, or extend an existing campaignReducer test file) asserting, via dispatching `map/executeTravel` on a realistic state (see `src/state/map/__tests__/mapReducer.test.ts` for state-building patterns):
1. Travel advances time exactly one slot and increments day on wraparound.
2. Travel pushes exactly one checkpoint, labeled `'Before travel'`, and the checkpoint's snapshot has the party on the ORIGIN tile.
3. Travel regenerates expired weather (seed a location with `currentWeather` whose expiry precedes the post-travel time; assert it changed / a fresh `generatedAt`), matching what `advanceTime` would do.
4. With `pausedSessionIds` non-empty: party tile does NOT move, time does NOT advance, `blockingError` is set with `type: 'pausedActivities'`.
5. Plain `advanceTime` still: guards, checkpoints (`'Before time advance'`), advances, regenerates weather (parity check that the refactor didn't fork behavior).

---

## Part C — Schema groundwork

`src/utils/schemaVersioning.ts`: `CURRENT_SCHEMA_VERSION` is `'1.5.4'`; `SCHEMA_METADATA` entries follow a `migratesFrom` pattern (see entries `'1.5.0'`–`'1.5.4'`).

1. Bump to `'1.5.5'` with a metadata entry (`migratesFrom: ['1.5.4']`, description like "Remove dead location-graph travel state (activeTravels, connection travel fields, map travelWizard)").
2. In the hydration/migration path (follow how prior bumps were wired — `src/utils/dataMigrations.ts` and/or `src/persistence/campaignStorage.ts`), add a defensive cleanup for legacy saves:
   - strip `activeTravels` from persisted locations state;
   - strip `travelTime`, `travelDifficulty`, `requirements` from each persisted `LocationConnection`;
   - strip `travelWizard` from persisted map state.
   The cleanup must be **idempotent** (safe on already-clean and already-migrated saves) and must never throw on missing/partial structures.
3. Tests: follow the existing migration test pattern (see `src/utils/__tests__/` migration/schema tests) — one test with a legacy-shaped fixture asserting the fields are stripped and version lands at 1.5.5; one idempotency test (migrating twice = migrating once).

---

## Definition of done — self-verify before finishing

Run all of these yourself and fix failures:

```
npx tsc --noEmit                       # 0 errors
npx vitest run                         # full suite green (~11s on this machine)
grep -rn "TravelAction\|LocalTravel\|activeTravels\|TravelPanel\|TravelBlockerList\|TravelWizardState\|travelDifficulty" src/
                                       # zero hits
```

At least 7 new tests across Part B (5 listed) and Part C (2 listed). Do not delete or skip unrelated failing tests — if something unrelated is red on a clean checkout, note it and leave it.

## Final summary requested

One paragraph on design decisions — especially: how you structured the shared time-advance helper(s), how the paused-guard was made to run before map delegation, anything you found referencing the deleted symbols beyond this spec's list, and how you wired the 1.5.5 migration into the existing chain.
