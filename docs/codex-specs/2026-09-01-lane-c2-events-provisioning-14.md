# Spec: Phase 14 Lane C2 — Travel events, encounter hand-off, provisioning & journey UI

**Date:** 2026-09-01
**Repo:** GURPS VTT (React 18 + TypeScript strict + Vite, Redux-style state with Immer, Vitest/jsdom)
**Branch:** you are on `codex/lane-c-journey-loop`, on top of the completed Lane C1 (journey engine). Commit nothing; leave changes in the working tree.
**Design doc (read for intent):** `docs/MAP_TRAVEL_14_PLAN.md`, decisions D8 (event tables), D9 (provisioning), D18/D22 (surfaces), plus the encounter bullet of D8 — this is the Phase 15a travel→combat hook.
**Pre-flight (required):** read `docs/codex-specs/2026-09-01-lane-c1-journey-engine-14.md` and the as-built C1 code before writing anything. C1 landed: `Journey` on `TravelGroup` (`src/types/party.ts`), the engine `src/state/party/journeyEngine.ts` with `progressJourneys(draft)` and the intentional no-op `handleJourneyDayBoundary(draft)`, journey actions in `src/state/party/`, `'travel'` in the downtime union, `travelLog` in `src/utils/activityLogger.ts`, and `JourneyStatusPanel` under `src/components/map/views/`. Where this spec names a C1 construct, locate it by name in the working tree — line numbers for C1 code are deliberately omitted.

## Background (why)

C1 made journeys real: groups move on the time tick, navigate, drift, camp at night, and their crew's travel shows up as resolved downtime tasks. But nothing *happens* on the road, and nobody has to eat. C2 adds the three missing loops: **terrain-keyed travel event tables** (one weighted roll per travel slot — flavor logs, hazards auto-apply, encounters pause the journey and hand off into EncounterSetup), **provisioning** (each travel day each journeying group needs one real cooked meal; missing it costs FP that won't recover until fed — GURPS B426, simplified), and the **GM surfaces**: a Manager editor for event tables, a per-map table-set override, the encounter interruption flow, and a provisioning preview on the travel confirm screen.

## Architecture rules (non-negotiable)

- `strict: true` stays clean: `npx tsc --noEmit` → 0 errors. **No new `as any`.** `import type` for type-only imports.
- State logic in reducers/utils, never components. Immer drafts throughout.
- Silent no-op on invalid reducer preconditions (project convention — no throws from reducers).
- Do not run `npm install`. Follow existing component patterns (Manager views, Tailwind classes, testids) — copy neighboring code style.

---

## Part 1 — Travel event types (`src/types/travelEvents.ts`, new file)

```ts
import type { Id } from './campaign';
import type { TerrainId } from './map';
import type { WeatherType } from './location';

export type TravelEventKind = 'nothing' | 'flavor' | 'hazard' | 'encounter';

/** Weather influence is authored into entries as eligibility gates (design D8) — not a second modifier system. */
export interface TravelEventConditions {
  /** Entry is eligible only when the map's current weather type is one of these. Omit = any weather. */
  weatherTypes?: WeatherType[];
  /** Entry is eligible only on night slots (i.e. during forced march). */
  nightOnly?: boolean;
  /** Entry is eligible only while the journey has forcedMarch set. */
  forcedMarchOnly?: boolean;
}

export interface TravelHazardEffects {
  /** Miles of progress lost: subtracted from journey.legProgressMiles, floored at 0. Never moves the group backward. */
  lostMiles?: number;
  /** Dice formula (e.g. '1d6-3'), rolled once per group member, result floored at 0, applied as FP loss. */
  fpLossFormula?: string;
  /** Dice formula, rolled once per group member, floored at 0, applied as HP loss. */
  hpLossFormula?: string;
}

export interface TravelEventEntry {
  id: Id;
  kind: TravelEventKind;
  /** Relative weight among eligible entries, > 0. 'nothing' should be the heaviest entry in shipped tables. */
  weight: number;
  name: string;
  description: string;
  conditions?: TravelEventConditions;
  /** kind 'hazard' only. */
  hazard?: TravelHazardEffects;
  /** kind 'encounter' only. Null = open EncounterSetup empty (GM improvises). */
  encounterTemplateId?: Id | null;
}

export interface TravelEventTable {
  id: Id;
  name: string;
  description?: string;
  entries: TravelEventEntry[];
  builtin?: boolean;
}

/** Terrain-keyed set: which table a journey rolls on, by the terrain of the tile the group ends the slot on. */
export interface TravelEventTableSet {
  id: Id;
  name: string;
  /** Keyed by preset terrain ids (constants/map.ts PRESET_TERRAIN_IDS). Custom terrains use fallbackTableId. */
  byTerrain: Record<TerrainId, Id | undefined>;
  fallbackTableId?: Id | null;
  builtin?: boolean;
}
```

