# Spec: Phase 14 Lane D — Locations on the map: marker pins, discovery, facility attachment, contacts, Manager nav

**Date:** 2026-08-31
**Repo:** GURPS VTT (React 18 + TypeScript strict + Vite, Redux-style state with Immer, Vitest/jsdom)
**Branch:** you are on `codex/lane-bd-climate-locations`. Commit nothing; leave changes in the working tree.
**Design doc (read for intent):** `docs/MAP_TRAVEL_14_PLAN.md`, decisions D2, D18, D19, D20, D22.
**Sequencing:** Lane B (per-map climate/weather/seasons, schema 1.5.7) landed on this branch immediately before you. **The as-built code is the authority** — in particular `Location` no longer has `currentWeather`/`weatherTableId`, weather lives on maps, and the hydrate/ensure chain and schema tail have moved. Read the current code before touching those areas. Your schema version is **1.5.8**.

## Background (why)

Locations are currently a floating list reachable only through the header weather chip; nothing ties a `Location` to a map tile. Facilities/kitchens/labs are usable from anywhere; contacts have no place; markers can be created but never clicked, edited, or discovered. Lane D pins locations to the map through markers, makes arrival switch the current location, implements discovery (the long-dead `MarkerModel.discoveredAt` finally gets written), attaches facilities to party/location/vehicle with position-gated availability, places contacts at locations, and gives LocationManager a real home in the Manager tab.

## Architecture rules (non-negotiable)

- `strict: true` clean (`npx tsc --noEmit` → 0). **No new `as any`.** `import type` for types.
- Logic in reducers/utils/selectors, not components. Do not run `npm install`.
- **Grep-gate honesty:** if migration code must reference removed legacy keys, use plain string literals with a comment — never assemble key names to dodge a grep.

## Part 1 — Marker ↔ Location link

- `MarkerModel` (`src/types/map.ts:135-153`) gains `locationId?: Id`. Fix the dead `discoveredAt` type while here: `{ day: number; slot: number }` (0-based slot, matching `state.time.slot`; the current `1|2|3` typing was never written by anything — change it, nothing breaks).
- `MARKER_TYPES` in `MarkerEditor.tsx:10-15` gains `{ value: 'location', label: 'Location' }`; `MARKER_ICONS` in `MarkerIcon.tsx:8-13` gains a `location` entry (lucide `MapPin` or `Landmark`, emerald).
- `MarkerEditor` gains a **location select** shown when type is `location` (options: existing locations by name + `— create new —` which takes a name inline). Confirm payload carries `locationId`; "create new" means MapPanel first dispatches `addLocation` with a minimal location (name, climate `'temperate'`, terrain from the tile via `resolveLocationTerrain`, `modifiers` from `getTerrainModifiers`) then adds the marker with the new id. **Caution (scout surprise): `addLocation` auto-assigns `currentLocationId` when it's null (`campaignReducer.ts:1305-1311`) — that behavior is fine, leave it.**
- Selector `selectLocationPins(state): Array<{ locationId: Id; mapId: MapId; tileId: TileId; markerId: MarkerId; visibility: MarkerVisibility; discoveredAt?: {day; slot} }>` in a new `src/state/selectors/locationPinSelectors.ts` — derived by scanning `maps.mapsById[*].markersById` for `locationId`-bearing markers. No back-ref stored on `Location` (single source of truth: the marker). Also `selectPinsForTile(state, mapId, tileId)` and `selectPinForLocation(state, locationId)` (first match). Re-export from `selectors/index.ts`.
- **`Location.connections` dies** (`types/location.ts` ~:245, `LocationConnection` type too): it's a pre-1.5.5 leftover that nothing edits (`handleCreateLocation` hardcodes `[]`, `handleUpdateLocation` omits it). Remove the field + type, fix fallout (the `mockLocations` fixture in `LocationComponents.test.tsx` includes it), strip the key in migration (Part 6).
- `Location` gains `gmNotes?: string`. `LocationFormView` gains a GM-notes textarea. **Add every new field to the `handleUpdateLocation` whitelist (`LocationManager.tsx:126-132`)** — it's a field whitelist and silently drops unknown fields.

