# Spec: Phase 14 Lane B — Per-map climate, per-map ambient weather, minimal season layer

**Date:** 2026-08-31
**Repo:** GURPS VTT (React 18 + TypeScript strict + Vite, Redux-style state with Immer, Vitest/jsdom)
**Branch:** you are on `codex/lane-bd-climate-locations`. Commit nothing; leave changes in the working tree.
**Design doc (read for intent):** `docs/MAP_TRAVEL_14_PLAN.md`, decisions D3, D4, D5.
**Context:** Lane A landed — travel groups/vehicles exist (`entities.travelGroups`, `src/utils/partyPosition.ts` exports `resolveGroupPosition`/`groupsOnMap`/`vehiclesOnMap`), `ui.activeTravelGroupId` names the active group, schema is 1.5.6, and `advanceSlotAndRegenerateWeather(draft, logMessage)` in `src/state/campaignReducer.ts:373-421` is the single time-tick weather site.

## Background (why)

Weather currently belongs to `Location` (`Location.currentWeather`, non-optional, `types/location.ts:239`), generated from `Location.climate` — leaving wilderness weatherless and multi-group play incoherent. Lane B moves the ambient sky to the **map**: `MapModel.climate` (scalar) + `MapModel.currentWeather`, regenerated on the time tick for maps with a party presence, seasoned by a minimal derived-season layer. Locations keep `climate` as a local override concept for Lane D; they stop generating or storing weather.

## Architecture rules (non-negotiable)

- `strict: true` clean (`npx tsc --noEmit` → 0). **No new `as any`.** `import type` for types.
- Logic in reducers/utils, not components. Do not run `npm install`.
- **Grep-gate honesty:** migration/hydration code that must reference removed legacy keys (`currentWeather` on locations, `weatherTableId` on locations) uses plain string literals with a comment — never obfuscate key names to satisfy a grep.

## Part 1 — Season layer

### Types + config (`src/utils/timeSystem.ts` + `src/state/campaignReducer.ts`)
- New types (in `timeSystem.ts`):
  ```ts
  export interface SeasonDef { name: string; days: number; temperatureShift: number; precipitationMultiplier: number }
  export interface CalendarConfig { seasons: SeasonDef[]; startSeasonIndex: number }
  export interface CurrentSeason { index: number; def: SeasonDef; dayOfSeason: number }  // dayOfSeason 1-based
  export function getCurrentSeason(day: number, calendar: CalendarConfig): CurrentSeason
  ```
  `getCurrentSeason` treats day 1 as day 1 of `seasons[startSeasonIndex]`, walks the cycle by summed `days`, wraps forever; defensive against empty/zero-length configs (fall back to a single 90-day "Season"). Pure, unit-tested.
