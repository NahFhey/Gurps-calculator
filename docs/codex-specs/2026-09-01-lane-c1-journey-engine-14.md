# Spec: Phase 14 Lane C1 — The journey loop: engine, tick movement, navigation/drift, travel tasks

**Date:** 2026-09-01
**Repo:** GURPS VTT (React 18 + TypeScript strict + Vite, Redux-style state with Immer, Vitest/jsdom)
**Branch:** you are on `codex/lane-c-journey-loop`. Commit nothing; leave changes in the working tree.
**Design doc (read for intent):** `docs/MAP_TRAVEL_14_PLAN.md`, decisions D6, D7, D10, D14, D15, D16 (+ punted calls 1, 2, 5).
**This is stage 1 of 2.** A follow-up spec (C2) adds terrain-keyed travel event tables + Manager editor, the encounter hand-off, cooking/provisioning + B426 missed meals, and the full journey UI. C1 must leave the app compiling, all tests green, and travel usable end-to-end through the new journey model with *minimal* UI.

## Background (why)

Travel today teleports: `map/executeTravel` moves the group the whole route in one dispatch and advances exactly one slot (cross-slice branch `campaignReducer.ts:962-1006`, in-code comment at :990-991 says Lane C replaces it). Over-budget routes are *blockers* (`EXCEEDS_TIME_BUDGET`), so multi-day journeys are impossible by construction. Lane C1 makes the confirmed route an **armed journey on the travel group**, progressed only by the ordinary time tick: each tick the group moves along the route by that slot's weather/terrain/encumbrance-adjusted mile budget, the designated navigator rolls Navigation (failure = overt lateral drift + auto-reroute), night slots auto-camp (GM forced-march override), and each moving slot materializes a **resolved** `'travel'` downtime task for the crew so the existing fatigue mechanic sees the work.

## Architecture rules (non-negotiable)

- `strict: true` stays clean: `npx tsc --noEmit` → 0 errors. **No new `as any`.** `import type` for type-only imports.
- State logic in reducers/utils, never components. Immer drafts throughout.
- Positions are always `TileId`s, never `{row,col}`. `expandMapIfNeeded` can replace `maps.mapsById[mapId]` mid-action (`mapReducer.ts:452-456`) — re-read the map through the draft after calling it; never hold a stale reference.
- Do not run `npm install`. UI only as listed in Part 7.

---

## Part 1 — Journey type (`src/types/party.ts`)

Append to the existing file (current content ends at `GroupPosition`, line 41):

```ts
export type JourneyPauseReason =
  | 'crewBelowMinimum'   // able-bodied + free crew < minCrew (vehicle) or zero able-bodied (foot)
  | 'noRoute'            // reroute after drift found no valid path
  | 'encounter'          // reserved for Lane C2 (travel events)
  | 'manual';            // GM paused from the journey panel

export interface JourneyNavigationLog {
  day: number;
  slot: number;
  roll: number;
  effectiveSkill: number;
  margin: number;               // effectiveSkill - roll (negative = failure)
  driftedTiles: number;         // 0 on success
  critFailure: boolean;
}

export interface Journey {
  id: Id;
  mapId: MapId;
  /** Remaining planned route. [0] is ALWAYS the group's current tile; last is the destination. */
  routeTileIds: TileId[];
  destinationTileId: TileId;
  mode: TravelMode;
  /** Designated navigator (must be a group member). Null = use gmNavigationSkill. */
  navigatorId: Id | null;
  /** GM-set effective Navigation level used when navigatorId is null (design punted call 1). */
  gmNavigationSkill: number;
  /** GM override: journey moves on night slots at a navigation penalty; no auto-camp. */
  forcedMarch: boolean;
  /** Miles of progress toward routeTileIds[1]; carries across slots for expensive tiles. */
  legProgressMiles: number;
  milesTraveled: number;
  status: 'active' | 'paused';
  pauseReason?: JourneyPauseReason;
  /** Carried from the wizard: allows traversing null-terrain tiles + pendingTerrainAssignment. */
  gmOverride: boolean;
  startedAt: { day: number; slot: number };
}
```