## Part 2 — Arrival switches the current location

In the two cross-slice blocks in `campaignReducer.ts` (travel `:900-934`, placeGroup `:848-878` — line numbers will have drifted with Lane B; find them by their "Interim until Lane D" comments):
- After movement, look up the destination tile's location-linked markers. **If one exists**: set `draft.locations.currentLocationId` to its `locationId`, log `location.changed` (`'player'`, message "Party arrived at ‹name›"), and skip the terrain-overwrite (a pinned location's terrain is its own; do still refresh nothing). **If none**: keep the existing interim behavior exactly (terrain + modifiers sync onto the current location, `terrain.changed` log) — the roaming-"Camp" model stays for wilderness; do NOT null `currentLocationId` (fishing spots, foraging biomes, forage zones, and trading forms all hard-filter on it — nulling it would gut downtime; see DowntimeContext:171-245).
- Keep the active-group gate (`groupId === draft.ui.activeTravelGroupId`) and update the comment: per-group current locations are Phase 15a's.

## Part 3 — Discovery

**Mechanism: reuse `MarkerVisibility`** (`'gm' | 'player'`) — a `visibility: 'gm'` marker IS the hidden marker; player-view filtering already exists in `MapScene.ts:867-870` and `Map3DView.tsx:128-131`. No new flag.

- **Auto-discovery on presence:** in the same two arrival blocks (Part 2), for every marker on the destination tile with `locationId` AND `visibility === 'gm'`: flip to `'player'`, stamp `discoveredAt = { day: draft.time.day, slot: draft.time.slot }` (post-advance values for travel), and log `location.discovered` — append `{ ...logEvent('location.discovered', 'player', { message: "Discovered ‹name›" }), day: draft.time.day }` (the explicit `day` matters: ChangelogTab's day filter needs it and `logEvent` doesn't set it). Only `locationId`-bearing markers auto-discover — plain GM note/danger markers stay GM-only forever.
- **GM toggle:** the location detail panel (Part 4) gets a GM-only Revealed/Hidden toggle dispatching `mapUpdateMarker` with the visibility flip; manual reveal also stamps `discoveredAt` if unset (manual hide leaves it — "the party forgot" isn't a thing).
- ChangelogTab: add `'location'` to `ACTIVITY_FAMILIES` (`ChangelogTab.tsx:5-17`) so `location.changed`/`location.discovered` become filterable.
- Auto-discovery applies to ALL groups' arrivals, not just the active group (discovery is objective; move this logic OUTSIDE the active-group gate of Part 2 — structure the block so location-switching is active-group-gated but discovery is not; for travel, the arriving group is `action.payload.groupId`'s destination regardless).

## Part 4 — Location detail panel on the Map tab

New `src/components/map/views/LocationDetailPanel.tsx` (LinksMenu overlay pattern — `absolute bottom-12 right-4 z-40 w-72`, header + close X):
- Content: location name; terrain + climate labels; description; **gmNotes (only when `isGmMode`)**; discovery line ("Discovered day N" / "Undiscovered" from the pin); attached facilities (Part 5 — names + type, from all three registries); contacts present (Part 6 — name + standing badge); GM-only controls: Revealed/Hidden toggle (Part 3), "Edit in Manager" hint text (no cross-tab jump needed).
- **Opening it:** markers are not raycast targets (tile-level picking only), so: (a) in `handleTileClick` (`MapPanel.tsx:259-303`), when NOT painting/placing/routing and the clicked tile has a location-linked marker visible to the current view, open the panel for that location (first pin wins if several); (b) `MapContextMenu` gains a "View location" item when the tile has a visible location pin. Local `useState<Id | null>` in MapPanel.
- **Finally wire marker editing:** `MapContextMenu` gains "Edit marker" when the tile has any marker (GM only) — opens `MarkerEditor` with `existing` (its dead prop) and a Delete button inside the editor dispatching `mapRemoveMarker`. Small, closes a real gap.
- Tooltip: extend the `occupantsByTile` flow (`MapPanel.tsx:159-168` → `Map3DView.tsx:156-158`) with location names — add a sibling `locationsByTile?: Map<TileId, string[]>` prop (respecting visibility for player view), rendered as `📍 ‹name›` lines.

