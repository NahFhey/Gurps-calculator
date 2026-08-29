# SPEC: 13c — Healing/Recovery: Rest task resolution with HP/FP recovery

**Date:** 2026-08-28
**Design source:** ROADMAP.md Phase 13c bullet "Healing/Recovery (injury recovery
tracking tied to rest activities)". Design decisions below are final; do not
re-litigate them.

## Background (why)

The downtime system has a `rest` activity type: rest tasks can be created (single
and batch) via `RestTaskForm`, but **nothing ever resolves them** — there is no rest
task list, no resolution panel, and resolving a rest task never touches character
HP/FP. Character health lives in `character.gcsData.pools.HP/.FP`
(`PointPool { current, max, points }`, defined in `src/types/characterSheet.ts`).
The only code that writes those pools today is the post-combat sync-back in
`src/components/combat/PostCombatSummary.tsx` (~lines 280–315) — follow that exact
update pattern for pool writes.

This lane closes the loop: resting characters recover FP, and a night's sleep makes
the GURPS B424 natural-recovery roll for HP, with an optional physician improving it.

Codebase rules (non-negotiable):
- Strict TypeScript: `strict: true`, `npx tsc --noEmit` must pass clean. **No new
  `as any` casts anywhere, including tests. No `@ts-ignore` / `@ts-expect-error`.**
- Redux-style state with Immer. Components access campaign state via
  `useCampaignStore()` from `src/state/campaignStore.tsx`; downtime state via
  `useDowntimeContext()` from `src/components/downtime/DowntimeContext.tsx`.
- No new bridge contexts. No business logic in components — put it in
  `src/utils/recovery.ts` and selectors.
- Use `import type` for type-only imports.
- Match the visual style of the existing downtime views (dark Tailwind classes,
  `data-testid` attributes on interactive elements).

## Game rules being implemented (GURPS B424, simplified for this app)

- **FP recovery:** any rest task (all three `restType`s) restores FP to max on
  resolution. (GURPS: 1 FP per 10 min of rest; a time slot is hours, so full.)
- **HP natural recovery:** only a `restType: 'sleep'` task makes the daily recovery
  roll, and only if the character spent the whole day resting (no non-rest tasks on
  the same `dayKey`) — the GM can override this gate in the resolution panel. Roll
  3d6 vs (HT + recoveryBonus + 1 if physician check succeeded). Success → recover
  1 HP; success with a successful physician check → 2 HP. Failure → 0 HP. Never
  exceed `maxHP`; never roll when already at full HP.
- **Physician:** a rest task may name a healer (`healerId`). If the healer has the
  Physician skill, the panel first rolls 3d6 vs their skill level; success gives
  +1 to the recovery target AND doubles recovered HP (1 → 2) on a successful
  recovery roll. First Aid skill does NOT help natural recovery (it is a
  post-combat concept elsewhere in the app) — only Physician counts.

## Deliverable 1: `src/utils/recovery.ts` (new file, pure logic)

```ts
import type { HealingEstimate } from '../types/combatTracker';
import type { RollVsTargetResult } from './dice';

/** Days-to-full estimates. MOVED VERBATIM from calculateHealingEstimate in
 *  PostCombatSummary.tsx — same formula, but taking raw numbers: */
export function estimateHealing(hpLost: number, fpLost: number): HealingEstimate;
// daysToFullHP: max(0, hpLost)  (1 HP/day)
// daysToFullFP: fpLost > 0 ? max(1, ceil(fpLost * 10 / 60 / 24)) : 0
// firstAidEstimate: { min: max(0, min(hpLost, 1)), max: min(hpLost, 4) }

/** Physician skill level for a character, 0 if none.
 *  Use getCharacterSkills() from '../types/characterSheet'; check keys
 *  'physician' then 'Physician'; return the higher, floor 0. */
export function getPhysicianLevel(character: CharacterLike): number;
// CharacterLike: define a minimal structural type compatible with Character
// (getCharacterSkills already accepts `any`-ish input; do NOT add `as any`).

export interface RestRecoveryInput {
  restType: 'sleep' | 'light_rest' | 'meditation';
  recoveryBonus: number;
  ht: number;
  currentHP: number;
  maxHP: number;
  currentFP: number;
  maxFP: number;
  /** true when the character has no other non-rest, non-cancelled tasks that day,
   *  OR the GM checked the override box */
  restedFullDay: boolean;
  /** physician skill level of the assigned healer; 0/undefined = no physician */
  physicianLevel?: number;
}

export interface RestRecoveryResult {
  fpRestored: number;              // maxFP - currentFP, floored at 0
  hpRollMade: boolean;             // true only when the recovery roll happened
  physicianRoll?: RollVsTargetResult;
  physicianSuccess?: boolean;
  recoveryTarget?: number;         // ht + recoveryBonus + (physicianSuccess ? 1 : 0)
  recoveryRoll?: RollVsTargetResult;
  hpRestored: number;              // 0, 1, or 2 — clamped so currentHP+hpRestored <= maxHP
}

export function resolveRestRecovery(input: RestRecoveryInput): RestRecoveryResult;
```

