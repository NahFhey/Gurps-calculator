# Read-only review: import/visibility phase (review claims C and D)

You are the reviewer. Do not run codex, do not spawn sub-agents, do not read or follow any skill under ~/.agents/skills/, ~/.codex/skills/ or ~/.codex/plugins/. Review the diff yourself and report to stdout.

**Mode: READ-ONLY.** Do not edit, create or delete any file (your sandbox blocks writes anyway, including /tmp). Do not run `npm install`. Nothing in this repo spends money; there are no paid APIs to avoid. Safe commands: `git diff`, `git log`, `git show`, `rg`, `sed -n`, `npx tsc --noEmit`, `npx vitest run <file>` (may fail in your sandbox because vite writes a cache under the symlinked, read-only `node_modules`; if so, say so and reason instead — the author has already run the suites, results below).

**Review the committed code, not the working tree.** Diff to review: `git diff bd47c06..54d05ac` (two WIP commits: `86b8ccf` = claim C, `54d05ac` = claim D). The author is editing `src/components/ManagerTab.tsx` and adding files in the working tree while you run (fix for B0 below); read files with `git show 54d05ac:<path>` where it matters.

## What this is

A GURPS 4e campaign manager (React 18 + TS strict + Vite, Electron shell, optional Express + Socket.io server in `server/`). The whole campaign is one `CampaignState` JSON blob. The GM can export it in two forms: **unlocked** (`{public, gm}` in plaintext, GM use only) and **locked** (`{public, gmLock}`, where `gmLock` is the full campaign encrypted with AES-GCM/PBKDF2 and `public` is meant to be handed to players). In multiplayer, players fetch campaign state through the server's `GET /api/campaigns/:id`.

The driving review is `docs/codex-specs/REFACTOR_DEEP_REVIEW.md` (your own earlier deep review), claims C and D. The handoff with the design is `docs/REFACTOR_HANDOFF.md`, sections "session 7" and "session 8".

What the phase claims to guarantee:
1. **Claim C — Manager import works.** Choosing a file in Manager → Import/Export replaces the campaign through `importCampaignState` (which checkpoints "Before import"); a pre-campaign flat export is refused with a message and changes nothing; the file input resets after success or error.
2. **GM unlock is honest.** For a locked import the pending lock is kept; GM mode turns on only after `unlockPendingGMLock` actually decrypts; a wrong password shows the error and leaves GM mode off and the state unchanged; the right password replaces the state with the merged campaign (checkpointed "Before GM unlock") and enables GM mode.
3. **Claim D — player-safe means player-safe.** `shared/playerProjection.ts` `projectCampaignForPlayers` redacts (A) GM-mode UI flags, (B) checkpoints, (C) reagent secrets mirroring `getVisibleReagentInfo` (`src/utils/helpers.ts`) incl. false profiles, (D) formula/batch GM fields, (E) effect-map gmNotes unless `gmNotesVisible`, (F) location gmNotes, (G) gm-only/mixed log entries, (H) GM map markers, gm-only image layers, hidden/masked tokens (combat participants exempt), (I) `legacy.appState` secrets. It is used for the `public` half of normalized exports (`splitState`), for asset collection in `exportLocked` (GM-only layer bytes not shipped), and by the server `GET /api/campaigns/:id` for every non-GM role.
4. `playerProjectionGaps` drives a warning on locked export listing what is NOT yet hidden (running combat; combat history/tombstones).

Known and deliberately deferred (do not report these as findings; you MAY report if a deferral is mislabelled or the deferred thing is worse than described): running-combat participants/log, `entities.combatHistory`, `combatTombstones`; fog of war (unrevealed tiles/tokens/structures); out-of-combat condition `revealed`; gm-only layer bytes via the asset GET route; GM-authored libraries the UI does not hide (`entities.combatCharacters`, `encounterTemplates`, travel event tables/sets, `skillAdvancements[].notes`, `activities.gmOverride`); dead `GMLockData`/`ManagerTabProps` types and the no-op `filterForPlayerExport`; Electron is not run on the author's machine.

