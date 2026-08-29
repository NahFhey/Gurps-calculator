# SPEC: 12c Lane B — Character templates, NPC generator, comparison view

**Date:** 2026-08-28
**Design source:** `docs/CHARACTER_LIFECYCLE_12C_PLAN.md` (decisions final; do
not re-litigate). Dispatches AFTER Lane A merges — it depends on Lane A's
`characterPoints.ts` (honest totals) and may reuse its helpers. Read as-built
before coding: `src/utils/characterManagement.ts` (stub templates you replace),
`src/components/character-management/CharacterCreationModal.tsx`,
`src/utils/characterDiff.ts` (field tables to reuse for comparison),
`ensureInventoryRecords` (the ensure-on-hydrate seeding precedent — find it in
the persistence/hydrate path).

## Background (why)

Templates today are hollow (name + cosmetic "150 pts" on a blank character).
This lane makes them real seeded data entities with a save-as-template
authoring path, adds an NPC generator producing full `Character` entities with
controlled variance, and a side-by-side comparison modal.

Codebase rules: strict TS, **no `as any` anywhere incl. tests, no
ts-suppressions**, logic in utils, `import type`, dark-Tailwind +
`data-testid`.

## Deliverable 1: template entities

- `src/types/campaign.ts`:
  ```ts
  export interface CharacterTemplateEntity {
    id: Id;
    name: string;
    description: string;
    builtin: boolean;              // seeded six = true; user saves = false
    gcsData: GCSCharacterData;     // full snapshot, images-free
    createdAt: number;
    updatedAt: number;
  }
  ```
  Entities shape: `characterTemplates?: Record<Id, CharacterTemplateEntity>`.
- Reducer actions + store creators: `upsertCharacterTemplate`,
  `removeCharacterTemplate`.
- **Seeding:** `src/constants/characterTemplateSeeds.ts` exporting the six
  builds; an ensure-step at hydrate (follow the `ensureInventoryRecords`
  precedent) inserts any missing builtin template by stable id (idempotent —
  never overwrites user edits to an existing entry).
- **The six seeded builds must be genuinely playable ~150-point
  generic-fantasy characters** (Fighter, Wizard, Rogue, Cleric, Ranger, Bard):
  adjusted attributes, 8–12 skills with real points/levels computed via the
  B170 ladder (`calculateSkillLevel`), 2–4 advantages and 1–2 disadvantages
  with sensible point values, basic equipment list. `totalPoints` computed
  honestly with `calculateTotalPoints` — not hardcoded 150; aim for 140–160
  and state each build's actual total in your summary.
- Deprecate the old stubs: remove `CHARACTER_TEMPLATES` /
  `createCharacterFromTemplate` and rewire callers; creation from a template =
  deep clone of `gcsData` (safeDeepClone) + `regenerateGCSDataIds` + name.

## Deliverable 2: template UI

- **Manager "Templates" view** (`src/components/manager/views/CharacterTemplatesView.tsx`,
  wired into ManagerTab like TradingView): list with name/description editable
  inline, point total, builtin badge, delete (confirm; builtin deletable too —
  the ensure-step must therefore track deletions: keep a
  `deletedBuiltinTemplateIds?: string[]` list in the same entities slice so
  deleted builtins stay deleted across hydrates).
- **CharacterCreationModal template step**: replace the stub list with entity-
  backed cards + a preview pane (attributes line, skill list with levels,
  traits, computed total) before Create.
- **"Save as template"** in `CharacterContextMenu.tsx`: prompts for
  name/description, snapshots the character's `gcsData` via deep clone with
  `images` stripped and `unspentPoints`/`pointLedger` zeroed/emptied (templates
  are builds, not careers), `builtin: false`.

## Deliverable 3: NPC generator

- `src/utils/npcGenerator.ts` (pure; RNG injected for testability):
  ```ts
  export type NpcVariance = 'none' | 'light' | 'heavy';
  export function generateNpcName(rng: () => number): string;   // syllable-based, 2-3 syllables + optional epithet-free surname; no external data
  export function generateNpc(template: CharacterTemplateEntity, variance: NpcVariance, rng: () => number): Character;
  ```
  Variance: none = exact copy; light = each of ST/DX/IQ/HT jittered −1/0/+1;
  heavy = jitter −2..+2 and each skill's points row ±(0–4 pts, min 1).
  After jitter, **recompute every derived number honestly**: attributePoints
  from the shared cost constants, each skill's `level`/`relativeLevel` from its
  points + (possibly changed) attribute via `calculateSkillLevel`, secondaries'
  bases, `totalPoints` via `calculateTotalPoints`. Output `isPlayer: false`,
  generated name, fresh ids (`regenerateGCSDataIds`), work-skills resynced
  (`syncWorkSkillsFromGCS` — see how `createBlankCharacter` does it).
- **UI**: a fourth path in `CharacterCreationModal` — "Generate NPC":
  template select, count (1–5), variance select, Generate → preview list
  (name editable + per-row reroll button `data-testid="reroll-name-button"`,
  key stats line, total) → "Add N characters" dispatches them all; changelog
  `characterLog.npcGenerated(names, templateName)` (extend Lane A's family).

## Deliverable 4: comparison view

- `src/components/character-management/CharacterCompareModal.tsx`, opened from
  a new context-menu item "Compare with…" (picker for the second character).
- Two columns, ALL rows shown (attributes, secondaries, pools, then skills /
  spells / traits / equipment as name-matched rows), differing values
  highlighted (amber text), rows present on only one side marked added/missing.
- Build it on `characterDiff.ts`: add an exported
  `buildComparisonRows(a: Character, b: Character)` that reuses the SAME field
  tables/matching logic but emits both values including unchanged rows — do
  not fork the field lists into the component, and do not change
  `diffCharacters`' existing behavior (import-preview tests must stay green).

## Deliverable 5: tests

1. Template seeding: idempotent ensure; deleted builtin stays deleted; seeds
   pass an "is playable" assertion (attributes ≠ all 10s, ≥8 skills, honest
   total within 140–160).
2. Save-as-template: images stripped, ledger cleared, builtin false.
3. Creation from template: deep-cloned (mutating the character doesn't touch
   the template), fresh ids.
4. `npcGenerator` with seeded fake rng: deterministic jitter bounds per
   variance; DX jitter changes DX-based skill levels correctly; honest totals;
   name generator shape + reroll variety.
5. CreationModal generate path; CompareModal renders unchanged + changed +
   one-sided rows.
6. Existing suites stay green (`characterDiff`, import flow, creation modal).

## Definition of done (self-verify, fix failures before finishing)

```bash
npx tsc --noEmit
npx vitest run src/utils/__tests__/npcGenerator.test.ts
npx vitest run src/components/character-management src/components/character-sheet src/components/manager
npx vitest run src/state
npx vitest run src/__tests__/combatIntegration.test.ts
```

All green, zero new `as any`, no commits — leave changes in the working tree.

## Requested final summary

One paragraph: each seeded build's computed point total, how variance jitter
keeps derived numbers consistent, and ANY deviation from this spec (call each
out explicitly).