`TravelGroup` gains one field: `journey?: Journey | null;` (default absent/null — plain JSON, so checkpoints and serialization work untouched; verify in tests).

## Part 2 — Slot day/night model (design D15, punted call 5)

In `src/utils/timeSystem.ts` add:

```ts
/** Night-slot indices for a day. Defaults to the last slot (design D15 punted call 5). */
export function getNightSlotIndices(slotsPerDay: number, override?: number[]): number[]
export function isNightSlot(slot: number, slotsPerDay: number, override?: number[]): boolean
```

State: `time` block in `campaignReducer.ts` (type at :211-218) gains `nightSlotIndices?: number[]` (optional, undefined = default). No editor UI in C1 — the field exists so a calendar-editor followup can write it; read it everywhere through the helpers. Do NOT hardcode `slot === 2` anywhere.

## Part 3 — The journey engine (`src/state/party/journeyEngine.ts`, new file)

Exported entry point, called from the campaign reducer with the full draft:

```ts
export function progressJourneys(draft: Draft<CampaignState>): void
```

Iterates all travel groups **sorted by group id** (deterministic order, design D14 sequential resolution) and for each group with `journey?.status === 'active'` runs one slot of journey progression **for the slot currently in `draft.time` (the elapsed slot — the engine runs BEFORE the slot advances, see Part 5)**.

### Per-slot progression for one group

