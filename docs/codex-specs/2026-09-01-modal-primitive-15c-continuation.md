# SPEC: Complete the Modal Primitive Migration (continuation)

## Situation

A previous agent run against `docs/codex-specs/2026-09-01-modal-primitive-15c.md` (READ IT FIRST — all its requirements, constraints, and definition of done still apply) was killed partway through. The working tree already contains its partial, healthy output — `npx tsc --noEmit` is clean and all UI tests pass (82/82):

- `src/components/ui/Modal.tsx` — the primitive, built and tested (`__tests__/Modal.test.tsx`). READ IT and reuse it as-is; extend it only if a remaining site genuinely needs a capability it lacks (note any extension in your summary).
- `ConfirmDialog` already refactored onto it; ~20 files already migrated (map dialogs, character-management editors, cooking/crafting/gathering/inventory/manager sites, KeyboardShortcutsModal).

## Your job: finish the migration

These files still contain `fixed inset-0` overlays. Classify each per the original spec (modal-shaped → migrate onto `Modal`; genuine non-modal overlay → leave, justify in summary):

- `src/components/alchemy/BatchesView.tsx`
- `src/components/character-management/AwardPointsModal.tsx`
- `src/components/character-management/CharacterCreationModal.tsx`
- `src/components/character-management/PointSpendModal.tsx`
- `src/components/combat/CharacterForm.tsx`
- `src/components/combat/GCSImportModal.tsx`
- `src/components/combat/ReinforcementsModal.tsx`
- `src/components/ConnectionDialog.tsx`
- `src/components/crafting/SaveDesignModal.tsx`
- `src/components/GMLockModal.tsx`
- `src/components/header/WeatherWidget.tsx`
- `src/components/inventory/EquipItemModal.tsx`
- `src/components/ManagerTab.tsx`
- `src/components/map/views/MapHeader.tsx`
- `src/components/RulesModal.tsx`
- `src/unified/UnifiedShell.tsx` — the two inline ad-hoc modals (generic `layoutState.modalContent` overlay + delete-character confirm; the confirm should become a `ConfirmDialog`), per the original spec.

Additionally, these files hand-roll `role="dialog"` and must end up either migrated or justified (the original spec's DoD: `role="dialog"` only in `Modal.tsx` + tests + justified exceptions):

- `src/components/combat/ConditionAddPopover.tsx` (likely a popover — if so, keep it but say so)
- `src/components/map/views/TravelWizard.tsx`

All original-spec rules apply unchanged: behavior parity (preserve existing backdrop/Escape semantics; sites gaining them is a flagged upgrade), sizes to presets, footer slot where natural, no visual redesign, theme tokens only, no new deps, strict TS.

## Definition of done — self-verify (same as original)

1. `npx tsc --noEmit` clean.
2. `npm run check:tokens` exit 0.
3. `npx vitest run` full suite green.
4. `npm run build` succeeds.
5. `rg -l "fixed inset-0" src -g '*.tsx'` → only `Modal.tsx` + justified non-modal sites; `rg -l 'role="dialog"' src` → only `Modal.tsx`, tests, and justified sites.

## Final summary requested

Same as the original spec, covering the ENTIRE migration (including the ~20 files migrated before the kill — inspect the git diff to report them): (a) migrated sites with size + backdrop/Escape settings and flagged upgrades, (b) unmigrated `fixed inset-0`/`role="dialog"` sites with justification, (c) behavior you could not preserve exactly. Flag anything unanticipated.
