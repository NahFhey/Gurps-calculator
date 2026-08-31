# Spec: Phase 14 Lane A1 — Travel groups & vehicles: state model, migration, travel rewire

**Date:** 2026-08-31
**Repo:** GURPS VTT (React 18 + TypeScript strict + Vite, Redux-style state with Immer, Vitest/jsdom)
**Branch:** you are on `codex/lane-a-groups-vehicles`. Commit nothing; leave changes in the working tree.
**Design doc (read for intent):** `docs/MAP_TRAVEL_14_PLAN.md`, decisions D11–D13, D15–D17.
**This is stage 1 of 2.** A follow-up spec (A2) adds map tokens, the active-group selector UI, the wizard portrait-composition step, and the Manager Vehicles view. A1 must leave the app compiling and behaviorally coherent with *minimal* UI adaptation.

## Background (why)

The app tracks a single party position: `MapModel.partyTileId`. Phase 14 introduces **travel groups** (every character belongs to exactly one; groups split/merge only when co-located) and **Vehicle** entities (catalog-typed, with `minCrew` and `hangarSlots`; vehicles can dock to carrier vehicles one level deep — fast "lancer" scout ships land on and deploy from a main skyship). The mover on the map becomes the group; a group aboard a vehicle derives its position from the vehicle. `partyTileId` dies, replaced by per-group/per-vehicle positions.

## Architecture rules (non-negotiable)

- `strict: true` stays clean: `npx tsc --noEmit` → 0 errors. **No new `as any`.** `import type` for type-only imports.
- State logic in reducers/utils, never components. Immer drafts throughout.
- Positions are always `TileId`s, never `{row,col}` (grid indices shift on map expansion — `src/types/map.ts:268-272`).
- Do not run `npm install`. Do not touch UI beyond the "minimal UI adaptation" section.

---

## Part 1 — Types (`src/types/party.ts`, new file)

```ts
import type { Id } from './campaign';        // match how other type files import Id
import type { MapId, TileId, TravelMode } from './map';

export interface VehicleTypeDef {
  id: string;
  name: string;
  mode: TravelMode;                 // 'foot' | 'boat' | 'airship' (types/map.ts:44)
  speedMilesPerSlot?: number;       // overrides TRAVEL_MODE_DEFINITIONS mi/slot when set
  minCrew: number;                  // able-bodied members required to operate
  hangarSlots: number;              // how many vehicles can dock to this one (0 = none)
  passengerCapacity?: string;       // descriptive only, GM eyeballing (design D16)
  icon?: string;                    // emoji or short label for tokens/UI
  builtin?: boolean;
}

export type VehiclePosition =
  | { kind: 'tile'; mapId: MapId; tileId: TileId }
  | { kind: 'docked'; carrierId: Id };

export interface Vehicle {
  id: Id;
  name: string;
  typeId: string;
  position: VehiclePosition | null;   // null = unplaced
  notes?: string;
  createdAt: number;
  modifiedAt: number;
}

export interface TravelGroup {
  id: Id;
  name: string;
  memberIds: Id[];                    // character ids; every character is in exactly one group
  vehicleId: Id | null;               // aboard this vehicle (position derives from it)
  position: { mapId: MapId; tileId: TileId } | null;  // used ONLY when vehicleId is null; null = unplaced
}

export interface GroupPosition { mapId: MapId; tileId: TileId }
```

Seeds in `src/constants/vehicleSeeds.ts` (new): `VEHICLE_TYPE_SEEDS: VehicleTypeDef[]`, all `builtin: true`:
- `vt-lancer` "Lancer" — airship, minCrew 1, hangarSlots 0, speedMilesPerSlot 600, icon '🛩'
- `vt-skyship` "Skyship" — airship, minCrew 3, hangarSlots 2, speedMilesPerSlot 457, icon '🚢'
- `vt-riverboat` "Riverboat" — boat, minCrew 1, hangarSlots 0, icon '🛶'
- `vt-sailer` "Sailing Ship" — boat, minCrew 3, hangarSlots 1, icon '⛵'

## Part 2 — State slice (`src/state/party/`, new domain, sub-reducer pattern)

Model on `src/state/character/characterActions.ts` (65 lines) + `characterReducer.ts` (`handleCharacterAction(draft: Draft<CampaignState>, action)`): string constants `as const`, payload types, union, `PARTY_ACTION_TYPES` Set + `isPartyAction` guard, barrel `index.ts`. Wire into `campaignReducer.ts` alongside the other `if (isXAction(...))` delegations (~line 810-834).