- Use `rollVsTarget('3d6', target)` from `src/utils/dice.ts` for both rolls.
- Recovery roll preconditions (`hpRollMade`): `restType === 'sleep'` AND
  `restedFullDay` AND `currentHP < maxHP`. Physician roll happens only when the
  recovery roll will be made and `physicianLevel > 0`.
- `rollVsTarget` returns `{ success, ... }` — use its `success` field, do not
  re-derive success from totals.
- Clamp `hpRestored` so the pool never exceeds max (e.g. 1 HP below max +
  physician double → restore 1, not 2).

## Deliverable 2: refactor `PostCombatSummary.tsx` to use `estimateHealing`

- Delete the local `calculateHealingEstimate` and compute
  `estimateHealing(summary.maxHP - summary.endHP, summary.maxFP - summary.endFP)`
  at its one call site. Behavior must be identical — the existing
  `src/components/combat/__tests__/PostCombatSummary.test.tsx` suite must pass
  unchanged (do not edit that test file).

## Deliverable 3: `RestData.healerId` + physician skill key

- In `src/types/downtime.ts`, extend `RestData` with
  `healerId?: string | null;` — doc comment: "Character providing medical care
  during this rest. Deliberately NOT a helper: helpers are slot-locked to one task,
  but one physician may tend several patients in the same slot." Optional field →
  no downtime schema migration needed.
- In `src/types/characterSheet.ts`, add `'Physician': 'physician'` to
  `GURPS_TO_ACTIVITY_KEY` so GCS-imported sheets expose the lowercase key.

## Deliverable 4: downtime selector for the full-day-rest gate

In `src/state/downtime/downtimeSelectors.ts`:

```ts
/** True if the character leads or helps any non-rest, non-cancelled task on dayKey. */
export function selectCharacterHasNonRestTasksForDay(
  state: DowntimeState,
  characterId: string,
  dayKey: number
): boolean;
```

## Deliverable 5: changelog wiring

- In `src/utils/activityLogger.ts`: widen `createActivityLogEntry`'s first
  parameter union with `'rest'`, and add a `restLog` creator family following the
  existing style:
  - `restLog.taskCreated(characterName, restType, meta?)` — message like
    `"Kara scheduled sleep"` / type `rest.task_created`
  - `restLog.recoveryResolved(characterName, hpRestored, fpRestored, meta?)` —
    message like `"Kara recovered 1 HP and 4 FP"` (omit zero parts naturally:
    "recovered 4 FP", "recovered nothing") / type `rest.recovery_resolved`
- In `src/components/ChangelogTab.tsx`: add `'rest'` to `ACTIVITY_FAMILIES`.

## Deliverable 6: UI — Rest activity views

Mirror the structure/conventions of the existing Mining views
(`MiningActivity.tsx`, `MiningTaskCard.tsx`, `MiningResolutionPanel.tsx`) — read
them first. New files in `src/components/downtime/views/`:

### `RestActivity.tsx`
- Props: `{ currentDayKey: number; currentSlot: number }`.
- Uses `useDowntimeContext()` for state/characters/actions and
  `useCampaignStore()` for `campaignActions` (`updateCharacter`, `addLogEntry`).
- Layout: header ("Rest & Recovery"), a "New Rest Task" button toggling the
  existing `RestTaskForm`, and the list of rest tasks for the current day+slot
  (`selectTasksForSlot` + `isRestTask` filter) rendered as `RestTaskCard`s.
- Also render a compact **party recovery status** strip above the list: for each
  party character with `gcsData` whose HP or FP is below max, show name,
  `HP cur/max`, `FP cur/max`, and days-to-full from `estimateHealing`. This is the
  "injury recovery tracking" surface. `data-testid="party-recovery-status"`.
- On task creation (submit from `RestTaskForm`): after `createDowntimeTask`,
  dispatch `campaignActions.addLogEntry(restLog.taskCreated(...))` with
  `meta: { characterIds: [leaderId], taskId }` — mirror how other activities log.
  (Look at how `RestCreationView` in `DowntimePanel.tsx` validates + creates
  today and keep that validation behavior.)
- Selecting "Resolve" on a pending card opens `RestResolutionPanel` for that task
  (inline panel or modal — follow the Mining pattern).

### `RestTaskCard.tsx`
- Props: task (narrowed rest task), leader + healer `Character` lookups, callbacks.
- Shows: leader name, rest type label ("Sleep" / "Light rest" / "Meditation"),
  healer name when set (with a small "Physician" tag if `getPhysicianLevel > 0`),
  recovery bonus when non-zero, status badge, and for **pending** tasks a
  "Resolve" button (`data-testid="resolve-button"`).
- For **resolved** tasks: render `task.results.message` and roll detail if present.

### `RestResolutionPanel.tsx`
- Props: the rest task, the leader character, the healer character (or null),
  `onFinalize(results: TaskResults)` and `onCancel` callbacks (parent
  `RestActivity` owns the store dispatches — keep the panel presentational plus
  roll state, like the Mining panel does with its callbacks; if MiningResolutionPanel
  instead dispatches internally, follow whichever pattern it actually uses).