**Already found by the author (B0, being fixed now; do not re-report):** the pending GM lock is `ManagerTab` component state; importing a locked file whose state has `combat.activeSession` makes `UnifiedShell` re-wrap in `CombatContextProvider`, which remounts the shell, so the lock is lost and the GM can never unlock that file.

## Framing

A different AI (Claude) wrote this across two sessions, each cut off at a context ceiling, and is likely overconfident. Its tests were written by the same reasoning as the code — check whether they can actually fail. It claims 37/37 mutants caught (`docs/codex-specs/import-visibility-mutants.py`); look for the mutations it did not try.

## Severity — rank by blast radius

1. **GM secret reaches a player**: any field the GM UI treats as hidden (check the actual player-mode rendering paths, not only the field names) that survives `projectCampaignForPlayers`, the locked export's `public` or `assets`, or the server GET for a player/spectator token. Also: any path where a non-GM gets the unprojected state (role parsing, missing token, a second route or socket event that returns `state_json`, the PUT/POST response bodies, error bodies).
2. **Data loss**: an import or unlock that overwrites the campaign without a checkpoint, a failed import that partly applies, an unlock that drops data the public half had (e.g. player-side changes) or that merges the wrong way round; the projection mutating its input (the GM's live state).
3. **Silent wrong**: GM mode enabled without a successful decrypt; a "safe to share" message when something listed above leaks; the server returning 200 with unprojected bytes on a parse failure.
4. Ordinary correctness, including the projection breaking the player client (shape the client hydrator or reducers cannot handle: deleted required fields, dangling `markerIds`, tokens referenced elsewhere).
5. Vacuous tests: name the one-line break that should make a test fail and say whether one does.
6. Style, briefly, last.

## Evidence

Every finding: `file:line`, a concrete reproducing sequence (input/state → steps), actual result, expected result. Anything you did not trace end-to-end is labelled **UNVERIFIED**. You may find nothing serious; that is less likely than you think.

## Where to look

`shared/playerProjection.ts`; `src/utils/exportImport.ts` (`splitState`, `mergeGM`, `exportLocked`, `importFile`, `unlockGMData`); `src/utils/campaignImport.ts`; `src/components/ImportExportPanel.tsx`; `src/components/ManagerTab.tsx` (at 54d05ac); `src/components/GMLockModal.tsx`; `server/src/routes.ts` and its auth middleware; `server/src/socket.ts` (does anything else send state?); `src/net/` (how a player client consumes the GET); the reducers' `importCampaignState`; the player-mode render paths that decide what is hidden (`getVisibleReagentInfo`, log visibility, map marker/token/layer visibility, effect map). Tests: `src/utils/__tests__/playerProjection.test.ts`, `src/utils/__tests__/exportImport.playerSafe.test.ts`, `src/utils/__tests__/fixtures/gmSecretsCampaign.ts`, `src/components/__tests__/ImportExportPanel.lockedExport.test.tsx`, `src/components/manager/__tests__/ManagerTab.importUnlock.test.tsx`, `server/src/__tests__/routes.test.ts`.

## Author's verification so far

On 54d05ac: `npx tsc --noEmit` clean; server tsc clean; full `npx vitest run` 341 files / 4730 tests passed; `server/` vitest 6 files / 92 passed; theme-token gate passed; mutation script 37/37 caught. Browser pane (real Chromium, vite dev): a locked import of the fixture loaded day 42 with 0 `SECRET` strings in the UI and 0 in the autosaved IndexedDB blob; wrong password → "Unlock Failed", GM mode off; right password → GM mode on, checkpoints "Before import" + "Before GM unlock", GM-only log entry back; a locked export made from the UI had 0 `SECRET` strings in the whole file and its `gmLock` decrypted to the full campaign. Not exercised in a browser: the multiplayer server path, Electron.

## Report format (stdout, Markdown, these sections in order)

## VERIFIED BUGS
`- [sev 1-6] file:line — title` then repro / actual / expected / fix shape.

## UNVERIFIED CONCERNS
Same shape, labelled.

## TEST GAPS AND VACUOUS TESTS
Per guarantee: the mutation, and whether an existing test catches it (name it).

## CHECKED AND OK
Mandatory. What you traced and found correct, specifically enough that silence can be told apart from coverage.
