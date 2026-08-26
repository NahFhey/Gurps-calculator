# SPEC: GCS Character Import — Equipment Parser Fix + Text Export (Phase 12b completion)

## Background

This is a React 18 + TypeScript (strict) + Vite app for GURPS 4e campaign management.
Characters are imported from a GCS-style plain-text format by
`src/utils/characterImport.ts` (`parseCharacterText`). There is a confirmed bug:
equipment entries never parse. There is also a missing feature: export back to the
same text format. You will fix the bug and add the exporter. Work ONLY in this
worktree; do not touch git (no commits) — the shepherd commits after review.

## Deliverable 1 — Fix the equipment parser bug

**The bug:** `parseEquipment` (characterImport.ts ~line 434) splits the line with
`splitBySemicolon`, which respects parentheses but NOT square brackets. An entry like
`1 Boots [$80; 3 lb]` is split at the semicolon inside the brackets, producing
fragments `"1 Boots [$80"` and `"3 lb]"`, so the regex
`/^(\d+)\s+(.+?)\s+\[\$(\d+);\s*([\d.]+)\s*lb\]$/` never matches and equipment parses
to an empty array. Real GCS sample sheets parse ZERO equipment.

**Required fix:**
- Make the splitting bracket-aware so `[...]` contents are never split. Either extend
  `splitBySemicolon` to track square-bracket depth alongside paren depth, or use the
  existing `splitBySemicolonSpells` pattern (which is bracket-aware) — your choice,
  but do NOT change the observable behavior of the Spells/Reactions/Advantages
  parsing that also uses `splitBySemicolon` (bracket-aware splitting is strictly
  more permissive: `[` never appears unbalanced in those lines; verify with the
  existing test suite).
- Broaden the equipment entry regex to also accept:
  - Decimal costs: `[$80.50; 3 lb]`
  - Thousands separators in cost: `[$3,000; 2 lb]` (strip commas before parseInt/Float)
  - Missing quantity prefix: `Boots [$80; 3 lb]` → quantity 1
  - `lb.` or `lbs` suffix variants
  - Entries that omit weight: `1 Torch [$3]` → weight 0
- Keep the existing behavior that unparseable fragments are skipped silently (the
  validation layer `characterImportValidation.ts` reports empty-parse warnings; do
  not change that file's public API).

## Deliverable 2 — Text export (`src/utils/characterExport.ts`, new file)

Write `exportCharacterText(character: Character): string` producing the same
plain-text format that `parseCharacterText` consumes. Study `parseCharacterText`
in full to get the exact line formats; the canonical sample lives in the test at
`src/utils/__tests__/characterImport.test.ts` (~line 140, "Bertok Darkwing").

Requirements:
- Emit every section the parser understands, in the parser's expected format:
  Name (with points), ST/DX/IQ/HT lines with bracketed point costs, secondary
  attributes, HP/FP, Reactions, Conditional Modifiers, Advantages, Perks,
  Disadvantages, Quirks, Skills, Spells, Equipment (as `Qty Name [$Cost; Weight lb];`),
  Other Equipment, Notes.
- Omit sections that are empty rather than emitting empty labels.
- Source data comes from `character.gcsData` (type `GCSCharacter` in
  `src/types/characterSheet.ts`); handle missing/undefined gcsData by exporting the
  minimal Name line from top-level fields.
- **Round-trip invariant (the core acceptance test):** for a character parsed from
  the Bertok Darkwing sample, `parseCharacterText(exportCharacterText(c))` must
  reproduce the same attributes, traits, skills, spells, and (post-fix) equipment.
  Lossless round-trip of every optional field is NOT required — the invariant is
  parse(export(parse(text))) deep-equals parse(text) for the gcsData sections
  listed above.
- Do not wire any UI. Utility + tests only.

## Constraints

- TypeScript strict mode must stay clean: run `npx tsc --noEmit` and fix all errors.
- NO new `as any` casts anywhere. Use `import type` for type-only imports.
- Do not modify files outside: `src/utils/characterImport.ts`,
  `src/utils/characterExport.ts` (new), and test files under `src/utils/__tests__/`.
- No new dependencies. No network access needed.
- Match the surrounding code style (JSDoc section comments, existing helper patterns).

## Definition of done — self-verify before finishing

1. Add tests in `src/utils/__tests__/characterImport.test.ts` asserting the Bertok
   sample now parses equipment: `[{name:'Boots',quantity:1,cost:80,weight:3},
   {name:'Healing Potions',quantity:2,cost:120,weight:0.5}]` (match on those fields,
   ignore generated ids), plus cases for each regex broadening above (decimal cost,
   comma thousands, missing quantity, lb variants, missing weight) and one malformed
   entry that is skipped.
2. Add `src/utils/__tests__/characterExport.test.ts` with the round-trip test plus
   targeted per-section format tests (at least 10 tests total).
3. Run and pass:
   - `npx vitest run src/utils/__tests__/characterImport.test.ts src/utils/__tests__/characterExport.test.ts src/utils/__tests__/characterImportValidation.test.ts src/utils/__tests__/characterImportUpdate.test.ts src/utils/__tests__/characterDiff.test.ts`
   - `npx tsc --noEmit`
   Fix any failures yourself before finishing, including pre-existing tests your
   change breaks.
4. Final summary: one paragraph on design decisions — especially the splitter choice
   and any format ambiguities you resolved in the exporter.