- Content:
  - Patient pools: current/max HP and FP bars.
  - Rest type + modifier breakdown: recoveryBonus, physician (+1 note).
  - Full-day gate: compute `selectCharacterHasNonRestTasksForDay(...)`; when true,
    show a warning ("Kara worked other tasks today — no natural HP recovery") and a
    GM override checkbox (`data-testid="full-day-override"`) that re-enables the roll.
  - "Roll Recovery" button (`data-testid="roll-recovery-button"`) → calls
    `resolveRestRecovery` once and displays: physician roll (if any), recovery roll
    dice + target, HP restored, FP restored. Disable after rolling.
  - "Apply" button (`data-testid="apply-recovery-button"`), enabled only after
    rolling. Apply does, in the parent (or panel — see above):
    1. `campaignActions.updateCharacter(leaderId, { gcsData: { ...gcsData, pools:
       updatedPools } })` — the same nested-spread pattern as the PostCombatSummary
       sync-back. Only when the leader has `gcsData`.
    2. `resolve(taskId, results)` (downtime context) with
       `TaskResults { success: true, message }` — message summarizing e.g.
       `"Slept: recovered 1 HP (rolled 9 vs 12), 4 FP"`. Include roll numbers.
    3. `campaignActions.addLogEntry(restLog.recoveryResolved(...))` with
       `meta: { characterIds: [leaderId], taskId, quantity: hpRestored }`.
  - Leader without `gcsData`: no pool math is possible — show a note and let Apply
    resolve the task with message "No character sheet — recovery not tracked."
- HT source: `leader.gcsData.attributes.HT`.

### `RestTaskForm.tsx` (modify existing)
- Add an optional **Healer** select under the rest-type select
  (`data-testid="healer-select"`): options = party characters with
  `getPhysicianLevel(c) > 0`, excluding the selected leader (in batch mode:
  excluding nobody — the same healer may tend all; but a batch row whose leader IS
  the healer gets `healerId: null` for that task). Label each option
  "Name (Physician-14)". When no physicians exist, render a muted "No physician in
  party" line instead of the select. Selected value goes into
  `activityData.healerId` (null when unset).
- Do not otherwise change form behavior; existing
  `RestTaskForm.test.tsx` must keep passing — extend it, don't rewrite it.

### `DowntimePanel.tsx` (modify)
- Replace the inline `RestCreationView` (and its now-unused imports) with
  `<RestActivity currentDayKey={currentDayKey} currentSlot={currentSlot} />` in the
  `'rest'` view branch, matching the other activities.

### `views/index.ts`
- Export the new components if that file re-exports the others (check it).

## Deliverable 7: tests (Vitest, jsdom; follow existing patterns in
`src/components/downtime/views/__tests__/` and `src/utils/__tests__/`)

1. `src/utils/__tests__/recovery.test.ts` — at least 12 tests:
   - FP restored to max for each restType; 0 when already full.
   - No HP roll for light_rest / meditation / full HP / `restedFullDay: false`.
   - Sleep + rested: success → 1 HP; failure → 0 HP (mock or seed `rollVsTarget`
     by mocking `../dice` — dice rolls are random, so mock the module).
   - Physician: roll made only when level > 0; success adds +1 to target and
     doubles to 2 HP; physician success but recovery failure → 0 HP.
   - Clamping: 1 HP below max with physician double → 1.
   - `estimateHealing`: zero-loss → zeros; hpLost 5 → daysToFullHP 5; firstAid
     min/max formula cases.
   - `getPhysicianLevel`: reads 'physician' and 'Physician' keys; 0 default.
2. `src/state/downtime/__tests__/downtimeSelectors.test.ts` (extend): cases for
   `selectCharacterHasNonRestTasksForDay` — leader hit, helper hit, rest-only day
   → false, cancelled tasks ignored, other days ignored.
3. `RestTaskCard.test.tsx` — pending renders resolve button; resolved renders
   message; healer physician tag.
4. `RestResolutionPanel.test.tsx` — roll then apply happy path (mock dice for
   determinism); full-day gate warning + override; leader without gcsData path.
5. `RestActivity.test.tsx` — renders recovery-status strip and task list; create
   flow logs a changelog entry. Follow `MiningActivity.test.tsx` for
   provider/store mocking.
6. Extend `RestTaskForm.test.tsx` for the healer picker (physicians listed,
   non-physicians absent, "No physician in party" fallback).

## Definition of done (self-verify before finishing)

Run ALL of the following yourself and fix failures before finishing:

```bash
npx tsc --noEmit
npx vitest run src/utils/__tests__/recovery.test.ts
npx vitest run src/state/downtime
npx vitest run src/components/downtime
npx vitest run src/components/combat/__tests__/PostCombatSummary.test.tsx
npx vitest run src/__tests__/combatIntegration.test.ts
```

All must pass with zero failures. Do not modify `PostCombatSummary.test.tsx` or
weaken existing tests. Do not commit anything — leave changes in the working tree.

## Requested final summary

One paragraph on design decisions — especially the pool-write path (exact shape of
the `updateCharacter` payload), how you made dice deterministic in tests, and
anything you deviated from in this spec (deviations must be called out explicitly).