1. **Night check.** If `isNightSlot(draft.time.slot, draft.time.slotsPerDay, draft.time.nightSlotIndices)` and `!journey.forcedMarch`: auto-camp. No movement, no travel task (the whole group is free for camp activities — that's the point of D15). Append log `travel.camp` (player): `"<group> makes camp"`. Return.
2. **Crew check.** `assigned = selectAssignedCharacterIdsForSlot(draft.downtime, draft.time.day, draft.time.slot)` (`src/state/downtime/downtimeSelectors.ts:331-350`). Able-bodied via `isAbleBodied` (`src/utils/partyPosition.ts:81-86`).
   - Vehicle journey (`group.vehicleId` set): `crew` = first `vehicleType.minCrew` members that are able-bodied AND not in `assigned`, in `memberIds` order. If fewer available than `minCrew` → pause journey (`status: 'paused', pauseReason: 'crewBelowMinimum'`), log `travel.paused` (player, message names the shortfall), return.
   - Foot journey: `crew` = ALL members not in `assigned`. If zero able-bodied members in the whole group → pause with `'crewBelowMinimum'`, return. (Assigned-but-able members don't block foot travel by themselves; they just also get no travel task — but see Part 4: on foot, members with a conflicting task simply aren't double-booked.)
3. **Navigation roll (design D7 + punted calls 1-2).**
   - Effective skill: if `navigatorId`, resolve via a new util `getNavigationSkill(character, mode)` in `src/utils/navigation.ts` (new file):
     - Uses `findMergedSkillLevel`-style lookup (copy the private helper pattern from `src/utils/study.ts:41-55`, via `getCharacterSkills` from `src/types/characterSheet.ts:626-631`): try `Navigation (Land|Sea|Air)` keyed by mode (`foot→Land, boat→Sea, airship→Air`), then plain `Navigation`; if untrained, default `IQ - 6` (attribute from `gcsData.attributes.IQ ?? 10`). Return `{ level, isDefault }` like `getInfluenceSkill` (`src/utils/social.ts:23-35`).
     - Else use `journey.gmNavigationSkill`.
   - Modifiers: `+ getWeatherModifierForActivity(map.currentWeather?.weather, 'travel')` (`src/utils/weatherSystem.ts:766`), `+ getFatiguePenalty(selectCharacterFatigueStatus(draft.downtime, navigatorId, day, slot))` when there is a navigator (`downtimeSelectors.ts:580, 658`), `- 5` when moving on a night slot under forced march (design D15).
   - Roll with `roll3d6()` from `src/utils/gathering.ts:335-345` (NOT the `alchemy.ts` duplicate). Margin = effectiveSkill − total. Crit failure via `isCriticalFailure(total, effectiveSkill)` (`gathering.ts:369`).
4. **Drift on failure (overt, design D7).** On failure: `driftTiles = min(3, ceil(-margin / 2)) + (critFailure ? 1 : 0)`. The slot's movement is spent wandering: move the group laterally `driftTiles` steps — each step picks a uniformly random neighbor tile (8-neighborhood, same adjacency as `mapRouter.ts` DIRECTIONS) that is passable for the mode (and has non-null terrain unless `journey.gmOverride`), excluding the tile you just came from and excluding `routeTileIds[1]` (drift is *away from* the intended line; if no candidate qualifies, stop drifting early — staying put is legal lost time). Apply each step as a position write + reveal (Part 3.6). **No forward progress this slot; `legProgressMiles` resets to 0.** Then recompute the remaining route: `findRoute(map, currentTile, destinationTileId, mode, journey.gmOverride)` (`src/utils/mapRouter.ts:52`). Valid → `journey.routeTileIds = route.path`. Invalid → pause with `'noRoute'`, log `travel.paused`. Log `travel.drifted` (player — the party knows, design D7): message includes tiles drifted and that the route was recalculated. Record a `JourneyNavigationLog` entry? No — keep the journey lean; the changelog IS the record (`appendLogEntry` auto-stamps day/slot). Skip to step 7 (task materialization still happens — the crew worked).
5. **Movement on success.** Slot budget miles = `computeSlotBudgetMiles` (Part 6). Walk the route: per-step cost between consecutive route tiles = same formula as `computeRouteMiles` (`mapRouter.ts:144-172`): `(scaleMilesPerTile * distFactor) / terrainSpeedModifier` where distFactor is 1.414 for diagonal steps. Consume `legProgressMiles + budget`; each time the accumulated miles cover the next step's cost, advance one tile: position write + reveal (3.6), subtract the cost, continue. Store the remainder in `journey.legProgressMiles`; add actual miles moved to `journey.milesTraveled`. Null-terrain steps: cost uses speedModifier 1.0 (matches `getSpeedModifier`, `mapRouter.ts:254-260`).
6. **Position write + reveal (per tile entered).** Mirror the `MAP_EXECUTE_TRAVEL` write (`mapReducer.ts:431-440`): vehicle journeys set `vehicle.position = { kind:'tile', mapId, tileId }` + `modifiedAt`; foot journeys set `group.position`. Add the tile to `map.revealedTileIds`; if `map.visionMode === 'lineOfSight'`, also add `computeVisibleTiles(map, [tileId])` (`src/utils/lineOfSight.ts`). After all movement for the slot: `expandMapIfNeeded` (re-read the map from the draft afterwards); if `journey.gmOverride`, append entered tiles with `terrainId === null` to `maps.pendingTerrainAssignment` (create the array if null — semantics of `mapReducer.ts:458-467`). Extract this into a small helper inside journeyEngine rather than trying to reuse the (deleted, see Part 5) reducer case.
7. **Travel task materialization (design D10).** For every moving slot (movement OR drift; not camp): write one already-resolved `'travel'` task directly into `draft.downtime` (the downtime reducer is NOT mounted in the campaign reducer — see Part 8 for the sync fix):
   - `id: 'task-travel-' + journey.id + '-' + day + '-' + slot`, `activityType: 'travel'`, `dayKey: draft.time.day`, `slot: draft.time.slot`, `leaderId: crew[0]`, `helperIds: crew.slice(1)`, `status: 'resolved'`, `createdAt/updatedAt: Date.now()`,
   - `activityData: TravelData` (Part 4), `results: { success: true, message: '<miles> mi toward <destination label>' | 'Drifted off course' }`.
   - Push the id onto `taskOrder`. Created resolved because fatigue only counts resolved tasks (`downtimeSelectors.ts:593-616` — `didCharacterWorkInSlot`) and unresolved tasks would trip the advisory `TimeAdvancementBlocker`.
   - Skip any crew member already in `assigned` (never double-book a slot); on foot the task's leader/helpers are exactly the unassigned members.
8. **Arrival.** When the route is consumed (`routeTileIds.length === 1`): set `group.journey = null`, log `travel.arrived` (player): `"<group> arrives after <milesTraveled> mi"`, then `handleLocationArrival(draft, mapId, destinationTileId, group.id === draft.ui.activeTravelGroupId)` — the existing helper at `campaignReducer.ts:339-394`; export it or pass it in (cleanest: move `handleLocationArrival` unchanged into `journeyEngine.ts` and re-import it in campaignReducer if other call sites remain; otherwise keep it in campaignReducer and pass as a callback parameter to `progressJourneys`. Choose one; do not duplicate the code).
9. **Day-boundary hook (C2 seam).** After the tick advances the slot (Part 5), when the day rolled over, the campaign reducer calls `handleJourneyDayBoundary(draft)` (export from journeyEngine): in C1 this is an intentional no-op with a comment — Lane C2 implements provisioning/missed-meal checks here. Keep the call wired so C2 is a body-only change.

Multi-group note: groups are processed sequentially; a later group's crew check sees the travel tasks materialized by an earlier group (correct — a character can't crew two journeys in one slot, though membership already prevents that; the ordering rule is for determinism).