### Seeds (`src/constants/travelEventSeeds.ts`, new; design punted call 3)

`TRAVEL_EVENT_TABLE_SEEDS: TravelEventTable[]` — one table per preset terrain (`travel-events-plains`, `-forest`, `-hills`, `-mountains`, `-swamp`, `-desert`, `-water`, `-urban`, `-road`), all `builtin: true`. Author each with 6–9 entries totaling sane weights: one `nothing` entry carrying ~65% of the table's weight (design: "nothing is the heaviest entry"), 2–3 `flavor` entries, 2–3 terrain-appropriate `hazard` entries (examples: desert "Scorching heat" `fpLossFormula: '1d6-3'` gated `weatherTypes: ['clear','cloudy']`… use real `WeatherType` values from `src/types/location.ts`; swamp "Sucking mire" `lostMiles: 6`; mountains "Rockslide" `hpLossFormula: '1d6-3'`; forest "Deadfall detour" `lostMiles: 4`; night-gated "Exhausting dark march" `fpLossFormula: '1d6-2'` with `nightOnly: true` on 2–3 tables), and exactly one `encounter` entry per table at low weight (~4% of total) with `encounterTemplateId: null`. Also `TRAVEL_EVENT_SET_SEED: TravelEventTableSet` — id `travel-event-set-default`, name 'Standard Travel Events', `builtin: true`, `byTerrain` mapping all 9 preset terrain ids, `fallbackTableId: 'travel-events-plains'`.

### State + actions

