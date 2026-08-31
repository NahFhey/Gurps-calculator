# Phase 14 — Map, Travel & Location System: Design Plan

**Designed:** 2026-08-31 (grill-me session, 25 questions)
**Status:** Shared design concept — ready for lane split / codex-shepherd specs
**Supersedes:** the Phase 14 section of ROADMAP.md as written 2026-03-22 (materially stale — see Survey Notes)

---

## Problem

The map renderer is done (three.js scene, zoom/pan/orbit/select/paint — see `SPEC-map-three.md`), but everything *around* it is half-wired:

- **Two unrelated travel systems.** Map-tile travel works for one-slot hops; location-graph travel (`TravelPanel`, `LocationConnection.travelTime`, `TravelAction`, `activeTravels`) is declared-but-dead — its button just sets `currentLocation`.
- **No `Location ↔ Map` association** — only a one-way string bridge that rewrites `currentLocation.terrain` after travel.
- **Multi-day journeys are impossible by construction** — over-budget routes are blockers, not journeys.
- **No calendar/season**; weather has no seasonal input. `timeSystem.ts` is slot-modulo only.
- **Travel's time-advance is a copy-paste divergence** from `advanceTime` (`campaignReducer.ts:803-825`) that skips weather regeneration, the undo checkpoint, and the paused-task guard. Real bug.
- Facilities, contacts, and discovery have zero coupling to place.
- **Single-party-position assumption** (`partyTileId`) — but Drakenfire play needs multiple vehicles: fast lancer recon ships that move independently, land back on the main ship, and deploy from it.

## Solution Shape

One movement model (map tiles), one positional primitive (**travel groups**), vehicles as first-class entities with docking, journeys progressed by the ordinary time tick, travel as a real downtime activity in the task bar, and locations/facilities/contacts pinned to the map through markers.

---

## Decisions (in grilling order)

### D1. One travel system
Map-tile travel is canonical. The location-graph travel path is **deleted**: `TravelPanel`'s pseudo-travel, and the dead types `TravelAction`, `LocalTravel`, `LocationState.activeTravels`, `LocationConnection.travelTime/travelDifficulty/requirements`. Abstract "fast travel" between known places, if ever wanted, is later built *through* the map system, not beside it.

### D2. Locations attach via markers
`MarkerModel` gains `locationId?`. A location is placed by linking a marker pin to it. Arrival at a location-linked marker switches the group's current location; otherwise the group is "in the wilderness." Multi-map presence works free: a city has a marker on the region map *and* its own local map (existing link/portal system), both markers pointing at the same `Location`.

### D3. Per-map climate
`MapModel.climate` — one of the 7 presets or a custom climate, set at map creation/settings, default temperate. Wilderness weather generates from map climate; a named location's climate override shifts how weather affects people there. **Painted per-tile climate zones: out of scope** — the per-map scalar is designed to become the fallback under a future zone layer.