## Part 4 — `'travel'` in the downtime union

`src/types/downtime.ts`:
- `DowntimeActivityType` (:45-54) gains `| 'travel'`.
- New `TravelData` in the ActivityData section:

```ts
export interface TravelData {
  /** Discriminator field for the discriminated union */
  type: 'travel';
  journeyId: Id;
  groupId: Id;
  vehicleId: Id | null;
  /** Miles the group moved this slot (0 when the slot was spent drifting). */
  milesMoved: number;
  drifted: boolean;
}
```
- Add to the `ActivityData` union (:340-349) and an `isTravelTask` guard beside the others (:446-520).

Exhaustiveness fallout (all confirmed sites):
- `ACTIVITY_DISPLAY_NAMES` (`src/state/downtime/downtimeSelectors.ts:739-750`): `travel: 'Traveling'` — hard compile error until added.
- `getToolIdsFromActivityData` (`downtimeValidation.ts:152-176`): add `case 'travel': return [];`.
- `getTargetKeyFromActivityData` (`downtimeSelectors.ts:374-421`): add `case 'travel': return data.journeyId;` (locks are irrelevant for auto-resolved tasks but the key must be stable).
- `getToolIdsFromTask` (`downtimeSelectors.ts:501-521`) if it switches on type.
- `src/utils/activityLogger.ts:26`: add `'travel'` to the family union, and add a small `travelLog` bundle with creators used by the engine — `camp`, `progress`, `drifted`, `paused`, `resumed`, `aborted`, `arrived` (all `visibility: 'player'` except `paused`/`resumed`/`aborted` which are `'mixed'` with a maskedMessage equal to the message — travel is overt by design). Alternatively the engine may use raw `logEvent('travel.<x>', ...)` like `time.advance` does — but then STILL add the `travelLog` creators and use them for consistency; pick the `createActivityLogEntry` path.
- `src/components/ChangelogTab.tsx:5-18` `ACTIVITY_FAMILIES`: add `'travel'`.
- `src/state/downtime/downtimeMigration.ts`: no legacy branch needed (verify the `default` fall-through doesn't misfire on travel tasks — it only handles legacy modes).
- Do NOT add a travel tile to `TileGrid`/`DowntimePanel` navigation — travel tasks are engine-owned and appear via task lists/status badges only (D10: "the task bar is a faithful view; travel tasks can't be edited/moved"). If any task-card list renders unknown activity types generically, that's acceptable for C1; Lane C2 adds a proper read-only `TravelTaskCard`.

## Part 5 — Reducer wiring: arm/pause/abort/reroute; the tick; executeTravel dies

### New party actions (`src/state/party/partyActions.ts` + `partyReducer.ts`, existing patterns)

1. `party/armJourney { groupId: Id; journey: Omit<Journey, 'id' | 'legProgressMiles' | 'milesTraveled' | 'status' | 'startedAt'> }` — guards (silent no-op on violation, reducer convention): group exists; no active journey on the group; `journey.routeTileIds.length >= 2`; `routeTileIds[0]` equals the group's resolved current tile on `journey.mapId` (`resolveGroupPosition`); if `navigatorId` set it must be a member. Writes `group.journey = { ...payload.journey, id: generated, legProgressMiles: 0, milesTraveled: 0, status: 'active', startedAt: { day, slot } }`... **but the party reducer receives only `Draft<CampaignState>` like the other domains — day/slot come from `draft.time`** (the party handler already receives the full draft; confirm and use it). Log `travel.departed` (player).
2. `party/pauseJourney { groupId }` — active → paused, `pauseReason: 'manual'`. No-op otherwise.
3. `party/resumeJourney { groupId }` — paused → active, clears `pauseReason`. Any pauseReason is resumable in C1 (GM judgment); C2 tightens 'encounter'.
4. `party/abortJourney { groupId }` — clears `group.journey` (group stays wherever it is — a partial route is a valid end state, design D6). Log `travel.aborted`.
5. `party/rerouteJourney { groupId, routeTileIds: TileId[] }` — guards: journey exists (any status); `routeTileIds[0]` equals current resolved tile; length >= 2. Replaces `routeTileIds` and `destinationTileId` (last element), resets `legProgressMiles: 0`, sets `status: 'active'` and clears `pauseReason` (rerouting un-pauses `noRoute`/`manual`).

Composition safety (interim rules, comment each): `party/createGroup`, `party/moveMembers`, `party/boardVehicle`, `party/disembark` no-op when the source or target group has an active or paused journey (abort first). `party/placeGroup` on a journeying group and `party/placeVehicle`/`party/dockVehicle` on a journeying group's vehicle abort the journey (GM teleport is an override), logging `travel.aborted`.

Store facade (`campaignStore.tsx`, map pattern ~:308-334 / ~:656-703): `partyArmJourney`, `partyPauseJourney`, `partyResumeJourney`, `partyAbortJourney`, `partyRerouteJourney`.

Selectors (`partySelectors.ts`): `selectActiveJourneys(state): Array<{ group: TravelGroup; journey: Journey }>`, `selectGroupJourney(state, groupId)`.

### The tick (`campaignReducer.ts` `case 'advanceTime'`, :1220-1231)

New order: `guardTimeAdvance` → `pushTimeCheckpoint(draft, 'Before time advance')` → **`progressJourneys(draft)`** (journeys consume the elapsed slot; travel tasks stamp the pre-advance day/slot; navigation uses the current weather) → `advanceSlotAndRegenerateWeather(...)` (unchanged) → **if the day rolled over, `handleJourneyDayBoundary(draft)`** (compare day before/after). Weather regeneration stays where it is — `mapsWithPresence` already covers journeying groups since their positions are ordinary group/vehicle positions.

### `map/executeTravel` dies

- Delete the action: `MAP_EXECUTE_TRAVEL` constant + `MapTravelExecutionAction` (`mapActions.ts:71, 211-221`, union + `MAP_ACTION_TYPES` entry), the reducer case (`mapReducer.ts:420-472`), the cross-slice branch (`campaignReducer.ts:962-1006` — the whole `if (action.type === 'map/executeTravel')` blocks inside `isMapAction`; keep `handleMapAction(draft, action)` and the `party/placeGroup` weather-regen block :947-955), and the store method `mapExecuteTravel` (`campaignStore.tsx:337, 720`).
- `grep -rn "executeTravel" src/` must return zero hits when done.
- `handleLocationArrival` stays (journey arrival + `party/placeGroup` paths use it — check current placeGroup usage; do not regress it).

### Travel validation changes (`src/utils/mapTravelValidation.ts`)

- **Delete the `EXCEEDS_TIME_BUDGET` blocker** (:147-161) and its code from `TRAVEL_BLOCKER_CODES` (`types/map.ts:336-345`) — over-budget routes are journeys now, not errors. `grep -rn "EXCEEDS_TIME_BUDGET" src/` → zero hits.
- `getRouteStats` (:166-203): replace `budgetMiles`/`withinBudget` outputs with `budgetMilesPerSlot` and `estimatedMovingSlots` (`Math.max(1, Math.ceil(totalMiles / budgetMilesPerSlot))`) and `estimatedDays` (`Math.ceil(estimatedMovingSlots / max(1, movingSlotsPerDay))` where movingSlotsPerDay = `slotsPerDay - nightSlotCount`; thread `slotsPerDay`/`nightSlotIndices` in via new optional params or an options object — pick the options object, the positional list is already long). Fix all consumers (`TravelStep2Route.tsx:38, 84` display becomes "X mi — ~N slots (~D days)").
- Keep every other blocker; they now gate *arming* the journey.

## Part 6 — Budget math (`computeSlotBudgetMiles`)

New export in `src/utils/mapTravelValidation.ts` (single source of truth; `validateTravelRoute` had the formula inline at :147-161 — it's deleted; `getRouteStats` :182-184 must now call this):

```ts
export function computeSlotBudgetMiles(input: {
  mode: TravelMode;
  vehicleType: VehicleTypeDef | null;
  weatherTravelModifier: number;          // getWeatherModifierForActivity(weather, 'travel')
  worstEncumbranceLevel: EncumbranceLevel | null;  // null for vehicle/mounted journeys
}): number
```

`base = vehicleType?.speedMilesPerSlot ?? getTravelModeDefinition(mode).milesPerSlot`; weather: `base + base * (weatherTravelModifier / 10)` (existing formula, `mapTravelValidation.ts:150`); encumbrance (foot only, design D16): multiply by the Move multiplier for the worst level. **`MOVE_MULTIPLIERS` in `src/utils/encumbrance.ts:36` is module-private — export it** (`export const MOVE_MULTIPLIERS`), don't re-derive. Floor the result at 1.

Worst-level helper in `src/utils/encumbrance.ts`:

```ts
export function getWorstGroupEncumbranceLevel(characters: Character[]): { level: EncumbranceLevel; bottleneckName: string | null }
```

Per member with `gcsData`: `calculateCharacterEncumbrance(gcsData.attributes, gcsData.secondaryAttributes, gcsData.equipment)` (:175-185); members without gcsData count as level 0. Over-10×BL members clamp to level 4 / ×0.2 — same as today's `getEncumbranceLevel` clamp (:71-79); document with a comment that "cannot move" is deliberately not modeled (design punted; GURPS ×0.1 shuffle left to GM). The journey engine calls this per tick with the group's members (encumbrance can change mid-journey); `bottleneckName` feeds the C2 confirm-screen preview — return it now.

## Part 7 — Minimal UI (compile + usable; C2 does the real surfaces)

- **`TravelStep3Confirm.tsx`**: add (a) navigator `<select>` over traveling members, defaulting to the highest `getNavigationSkill(character, mode).level`, showing each member's effective level and "(default)" when untrained — pattern: `RestTaskForm.tsx` healer select (:198); include a "GM-set skill" option that reveals a number input for `gmNavigationSkill` (default 10); (b) a GM-only "Forced march" checkbox (visible when `isGmMode`); (c) estimated duration line from the reworked `getRouteStats`. Confirm button label: "Begin Journey".
- **`MapPanel.tsx` `handleTravelConfirm` (:551-570)**: after `applyCompositionActions`, dispatch `partyArmJourney` with `{ mapId, routeTileIds: travelRoute, destinationTileId, mode: travelMode, navigatorId, gmNavigationSkill, forcedMarch, gmOverride: isGmMode }` instead of `mapExecuteTravel`. Wizard closes as today. Thread the new confirm-step state (navigatorId/gmNavigationSkill/forcedMarch) through `TravelWizard` props the same way staged members are threaded.
- **Journey status strip** (new small component `src/components/map/views/JourneyStatusPanel.tsx`, rendered by MapPanel when the *active group* has a journey): one compact overlay row — status ('Traveling'/'Paused: <reason>'), destination label (marker label at destination tile if any, else tile id), `milesTraveled` mi done / total remaining via `computeRouteMiles`, and buttons: Pause/Resume (toggles), Abort (with `window.confirm`), and while paused a "Re-route" hint text ("open Travel to plot a new route" — actual reroute UI is C2; wire `party/rerouteJourney` only through the wizard: when the active group has a *paused* journey, `handleTravelConfirm` dispatches `partyRerouteJourney` + updates navigator/forcedMarch via... no — keep C1 simple: when a journey exists (any status), the Travel button opens the wizard in reroute mode = on confirm dispatch `partyAbortJourney` then `partyArmJourney` with the new route. One code comment noting C2 may refine this into a true reroute that preserves milesTraveled).
- **Advance-slot convenience**: the header already has the tick (`TimeControls`); additionally give `JourneyStatusPanel` an "Advance slot" button calling `actions.advanceTime()` (design D14's convenience button).
- `TravelWizard.tsx` validation call (:93-109) unchanged apart from compile fallout from Part 5's validation changes.

## Part 8 — Downtime two-way sync fix (required for Part 3.7)

`DowntimeProvider` (`src/components/downtime/DowntimeContext.tsx:149-163`) holds downtime state in a local `useReducer` seeded once from `campaignState.downtime` and mirrors local→campaign via `setDowntime`. The journey engine (and, pre-existing bug, checkpoint restore at `campaignReducer.ts:1207`) writes `draft.downtime` in the campaign store — the provider never adopts those writes, and its next local dispatch would mirror stale state back, silently deleting travel tasks.

Fix (campaign wins):
- New downtime action `DOWNTIME_STATE_REPLACE` (`downtimeActions.ts` + reducer case): replaces the whole state with the payload (no validation).
- In `DowntimeProvider`, add an adoption effect: when `campaignState.downtime !== prevDowntimeStateRef.current` (reference inequality — the ref always holds the last state *we* pushed, and `setDowntime` stores our exact object, so any other reference means the campaign reducer produced new downtime state), set the ref to `campaignState.downtime` and `dispatch({ type: DOWNTIME_STATE_REPLACE, payload: campaignState.downtime })`. Keep the existing mirror-push effect; the ref guard prevents ping-pong. Add a component test proving: campaign-side downtime change (e.g. a travel task appearing) is visible through the provider, and a subsequent local task creation does not erase it.

## Part 9 — Persistence, hydration, migration

- **Schema 1.5.9**: bump `CURRENT_SCHEMA_VERSION` (`schemaVersioning.ts:16`); add `SCHEMA_METADATA['1.5.9']` (`name: 'The Journey Loop'`, `migratesFrom: ['1.5.8']`, features like `['journeys','travel_tasks','night_slots']`); register `'1.5.8:1.5.9': migrateTo1_5_9` in `dataMigrations.ts` (:56-70). `migrateTo1_5_9(data)`: defensive only — for each travel group with a `journey`, drop it if its `mapId` isn't in `data.maps.mapsById` or `routeTileIds` is not a non-empty array. Idempotent, never throws on partial data.
- **`ensureJourneyIntegrity(state)`** in `src/persistence/dataMigration.ts` (pattern + identity contract of `ensureTravelGroups` :177 — return the same reference when unchanged): clears `group.journey` when the map is missing, `routeTileIds[0]` doesn't match the group's resolved position, or the navigator isn't a member (set `navigatorId: null` in that last case instead of clearing the journey). Chain into `hydrateCampaignState` (`campaignStorage.ts:122-168`) after `ensureTravelGroups`.
- Journeys/tasks are plain JSON — no Set handling; extend `src/__tests__/serializationRoundTrip.test.ts` with an active journey + travel task surviving serialize→hydrate, and a checkpoint-restore test proving a journey survives snapshot/rollback.

## Part 10 — Tests (new + fallout)

Fallout to fix without weakening unrelated assertions: `src/state/__tests__/travelTimeAdvance.test.ts` (rewrite around the journey model — its 6 behaviors map onto: arm+tick advances one slot with one 'Before time advance' checkpoint; weather regen at post-tick time; paused-activity guard; parity with plain advanceTime), `groupTravel.test.ts`, `mapReducer.test.ts` executeTravel suites (delete/replace), `mapTravelValidation.test.ts` (EXCEEDS_TIME_BUDGET removal, getRouteStats new shape), `MapViewComponents.test.tsx` / `TravelStep*` component tests, anything importing `mapExecuteTravel`.

New test files (≥ 30 new tests):
1. `src/state/party/__tests__/journeyActions.test.ts` — arm guards (wrong start tile, active journey exists, non-member navigator), pause/resume/abort/reroute transitions, composition actions no-op or abort per the interim rules.
2. `src/state/party/__tests__/journeyEngine.test.ts` — the core. Build a real map fixture (use existing map test helpers). Cover: single tick moves by budget with terrain costs and leg-progress carry (expensive tile takes 2 slots); multi-tick arrival fires `handleLocationArrival` + clears journey; night slot auto-camps (no movement, no task); forced march moves on night slot at −5 nav; vehicle journey moves the vehicle (aboard group + docked vehicle follow); crew shortfall pauses; foot all-incapacitated pauses; drift on failed nav (mock `Math.random`: force the 3d6 and neighbor picks), lateral tiles + reroute + no forward progress; `noRoute` pause when rerouting fails; travel task materialized resolved with correct crew/day/slot and fatigue visible next slot via `selectCharacterFatigueStatus`; already-assigned member is never double-booked; weather travel modifier and worst-member encumbrance scale the budget; deterministic multi-group ordering.
3. `src/utils/__tests__/navigation.test.ts` — specialty-by-mode lookup, plain-Navigation fallback, IQ−6 default, GM-skill path.
4. `src/utils/__tests__/encumbrance.test.ts` additions — `getWorstGroupEncumbranceLevel` (bottleneck name, gcsData-less member, clamp).
5. `computeSlotBudgetMiles` cases (vehicle speed override, weather ±, encumbrance foot-only, floor at 1).
6. Migration/ensure/round-trip per Part 9.
7. Downtime sync component test per Part 8.

## Definition of done — self-verify before finishing

```
npx tsc --noEmit                      # 0 errors
npx vitest run                        # full suite green (~3,900+ tests)
grep -rn "executeTravel" src/         # zero hits
grep -rn "EXCEEDS_TIME_BUDGET" src/   # zero hits
grep -rn "as any" src/ --include="*.ts" --include="*.tsx" | grep -v __tests__ | wc -l   # not higher than before your changes
```

If something unrelated is red on a clean checkout, note it and leave it.

## Final summary requested

One paragraph: how you ordered journey progression relative to the slot advance and why; how the drift + reroute implementation handles edge tiles/no-candidate cases; how you kept the travel-task writes and the DowntimeProvider sync from racing; any place the composition-action interim rules or the reroute-via-abort flow got awkward; and anything you deliberately left for Lane C2.
