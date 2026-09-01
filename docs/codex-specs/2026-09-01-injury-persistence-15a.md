# Spec: Phase 15a — Combat Injury Persistence (conditions, crippled limbs, death)

**Date:** 2026-09-01
**Repo:** GURPS VTT (React 18 + TypeScript strict + Vite, Redux-style state with Immer, Vitest/jsdom)
**Branch:** you are on `codex/injury-persistence`. Commit nothing; leave all changes in the working tree.
**Design doc (read first — the authority on intent):** `docs/INJURY_PERSISTENCE_15A_PLAN.md` (14 numbered decisions). If this spec and the plan conflict, flag it in your final summary instead of silently picking one.
**Pre-flight (required):** read the plan, then: `src/types/combatTracker.ts` (Participant ~L59–108, ConditionInstance ~L43–58), `src/constants/conditions.ts` (12-entry catalog, ~L79–199), `src/utils/conditionsEngine.ts` (createConditionInstance L59, tick/expiry helpers), `src/components/combat/PostCombatSummary.tsx` (buildCombatSummary L44–87, sync effect L262–297), `src/components/combat/EncounterSetup.tsx` (partyCharacterToCombat — the participant literal with `conditions: []`, `crippled: []`, `isDead: false`, and the "Add All Party" handler), `src/types/campaign.ts` (Character ~L55–77), `src/components/downtime/views/CharacterStatusBadge.tsx`, `src/state/downtime/downtimeSelectors.ts` (selectCharacterSlotSummary ~L725–760), `src/unified/UnifiedShell.tsx` (isUnavailable ~L457 and its consumers), `src/components/downtime/views/RestActivity.tsx` (handleFinalize L103–127) + `src/utils/recovery.ts`, `src/utils/effectsEngine.ts` (crippled location keys, isDead application). Line numbers approximate — locate by name.

## Background (why)

Combat tracks conditions, crippled limbs (`Participant.crippled: string[]` of hit-location keys), and death (`isDead`), but the post-combat sync writes only `gcsData.pools.HP/FP`. Everything else evaporates: a GM-concealed poisoning is gone by the next scene, an amputation heals silently, and a dead party character stays in the party column assignable to fishing tasks at −8 HP. This lane persists that state onto the party `Character`, closes the loop back into the next combat, and gives death and unconsciousness teeth in downtime.

## Architecture rules (non-negotiable)

- `strict: true` stays clean: `npx tsc --noEmit` → 0 errors. **No new `as any`.** `import type` for type-only imports.
- State logic in reducers/utils, never components (pure helpers in `src/utils/` are fine and preferred for the persist/seed transforms so they are unit-testable).
- Do not run `npm install`. Copy neighboring patterns (badge components, Tailwind, testids).
- Persistence is **party-only**: participants with `isFromParty && partyCharacterId`. Library participants (`libraryId`) are reusable templates — never persist onto them.

## Part 1 — Types

### 1a. `src/types/campaign.ts` — `Character` gains:

```ts
/** Persistent injury state carried between combats (Phase 15a). Top-level on purpose:
 * gcsData is draft-edited wholesale by panels and overwritten by GCS re-import. */
status?: CharacterStatus;
```

```ts
export interface PersistedCondition {
  instanceId: string;
  conditionId: string;
  label: string;
  severity?: number;
  source?: string;
  notes?: string;
  /** GM concealment state (12a.6) — survives the combat boundary. */
  revealed?: 'closed' | 'half' | 'open';
}

export interface CharacterStatus {
  /** Open-ended: last until cleared (GM editor, or the rest wake-up rule for 'unconscious'). */
  conditions?: PersistedCondition[];
  /** Hit-location keys, same vocabulary as Participant.crippled (armR/armL/legR/legL/hand/foot). */
  crippled?: string[];
  dead?: boolean;
}
```