### D4. Per-map weather *(supersedes the earlier "single campaign-level weather" decision made mid-session)*
`currentWeather` lives on `MapModel` — one sky per map, regenerated on time advance for maps with a party presence, from map climate + season. Terrain applies at **consumption** time: `useWeatherModifiers` combines ambient weather with the terrain the group is standing in (existing terrain-modifier tables). `Location.currentWeather` is migrated away (schema bump; hydrate pulls current location's weather into its map).

### D5. Minimal season layer
Campaign-settings `calendar` config: four seasons with configurable names and length (default 90 days), starting season for day 0. Season is **derived** from the existing day counter. It affects weather as a temperature-band shift + precipitation weight multiplier applied to existing climate tables at generation time (no per-season table variants). Header time display shows season + day-of-season. **Full calendar (months, holidays): out of scope** — a future calendar layer feeds the same "current season" derivation.

### D6. Journey-as-state
Confirming a route creates an **active journey** on the group (route, mode, miles-progressed). Each `advanceTime` moves the group along the route by that slot's weather/terrain-adjusted budget, revealing as it goes, until arrival. Mid-journey interruption (events, encounters, crew loss) pauses at a real tile; GM can abort or re-route — a partial route is always a valid state. One-click "advance until arrival or interruption" sugar can be layered later.

### D7. Navigation & overt drift
Per travel slot, the designated navigator (`navigatorId` on the journey, `RestData.healerId` pattern) rolls navigation — effective skill from the sheet, modified by weather visibility, terrain, and mode; GM-overridable at journey start. On failure the slot's movement deviates laterally ~1 tile per margin-of-failure chunk (crit fail worse), the remaining route auto-recomputes from the actual position, and the drift is logged. The party knows it drifted. **Hidden believed-vs-actual drift: deferred** — the journey entity keeps route and position separate so it can be layered on later.

### D8. Travel events
One event roll per travel slot against a **terrain-keyed weighted table** (foraging pattern — "nothing" is the heaviest entry). Entry kinds:
- **flavor** — text, changelog only
- **hazard** — mechanical (lost miles, fatigue, minor damage), auto-applied + logged
- **encounter** — pauses the journey, one-click hand-off into `EncounterSetup`, optionally pre-loading a linked `EncounterTemplate` (this *is* the Phase 15a travel→combat hook)

Ship default tables for the 9 preset terrains; GM-editable in the Manager like gathering tables. Scoping: global per-terrain defaults + optional **per-map table-set override** (the `weatherTableId` pattern; a map stands in for "region"). Weather influence is authored into entries via condition gates, not a second modifier system.

### D9. Provisioning: cooking, not ration-ticking
Each travel day, each group needs **one cooked meal batch** via a real `cooking` task from the existing cooking system (ingredients drawn through the inventory bus, meal buffs apply — a good trail cook is a party asset). Aboard a vehicle: any rider with a free slot. **On foot: the group must halt a slot to cook** (journey doesn't move that slot). No cooked meal → a **missed-meal day**: B426 accumulation per character (FP loss that won't recover until fed), logged. GM "forced march" toggle knowingly skips cooking. Confirm-screen provisioning preview: days of ingredients + who's cooking. **Water tracking: out of scope** — desert flavor lives in terrain event tables as hazards.

### D10. Travel is a downtime activity; the journey owns spatial truth
`'travel'` joins the `ActivityData` union. Each travel day auto-creates a travel task in the planner occupying the assigned crew's slots — visible in the task bar, blocking other tasks for crew, **counting as worked slots** for the existing fatigue mechanic. The journey loop resolves these tasks as it advances; the task bar is a faithful *view* (travel tasks can't be edited/moved in the planner — abort/re-route from the map). Non-crew ride along with free slots.

### D11. Vehicles and travel groups
- **`Vehicle`** entity: name, type from a GM-editable **catalog** (type carries travel mode, speed modifier, `minCrew`, descriptive capacity, `hangarSlots`, icon), position, condition/notes. Vehicles persist when parked/crewless (a beached lancer stays on its tile).
- **Travel group** = the universal mover: a set of characters + optionally the vehicle they're aboard. Foot travel is a vehicle-less group. Solo travel is a one-person group. Journeys, navigation, drift, events, cooking, tasks, fatigue all attach to the *group*.
- `minCrew` lives on the vehicle type, enforced at wizard confirm as a `validateTravelRoute` blocker. Crew must be able-bodied — implement the documented no-op `PARTY_INCAPACITATED` check here. Mid-journey crew loss pauses the journey ("crew below minimum") rather than retroactively blocking.

### D12. Groups are persistent and total
Every character always belongs to exactly one travel group. Campaign starts with a "main party" group seeded from `partyTileId`. Groups are the unit of **position** — a character's map location, current named location, and reachable facilities derive from their group. **Split/merge/board require co-location** (same tile, or aboard/docked-to the same vehicle). Wizard UI: draggable member portraits that pull apart into groups and rejoin (dnd-kit, per the initiative-timeline pattern).