`campaignReducer.ts` entities block (optional-declared like the Lane A fields): `entities.travelEventTables?: Record<Id, TravelEventTable>`, `entities.travelEventTableSets?: Record<Id, TravelEventTableSet>`, `entities.deletedBuiltinTravelEventIds?: string[]` (one tombstone list shared by tables and sets — ids don't collide).

Party-domain actions (existing `src/state/party/` patterns, silent no-op guards): `party/upsertTravelEventTable { table }`, `party/removeTravelEventTable { tableId }`, `party/upsertTravelEventTableSet { set }`, `party/removeTravelEventTableSet { setId }` — builtin resurrect/tombstone semantics copied from `src/state/character/characterReducer.ts:54-70`. Removing a table still referenced by a set: allowed; resolution treats dangling refs as missing (falls through to fallback). Removing the set a map points at: allowed; resolution falls back to the default seed set.

`MapModel` (`src/types/map.ts`) gains `travelEventTableSetId?: Id | null` — the `weatherTableId` pattern (`map.ts:264`). Extend the `mapUpdateMap` partial (`campaignStore.tsx:316`, impl ~:680) with the new key.

Store facade methods + selectors (`partySelectors.ts`): `selectTravelEventTables`, `selectTravelEventTableSets`, and the resolver below re-exported for components.

### Resolution + roll (`src/utils/travelEvents.ts`, new file)

```ts
export function resolveTravelEventTable(
  state: Pick<CampaignState, 'entities' | 'maps'>,
  mapId: MapId,
  terrainId: TerrainId | null
): TravelEventTable | null
// set = map.travelEventTableSetId (if it resolves) else the default seed set (if not tombstoned) else null;
// table = set.byTerrain[terrainId] → set.fallbackTableId → null. Dangling table ids at any step fall through.

export interface TravelEventContext {
  weatherType: WeatherType | null;   // map.currentWeather?.weather.type
  isNightSlot: boolean;
  forcedMarch: boolean;
}

export function rollTravelEvent(table: TravelEventTable, ctx: TravelEventContext): TravelEventEntry | null
// Filter entries by conditions (weatherTypes includes ctx.weatherType when set; nightOnly/forcedMarchOnly must match),
// drop entries with weight <= 0, weighted-random pick (Math.random, same pattern as generateWeather's
// weighted selection in weatherSystem.ts). 'nothing' or empty eligible list → null.
// Dice for hazards are NOT rolled here — the engine does that (keeps this function table-pure for tests).
```

## Part 2 — Engine integration (`src/state/party/journeyEngine.ts`)

One event roll per travel slot per journeying group (design D8) — moving slots AND drift slots, never camp slots. Runs **after** the slot's movement/drift and after travel-task materialization, on the tile where the group ended the slot. **Roll only when the journey still has route remaining after movement** (`routeTileIds.length > 1` at the roll point, i.e. before the arrival block in `progressGroup`) — the arrival slot rolls no event, because a completed journey has nothing left to pause; add a code comment saying "arrival ambushes" are a possible followup. Details:

- Resolve the table for the group's ending tile terrain; no table → done.
- `rollTravelEvent` with `{ weatherType, isNightSlot: isNightSlot(...), forcedMarch: journey.forcedMarch }`. Null → done.
- **flavor**: `travelLog` entry (player) with the entry's name + description.
- **hazard**: apply mechanically and log (player visibility — hazards are overt):
  - `lostMiles`: `journey.legProgressMiles = Math.max(0, journey.legProgressMiles - lostMiles)`.
  - `fpLossFormula` / `hpLossFormula`: per group member, roll via `evaluateDiceFormula` (`src/utils/gathering.ts` ~:300-330), floor at 0, subtract from `character.gcsData.pools.FP.current` (floored at 0) / `pools.HP.current` (no floor — negative HP is legal GURPS). Members without `gcsData`/pools are skipped. Write through the draft directly (the engine already owns cross-slice writes).
  - Log message names the event and summarizes effects ("Rockslide — Brakka takes 2 HP, Sella 1 HP").
- **encounter** (the 15a hook): `journey.status = 'paused'`, `pauseReason: 'encounter'`; set `draft.ui.pendingIntent = { kind: 'encounter', templateId: entry.encounterTemplateId ?? null, groupId: group.id }`; log `travelLog` entry (player) "Encounter: <name> — journey halted". Multiple groups hitting encounters on one tick each pause; the single `pendingIntent` slot is last-writer-wins — add a code comment noting the GM resolves them one at a time from the journey panel (design D14 sequential resolution).

Resume tightening (C1 left this open): `party/resumeJourney` on a journey paused with `'encounter'` works only when there is no active combat session (`draft.combat.activeSession` falsy — check the actual field name in `src/types/combatTracker.ts` `CombatState`); otherwise silent no-op.

## Part 3 — Encounter hand-off (pendingIntent)

`PendingIntent` (`src/state/campaignReducer.ts:103-106`) gains `| { kind: 'encounter'; templateId: Id | null; groupId: Id }`. It is already nulled on hydrate (`campaignStorage.ts:133`) — fine: the *journey pause* is the persistent fact; the intent is same-session sugar.

Consumers (mirror the 13b split: the router routes without clearing, the leaf consumes and clears):
- **`CombatTab.tsx`** (`src/components/CombatTab.tsx:27` local `view` state): when `state.ui.pendingIntent?.kind === 'encounter'` and there is no active combat session, force the setup view (same mechanism `DowntimePanel.tsx:31-37` uses to route by intent — do NOT clear the intent here).
- **`EncounterSetup.tsx`** (`src/components/combat/EncounterSetup.tsx`): on mount with an `encounter` intent (use the `consumedIntentRef` guard pattern from `CookingTab.tsx:61,74-88`): if `templateId` resolves in `encounterTemplates`, run the existing template-load path (`handleLoadTemplate`, :259-274) and prefill `encounterName` from the travel event; then `clearPendingIntent`. A null/dangling `templateId` just clears the intent (GM builds the encounter by hand).
- **Map side**: the C1 `JourneyStatusPanel` gains an interruption banner when the active group's journey is paused: reason-specific text and, for `'encounter'`, a "Set up encounter" button that dispatches `setPendingIntent({ kind: 'encounter', ... })` (re-arming it in case it was consumed/cleared) followed by `actions.setActiveModule('combat')`. For `'crewBelowMinimum'` / `'noRoute'` show amber text + the existing Resume/re-route affordances.

## Part 4 — Provisioning (design D9, B426 simplified)

### State

- `entities.groupMeals?: Record<Id /* groupId */, number /* last day this group ate a cooked meal */>`
- `entities.starvationFpDebt?: Record<Id /* characterId */, number /* FP that cannot recover until fed */>`

### Recording meals

New action `party/recordMeal { groupId: Id; day: number }`: stamps `groupMeals[groupId] = day` and **zeroes `starvationFpDebt` for every current member of the group** (being fed unlocks recovery — simplified B426). Store facade `partyRecordMeal`.

Wire the cooking system (the only producer): in `CookingTab.create()` (`src/components/cooking/CookingTab.tsx:103-178`) and `executeRemake()` (:239-321), on the Success/Critical Success branch that already calls `actions.setMealBuff(...)`, also resolve the cook's travel group (new util `findGroupOfCharacter(state, characterId): TravelGroup | null` in `src/utils/partyPosition.ts` — every character is in exactly one group per Lane A) and call `actions.partyRecordMeal({ groupId, day: state.time.day })`. Non-journeying groups get stamped too — harmless and correct.

### Missed-meal check (the C1 seam)

Implement the body of `handleJourneyDayBoundary(draft)` (C1 left it a documented no-op; it is called by `case 'advanceTime'` exactly when the day rolled over, with `draft.time.day` already the NEW day — the completed day is `draft.time.day - 1`):

- For each travel group that **traveled on the completed day** — defined as: any `'travel'` task in `draft.downtime.tasksById` with `dayKey === completedDay` and `activityData.groupId === group.id` (use the `isTravelTask` guard):
  - Fed if `entities.groupMeals?.[group.id] === completedDay`. If fed → nothing (log nothing; the cooking log already recorded the meal).
  - Not fed → **missed-meal day** (design: forced march "knowingly skips cooking" — no special case needed; the ledger check is uniform): for each member with `gcsData.pools.FP`: `FP.current = Math.max(0, FP.current - 1)`; `starvationFpDebt[memberId] = (existing ?? 0) + 1`. Log one `travelLog` entry per group (player): "<group> went without a cooked meal — 1 FP lost (won't recover until fed)".
- Groups that did not travel that day are never checked (downtime is assumed provisioned; design scopes D9 to travel days).

### Recovery gate (B426: lost FP returns only after eating)

`src/utils/recovery.ts`: `RestRecoveryInput` gains `starvationFpDebt?: number` (default 0). FP restore becomes `fpRestored = Math.max(0, input.maxFP - (input.starvationFpDebt ?? 0) - input.currentFP)` — rest can never raise FP above `maxFP - debt`. Callers: `RestResolutionPanel.tsx` (and any other `resolveRestRecovery` call site — grep) passes the leader's debt from `entities.starvationFpDebt`. `party/recordMeal` zeroing the debt is what re-opens full recovery.

### Provisioning preview (wizard confirm, design D9)

New util `estimateProvisionDays(state, memberIds: Id[]): { foodUnits: number; days: number; bestCookName: string | null }` — `foodUnits` = total quantity of the same food records `CookingTab` cooks from (locate the food store CookingTab's `foods` come from and count the same way — one ingredient unit feeds one person, matching CookingTab's `stats.total === numPeople` gate at :104); `days = Math.floor(foodUnits / max(1, memberIds.length))`; `bestCookName` = traveling member with the highest `cooking` skill via `getCharacterSkills` (`src/types/characterSheet.ts:626-631`), null if nobody has it. Render in `TravelStep3Confirm` under the C1 duration estimate: "≈N days of ingredients for M travelers — Best cook: X", with an amber warning row when `days < estimatedDays` from `getRouteStats` ("Not enough provisions for the estimated journey").

### Halt-to-cook affordance (`JourneyStatusPanel`)

While the active group's journey exists, show a fed-today indicator (`groupMeals[groupId] === time.day` → "Fed today ✓" else "No meal today") and a button:
- Foot journey, status active: **"Halt & cook"** → `partyPauseJourney({ groupId })` (manual), `setPendingIntent({ kind: 'cook', foodIds: [] })`, `setActiveModule('downtime')` — `DowntimePanel` already routes the `cook` intent to the cooking view (:31-37). The GM cooks, then resumes from the panel; the halted slot is the design's "journey doesn't move that slot".
- Vehicle journey (riders cook underway): **"Cook"** → same intent + navigation, no pause.

## Part 5 — Manager editor + map override (design D22 pattern)

- **`ManagerTab.tsx`**: add `'travelEvents'` to the `ManagerView` union (:38-58), a nav button "Travel Events" beside Vehicles (~:493-495, pick an unused accent color), a router line `{view === 'travelEvents' && <TravelEventsView />}` (~:628-631), and the import.
- **`src/components/manager/views/TravelEventsView.tsx`** (new; follow `GatheringManager`/`TablesView` + `VehiclesView` precedent, sub-nav pattern from `GatheringManager.tsx:199+` if you want Tables/Sets tabs):
  - **Tables**: list (name, entry count, builtin badge) → editor: name/description; entry rows with kind `<select>`, weight number input, name, description, hazard inputs (lostMiles number, fp/hp formula text inputs) shown when kind='hazard', encounter template `<select>` over `entities.encounterTemplates` (plus "— none —") when kind='encounter', condition gates (weather multi-select over the `WeatherType` values, Night-only + Forced-march-only checkboxes). Add/remove entry, save via `party/upsertTravelEventTable`, delete with tombstone semantics for builtins.
  - **Sets**: list → editor: name; a 9-row grid of preset terrains (id → display name from `createPresetTerrains()` / `PRESET_TERRAIN_IDS`, `constants/map.ts:216-226`) each with a table `<select>`; fallback table select. Save/delete via the set actions.
- **`MapHeader.tsx`**: a "Travel events" `<select>` beside the weather-table select (:264-265 pattern) writing `travelEventTableSetId` through `onUpdateMapSettings`; options = sets from state + "Default".

## Part 6 — Persistence, hydration, migration

- **Schema 1.6.0** (Phase 14 completion): bump `CURRENT_SCHEMA_VERSION` (`schemaVersioning.ts:16`), metadata entry (`name: 'Travel Events & Provisioning'`, `migratesFrom: ['1.5.9']`), register `'1.5.9:1.6.0': migrateTo1_6_0` in `dataMigrations.ts`. Migration is defensive only: drop `travelEventTableSetId` from maps when the set id is absent AND not the default seed id; drop `encounterTemplateId` from entries whose template no longer exists; both idempotent, never throw on partial data.
- **`ensureTravelEventTables(state)`** in `src/persistence/dataMigration.ts` (identity-contract pattern of `ensureTravelGroups`): seeds every builtin table + the default set whose id is not tombstoned in `deletedBuiltinTravelEventIds` (clone-in, same as vehicle-type seeding); guarantees `groupMeals`/`starvationFpDebt` records exist as `{}`. Chain into `hydrateCampaignState` after `ensureJourneyIntegrity`.
- Round-trip: extend `serializationRoundTrip.test.ts` — custom event table + set, map override id, groupMeals + starvation debt survive serialize→hydrate; checkpoint restore preserves them (they live in `entities`, which rollback already restores — just assert it).

## Part 7 — Tests (≥ 30 new)

1. `src/utils/__tests__/travelEvents.test.ts` — resolution precedence (map override → default set → null; dangling table/set ids fall through; tombstoned default set → null; custom terrain → fallback), weighted roll (mock `Math.random`: boundaries between entries), condition gating (weather type, nightOnly, forcedMarchOnly), 'nothing' → null, all-ineligible → null, zero/negative weights dropped.
2. `journeyEngine` event tests (extend C1's `journeyEngine.test.ts`) — flavor logs; hazard lostMiles floors at 0; fp/hp dice applied per member (mock random), FP floored at 0, HP allowed negative, gcsData-less member skipped; encounter pauses + sets intent with template id and groupId; camp slots never roll; two groups + two encounters → both paused, intent is last group's; resume blocked while combat active, allowed after.
3. Provisioning — `handleJourneyDayBoundary`: fed group untouched; unfed traveling group loses 1 FP/member + debt increments; non-traveling group ignored; forced-march group follows the same ledger check; `party/recordMeal` stamps day + zeroes member debt; recovery cap (`resolveRestRecovery` with debt 2 caps FP at max−2); `estimateProvisionDays` math + best cook; CookingTab success path records the cook's group meal (component test — assert `partyRecordMeal` effect via state).
4. Hand-off — `CombatTab` forces setup view on encounter intent; `EncounterSetup` loads the template, prefills name, clears intent; dangling template id clears intent without crashing.
5. Manager/UI smoke — TravelEventsView renders tables + saves an entry edit; MapHeader select writes `travelEventTableSetId`; JourneyStatusPanel shows encounter banner + fed indicator (component tests, jsdom).
6. Migration/ensure/round-trip per Part 6.

Fix all fallout in existing tests without weakening unrelated assertions.

## Definition of done — self-verify before finishing

```
npx tsc --noEmit                      # 0 errors
npx vitest run                        # full suite green
grep -rn "as any" src/ --include="*.ts" --include="*.tsx" | grep -v __tests__ | wc -l   # not higher than before
```

If something unrelated is red on a clean checkout, note it and leave it.

## Out of scope (deliberate)

- A dedicated Travel tile/view in the downtime tab and a `TravelTaskCard` — travel occupancy already surfaces through the party sidebar (`ACTIVITY_DISPLAY_NAMES` 'Traveling' badge) and the changelog `travel.*` family; travel tasks are engine-owned and uneditable by design (D10).
- Water tracking, cargo ledgers, per-group hidden reveal, settlement generator — Phase 14 out-of-scope list.
- Auto-resume after combat ends (GM resumes from the panel), auto-halting the journey when an encounter's combat starts (the pause IS the halt).

## Final summary requested

One paragraph: how the event roll integrates with the C1 tick order; how you kept the single `pendingIntent` slot sane with multiple paused groups; where the provisioning ledger hooks into CookingTab and whether the food-unit counting matched CookingTab's ingredient gate cleanly; and anything about the Manager editor that deviated from the Gathering precedent.
