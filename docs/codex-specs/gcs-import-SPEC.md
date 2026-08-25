# Task: GCS character import — validation, diff preview, batch party import (Roadmap 12b slice)

## Background

This is a GURPS 4e campaign-management app (React 18 + TypeScript strict + Tailwind + Vite, Vitest/jsdom). Characters can be imported from a GCS text export via `parseCharacterText()` in `src/utils/characterImport.ts` (tests: `src/utils/__tests__/characterImport.test.ts`; a real sample lives at `docs/Archive/Sample Character Sheet.txt`) or from JSON. The import UI lives in `src/components/character-management/CharacterCreationModal.tsx`. Import-related Zod schemas may already exist (see `src/utils/__tests__/importSchemas.test.ts` and its subject module) — reuse them where applicable.

Today the parser silently defaults anything it can't parse, imports always create a new character, and one file = one character. This task adds three capabilities. All state changes go through the existing store actions `addCharacter(character)` and `updateCharacter(id, changes)` from `useCampaignStore()` — no new reducer actions, no changes under `src/state/` or `src/types/`.

## Deliverables

### 1. Validation layer — `src/utils/characterImportValidation.ts`

`validateCharacterText(text: string): ImportValidationResult` where the result is `{ ok: boolean; errors: ImportIssue[]; warnings: ImportIssue[] }` and `ImportIssue = { line?: number; section?: string; message: string }`.

- **Errors** (block import): empty/whitespace-only input; input > 1 MB; no `Name:` line; a section line that matches a known label but fails to parse into any entries when it visibly contains content.
- **Warnings** (import proceeds): unrecognized non-empty lines (report line number + a snippet); known sections absent (e.g. no `Skills:` line); numeric fields that fell back to defaults.
- Pure function, no DOM, no store access. Do not change `parseCharacterText`'s behavior — validation is a separate pass (it may reuse internal helpers if you export them, but existing parser outputs for existing tests must not change).

### 2. Diff preview — `src/utils/characterDiff.ts`

`diffCharacters(existing: Character, incoming: Character): CharacterDiff` — a pure structured comparison of the `gcsData` payloads (and top-level `name`, point totals):

- Scalar changes as `{ path: string; label: string; from: string | number; to: string | number }` for primary attributes, secondary attributes, point pools.
- Collection changes for skills, spells, advantages, perks, disadvantages, quirks, equipment: `{ added: T[]; removed: T[]; changed: Array<{ name: string; changes: FieldChange[] }> }`, keyed by entry name (case-insensitive).
- Include a `summary` count object (`{ changedFields, added, removed, modified }`) so the UI can show "12 changes".
- `hasChanges(diff): boolean` helper.

### 3. Batch parsing — extend `src/utils/characterImport.ts` (additive only)

`parsePartyText(text: string): Character[]` — splits the input on `Name:` block boundaries (each `Name:` line starts a new character) and runs the existing single-character parser per block. Also accept a JSON array of characters for the JSON path (wherever single-character JSON import currently lives, mirror it for arrays). Existing exported function signatures and behavior must not change.

### 4. UI wiring — `src/components/character-management/CharacterCreationModal.tsx` (+ new subcomponents in `src/components/character-management/`)

On file import:

- Run validation first. Errors → show them in the modal (list with line numbers), no import. Warnings → show them collapsed/expandable, import allowed.
- **Single character whose name matches an existing character** (case-insensitive, against the characters already in the store): offer "Create as new" vs "Update existing", where Update shows the diff preview (grouped: Attributes / Pools / Skills / Spells / Traits / Equipment; added = green, removed = red, changed = from → to) with Confirm/Cancel. Confirm calls `updateCharacter(existingId, { name, gcsData, ... })`, preserving fields the import doesn't carry (id, images, notes not present in the file — spread carefully).
- **Multiple characters in one file**: show a batch preview list — one row per parsed character with name, point total, and a badge for `new` vs `update` (name match), each row checkbox-selected (default all). "Import selected" runs add/update per row. Per-row diff preview is NOT required (nice-to-have only if trivial); the badge is enough.
- Follow the modal's existing styling conventions (slate/indigo Tailwind palette used throughout the file).

### 5. Tests

- `src/utils/__tests__/characterImportValidation.test.ts` — valid sample passes; each error class; each warning class. Use `docs/Archive/Sample Character Sheet.txt` content as a fixture (copy the needed text into the test file or read via fs in a node-env test, matching how existing util tests do it).
- `src/utils/__tests__/characterDiff.test.ts` — no-change diff is empty; scalar change; added/removed/changed skill; equipment change; summary counts.
- Extend `src/utils/__tests__/characterImport.test.ts` (additive): multi-character split, single-character text still yields one character, existing tests untouched and passing.
- Component tests for the modal flows (validation error display, update-vs-create choice appears on name match, batch list renders and imports selected) in `src/components/character-management/__tests__/`.
- Minimum 25 new tests overall.

## Hard constraints

- `strict: true` TypeScript — `npx tsc --noEmit` must pass with zero errors.
- **No new `as any` casts. No `@ts-ignore` / `@ts-expect-error`.** Use `import type` for type-only imports.
- No changes under `src/state/` or `src/types/` except: if a type you need is missing, add it to a NEW file colocated with your utils, not to existing type files.
- No new dependencies (zod is available if already in package.json — check before using). Do not run npm install (node_modules is a symlink, already populated).
- Do not modify `src/unified/UnifiedShell.tsx` or the character context menu — all UI stays inside CharacterCreationModal and new subcomponents it renders.

## Definition of done — self-verify before finishing

Run these yourself from the repo root and fix failures before finishing:

```
npx tsc --noEmit
npx vitest run src/utils/__tests__/characterImport.test.ts src/utils/__tests__/characterImportValidation.test.ts src/utils/__tests__/characterDiff.test.ts
npx vitest run src/components/character-management
```

All must pass. Then write a final summary: one paragraph on design decisions — especially how the diff handles fields the text format doesn't carry (the risky area: update-existing must not wipe data the import file has no opinion on) — plus anything that looked like a pre-existing bug (do NOT fix pre-existing bugs — report them).