Storage (all optional-declared like `contacts?` at `campaignReducer.ts:169`, defaulted in `createCampaignState` like `characterTemplates` at `:452-453`):
- `entities.travelGroups?: Record<Id, TravelGroup>`
- `entities.vehicles?: Record<Id, Vehicle>`
- `entities.vehicleTypes?: Record<string, VehicleTypeDef>`
- `entities.deletedBuiltinVehicleTypeIds?: string[]`
- `ui.activeTravelGroupId?: Id | null` (in the `ui` block next to `gmModeEnabled`)

### Position resolution helpers (`src/utils/partyPosition.ts`, new)

```ts
resolveVehiclePosition(vehicles: Record<Id, Vehicle>, vehicleId: Id): GroupPosition | null
  // 'tile' → that; 'docked' → carrier's position IF carrier is kind 'tile' (one level only;
  // a docked carrier is invalid state — return null defensively, never recurse deeper)
resolveGroupPosition(state: Pick<CampaignState,'entities'>, group: TravelGroup): GroupPosition | null
  // vehicleId ? resolveVehiclePosition : group.position
areCoLocated(state, a: TravelGroup, b: TravelGroup): boolean
  // same resolved {mapId,tileId}; ALSO true when both aboard the same vehicle or one aboard
  // a vehicle docked to the other's vehicle (same resolved tile covers this — but two
  // unplaced groups (null) are NOT co-located)
groupsOnMap(state, mapId): Array<{ group: TravelGroup; tileId: TileId }>
vehiclesOnMap(state, mapId): Array<{ vehicle: Vehicle; tileId: TileId }>   // kind 'tile' only
dockedVehicles(vehicles, carrierId): Vehicle[]
isAbleBodied(character: Character): boolean
  // via calculateHPStatus(gcsData.pools.HP.current, .max) from src/utils/combatHelpers.ts:223-230;
  // status 'critical' or 'dead' → false; characters with no pools → true
```

### Actions (prefix `party/`)

1. `party/createGroup { name, memberIds, fromGroupId }` — split: members must all belong to `fromGroupId`; new group gets the source group's `vehicleId`-independent resolved position as its `position` (i.e., splitting off a vehicle-borne group puts the new group ON the vehicle too? No — new group inherits `vehicleId` from source, so both stay aboard; splitting while on foot copies `position`). Removes members from source. If source empties, delete it (never delete the last remaining group in the campaign). No-op (ignore) on empty memberIds or unknown ids.
2. `party/moveMembers { memberIds, toGroupId }` — merge/transfer: each member's current group must be co-located with the target (`areCoLocated`); silently skip members that aren't. Emptied source groups are deleted (except the last group). If the deleted group was `ui.activeTravelGroupId`, point it at `toGroupId`.
3. `party/renameGroup { groupId, name }`
4. `party/setActiveGroup { groupId }` — validates existence.
5. `party/boardVehicle { groupId, vehicleId }` — allowed when the group's resolved position equals the vehicle's resolved position (this covers boarding a docked lancer from its carrier). Sets `vehicleId`, nulls `position`.
6. `party/disembark { groupId }` — only when the group's vehicle resolves to a tile (`kind:'tile'` or docked-to-a-tiled-carrier): group gets `position` = that tile, `vehicleId = null`.
7. `party/placeGroup { groupId, mapId, tileId }` — GM placement (replaces `map/setPartyTile` semantics). Only for groups NOT aboard a vehicle (aboard → no-op). Sets `position`.
8. `party/upsertVehicle { vehicle }` / `party/removeVehicle { vehicleId }` — remove cascades: groups aboard it get `position` = its resolved tile (or null if unplaced/docked-unresolvable) and `vehicleId = null`; vehicles docked to it get `position` = its tile the same way.
9. `party/placeVehicle { vehicleId, mapId, tileId }` — GM placement; if currently docked, this undocks it.
10. `party/dockVehicle { vehicleId, carrierId }` — requires: carrier position `kind:'tile'`; vehicle's resolved position equals carrier's tile; `dockedVehicles(carrier).length < carrierType.hangarSlots`; no self-dock; vehicle must have nothing docked to IT (one level). Sets `position = { kind:'docked', carrierId }`.
11. `party/undockVehicle { vehicleId }` — position becomes carrier's tile (`kind:'tile'`).
12. `party/upsertVehicleType { def }` / `party/removeVehicleType { typeId }` — builtin resurrect/tombstone pattern copied from `src/state/character/characterReducer.ts:54-70` (upsert removes the id from `deletedBuiltinVehicleTypeIds`; remove adds it only if `builtin`). Removing a type in use by vehicles: no-op (ignore) — report this rule in a code comment.

