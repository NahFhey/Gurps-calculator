# KNOWN_ISSUES.md

Acknowledged concerns the `gurps-vtt-auto-review` routine should NOT re-flag every day.

## How this file works

- Each entry is a known concern that has been seen, judged, and parked — either because it's tracked elsewhere, requires human design judgment the loop can't make, or is grandfathered for compatibility reasons.
- The review routine reads this file before evaluating, and suppresses any concern whose **fingerprint** matches an entry here.
- Devin can add or remove entries by hand. The routine may also append entries when promoting a CONCERN to known status (committed as `review: ack <fingerprint>`).
- Closing an entry: delete the line (or move to a `## Resolved` section with the date) when the underlying issue is fixed.

## Fingerprint format

```
- [<status>] <area>: <one-line description> [<source>]
```

`<status>`:
- `tracked` — captured in roadmap or another doc; loop should not re-raise
- `grandfathered` — accepted exception, not to be undone
- `deferred` — acknowledged, awaiting human cycles

## Open

- [tracked] type-safety: `src/utils/exportImport.ts` uses `:any` annotations at ~10 sites; should become `unknown` + validators or `CampaignState`. Not a regression from the JS source. [manual review 2026-05-09]
- [grandfathered] type-safety: `src/utils/__tests__/combatHelpers.test.ts` uses `@ts-nocheck`. Queued for replacement with typed fixtures via `AUTO_QUEUE.md` Phase 10c follow-up; suppress until that item lands. [manual review 2026-05-09]
- [deferred] a11y: focus trap not implemented in any of the 11 modal a11y sweeps from Phase 15d (`ConfirmDialog`, `RulesModal`, `ConnectionDialog`, `GMLockModal`, `CharacterCreationModal`, `GCSImportModal`, `ReinforcementsModal`, `SaveDesignModal`, `TerrainAssignmentModal`, `MapCreateDialog`, `TravelWizard`). Belongs in a shared `<Modal>` wrapper, not 11 per-component implementations. [manual review 2026-05-09]

## Resolved

<!-- Move entries here with a resolution date when fixed. -->