(If `revealed`'s union already has a named type near ConditionInstance, reuse it via `import type` rather than re-declaring.)

### 1b. `src/constants/conditions.ts`

Every catalog entry gains `persistsAfterCombat: boolean`. Values: **true** for `poisoned`, `unconscious`, `blinded`; **false** for `stunned`, `prone`, `grappled`, `bleeding`, `burning`, `slowed`, `haste`, `shielded`, `fatigued`. Export a lookup helper if one doesn't fall out naturally (e.g. `conditionPersistsAfterCombat(conditionId: string): boolean`, default **false** for unknown ids).

## Part 2 — Persist/seed transforms (`src/utils/injuryPersistence.ts`, new file)

Pure functions, no store access:

```ts
/** Filter a participant's end-of-combat conditions down to what persists, trimmed. */
export function buildPersistedConditions(conditions: ConditionInstance[] | undefined): PersistedCondition[];
```
Rules: drop conditions already expired (an expired condition should have been removed by the tick engine, but filter defensively: an `expiresAt` of `{type:'turn', turnsRemaining <= 0}` or a round expiry in the past relative to nothing you can see — simply trust the array as live, and additionally drop `expiresAt?.type === 'endOfCombat'` entries); keep only ids where the catalog says `persistsAfterCombat`; map to the trimmed `PersistedCondition` shape (carry `instanceId, conditionId, label, severity, source, notes, revealed`; include optional fields only when defined).

```ts
/** Build the status object a party character should carry after this combat. Replace semantics. */
export function buildCharacterStatus(participant: Participant): CharacterStatus | undefined;
```
Returns `{ conditions, crippled, dead }` with: `conditions` from `buildPersistedConditions`, `crippled` copied when non-empty, `dead: true` when `participant.isDead`. Omit empty/false members. Return `undefined` when everything is empty/false — an all-clear combat leaves `status` absent, not `{}` (assign `undefined` to clear a previously-set status: replace semantics, plan decision 5).

```ts
/** Seed a character's persisted status into a fresh combat participant. */
export function seedParticipantFromStatus(status: CharacterStatus | undefined): { conditions: ConditionInstance[]; crippled: string[] };
```
Conditions become full `ConditionInstance`s with `duration: { type: 'permanent' }` and `expiresAt: null` (use `createConditionInstance` from `src/utils/conditionsEngine.ts` if its signature fits, else construct literals matching its output shape), preserving `instanceId`, `revealed`, `severity`, `source`, `notes`. `crippled` is copied. Dead characters are not seeded (they are filtered upstream, Part 4) — but this function must still behave sanely if called with `dead: true` (just seed conditions/crippled).

## Part 3 — Post-combat sync (`src/components/combat/PostCombatSummary.tsx`)

Extend the existing sync effect (~L262–297), same channel, same one-shot `syncComplete` guard:
- For each `isFromParty && partyCharacterId` participant, the single `updatePartyCharacter` call now carries **both** the pools update (unchanged) **and** `status: buildCharacterStatus(participant)` — including `status: undefined` when the builder returns undefined (replace semantics must clear stale status; verify `updateCharacter`'s merge in `src/state/campaignStore.tsx` (~L434) actually applies an explicit `undefined` — if it spreads and drops undefined keys, adjust the write so clearing works, e.g. always pass the `status` key and make the store's updateCharacter delete the field when the patch value is undefined; keep the change narrow and test it).
- Do NOT gate the status write on `gcsData` existing — the current sync `return`s early when `!partyChar.gcsData` (~L271); status must be written even for gcsData-less characters (only the pools part needs gcsData). Restructure minimally.
- Dead participants: pools sync as today, plus `status.dead: true`.

## Part 4 — Seeding into combat (`src/components/combat/EncounterSetup.tsx`)

- In `partyCharacterToCombat` (the participant literal currently hardcoding `isDead: false, crippled: [], conditions: []`): call `seedParticipantFromStatus(character.status)` and use its `conditions`/`crippled`. `isDead` stays `false` (dead characters shouldn't normally get here).
- **"Add All Party"** handler: skip characters whose `status.dead` or whose persisted conditions include `unconscious`. Individual add stays untouched (GM override path — plan decision 7).
- Party character list rows: for dead/unconscious characters, show a small inline status hint (e.g. text badge "dead" / "KO") so the skip isn't mysterious — follow the existing row styling; do not disable individual add.

## Part 5 — Downtime gate

- New tiny selector/util (put beside `selectCharacterSlotSummary` in `src/state/downtime/downtimeSelectors.ts` or as a util): `isCharacterIncapacitated(character): boolean` = `status.dead === true || status.conditions?.some(c => c.conditionId === 'unconscious')`.
- `src/unified/UnifiedShell.tsx` `isUnavailable` (~L457): becomes assignment-based OR incapacitated.
- `validateTaskCreation` path (`src/state/downtime/` — locate the leader/helper validation): reject creating a task whose leader or helper is incapacitated, with a clear validation message ("X is dead" / "X is unconscious"). **Exception:** a `rest` task may target an incapacitated character (patients get rested); gate only their use as workers/leaders on non-rest tasks — check how rest tasks assign the sleeper (leaderId) and carve the exception precisely: rest tasks with an incapacitated **leader** are allowed; non-rest tasks are not, and incapacitated helpers are never allowed.

## Part 6 — Recovery

- **Wake-up rule** (`src/components/downtime/views/RestActivity.tsx` `handleFinalize`, ~L103–127): after applying `hpRestored`, if the character's resulting `HP.current > 0` and their `status.conditions` include `unconscious`, the same `updateCharacter` call also writes status with unconscious removed (drop the status field entirely if that empties it and nothing else is set). One site only — no reducer-level coupling on HP writes.
- **GM status editor:** in the party column's "Character options" menu (`src/unified/UnifiedShell.tsx` — locate the Character options button/menu), add a "Status" entry opening a small popover/modal listing the character's persisted conditions (icon + label, reuse the icon lookup from `src/constants/conditions.ts`) and crippled limbs (human labels via `src/utils/hitLocations.ts`), each with a remove ✕; plus a "Mark alive" / "Mark dead" toggle for `status.dead`. All writes via `updateCharacter` with the amended `status` (field dropped entirely when empty). GM-facing; follow existing menu/popover patterns in the shell.

## Part 7 — Display surfaces

- **Party column** (`src/components/downtime/views/CharacterStatusBadge.tsx` + its call site): add — skull badge "Dead" when `status.dead`; "KO" badge when unconscious persisted; a compact indicator when other conditions or crippled limbs exist (e.g. first 2 condition icons + "+N", and a 🦴/label for crippled count) with a `title` tooltip listing names. Dead badge takes precedence visually. Keep it small — this is a badge row, not a panel.
- **Rest view** (`src/components/downtime/views/RestActivity.tsx` recovery strip, ~L45–54 where deficits are listed): per character, also list persisted condition labels and crippled limb labels, read-only.

## Part 8 — Schema

`CURRENT_SCHEMA_VERSION` `1.6.1` → `1.6.2` in `src/utils/schemaVersioning.ts` (entry name like "Injury Persistence", `breaking: false`, `migratesFrom: ['1.6.1']`) + no-op migration `1.6.1:1.6.2` in `src/utils/dataMigrations.ts`, exactly like `migrateTo1_6_1`. No backfill — existing characters simply lack `status`.

## Part 9 — Tests (Vitest, follow neighboring idioms)

Utils (`src/utils/__tests__/injuryPersistence.test.ts`, new):
1. Persist filter: catalog-flagged ids kept, non-flagged dropped, `endOfCombat`-expiry dropped, unknown ids dropped; trimmed shape exact (no round/turn fields); optional fields only when defined.
2. `buildCharacterStatus`: all-clear → `undefined`; dead-only → `{dead: true}`; crippled copy; combined.
3. Seed round trip: status → participant conditions (permanent duration, null expiry, revealed/severity/source/notes preserved) + crippled; `undefined` status seeds empty.

Component/integration:
4. PostCombatSummary sync writes status alongside pools for party participants; **clears** stale status when combat ends clean (character had status going in — assert the replace semantics through the real store); library participants untouched; gcsData-less character still gets status.
5. EncounterSetup: party character with status seeds participant conditions/crippled (extend existing EncounterSetup tests in `src/components/combat/__tests__/CombatComponents.test.tsx`); Add All Party skips dead and unconscious characters.
6. Gate: `isCharacterIncapacitated` truth table; task-creation validation rejects incapacitated leader on non-rest task, allows on rest task, rejects incapacitated helper always; `isUnavailable` reflects incapacitation.
7. Wake-up rule: rest finalize with resulting HP > 0 removes unconscious (and drops empty status); HP ≤ 0 leaves it; character without unconscious unaffected.
8. Badges: CharacterStatusBadge renders skull/KO/condition indicator from status.
9. Status editor: removing a condition/crippled entry writes the amended status; removing the last drops the field; dead toggle works.

## Definition of done — self-verify before finishing

1. `npx tsc --noEmit` → 0 errors.
2. `npx vitest run src/utils/__tests__/injuryPersistence.test.ts src/components/combat/__tests__ src/state/downtime src/components/downtime/views/__tests__ src/utils/__tests__/conditionsEngine.test.js src/utils/__tests__/schemaVersioning.test.ts src/__tests__/combatIntegration.test.ts src/utils/__tests__/exportImport.test.ts 2>&1` — all pass; do not weaken existing assertions (the combat view filter and conditions engine suites are load-bearing).
3. Fix failures yourself before finishing.

## Final summary requested

One paragraph on decisions made within the spec's degrees of freedom — especially how you handled `updateCharacter` clearing `status` to undefined (Part 3), the rest-task exception carve in validation (Part 5), and where the status editor landed in the shell. List every file created or modified.
