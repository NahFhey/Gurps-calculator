# Context — GURPS Party Management Tool

> **What this file is.** The *ubiquitous language* for this repo: the shared
> vocabulary used by the code, by Devin (domain expert), and by any agent or
> contributor working here. If a term is in this file, use it exactly as
> defined — in variable names, file names, UI copy, commit messages, and
> design discussion. If you need a word that *isn't* here, that's a signal to
> stop and define it (add it here) rather than inventing a synonym.
>
> **Status tags.** Every term is tagged:
> - `[canonical]` — the current, correct term. Use it.
> - `[legacy]` — still in the code, but superseded. Don't build new code on it; don't reintroduce it.
> - `[in tension]` — the term is overloaded or two systems disagree. See "Collisions & landmines" before touching.
>
> **Scope.** This repo is currently treated as a *single bounded context* —
> one shared language across the whole app. If it ever splits (e.g. the
> multiplayer server grows its own vocabulary), promote this into a context
> map with per-context files. Not needed yet.
>
> **Companion docs.** This file captures *language*. Hard-to-reverse design
> decisions that language can't hold belong in ADRs (`docs/adr/` — not yet
> created). The roadmap (`ROADMAP.md`) holds *sequencing*.
>
> **Maintenance.** Update this file *as you go* during design/grill sessions,
> not afterward. A glossary that has drifted from the code is worse than no
> glossary — when in doubt, re-ground the term against the cited type.

---

## The app in one paragraph

A desktop (Electron) campaign-management tool for running a GURPS 4e tabletop
game. The GM maintains a roster of characters, runs tactical combat, and
resolves between-session "downtime" activities — gathering, crafting, alchemy,
cooking, mining, rest — that consume time, skills, tools, and facilities and
produce inventory. State lives in a single Redux-style store, persists locally
(IndexedDB / SQL.js), and can optionally sync to a multiplayer server so
players see a filtered view.

---

## Core architecture terms

**CampaignState** `[canonical]` — The single root state type for the whole
app. Defined in `src/state/campaignReducer.ts`. Top-level keys: `ui`, `meta`,
`entities`, `legacy`, `time`, `inventory`, `crafting`, `alchemy`, `gathering`,
`dayPlanner`, `activities`, `logs`, `checkpoints`, `combat`, `locations`,
`downtime`, `maps`, `multiplayer`.

**CampaignStore** `[canonical]` — The React layer *around* `CampaignState`:
the provider, the `useCampaignStore()` hook, and the bound `actions`. Defined
in `src/state/campaignStore.tsx`. "The store" means this. Access state through
`useCampaignStore()` — never through the bridge contexts in `src/contexts/`.

**entities** `[canonical]` — The slice of `CampaignState` holding normalized
domain data — mostly `Record<Id, T>` maps (characters, materials, foods,
crafts, alchemy*, gathering*, combat*, tools, facilities, inventories). Note:
a few members (`foodTypes`, `materialTypes`, `cookingSkills`) are *arrays*,
not maps, despite living under `entities`. The README's "`collections/`"
grouping is descriptive shorthand — there is no literal `collections` key.

**Id** `[canonical]` — `type Id = string`. The universal entity identifier.
Re-declared in several type files (`campaign.ts`, `location.ts`,
`partyTool.ts`) — same meaning everywhere.

**LegacyAppState** `[legacy]` — `Record<string, unknown>` escape hatch parked
at `state.legacy.appState`. Holdover from the pre-unification app. Don't add
to it.

**Tab** `[canonical]` — A top-level app module / screen, e.g. `CombatTab`,
`InventoryTab`, `ManagerTab`, `DayPlannerTab`. Selected via
`ui.activeModule`. ("Module" is the state-level word; "Tab" is the
component-level word for the same thing.)

**View** `[canonical]` — An extracted sub-component *inside* a Tab, living in
a `…/views/` folder (e.g. `manager/views/`, `combat/views/`). Product of the
"thin router + view component" decomposition pattern: the Tab routes, the
Views render. Target size under ~500 lines.