## Part 5 — Facility attachment (party / location / vehicle)

### Types
- **Delete the dead legacy `Facility`** in `src/types/partyTool.ts:53-58` and the `GlobalState.facilities` field referencing it (scout-verified: no consumer dereferences it). The live type is `campaign.ts:908`.
- New shared type in `campaign.ts`:
  ```ts
  export type FacilityAttachment =
    | { kind: 'party' }
    | { kind: 'location'; locationId: Id }
    | { kind: 'vehicle'; vehicleId: Id };
  ```
  `Facility`, `Kitchen` (:792-797), and `AlchemyLab` (:606-611) each gain `attachment?: FacilityAttachment` — absent means `party` (carried gear, current behavior; existing data migrates untouched).

### Reachability helper — new `src/utils/facilityAccess.ts` (pure, unit-tested)
```ts
export function findGroupForCharacter(state, characterId): TravelGroup | null   // linear scan of memberIds (ensureTravelGroups guarantees exactly-one)
export function isAttachmentReachable(state, attachment | undefined, characterId): boolean
```
Rules: undefined/`party` → true. `location` → the group's resolved tile carries a marker with that `locationId` (use `selectPinsForTile`-equivalent logic; visibility irrelevant — being there is being there). `vehicle` → the group is aboard it (`group.vehicleId === vehicleId`), or aboard a vehicle docked to it, or aboard the vehicle it is docked to (one docking level, reuse `resolveVehiclePosition`/`dockedVehicles` from `partyPosition.ts`). Unknown group/vehicle/no position → false (except party).