- `DEFAULT_CALENDAR` (export from `timeSystem.ts`): Spring `{days: 90, temperatureShift: 0, precipitationMultiplier: 1.1}`, Summer `{90, +1, 0.85}`, Autumn `{90, 0, 1.15}`, Winter `{90, -2, 1.0}` (winter's cold shift is what makes snow-band entries reachable — no separate snow flag).
- State: `time.calendar?: CalendarConfig` added to the `time` block (`campaignReducer.ts:205-211`), defaulted to `DEFAULT_CALENDAR` in `createCampaignState` (~:543-549). New reducer action `setCalendarConfig { payload: CalendarConfig }` + store method `setCalendarConfig`. Hydrate default: `calendar` missing on old saves → `DEFAULT_CALENDAR` (see Part 4 — note `locations`/`time` have no per-slice hydrate defaults today; `time` is covered by `...payload` spread, so add an explicit `time: { ...base.time, ...payload.time }`-style default with `calendar: payload.time?.calendar ?? DEFAULT_CALENDAR`).

### Season → weather hooks (`src/utils/weatherSystem.ts`)
- `WeatherGenerationInput` (`types/location.ts:283-289`) gains `season?: SeasonDef`.
- In `generateWeather` (:632): before `weightedRandom` (:639), map entries through a new exported pure `applySeasonToEntries(entries, season)` — scales `probability` by `season.precipitationMultiplier` for precipitation types (`lightRain, rain, heavyRain, thunderstorm, snow, blizzard, hail`), leaves others; before `randomTemperature` (:642), shift the selected `temperatureRange` by `season.temperatureShift` bands via a new exported `shiftTemperatureRange(range, shift)` clamped into `TEMPERATURE_ORDER` bounds. No season → both no-ops.
- **Export the canonical `TEMPERATURE_ORDER`** from `weatherSystem.ts` (:459) and delete the duplicate at `src/components/location/WeatherTableEditor.tsx:37-39` (import instead).
- Fix the flagged landmine while here: `isWeatherExpired` (:681, hardcodes `* 3` at :689-690) gains a `slotsPerDay = 3` param; `generateWeather` forwards `slotsPerDay` (add to `WeatherGenerationInput`) to `randomDuration`/`calculateExpiration` (:644, :669). Update the two reducer call sites to pass `draft.time.slotsPerDay`.

### Header display (`src/components/header/TimeDisplay.tsx`)
- Third block after the Time block (:50-59): season name + "Day N" of season, from `getCurrentSeason(day, calendar)`. Player-visible (TimeDisplay is not GM-gated). Compact variant: append the season's first letter is noise — leave compact unchanged. Also fix the hardcoded `/3` at :56 to use `slotsPerDay`.

### Calendar config UI (`src/components/ManagerTab.tsx` + new view)
- New Manager view `'calendar'`: nav button + render branch (pattern as-built for `'vehicles'` in Lane A2). New `src/components/manager/views/CalendarView.tsx` (model on `VehiclesView`): one row per season — name (text), days (number ≥ 1), temperature shift (number, −3..+3), precipitation × (number, 0.1..3 step 0.05) — plus start-season select and a "Reset to defaults" button. Dispatches `setCalendarConfig` with the whole config. Keep it small; no add/remove-season rows (exactly the configured array's length — but DO allow adding/removing seasons, actually: the design says four configurable seasons; fixed four is fine for now — render exactly the four with editable fields; note this as a comment).

## Part 2 — Per-map climate

- `MapModel` (`src/types/map.ts:249-304`) gains `climate: ClimateType` (import type from `types/location`). Default `'temperate'`.
- `createNewMap` (`src/utils/mapUtils.ts:378-406`) accepts `climate` in its params (default `'temperate'`).
- **All four duplicated create-param sites gain `climate`:** `MapCreateDialog.tsx:11-16` (+ a climate select rendered after the Description block ~:109 — options = 7 presets + `locations.customClimates`, pass the merged label map in as a prop), `MapPanel.tsx` `handleCreateMap` (~:250-256), `campaignStore.tsx:311/:672`, `mapActions.ts:81-88` `CreateMapAction`.
- **Settings popover:** `MapHeader.tsx:224-275` gains a climate select; widen the triple-duplicated `Pick<>` (`MapHeader.tsx:36-38`, `campaignStore.tsx:313/:675`, `mapActions.ts:96`) with `'climate'` and `'weatherTableId'` (Part 3); add explicit `if (changes.climate !== undefined)` branch in `mapReducer.ts:106-119` (the reducer applies field-by-field — a spread will not work).
- Hydrate default: `climate: map.climate ?? 'temperate'` in `hydrateMapState` (`campaignStorage.ts` beside :55).

## Part 3 — Weather moves to the map

### State shape
- `MapModel` gains `currentWeather?: ActiveWeather | null` and `weatherTableId?: Id | null` (per-map custom table override, replacing the per-location one; tables themselves stay in `locations.weatherTables` — GM-authored, referenced from maps).
- **`Location` loses `currentWeather` and `weatherTableId`** (`types/location.ts:238-239`). `Location.climate` STAYS (Lane D uses it as a local override; unused by generation after this lane).

### Generation context (one helper, used everywhere)
New `src/utils/ambientWeather.ts`:
```ts
export function resolveWeatherContext(state, mapId): { climate: ClimateType; weatherTable?: WeatherTable }
  // map.climate; map.weatherTableId → locations.weatherTables[id] (dangling id → undefined)
export function regenerateMapWeatherIfNeeded(draft, mapId, time, season): boolean
  // missing OR isWeatherExpired(mapWeather, time, slotsPerDay) → generateWeather({climate-context, season,
  //   weatherEffectOverrides: draft.locations.weatherEffectOverrides, slotsPerDay}) → map.currentWeather; returns whether changed
export function mapsWithPresence(state): Set<MapId>   // union of groupsOnMap/vehiclesOnMap positions across all maps
export function getActiveAmbientWeather(state): { weather: Weather | null; mapId: MapId | null; mapName: string | null }
  // active group's resolved map (fall back to maps.activeMapId) → its currentWeather?.weather
```
`generateWeather`'s input currently requires a `Location` object — refactor `WeatherGenerationInput` to take `{ climate: ClimateType; ... }` instead of `location: Location` (the only field it reads is `location.climate`, weatherSystem.ts:636). Update `createDefaultLocation` (weatherSystem.ts:828-856) to stop generating weather entirely (locations no longer hold it) — it returns a Location without weather fields; `createInitialLocationState` unchanged otherwise.

### Reducer changes (`src/state/campaignReducer.ts`)
- `advanceSlotAndRegenerateWeather` (:373-421): the per-location loop (:397-420) is replaced — for each mapId in `mapsWithPresence(draft)`, `regenerateMapWeatherIfNeeded(...)` with `season = getCurrentSeason(nextDay, calendar)`; log `weather.changed` only for the active group's map (use `resolveGroupPosition` on the active group; fall back to `maps.activeMapId`).
- Arrival triggers: after `party/placeGroup` and after `map/executeTravel` movement (both cross-slice blocks already exist, commented "Interim until Lane D"), call `regenerateMapWeatherIfNeeded` for the destination map WITHOUT advancing time (covers arriving on a map whose weather is missing/stale).
- `rollNewWeather` (:1356-1379): payload becomes `{ mapId: Id }`; regenerates that map's weather unconditionally (GM reroll), logs `weather.changed`. `setLocationWeather` (:1347-1354) becomes `setMapWeather { mapId, weather: ActiveWeather }`. Update action types (:798-799), store methods (`campaignStore.tsx:296-297/:649-651`), and the WeatherWidget dispatchers.
- Delete the now-orphaned per-location weather writer in `LocationManager.handleCreateLocation` (`LocationManager.tsx:99-112`) — new locations simply have no weather fields.

### Consumption (`src/hooks/useWeatherModifiers.ts`)
- The hook resolves ambient weather via `getActiveAmbientWeather(state)` instead of `getCurrentLocation`/`getCurrentWeather`. Location modifiers contribution (`currentLocation.modifiers`) STAYS as today (Lane D refines locations). Return shape: keep fields; `locationName` now reports the map name (rename to `sourceName` ONLY if the rename stays mechanical — it's displayed in a few places; if renaming ripples, keep the field name and put the map name in it with a comment).
- **Widen the memo deps** (:100 and the `useAllWeatherModifiers` twin) to cover `state.maps`, `state.entities.travelGroups`, `state.entities.vehicles`, `state.ui.activeTravelGroupId` — stale-memo here silently breaks every activity's weather modifier. Update the test-file `MockCampaignStoreValue` accordingly.
- `weatherSystem.getCurrentWeather/getCurrentLocation` (:874-884): `getCurrentWeather` is deleted (its data moved); `getCurrentLocation` stays.

### WeatherWidget (`src/components/header/WeatherWidget.tsx`)
- Reads ambient weather via `getActiveAmbientWeather`; header line (:170-173) shows `{mapName} ({climateLabel})` — guard the label: `allLabels[climate] ?? climate` (fixes the unguarded `CLIMATE_LABELS[...]` at :172; merge custom climate labels like `LocationListView.tsx:48` does). Remaining-slots (:46-49), reroll (:93-97 → `rollNewWeather({mapId})`), and the GM weather editor (`setMapWeather`) all re-key to the active map. No-map/no-weather → the widget's existing empty state.
- `LocationListView.tsx:79-83` weather icon/description lines are deleted (locations have no weather); `:48` climate label stays.
- `LocationFormView.tsx:88-96` weather-table select is deleted (tables now referenced per map). The map settings popover gains a weather-table select (`<option value="">Climate default</option>` + `locations.weatherTables` values) driving `weatherTableId`.

## Part 4 — Persistence, hydration, migration

**CRITICAL — read first:** the versioned `migrateData` registry does NOT run on live campaign saves (`storage.ts:57` gates on `appState`/`gmState`; `campaignStorage.ts:171` passes `migrations=false`). The load-bearing upgrade path is `hydrateCampaignState`. You must do BOTH:
1. **Hydrate-side (load-bearing):** new `ensureAmbientWeather(state)` in `src/persistence/dataMigration.ts` (pattern: `ensureTravelGroups` — return the same reference when nothing changed): (a) every map gets `climate` (default temperate — belt-and-braces with hydrateMapState) ; (b) if the ACTIVE map (`maps.activeMapId`, else first map) lacks `currentWeather` and the legacy current location still carries one in the raw payload, move it onto that map; (c) strip legacy `currentWeather`/`weatherTableId` keys from every location (string-literal keys + comment); (d) `time.calendar` default. Chain it into `hydrateCampaignState` (`campaignStorage.ts:70/:104`). Note `locations` has NO per-slice hydrate default today — add an explicit safe default block for `locations` (spread base then payload) so partial saves can't crash the ensure.
2. **Registry-side (export/import parity):** `migrateTo1_5_7` doing the same transformation on raw `MigratableData`, registered `'1.5.6:1.5.7'` (`dataMigrations.ts:55-67`), + `SCHEMA_METADATA['1.5.7']` after :121 (`migratesFrom: ['1.5.6']`, name like 'Per-Map Ambient Weather & Seasons'), + bump `CURRENT_SCHEMA_VERSION` (:16).
- Serialization: climate/weather/calendar are plain JSON — no Set handling; extend `src/__tests__/serializationRoundTrip.test.ts` with map climate + currentWeather + calendar surviving.

## Part 5 — Tests (new + fallout)

Fallout to fix (do not weaken unrelated assertions): `weatherSystem.test.ts` (input-shape change), `useWeatherModifiers.test.ts` (state widening — rebuild `makeStore` with maps/groups), `travelTimeAdvance.test.ts` (its `expireCurrentWeatherAt` helper re-keys to the map), `locationSelectors.test.ts` (weather selectors move/die), `LocationComponents.test.tsx`, `HeaderComponents.test.tsx`, `MapViewComponents.test.tsx` (settings popover), any `mapUpdateMap` tests.

New tests, at minimum:
1. `getCurrentSeason` — boundaries (day 1, last day of a season, wrap past a full year, startSeasonIndex ≠ 0, degenerate config).
2. `applySeasonToEntries` + `shiftTemperatureRange` — precipitation scaling only touches precip types; band shift clamps at both ends; no-season no-ops (use the existing `Math.random`-mock determinism pattern, `weatherSystem.test.ts:44-51`).
3. `generateWeather` with a winter season on a temperate table → colder band than unshifted baseline (deterministic).
4. Reducer: time tick regenerates expired weather ONLY on maps with presence; a presence-less map stays stale; `weather.changed` logged only for the active group's map; `advanceTime`/`map/executeTravel` parity preserved (extend `travelTimeAdvance.test.ts`).
5. Arrival regen: `party/placeGroup` onto a map with expired/missing weather generates it without advancing time.
6. `rollNewWeather {mapId}` + `setMapWeather` reducer cases.
7. Migration/ensure: legacy save with `Location.currentWeather` + `weatherTableId` → active map inherits the weather, locations stripped, calendar defaulted, maps get climate; idempotent; same-reference when already clean.
8. `TimeDisplay` renders season name + day-of-season (RTL).
9. `CalendarView` RTL — renders four seasons, edits dispatch `setCalendarConfig`.

## Definition of done — self-verify before finishing

```
npx tsc --noEmit                                    # 0 errors
npx vitest run                                      # full suite green (~3,904+ before your additions)
grep -rn "currentWeather" src/types/location.ts src/components/location/  # zero hits
grep -rn "setLocationWeather\|getCurrentWeather" src/                     # zero hits
```
(The `currentWeather`/`weatherTableId` string literals in `dataMigrations.ts` / `persistence/dataMigration.ts` migration code are expected and exempt — the gates above are scoped so they don't collide.)

At least 30 new tests. If something unrelated is red on a clean checkout, note it and leave it.

## Final summary requested

One paragraph: how the ambient-weather resolution is keyed (active group vs active map, and the fallbacks), how the season hooks integrate with custom weather tables, what you did about `useWeatherModifiers`'s memo deps and return shape, and anything in the hydrate/ensure split that future lanes should know.