**Shell / UnifiedShell** `[canonical]` — The app frame (`src/unified/
UnifiedShell.tsx`) — header, tab routing, character pane. "The shell" means
this.

**Checkpoint** `[canonical]` — A user-triggered save/restore snapshot of
`CampaignState`, stored in `state.checkpoints`. Distinct from the automatic
IndexedDB persistence. Not the same as combat undo/redo history.

---

## People & roles

**Character** `[in tension]` — The canonical roster entity: a person/creature
in the campaign. Defined in `src/types/campaign.ts` (`id`, `name`,
`isPlayer?`, `work`, optional `gcsData`, `hitLocationProfileId`). Stored in
`entities.characters`. **Three other types are also named `Character`** — see
Collisions.

**Player character / PC** `[canonical]` — A `Character` with `isPlayer ===
true`. Per `spec.md`, only Players may act as activity leaders or helpers;
allies, enemies, and objects are excluded from activity work.

**Worker** `[legacy]` — The pre-unification word for a person performing an
activity. The design explicitly *replaced* abstract "workers" with player
characters (`spec.md` §1; `entities.characters` is commented "merged workers +
party characters"). Still pervasive in code: the `Worker` type
(`src/types/views.ts`), `WorkersView`, `WorkersPanel`, `worker: string` fields
on `CraftShift` / `GatheringSession` / alchemy shift records, and
`primaryWorkerId` / `leaderWorkerId` / `assignedWorkerIds`. **Treat "worker"
as "a Character acting in an activity."** New code should say *leader* /
*helper*, not *worker*.

**Leader** `[canonical]` — The primary Character responsible for a downtime
task. Field: `DowntimeTask.leaderId`. (Older systems call this "primary
worker.")

**Helper** `[canonical]` — A Character assisting a task's leader. Field:
`DowntimeTask.helperIds`. Must also be a Player and must have the relevant
skill.

**Work / WorkSettings** `[canonical]` — The opt-in block on a `Character`
(`work: { enabled?, skills: Record<string, number> }`) declaring which
activity skills that character can contribute and at what level.

---

## Combat

**CombatCharacter** `[in tension]` — A combat *library* entry: a reusable
stat block (PC or NPC) kept in `entities.combatCharacters`, ready to be
dropped into an encounter. Defined in `src/types/campaign.ts`.

**Participant** `[canonical]` — A character *instantiated into a running
combat* — has an `instanceId`, live `hp`/`fp`/`mp`, conditions, position,
turn state. Defined in `src/types/combatTracker.ts`. The distinction that
matters: a `CombatCharacter` is the template; a `Participant` is one
appearance of it in one fight. Two participants can share a `libraryId`.

**CombatSession** `[in tension]` — A whole combat encounter plus its outcome
and log, as stored in campaign state (`combat.activeSession`,
`combatHistory[]`). Defined in `src/types/campaign.ts`.

**CombatState** `[in tension]` — The CombatTracker's own working shape for the
fight in progress (`participants`, `turnOrder`, `currentRound`,
`turnDecisions`, `log`). Defined in `src/types/combatTracker.ts`. *Appears* to
be a different-layer representation of the same fight as `CombatSession` —
**confirm the relationship before treating them as interchangeable** (open
question below).

**Encounter** `[canonical]` — A planned fight. `combat.encounterId` references
one; `EncounterSetup` builds them; encounter templates are reusable
pre-builds. The running encounter is the `CombatState` / `CombatSession`.

**Maneuver** `[canonical]` — A GURPS combat action choice for a turn (Attack,
Aim, Wait, etc.). Defined in `src/types/combatTracker.ts`; catalog in
`src/constants/maneuvers.ts`. Selected per turn via `TurnDecision`.

**Turn / Round** `[canonical]` — `Round` = one full cycle through
`turnOrder`; `Turn` = one participant's slice of a round. Tracked by
`currentRound` / `currentTurnIndex`.

**Condition** `[canonical]` — A status effect on a participant
(`ConditionInstance`, catalog in `src/constants/conditions.ts`). Has an
`instanceId`, optional `duration`, optional `source`.

**Reveal state** `[canonical]` — Per-participant control over what players can
see (name / HP / defenses shown as exact, band, or unknown). `RevealState` in
`src/types/combatTracker.ts`; `combat.revealState` in campaign state. Powers
the GM-vs-player combat view split.

**Hit location profile** `[canonical]` — A named set of hit locations a
character's body uses (`HitLocationProfile`, currently only `'humanoid'`).
`Character.hitLocationProfileId` selects it.

**Tombstone** `[canonical]` — A removed/dead `CombatCharacter` retained in
`entities.combatTombstones` rather than deleted.

---

## Time & scheduling

**Day / Slot** `[canonical]` — Game time is `{ day, slot }`. A day has
`SLOTS_PER_DAY` slots (3: morning / afternoon / evening, per
`time.slotLabels`). `slot` is a 0-based index. `dayKey` is the same as `day`,
used as a record key.

**Advance time** `[canonical]` — Moving the clock forward one slot
(`advanceTime` action / `advanceTimeSlot`). On advance, **all tool
reservations and equipment selections clear** and activities must be
reconfigured. Can be *blocked* — see `ui.blockingError` and unresolved
downtime tasks.

**Day Planner** `[in tension]` — The scheduling subsystem under
`state.dayPlanner` + `src/components/dayplanner/`. Uses *its own*
`TaskAssignment` type, `TimeSlot`, and `PendingDayLedger` from
`src/types/dayplanner.ts`. Task lifecycle: `Draft → Resolving → Completed`;
modes limited to `Fishing | Foraging`. **Appears older than the Downtime
system** and overlaps it heavily — see Collisions and open questions.

**Downtime** `[canonical]` — The newer "unified downtime task system"
(its own header's words) under `state.downtime` + `src/components/downtime/`.
Defined in `src/types/downtime.ts`. Has schema versioning + migrations. This
is where new between-session activity work should go.

**DowntimeTask** `[canonical]` — The core downtime entity: one scheduled
activity for one `{ day, slot }`, with a `leaderId`, `helperIds`, a
`status` (`pending | in_progress | resolved | cancelled`), and a
discriminated-union `activityData`. Stored in `downtime.tasksById` /
ordered by `downtime.taskOrder`.

**DowntimeActivityType** `[canonical]` — `fishing | foraging | mining |
alchemy | crafting | rest`. The activity kinds the Downtime system resolves.
(Note: *not* the same set as Day Planner's `TaskMode` or campaign.ts's
`TaskAssignment.taskType` — see Collisions.)

**Ledger / PendingDayLedger** `[in tension]` — A buffer of not-yet-committed
results for a day. **Defined twice** with different shapes — `DayLedger` in
`campaign.ts` vs `PendingDayLedger` in both `dayplanner.ts` and `downtime.ts`.
Treat carefully.

**Activity** `[in tension]` — As a *concept*: any skill-driven, time-consuming
non-combat action (gathering, crafting, etc.). As a *state slice*:
`state.activities` is specifically the **legacy "Activities Panel"** data
(`partyToolState`, `primaryWorkerId`, `helperIds`, `gmOverride`, …). Don't
confuse the concept with the legacy slice.

---

## Tools, facilities, equipment

**ToolTemplate** `[canonical]` — A *definition* of a kind of tool, with
per-activity-category modifier sets (`ToolModifierSet`: `skillBonus`,
`yieldFlat`, `yieldPercent`, `timeBonus`, `riskModifier`, `qualityModifier`).
Lives in `entities.toolTemplates`. Authored in the Templates area of Manager.

**ToolInstance** `[canonical]` — A *specific physical tool*: a persistent
`toolId`, a `templateId`, a `conditionId`, optional owner. Tools are distinct
instances, **not stacks**. The `toolId` persists across transfers, logs, and
reservations. Lives in `entities.toolInstances`.

**Tool condition** `[canonical]` — A GM-managed label on a tool
(`toolCondition` / `Facility.conditionId`) — e.g. "good", "worn", "broken".
Labels only, no automatic math. Selecting a *broken* tool or facility
**hard-stops** the activity.

**GatheringTool** `[in tension]` — A *different, simpler* "tool": a flat
`{ skillBonus, yieldBonus, durability }` record in `entities.gatheringTools`,
**not** instance/template-based. When code says "tool" in a gathering context
it may mean this, not a `ToolInstance` — see Collisions.

**Tool reservation** `[canonical]` — A claim on a `ToolInstance` (by `toolId`)
for an activity. `entities.toolReservations: Record<Id, string[]>`. Reserved
tools are invisible elsewhere, can't be deleted, and **all reservations clear
on time advance**.

**Facility** `[in tension]` — The *unified* fixed-location modifier source —
`facilityType: kitchen | lab | workshop | general`, a `rating`, optional
per-activity-category modifiers. `entities.facilities`. One facility per
activity; stacks with tools.

**Kitchen / AlchemyLab** `[legacy]` — The pre-unification per-domain facility
types (`entities.kitchens`, `entities.alchemyLabs`), each just `{ name,
rating, description }`. Superseded by `Facility`; still present in state.

**Inventory** `[canonical]` — A first-class container: `ownerType: 'party' |
'character'`, an `ownerId`, `currency`, `items`, `tools`, `materials`,
`food`. Every character has a personal inventory; there is one party
inventory. `entities.inventories`.

**Currency** `[canonical]` — GM-defined named currencies, held per-inventory.
Transfers are logged (`CurrencyLog` / `currencyLogs`), final, and **not
undoable**.

**Basic +0 Tool** `[canonical]` — The explicit "no tool" entry — performing
an activity barehanded with no modifiers. Activities always allow it
(`spec.md`: "no forced realism").

---

## Crafting, alchemy, gathering

**Craft** `[in tension]` — A *multi-phase, persistent crafting project*:
`phase: setup → design → craft → complete`, accumulated `shifts`, a
`startDay` and `completedDay`. `entities.crafts`. Driven by `CraftingTab` /
`CraftingWorkbench`. **Directly contradicts** the Downtime crafting model —
see Collisions.

**CraftShift** `[canonical]` — One work session logged against a `Craft`:
worker, roll, effective skill, hours added, quality shift.

**CraftDesign** `[canonical]` — A saved, reusable crafting plan (template +
materials + mods) that hasn't been started as a `Craft` yet.
`entities.craftDesigns`.

**Template (crafting)** `[canonical]` — A blueprint for a craftable item —
`WeaponTemplate`, `ArmorTemplate`, `RangedTemplate`, `ExplosiveTemplate`,
grouped in `CustomTemplates`. Note "template" also means `ToolTemplate` and
"encounter template" — usually disambiguated by context.

**Reagent / AlchemyReagent** `[canonical]` — An alchemical ingredient.
Carries `aspects` (`primary` / `secondary` / `tertiary`), a `refinement`
level (`crude | prepared | refined`), `basePotency`, `roles`, `hazards`, and
an optional `falseProfile` (the GM-facing fake identity until identified).

**Formula / AlchemyFormula** `[canonical]` — A recipe for a potion: an
ingredient list plus computed stats (`tier`, `potencyLoad`, `vector`,
dominant/secondary aspect, traits, hazards).

**Batch / AlchemyBatch** `[canonical]` — An in-progress or finished brew of a
`Formula`: `status: brewing | complete | failed`, work shifts, hazard events,
analysis (`forecast`, `microAssay`).

**Aspect** `[canonical]` — An alchemical property axis on reagents and
formulas (`primary` / `secondary` / `tertiary`). Drives potion behavior.

**GatheringSpecies** `[canonical]` — A catalog entry for something gatherable
— `category: fish | game | plant`, base yield, skill, difficulty,
environments.

**GatheringEnvironment** `[canonical]` — A place where gathering happens; ties
species to a location (`locationId`) for auto-selection in downtime.

**GatheringSession** `[in tension]` — A single gathering attempt
(`type: fishing | foraging | hunting`, worker, day/slot, results). Note:
"session" collides with `CombatSession` and the multiplayer `SessionInfo` —
see Collisions.

**Forage Zone Profile** `[canonical]` — The *revamped* foraging data model
(`forageZoneProfiles`, `forageItems`, `foragingConfig`). The Downtime
`ForagingData.zoneId` points at one. Supersedes the older
`biomeId` / `nodeId` / `tableId` foraging fields (still kept for save
compatibility, marked `@deprecated` in code).

**Mining Site** `[canonical]` — A discovered, mapped deposit (`MiningSite`)
with a size, total/remaining units, quality. Deep Mining extraction requires
one; Surface Prospecting doesn't.

---

## Locations, weather, maps

**Location** `[canonical]` — A GM-authored area of the game world with a
`climate`, `terrain`, weather, modifiers, and connections to other locations.
`locations.locations`; the party is at `locations.currentLocationId`.

**Weather / ActiveWeather** `[canonical]` — `Weather` = a condition + intensity
+ temperature + its effects. `ActiveWeather` = current weather plus duration
tracking. Generated from a `WeatherTable`.

**Travel** `[canonical]` — Movement between locations (`TravelAction`) or
within one (`LocalTravel`). On the map, executed via the Travel Wizard.

**Map / Tile / Terrain / Marker / Link** `[canonical]` — The hex/grid map
system (`state.maps`, `src/types/map.ts`). A `Map` is a grid of `Tile`s, each
with a `Terrain`; `Marker`s are points of interest; `Link`s connect map
features. Distinct vocabulary from `Location` — a Map *visualizes* travel,
Locations are the logical places.

---

## GM, multiplayer, persistence

**GM mode** `[canonical]` — `ui.gmModeEnabled`: whether GM-only tooling and
content are *shown* in the UI.

**GM session unlocked** `[canonical]` — `ui.gmSessionUnlocked` (also seen as
`gmUnlocked`): whether the GM password has been entered *this session* to
decrypt GM content. Distinct from `gmModeEnabled` — one is "show GM stuff,"
the other is "GM content is decrypted."

**GM Lock** `[canonical]` — The encryption-at-rest of GM-only content
(`GMLockModal`, `GMLockData` with `encryptedData` / `iv` / `salt`, AES-GCM).

**GM override** `[canonical]` — A per-activity flag (`gmOverride`) that
bypasses pre-resolution validation. Still applies all modifiers/consumption,
and is **explicitly logged**.

**Role** `[canonical]` — Multiplayer connection role: `gm | player |
spectator` (`shared/session.ts`). Distinct from "GM mode" — Role is *who you
are on the server*, GM mode is *a local UI toggle*.

**Log visibility** `[canonical]` — Every `LogEntry` carries
`visibility: 'gmOnly' | 'player' | 'mixed'`, controlling what the synced
player view shows.

**SessionInfo** `[canonical]` — A *multiplayer connection* session
(`sessionId`, `campaignId`, `joinCode`, `role`). **Not** a play session and
**not** a `CombatSession` / `GatheringSession` — see Collisions.

**GCS** `[canonical]` — GURPS Character Sheet: the *external* desktop app and
its character-data format. `Character.gcsData` (`GCSCharacterData`) holds an
imported sheet; `GCSImportModal` / `src/utils/gcsParser.js` do the import.
When Devin says "GCS" he means the external app's data, brought into this
tool — not this tool's own character sheet UI.

---

## Collisions & landmines

These are the places where one word means several things, or two subsystems
disagree. **Read the relevant entry before writing code that touches them.**

1. **`Character` is declared four times, all different.**
   - `src/types/campaign.ts` — the canonical roster entity. **Use this one.**
   - `src/types/partyTool.ts` — `[legacy]` narrow version (pre-unification).
   - `src/types/combatTracker.ts` — a combat-flavored stat shape
     (`hp`/`fp`/`mp`, defenses, `category`).
   - Plus `CombatCharacter` (campaign.ts) and `Participant` (combatTracker.ts).
   Mental model: **Character** (roster) → **CombatCharacter** (combat library
   template) → **Participant** (one instance in a running fight).

2. **`TaskAssignment` is declared twice with incompatible shapes.**
   `src/types/campaign.ts` (`taskType` includes `hunting`/`cooking`, status
   `pending|complete|failed`) vs `src/types/dayplanner.ts` (`mode:
   Fishing|Foraging`, worker-ID fields, status `Draft|Resolving|Completed`).
   The reducer's `dayPlanner.taskAssignments` uses the **campaign.ts** one;
   the dayplanner *view* components use the **dayplanner.ts** one. Importing
   "the wrong `TaskAssignment`" will typecheck and still be wrong.

3. **Two parallel scheduling systems: Day Planner vs Downtime.**
   Both are live in `CampaignState` (`dayPlanner` and `downtime`). They have
   different task types, different status enums, different activity sets,
   different ledger types. Downtime is the newer "unified" one and is where
   new work goes — but Day Planner has *not* been removed. Don't assume one is
   dead; see open questions.

4. **Two crafting models that contradict each other.**
   `Craft` (campaign.ts) is a **multi-phase, multi-slot, persistent project**.
   Downtime's `CraftingData` is explicitly **"slot-bounded… NO multi-slot
   project persistence."** Same word, opposite lifecycle. Know which one a
   given component is built on before changing crafting behavior.

5. **"Tool" means two unrelated things.**
   `ToolTemplate`/`ToolInstance` (instanced, reservable, condition-tracked) vs
   `GatheringTool` (flat `skillBonus`/`yieldBonus` record). UI says "tool" for
   both.

6. **"Facility" vs "Kitchen"/"Lab".** `Facility` is the unified `[canonical]`
   type; `Kitchen` and `AlchemyLab` are `[legacy]` per-domain types still in
   state. Also: `Facility` itself is declared in both `campaign.ts` (with
   `facilityType`/`rating`) and `partyTool.ts` (bare) — use the campaign.ts
   one.

7. **"Session" means three things.** `CombatSession` (a fight),
   `GatheringSession` (a gathering attempt), `SessionInfo` (a multiplayer
   connection). No relationship between them.

8. **"GM-" prefix covers five distinct concepts.** GM *mode* (UI visibility),
   GM *session unlocked* (decryption state), GM *Lock* (encryption at rest),
   GM *override* (validation bypass), and `Role.GM` (server identity). They
   are not interchangeable.

9. **"Template" means three things.** Crafting blueprints (`WeaponTemplate`
   etc.), `ToolTemplate`, and combat "encounter templates." Usually clear from
   context — but name new things specifically.

10. **README's state shape is simplified.** It describes "`entities/ /
    collections/ / checkpoints/`." The real `CampaignState` has ~18 top-level
    keys and there is no `collections` key. Trust `campaignReducer.ts`.

---

## Open questions

Things the code alone didn't answer — candidates for a grill session before
related work:

- **Is Day Planner being retired in favor of Downtime, kept as a separate
  feature, or merged?** Both are wired into state today. The answer changes
  whether new gathering/scheduling work touches `dayPlanner` at all.
- **What's the intended relationship between `CombatSession` and
  `CombatState`?** Two representations of one fight at different layers, or
  genuinely separate concerns?
- **Is the `Craft` multi-phase project system staying, or is Downtime's
  single-slot crafting meant to replace it?** They can't both be "the"
  crafting model long-term.
- **Are `partyTool.ts` and `state.activities` (the legacy Activities Panel)
  slated for removal?** They're tagged `[legacy]` here on inference from
  `spec.md` and the "merged workers" comment — confirm.
- **Should "worker" be actively renamed to leader/helper/Character across the
  codebase, or just frozen (no new uses)?**