### Filter sites (the REAL seams — there is no central facility-resolution layer; scout-verified the calculator/resolver are pure and never see state)
1. **Kitchen dropdowns:** `CookingTab.tsx` (~:50, :106-107) and its views — filter the kitchen list to `isAttachmentReachable(state, k.attachment, leaderId)` where leaderId is the cooking task's leader (or the active group's first member for immediate-mode cooking; pick what the code actually has — report in summary).
2. **Lab dropdowns:** `src/components/alchemy/BatchesView.tsx` (~:129, :275) — same filter.
3. **DowntimeContext `craftingWorkshops`** (`DowntimeContext.tsx:301-305`) — apply the filter (it's currently consumed by nothing, but filter it anyway so the exposed value is honest).
4. Show unreachable facilities greyed with a "(at ‹place›ǀaboard ‹vehicle›)" suffix rather than hiding them, where the dropdown component makes that cheap; hard-exclude otherwise. Note which you did per site in the summary.

### Editor UI
- `FacilitiesView`, `KitchensView`, `LabsView` each gain an **Attachment** control: select party/location/vehicle + a second select for the specific location (by name) or vehicle (by name). Persist through their existing save paths (`setFacilities` read-modify-write; kitchen/lab save callbacks). While in `FacilitiesView`: delete the stray `console.log` at :89.
- `LocationDetailPanel` (Part 4) lists facilities/kitchens/labs whose attachment targets the shown location.

## Part 6 — Contacts at locations

- `ContactEntry` (`campaign.ts:850-859`) gains `locationId?: Id | null`.
- `SocialActivity.tsx` ContactCard gains a location select (locations by name + "— nowhere in particular —"), persisted via the existing `upsertContact`.
- **Soft presence hints** (never a gate): `SocialTaskForm.tsx` and `TradingTaskForm.tsx` — when the selected/matched contact has a `locationId`, render a hint line: "at ‹location name›" plus, when that differs from the active group's `currentLocationId`, "— party elsewhere" (muted styling, `data-testid="contact-presence-hint"`).
- `LocationDetailPanel` lists contacts with matching `locationId` (name + standing modifier badge, reuse the trading badge styling).

## Part 7 — Manager navigation

- `ManagerTab.tsx`: add `'locations'` to the `ManagerView` union (:35-53), a nav button (teal accent; place before `vehicles`), and `{view === 'locations' && <LocationManager />}` in the render switch. `LocationManager`'s `onClose` is optional, so it mounts propless — but widen its root from `max-w-md` (`LocationManager.tsx:293`) to `max-w-2xl` so it doesn't look cramped in the pane (the WeatherWidget modal usage tolerates the wider card fine).
- WeatherWidget keeps its three modal shortcuts unchanged.

## Part 8 — Schema 1.5.8 + hydration

**Reminder:** the versioned `migrateData` registry does NOT run on live saves; the load-bearing path is `hydrateCampaignState`'s ensure chain (Lane B just went through this — copy its as-built split).
1. **Hydrate-side:** new `ensureLocationIntegrity(state)` in `src/persistence/dataMigration.ts` (pattern: `ensureTravelGroups` — `changed` flag, same-reference when clean): strip legacy `connections` key from every location (string literal + comment); drop dangling `MarkerModel.locationId` references (location deleted → remove the field from the marker, keep the marker); drop dangling facility/kitchen/lab `attachment` targets (unknown location/vehicle → revert to undefined/party); nothing to backfill otherwise (all new fields optional). Chain it as the new outermost wrapper in `hydrateCampaignState` (mind the hand-balanced parens; Lane B may have added its own wrapper — read as-built).
2. **Registry-side:** `migrateTo1_5_8` (strip `connections`, same dangling-ref hygiene on raw data), registered `'1.5.7:1.5.8'`, + `SCHEMA_METADATA['1.5.8']` (`migratesFrom: ['1.5.7']`, name like 'Locations on the Map'), bump `CURRENT_SCHEMA_VERSION`.
- Extend `serializationRoundTrip.test.ts`: marker `locationId`/`discoveredAt`, facility attachments, contact `locationId` survive.

## Part 9 — Tests (new + fallout)

Fallout: `LocationComponents.test.tsx` (`mockLocations` fixture — update it once, carefully: remove `connections`, weather fields are already gone via Lane B), `LocationManager.test.tsx`, `MapViewComponents.test.tsx` (MarkerEditor/MarkerIcon/context menu), `mapActions/mapReducer` marker tests, `FacilitiesView.test.tsx`.

New, at minimum:
1. Reducer: arrival at a location-linked tile switches `currentLocationId` + logs `location.changed`; arrival at an unlinked tile keeps the terrain-sync interim behavior; non-active-group travel does NOT switch location but DOES auto-discover.
2. Reducer: auto-discovery flips `visibility` gm→player, stamps `discoveredAt` with post-advance day/slot on travel, logs `location.discovered` with `day`; already-player markers untouched; non-location gm markers untouched; idempotent on re-arrival.
3. `facilityAccess` unit tests: party always; location by pin-tile match; vehicle aboard / docked-both-directions / not-co-located; dangling ids.
4. Kitchen/lab dropdown filtering (RTL or context-level): unreachable kitchen excluded/greyed for a leader whose group is elsewhere.
5. `LocationDetailPanel` RTL: renders name/terrain/climate, gmNotes only in GM mode, discovery line, facilities + contacts lists, reveal toggle dispatches `mapUpdateMarker`.
6. MarkerEditor location select + create-new flow; context-menu Edit/Delete marker path.
7. Contact presence hint RTL (at-location, party-elsewhere, no-location cases).
8. ManagerTab `'locations'` nav renders LocationManager.
9. Migration/ensure: legacy save with `connections` + dangling refs → cleaned, idempotent, same-reference when clean.

## Definition of done — self-verify before finishing

```
npx tsc --noEmit                                  # 0 errors
npx vitest run                                    # full suite green
grep -rn "LocationConnection\|connections" src/types/location.ts src/components/location/   # zero hits
grep -rn "interface Facility" src/types/partyTool.ts                                        # zero hits
```
At least 30 new tests. If something unrelated is red on a clean checkout, note it and leave it.

## Final summary requested

One paragraph: how the arrival block is structured (active-group gating vs objective discovery), what you did at each facility filter site (grey vs hide, and where the leader id came from), any as-built Lane B drift you had to accommodate, and anything about the marker/location referential integrity that future lanes should know.