Invalid preconditions on any action: silently no-op (matches existing reducer conventions — no throws from reducers).

### Membership invariant maintenance

In `src/state/character/characterReducer.ts`:
- `CHARACTER_ADD` (~:27-38): after adding, append the id to the active travel group (fallback: first group by `Object.values` order; if no groups exist, create `{ id: generated, name: 'The Party', memberIds: [id], vehicleId: null, position: null }` and set it active).
- `CHARACTER_REMOVE` (~:40-48, already cascades to inventories): also remove the id from whichever group holds it; delete the group if emptied (except the last group).

### Store facade (`campaignStore.tsx`)

Add one-line dispatch methods following the map pattern (declared ~:308-334, implemented ~:656-703): `partyCreateGroup`, `partyMoveMembers`, `partyRenameGroup`, `partySetActiveGroup`, `partyBoardVehicle`, `partyDisembark`, `partyPlaceGroup`, `partyUpsertVehicle`, `partyRemoveVehicle`, `partyPlaceVehicle`, `partyDockVehicle`, `partyUndockVehicle`, `partyUpsertVehicleType`, `partyRemoveVehicleType`.

### Selectors (`src/state/selectors/partySelectors.ts`, new; re-export from `selectors/index.ts`)

`selectTravelGroups`, `selectActiveTravelGroup` (resolves `ui.activeTravelGroupId`, falls back to the first group), `selectGroupPosition(state, groupId)`, `selectVehicles`, `selectVehicleTypes` (record, seeds merged already by hydration — just read state), `selectGroupsAboardVehicle(state, vehicleId)`, `selectGroupsOnMap(state, mapId)`, `selectVehiclesOnMap(state, mapId)`.

## Part 3 — `partyTileId` dies; travel rewires to groups

