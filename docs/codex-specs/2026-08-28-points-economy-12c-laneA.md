# SPEC: 12c Lane A — Points economy: awards, ledger, spend cart

**Date:** 2026-08-28
**Design source:** `docs/CHARACTER_LIFECYCLE_12C_PLAN.md` (decisions final; do
not re-litigate). Read it first. Also read AS-BUILT before coding:
`src/components/character-sheet/SkillHistorySection.tsx` (the manual Record
Advancement flow you will refactor onto a shared helper),
`src/utils/study.ts` + `src/components/downtime/views/StudyActivity.tsx`
(Study's award path, merged before this dispatch — refactor it onto the same
helper), `src/components/character-sheet/AttributesSection.tsx` /
`SecondaryAttributesSection.tsx` / `PointPoolsSection.tsx` (scattered cost
constants you will extract), and `src/components/character-sheet/CharacterSheet.tsx`
(the draft-then-commit editing idiom and its inline totals memo).

## Background (why)

The app has no advancement economy: no earned-points pool, no award moment, no
cost-enforced spending. This lane adds `unspentPoints` + a point ledger on
`gcsData`, a GM Award Points modal, and a cart-with-confirm Spend Points
workflow with three enforcement tiers (computed skills/spells, computed
attributes/secondaries, GM-priced traits). It also consolidates the cost math
into one module and fixes two live bugs (sense-attribute costs missing from
totals; dangling `skillHistory.skillId` after duplicate/import) plus one stub
(context-menu Edit).

Codebase rules: strict TS (`npx tsc --noEmit` clean), **no `as any` anywhere
incl. tests, no ts-suppressions**, logic in utils not components,
`import type`, dark-Tailwind + `data-testid`.

## Deliverable 1: types + ledger

In `src/types/characterSheet.ts`:
```ts
export interface PointLedgerEntry {
  id: Id;
  date: string;            // ISO
  kind: 'award' | 'spend';
  points: number;          // positive for award, negative for spend
  label: string;           // award note ("Session 12: rescued the caravan") or spend summary ("Raised Alchemy 12→13, +1 ST")
}
```
`GCSCharacterData` gains `unspentPoints?: number` and
`pointLedger?: PointLedgerEntry[]` (both optional — no migration; read with
`?? 0` / `?? []`). `createDefaultGCSData()` seeds `unspentPoints: 0`,
`pointLedger: []`.

## Deliverable 2: shared rules module — `src/utils/characterPoints.ts`

- Move the cost constants here and refactor the three sheet sections to import
  them (identical behavior): `ATTRIBUTE_COSTS { ST:10, DX:20, IQ:20, HT:10 }`,
  `SECONDARY_COSTS` (will 5, frightCheck 2, per 5, vision/hearing/tasteSmell/
  touch 2, basicSpeed 5, basicMove 5), `POOL_COSTS { HP:2, FP:3 }`.