### D13. Docking
`Vehicle.position` union: `{ on-tile: mapId, tileId }` | `{ docked: carrierVehicleId }`. A docked vehicle is wherever its carrier is (rides through journeys with zero bookkeeping); its characters count as co-located with the carrier group. `hangarSlots` on the type (main ship 2, lancer 0) — no size classes or cargo math. **Dock**: be on the carrier's tile at a slot boundary; free action. **Deploy**: undock at the carrier's tile (mid-journey fine); journey can start next slot. Nested docking disallowed — one level, carrier must be on a tile.

### D14. All movement on the time tick
Wizard confirm **arms** the journey; the header advance-slot button is the single tick that progresses every active journey (movement, navigation, events, cooking check, fatigue) alongside weather regen and everything else. **The divergent travel time-advance path (`campaignReducer.ts:803-825`) is deleted**, structurally fixing the skipped weather-regen/undo-checkpoint/paused-guard bug. Convenience "advance slot" button on the confirm screen. Multiple groups hitting events on one tick resolve **sequentially** (per-group interruption panel + changelog).

### D15. Day rhythm
Slot config gains a night flag (default: last slot of the day). Journeys move on day slots and **auto-camp on night slots** — camp slots leave the whole group free (cooking, rest/sleep tasks land there; 13c recovery needs sleep for HT rolls). Typical 3-slot day: move, move, camp. **Forced night march** override: move on night slots at a navigation penalty compounding with weather, no sleep. Pace is *emergent* — GM chooses halts; existing fatigue tiers + B424 sleep gate supply consequences. No separate pace setting.

### D16. Encumbrance
Foot groups: per-slot mile budget scaled by the **worst encumbrance level in the group** (existing `encumbrance.ts`, standard GURPS multipliers ×1/×0.8/×0.6/×0.4/×0.2); confirm screen names the bottleneck. Mounted/vehicle groups ignore personal encumbrance. **Vehicle cargo-weight ledger: out of scope** (descriptive capacity field for GM eyeballing; honest tracking is a followup).

### D17. Map presentation
Every group renders as a token — vehicle groups show the type icon, foot groups a stack of member portrait tokens (12a assets); parked vehicles render dimmed. Header party controls generalize to an **active-group selector** (or click a token); Frame/Travel/Place act on the active group; the wizard always operates on it. **Reveal is the union of all groups** — each reveals along its own path with its own LOS, merging into the map's one revealed set. Per-group hidden knowledge ("only the lancer saw it"): deferred.