### Remove the field
Delete `MapModel.partyTileId` (`src/types/map.ts:300`). Fix every usage (inventory below). Delete the `MAP_SET_PARTY_TILE` action, its reducer case (`mapReducer.ts:414-434`), constant, type, and store method `mapSetPartyTile` — replaced by `party/placeGroup`. `createInitialGrid`/`createNewMap` (`mapUtils.ts:66-69, 387, 405`) no longer seed a party tile (new maps are born empty; keep seeding `revealedTileIds` with the center tile so the map isn't fully dark).

### `map/executeTravel` gains the mover
Payload (`mapActions.ts` `MapTravelExecutionAction`) gains `groupId: Id`. In `mapReducer.ts` `MAP_EXECUTE_TRAVEL` (~:440-484):
- Delete the "null party on all other maps" loop (~:448-452) — obsolete by construction.
- Instead of `map.partyTileId = destinationTileId`: resolve the group; if `group.vehicleId` → set that vehicle's `position = { kind:'tile', mapId, tileId: destinationTileId }` (all aboard groups + docked vehicles follow for free); else set `group.position = { mapId, tileId: destinationTileId }`. (handleMapAction receives the full `Draft<CampaignState>`, so writing `draft.entities` here is fine — mirror how the cross-slice code already reads both slices.)
- Route reveal (~:455-457), LOS reveal from destination (~:458-462), `expandMapIfNeeded`, `pendingTerrainAssignment` — all unchanged.
- Guard: if the group doesn't exist or isn't resolvable to this map, no-op the whole case.

Cross-slice in `campaignReducer.ts` (~:834-887): the terrain-sync block currently keys on `executeTravel | setPartyTile` — now keys on `executeTravel | party/placeGroup`; run it **only when the moved group is the active group** (interim rule; Lane D redoes location derivation — leave a comment saying so). Time advance + checkpoint stay exactly as Lane 0 left them, still `executeTravel`-only. **Known interim quirk (add a code comment):** each `executeTravel` advances one slot, so moving two groups in sequence costs two slots; Lane C's journey model replaces this.

### Vision/LOS becomes union-of-groups
`MapPanel.tsx:101-104` `visibleTileIds`: observers = resolved tiles of ALL groups and ALL `kind:'tile'` vehicles on the active map (dedupe). `computeVisibleTiles` already takes `TileId[]` (`lineOfSight.ts:101-128`) — caller-side change only.

### Travel validation (`src/utils/mapTravelValidation.ts`)
New signature:
```ts
validateTravelRoute(input: {
  map: MapModel; routeTileIds: TileId[]; mode: TravelMode;
  group: TravelGroup; characters: Record<Id, Character>;
  vehicle: Vehicle | null; vehicleType: VehicleTypeDef | null;
  day: number; slot: number; downtimeState: DowntimeState;
  isGmMode: boolean; weatherTravelModifier?: number;
}): TravelBlocker[]
```
(Refactor to an options object — the positional list is already unwieldy.) Changes:
- `PARTY_IN_DOWNTIME` (~:56-64): check only `group.memberIds`.
- **Implement `PARTY_INCAPACITATED`** (replacing the comment stub ~:66-69): on foot, blocked if zero able-bodied members (`isAbleBodied`); message names the incapacitated members.
- Replace `INSUFFICIENT_PERSONNEL` (~:72-88) with a new code `INSUFFICIENT_CREW` (add to `TRAVEL_BLOCKER_CODES`, `types/map.ts:328-336`; delete `INSUFFICIENT_PERSONNEL` and the `personnel` field usage from `TRAVEL_MODE_DEFINITIONS` consumers — leave the constant data itself alone if other code reads it; check): when traveling by vehicle, able-bodied AND not-downtime-busy member count must be ≥ `vehicleType.minCrew`.
- New code `VEHICLE_MODE_INCOMPATIBLE`: vehicle's `mode` must be in `SCALE_TO_MODES[map.scaleMilesPerTile]` (foot travel keeps the existing MODE_INCOMPATIBLE path).
- `EXCEEDS_TIME_BUDGET` (~:136-151) and `getRouteStats` (~:159-203): when a vehicle with `speedMilesPerSlot` travels, that value replaces the mode definition's mi/slot for the budget. Thread the vehicle/vehicleType through `getRouteStats` (optional params or options object).

### Minimal UI adaptation (compile + stay usable; A2 does the real UI)
- `MapPanel.tsx`: derive `activeGroup` + `activeGroupTile` via selectors. Replace every `activeMap.partyTileId` read (`:78-85` links, `:94-99` reachable, `:101-104` vision, `:135-142` routing, `:409` hasPartyOnMap) with the active group's resolved tile (when on the active map, else null). `partyCharacterIds` memo (`:88-90`) becomes the active group's `memberIds`. Place-party flow (`:126-132`) dispatches `party/placeGroup` for the active group (drop the `mapRevealTiles` call — placeGroup itself does not reveal; instead keep revealing by also dispatching the existing `mapRevealTiles` — fine to keep both dispatches as today). `handleUseLink` (`:313-320`) places the active group at the link target. `handleTravelConfirm` (`:339-350`) adds `groupId: activeGroup.id` to the payload.
- `TravelWizard.tsx` + step components: prop `partyCharacterIds` renames to `memberIds` (the traveling group's); wizard receives and threads `group`/`vehicle`/`vehicleType` into `validateTravelRoute` and `getRouteStats`. Mode step: if the group is aboard a vehicle, lock the mode to the vehicle type's mode (render the step with the other options disabled and a one-line note); on foot, only `'foot'` selectable (boat/airship now require a vehicle). `startTileId` = group's resolved tile.
- `Map3DView.tsx:155` tooltip: replace "Party here" with the names of groups/vehicles on the hovered tile (pass a `occupantsByTile?: Map<TileId, string[]>` prop from MapPanel; render each name on its own line).
- `MapScene.ts` `buildParty()` (~:695-716) + `frameParty()` (~:182-193): keep both, but drive them from a new `partyTileId?: TileId | null` field on the scene's data input that Map3DView now feeds from a new prop `activeGroupTileId?: TileId | null` (MapPanel passes the active group's tile). Rename prop/plumbing where cheap; do not build token rendering — that's A2.
- `MapHeader.tsx:110-112` green dot: any group/vehicle present on that map (pass a `mapsWithPresence: Set<MapId>` prop from MapPanel instead of reading `m.partyTileId`).
- `LinkEditor.tsx:35-37` default link target: the target map's center tile (`grid[Math.floor(rows/2)][Math.floor(cols/2)]`).

## Part 4 — Persistence, hydration, migration

- **Schema 1.5.6**: bump `CURRENT_SCHEMA_VERSION` (`schemaVersioning.ts:16`), add `SCHEMA_METADATA['1.5.6']` (`migratesFrom: ['1.5.5']`, name like 'Travel Groups & Vehicles'), register `'1.5.5:1.5.6': migrateTo1_5_6` in `dataMigrations.ts` (~:55-66). `migrateTo1_5_6(data)`: for each map in `data.maps.mapsById` with a `partyTileId`, remember the first (prefer `data.maps.activeMapId`'s map) as the party position, then delete `partyTileId` from every map; stash nothing else (group creation happens in the ensure step — the migration just cleans the field; to preserve the position, write it into `data.entities.travelGroups` yourself here: create the main group inline if `travelGroups` is empty). Idempotent, never throws on partial data.
- **`ensureTravelGroups(state)`** in `src/persistence/dataMigration.ts` (pattern: `ensureCharacterTemplates` `:23-42`, return same reference when unchanged): guarantees (a) `entities.travelGroups` exists and every character id in `entities.characters` appears in exactly one group — strays go to the first group; missing structures created (main group 'The Party', position null); duplicated ids deduped (first group wins); (b) `entities.vehicles` exists; (c) `entities.vehicleTypes` contains every seed whose id isn't in `deletedBuiltinVehicleTypeIds` (same clone-in pattern as templates); (d) `ui.activeTravelGroupId` points at an existing group (else first group).
- Chain it into `hydrateCampaignState` (`persistence/campaignStorage.ts:65-99`) alongside the other ensureX wrappers.
- `hydrateMapState` (`campaignStorage.ts:42-59`): drop any persisted `partyTileId` key defensively. Positions/groups/vehicles are plain JSON — no Set handling needed.
- Extend `src/__tests__/serializationRoundTrip.test.ts` with groups/vehicles state surviving serialize→hydrate.

## Part 5 — Tests (new + fallout)

Fix all fallout in existing tests (`mapReducer.test.ts` party suites ~:437-536, `travelTimeAdvance.test.ts` — its fixture must now build a group, `mapUtils.test.ts` party assertions, `mapTravelValidation.test.ts` for the new signature, `MapViewComponents.test.tsx` fixtures, etc.). Do not weaken unrelated assertions.

New test files:
1. `src/state/party/__tests__/partyActions.test.ts` — constants/uniqueness/guard, mirroring `characterActions.test.ts`.
2. `src/state/party/__tests__/partyReducer.test.ts` — at minimum: split preserves co-location & deletes emptied source; moveMembers refuses non-co-located members; last group never deleted; board requires co-location; disembark lands on the vehicle's tile; dock enforces hangarSlots + same-tile + no-nesting (both directions); undock lands on carrier tile; removeVehicle cascades groups + docked vehicles to its tile; placeGroup no-ops for vehicle-borne groups; CHARACTER_ADD joins active group / creates 'The Party'; CHARACTER_REMOVE leaves no orphan membership.
3. `src/state/__tests__/groupTravel.test.ts` (or extend `travelTimeAdvance.test.ts`) — executeTravel with `groupId`: foot group's position moves; vehicle-borne group moves the vehicle and a second group aboard follows; a docked lancer follows its traveling carrier; time still advances exactly one slot with checkpoint (Lane 0 parity).
4. `src/utils/__tests__/partyPosition.test.ts` — resolution incl. docked chain, docked-to-docked returns null, co-location cases.
5. `mapTravelValidation` additions — INSUFFICIENT_CREW (crew below minCrew; incapacitated member doesn't count), PARTY_INCAPACITATED on foot (all down = blocked, one able = allowed), VEHICLE_MODE_INCOMPATIBLE, vehicle speed changes the budget.
6. Migration/ensure tests — 1.5.6 strips `partyTileId` and seeds the main group at the old party position; ensureTravelGroups adopts stray characters, dedupes, seeds vehicle types, respects deleted-builtin tombstones; idempotent (same reference when nothing to do).

## Definition of done — self-verify before finishing

```
npx tsc --noEmit                    # 0 errors
npx vitest run                      # full suite green (~3,840+ tests, ~15-30s)
grep -rn "partyTileId" src/         # zero hits
grep -rn "INSUFFICIENT_PERSONNEL" src/   # zero hits
```

At least 25 new tests across the six areas above. If something unrelated is red on a clean checkout, note it and leave it.

## Final summary requested

One paragraph: how you modeled group/vehicle position writes in the map reducer vs party reducer, any place the co-location or docking rules got awkward, what UI call sites beyond the listed ones you had to touch, and how the 1.5.6 migration + ensure step divide the work.