- Move `calculateTotalPoints` here (re-export from characterSheet.ts for
  compatibility) and **fix it to include the five sense/frightCheck secondary
  point costs currently omitted** (vision, hearing, tasteSmell, touch,
  frightCheck — audit which of the nine secondaries both it and the
  CharacterSheet memo drop, and include ALL secondaries' points). Replace
  `CharacterSheet.tsx`'s inline totals `useMemo` with a call to it. Displayed
  totals will change on affected sheets — that is the intended bug fix; update
  any tests asserting the old wrong totals and say so in your summary.

## Deliverable 3: shared advancement helper — `src/utils/skillAdvancement.ts`

```ts
export interface SkillAdvancementInput {
  skillId?: Id;                      // existing skill
  newSkill?: { name: string; specialization?: string; attribute: SkillAttribute; difficulty: SkillDifficulty };
  pointsToAdd: number;               // >= 1
  sessionLabel?: string;
  notes?: string;
}
export function applySkillAdvancement(gcsData: GCSCharacterData, input: SkillAdvancementInput):
  { updatedSkills: Skill[]; historyEntry: SkillAdvancementEntry };
```
Level/relativeLevel recomputed via existing `calculateSkillLevel` /
`calculateRelativeLevel` (Will/Per attributes read from secondaryAttributes).
Entry ids get a random suffix (not bare Date.now()). Refactor BOTH existing
writers onto it: `SkillHistorySection.handleRecordAdvancement` and Study's
`computeStudyAward` in `src/utils/study.ts` — their test suites must stay
green (update only mechanical expectations like id shape, and call out every
test you touch).

## Deliverable 4: bug fixes

1. `regenerateGCSDataIds` (`src/utils/characterManagement.ts`): remap
   `skillHistory[].skillId` when skills get new ids (build old→new id map).
2. Context-menu "Edit" (`src/unified/UnifiedShell.tsx` ~line 232): currently a
   TODO stub that only selects. Make it select AND open the character sheet's
   edit mode (thread a prop/state the sheet already supports — read how
   `editMode` is toggled and lift what's needed minimally).

## Deliverable 5: Award Points

- `src/components/character-management/AwardPointsModal.tsx`, opened from a new
  "Award Points" button in the party column header (`UnifiedShell.tsx`, next to
  Add Character; `data-testid="award-points-button"`).
- Modal: amount (number ≥1), note (text), character multi-select (default: all
  `isPlayer !== false` characters checked; NPCs listed unchecked).
- Confirm: for each selected character dispatch `updateCharacter` with gcsData
  carrying `unspentPoints + amount` and an appended `pointLedger` award entry;
  one changelog entry per award batch via new `characterLog` family (Deliverable 7).

## Deliverable 6: Spend Points cart

- `src/components/character-management/PointSpendModal.tsx` (decompose into
  views if it exceeds ~400 lines), opened from: a new context-menu item
  "Spend Points" (`CharacterContextMenu.tsx`) and a pool badge on the character
  sheet header showing `unspentPoints` when > 0
  (`data-testid="unspent-points-badge"`).
- Header: character name + pool balance + running cart total + remaining.
- Tabs:
  - **Skills & Spells**: list existing entries with "+1 point" steppers
    showing the resulting level and cost delta; "add new skill" row (name /
    attribute / difficulty, like Study's form). Uses `applySkillAdvancement`
    math for preview; multiple increments to one skill accumulate into one
    cart line.
  - **Attributes**: steppers for ST/DX/IQ/HT and all secondaries + HP/FP max,
    costs from `characterPoints.ts`. Preview shows dependent recomputation
    (raising DX/IQ changes skill levels — recompute every skill's `level` from
    its stored points/difficulty at apply time).
  - **Traits**: add advantage/perk/disadvantage/quirk rows: name + free
    point cost (negative allowed; disadvantages credit the pool).
- Cart panel: line items with remove; Confirm disabled while
  `cartTotal > unspentPoints` (`data-testid="confirm-spend-button"`,
  insufficient notice) or cart empty.
- Confirm applies ONE `updateCharacter` atomically: updated skills (+history
  entries via the shared helper, sessionLabel "Point spend — Day N" using
  campaign day), updated attributes/attributePoints/secondaries/pools, added
  traits, `unspentPoints - cartTotal`, appended spend ledger entry, then one
  `characterLog.pointsSpent` changelog entry.

## Deliverable 7: changelog

`src/utils/activityLogger.ts`: `'character'` in the union + `characterLog`
family: `pointsAwarded(names: string[], amount, note, meta?)`,
`pointsSpent(characterName, amount, summary, meta?)`. Add `'character'` to
`ACTIVITY_FAMILIES` in `ChangelogTab.tsx`.

## Deliverable 8: tests

1. `src/utils/__tests__/characterPoints.test.ts` — constants; corrected
   `calculateTotalPoints` incl. sense/frightCheck points (assert a case that
   would have been wrong before).
2. `src/utils/__tests__/skillAdvancement.test.ts` — existing-skill increment
   across breakpoints, new-skill creation, Will/Per attribute source, history
   entry shape.
3. `regenerateGCSDataIds` skillId remap test (extend characterManagement tests).
4. `AwardPointsModal.test.tsx` — default selection, per-character ledger +
   pool writes, changelog entry.
5. `PointSpendModal.test.tsx` — cost preview, accumulation, insufficient-funds
   block, disadvantage credit, atomic apply payload (assert the single
   `updateCharacter` argument), DX raise recomputes a DX-based skill's level.
6. All existing suites stay green — especially character-sheet, downtime
   (Study), and `src/components/character-management`.

## Definition of done (self-verify, fix failures before finishing)

```bash
npx tsc --noEmit
npx vitest run src/utils/__tests__/characterPoints.test.ts src/utils/__tests__/skillAdvancement.test.ts
npx vitest run src/components/character-sheet src/components/character-management
npx vitest run src/components/downtime
npx vitest run src/__tests__/combatIntegration.test.ts
```

All green, zero new `as any`, no commits — leave changes in the working tree.

## Requested final summary

One paragraph: the atomic spend payload shape, every existing test you had to
touch and why, and ANY deviation from this spec (call each out explicitly).