### D18. Facilities attach three ways
Consolidate on the `campaign.ts` `Facility` type (the `partyTool.ts` legacy type dies). New `attachment` field:
- **`party`** (default — carried gear, available anywhere; existing facilities migrate untouched)
- **`location`** (a smithy in town — usable only by a group at that location)
- **`vehicle`** (the main ship's galley/lab — usable by groups aboard or docked)

Activity calculator filters facilities by the task leader's group position. The 13b reservation engine is unchanged — it sees a filtered list. The main ship becomes a genuine mobile base; en-route cooking uses the ship galley's rating.

### D19. NPC placement = contacts at locations
`Contact` (13c social) gains `locationId?`. Location detail lists contacts present; social/trading task forms show a **soft presence hint** ("at Ravenport; your group is elsewhere") — never a hard gate. No overland NPC `Character` tokens (meaningless at 12+ mi/tile); a future local-scale map reuses the marker system.

### D20. Discovery
`MarkerModel.hidden?: boolean` — hidden markers don't render in player view even on revealed tiles. Discovery: **automatic when a group ends a slot on the tile**, or **manual GM toggle**. Either path writes the long-dead `discoveredAt: {day, slot}`, displayed as "discovered on day N" — a found-places journal via the changelog. `Location` gains `gmNotes` alongside player-visible `description`. Sight-based discovery (spotting from afar through LOS): deferred.

### D21. Settlement generator: deferred
Everything it would produce is hand-authorable in minutes through UIs this phase builds. Future ingredients when built: 12c syllable name generator, contact/facility templates, size-tiered service table.

### D22. Navigation surfaces
- **Manager** gains a **Vehicles view** (type catalog + instances: name, condition, position readout, crew) and adopts LocationManager (weather tables, climate editors, overrides) into its navigation. The WeatherWidget keeps its shortcut but stops being the only door.
- **Map tab** is the browsing surface for places: clicking a location-linked marker opens a **location detail panel** (description, gmNotes, climate, facilities, contacts, discovery info).
- No new top-level tab. Travel wizard (with the portrait-grouping step) stays a map overlay.

---

## Out of Scope (definition of done depends on these staying out)

- Painted per-tile climate/region zones (per-map scalar is the designed fallback)
- Full calendar — months, named days, holidays
- Hidden drift (believed vs. actual position)
- Water tracking
- Vehicle cargo-weight ledger
- Per-group hidden reveal / knowledge partitioning
- Settlement generator
- Sight-based (LOS) discovery
- Overland NPC tokens
- Abstract fast travel
- Nested docking

## Engineering Notes

- **Schema:** version bump + hydrate defaults — groups seeded from `partyTileId`; `Facility.attachment` defaults `party`; `Location.currentWeather` → owning map's `currentWeather`; new `MapModel`/`MarkerModel`/vehicle fields need hydrate defaults in `campaignStorage.ts` (survey: no map-specific migration entries exist today; global version 1.5.4).
- **Deletions:** divergent travel time-advance branch (`campaignReducer.ts:803-825`), `TravelPanel` pseudo-travel, dead location-travel types (D1), orphaned `TravelBlockerList.tsx`, dead `TravelWizardState` slice in `MapState` (MapPanel keeps local wizard state).
- **The cross-slice travel branch currently has zero tests** — the journey loop inside `advanceTime` needs reducer-level tests asserting movement, weather regen, undo checkpoint, and task materialization per tick.
- Reusable infra confirmed by survey: `RollableTable`/`rollOnCatchTable` (weighted tables), `FORAGE_EVENTS_*` + `determineDynamicEventType` (tiered events), `EncounterTemplate` CRUD (travel→combat), `foodsConsumed`/`itemConsumed` bus, `FatigueStatus`/`getFatiguePenalty`, `encumbrance.ts`, dnd-kit.
- `KNOWN_ISSUES.md`: TravelWizard is on the no-focus-trap list — the wizard rework is the moment to adopt/create the shared `<Modal>`.

## Punted Minor Calls (defaults chosen; revisit at implementation if they chafe)

1. Navigation skill resolution: look up a Navigation specialty matching the mode; fallback is a GM-set effective level at journey start.
2. Drift magnitude: ~1 tile lateral per 2 points of margin-of-failure; tune against real routes.
3. Default travel-event table contents for the 9 terrains: authored at implementation.
4. Season default modifiers (temp-band shifts, precipitation multipliers per season): authored at implementation.
5. Night-slot default when `slotsPerDay` ≠ 3: last slot of the day.
6. Starter vehicle catalog (lancer, main skyship, wagon, riverboat…): Drakenfire-flavored seeds, GM-editable.
7. Portrait-stack rendering for large foot groups: cap + overflow count, initiative-timeline pattern.

## Suggested Lane Split (for codex-shepherd specs)

- **Lane 0 — Foundation & demolition:** delete dead travel system; unify travel into `advanceTime` (bug fix); schema groundwork. Small, unblocks everything.
- **Lane A — Groups & vehicles:** group/vehicle/catalog state model, docking, co-location rules, map tokens, active-group selector, portrait-grouping wizard step, Manager Vehicles view.
- **Lane B — Climate, season, weather:** per-map climate + weather, season layer, header display, migration off `Location.currentWeather`. Independent of A.
- **Lane C — The journey loop:** journey entity, per-tick movement, navigation/drift, event tables + Manager editor, cooking/provisioning, night rhythm, encumbrance, travel tasks, encounter hand-off. Depends on A (and B for weather inputs).
- **Lane D — Locations on the map:** marker↔location link, location detail panel, facility attachment + calculator filter, contact placement, discovery, LocationManager into Manager nav. Depends on A only lightly (group position).

Sequencing: 0 → A → (B ∥ D) → C. Lane C is the largest and most table-visible; every game night touches it.
