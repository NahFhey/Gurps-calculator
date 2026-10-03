# import/visibility review triage (2026-10-02, from log lines 10146-10225)

Spec `import-visibility-REVIEW-SPEC.md` (sha256 5bc87b68…), one read-only gpt-6.1-sol round (codex-cli 0.159.3, high effort, 199,217 tokens, 2026-10-02T23:49:59Z to ~2026-10-03T00:02Z) over `bd47c06..54d05ac` (claims C and D). Log `logs/import-visibility-review.log.gz`. The final report starts at the LAST `## VERIFIED BUGS` line, which comes AFTER the last `tokens used` line: `zcat logs/import-visibility-review.log.gz | sed -n '10146,$p'`. The first such block in the log is the echoed spec.

Every finding was checked against source before a verdict. Each fix was written failing-test-first; the mutant named in the last column is in `import-visibility-mutants.py` and is caught by that test.

## Claims C and D as reproduced (before review)
- **Claim C (Manager import disconnected, GM unlock broken).** The review said a wrong password could enable GM mode. With the real `GMLock` shape that path is unreachable: `handleImport` ignored its file, and the unlock handler checked `gmLockData.encryptedData`, a field the real lock (`ciphertext`) does not have, called `unlockGMData` without `await`, and discarded `mergeGM`'s result. **The reproduced symptom is "the correct password never unlocks".** Fixed by `prepareCampaignImport` / `unlockPendingGMLock` (`src/utils/campaignImport.ts`) and the ManagerTab wiring; mutants M1-M5.
- **Claim D (player-safe exports leak GM secrets).** Nothing filtered state for players: the normalized locked export's public half was the full campaign, and the server campaign GET returned raw state to players. Fixed by `shared/playerProjection.ts` (redactions A-I), wired into `splitState`, `exportLocked` asset collection and the server GET for every non-GM role; mutants PA-PI, PX, W1-W2, S1-S3, G1-G3.

## Own finding (browser pane, before the Codex round)
| ID | Finding | Verdict | Fix / test |
|---|---|---|---|
| B0 | A locked file with `combat.activeSession` makes `UnifiedShell` re-wrap in `CombatContextProvider`, which remounts ManagerTab and drops its pending lock; "Enable GM Mode" then falls to the no-lock `confirm` path and the GM can never unlock | REAL, reproduced in the browser and in a test | `src/state/pendingGMLock.ts`: module-level holder + `usePendingGMLock` (useSyncExternalStore), in memory only, cleared on unlock or replaced by the next import. Test "a locked file with a running combat can still be unlocked after the shell remounts". Mutant B0. |

## Codex findings
| ID | Finding | Verdict | Fix / test |
|---|---|---|---|
| V1 (sev 1) | `maps.stamps` (GM-only stamp library; `MapPanel.tsx:1061` renders it only in GM mode) survives the projection; `collectReferencedAssetIds` collects every stamp asset, so a locked export ships GM image bytes in plaintext and the server GET sends stamp metadata | REAL by reading | `redactMaps`: `maps.stamps = {}` when present (key kept). Tests: "(H) empties the GM stamp library and keeps the key"; "a locked export does not ship the bytes of the GM stamp library" (stamp added after ingest, not to the shared fixture). Mutant PH7. |
| V2 (sev 1) | Mixed log entries keep `meta.quantity` (the damage, `activityLogger.ts:459`) and `payload.title`; the player changelog (`ChangelogTab.tsx:58-65`) shows only `maskedMessage`. The existing test endorsed `{ quantity: 6 }` | REAL | Mixed entries become `{ message, maskedMessage? }` with no title, and `meta` is deleted. Both (G) tests updated. Mutants PG3 (meta kept), PG4 (title kept). |
| V3 (sev 2) | Unlock returns the encrypted GM snapshot and discards changes to the public half or made after import (`mergeGM` normalized = gmPayload) | DOWNGRADED to an owner decision: the encrypted half is the authoritative campaign by design, the replaced state is kept in the "Before GM unlock" checkpoint, and a real merge needs a three-way merge of redacted fields | `GMLockModal` now says unlocking loads the file's full GM campaign and that changes since the import are kept in the "Before GM unlock" checkpoint. Test "the unlock dialog says …". Mutant V3. Owner decision recorded in `docs/REFACTOR_HANDOFF.md`. |
| V4 (sev 2) | Exporting while a lock is pending drops the GM payload (export uses the projected store state) | REAL | `ImportExportPanel`: while `gmLockData` is set both export buttons are disabled (handlers also return early) and the panel says "Unlock the GM content before exporting". Test "exports are disabled while GM content is locked, and enabled again after unlock". Mutant V4. |
| V5 (sev 3) | A locked import trusts the plaintext `public.ui.gmModeEnabled` / `gmSessionUnlocked` | REAL | `prepareCampaignImport` locked branch hydrates `projectCampaignForPlayers(public)`, not the raw public half. This also covers locked files exported before this phase, whose public half is the full campaign. The pending lock keeps the raw envelope for the unlock. Test "a locked file whose public half carries secrets and GM flags loads only the player view" (unlock still restores). Mutant V5. |
| U1 (sev 1, unverified by Codex) | A level-4 disguised reagent keeps its REAL `effectFamily` / `potency` (deleted only below level 4) | REAL by reading | `effectFamily`, `potency` moved into `FULLY_IDENTIFIED_FIELDS` (read from the false profile at level 4, else deleted); `GATED_LEGACY_FIELDS` removed. Tests: false profile without them → absent; false profile with them → its values; non-disguised level 4 keeps its own (fixture `identified`). Mutants U1 (original behaviour), U1b (never gated). |

## Test gaps (all accepted)
| Gap | Test added | Mutant |
|---|---|---|
| File input reset unasserted | `chooseFile` tracks the input value; the unlocked-import and pre-campaign tests assert it is reset (success and error paths) | T1 |
| Wrong password: full state unchanged unasserted | the wrong-password test asserts `latest` equals the state before the attempt | T2 (failed unlock dispatches an import) |
| "Before GM unlock" label unasserted | right-password test asserts labels `['Before GM unlock', 'Before import']` | T3 |
| Level 1 with three aspects | "level 1 shows only the primary aspect of three" | PC1 (now also caught here) |
| Tombstone-only warning | `playerProjectionGaps` unit tests (empty campaign; tombstones only) | G4 |
| Shape test too weak | entities/ui keys ⊇ the input's, and `hydrateCampaignState(out)` loads with the reagents present | PS (entities key dropped) |
| Mutant runner counted any nonzero exit as CAUGHT | CAUGHT only when at least one `×` line is printed; nonzero exit without one is ERROR | n/a |

## Mutation results (2026-10-02, after the fixes)
`python3 docs/codex-specs/import-visibility-mutants.py` from the repo root: **49 / 49 CAUGHT, 0 ERROR, 0 SURVIVED** (every catch is at least one failing test). M1, M4 and M5 (claim C, session 7) were scratch mutants and are not in the script; their code is unchanged and its tests are in the run below via M2/M3/T1.

```
M2 failed unlock enables GM: CAUGHT (1 failing) — × a wrong password leaves GM mode off and shows the failure 136ms
M3 unlock skips merged-state dispatch: CAUGHT (3 failing) — × the right password restores GM secrets and enables GM mode 101ms
B0 lock scoped to the component (cleared on unmount): CAUGHT (1 failing) — × a locked file with a running combat can still be unlocked after the shell remounts 1080m
PA gm flags kept: CAUGHT (1 failing) — × (A) turns GM mode off 6ms
PB checkpoints kept: CAUGHT (3 failing) — × leaves no GM secret anywhere in the projection 8ms
PC1 aspects off-by-one: CAUGHT (4 failing) — × leaves no GM secret anywhere in the projection 12ms
PC2 real aspects despite false profile: CAUGHT (5 failing) — × leaves no GM secret anywhere in the projection 11ms
PC3 reagent notes kept: CAUGHT (4 failing) — × leaves no GM secret anywhere in the projection 7ms
PC4 falseProfile kept: CAUGHT (3 failing) — × leaves no GM secret anywhere in the projection 10ms
PC5 real roles kept: CAUGHT (4 failing) — × leaves no GM secret anywhere in the projection 11ms
PC6 showObviousRoles ignored: CAUGHT (1 failing) — × obvious roles stay hidden when the campaign turns them off 5ms
PC7 level-4 fields leak below 4: CAUGHT (5 failing) — × leaves no GM secret anywhere in the projection 11ms
U1 real family/potency kept at level 4: CAUGHT (2 failing) — × a full identification of a disguised reagent shows the false profile 3ms
U1b family/potency never gated: CAUGHT (6 failing) — × leaves no GM secret anywhere in the projection 7ms
PD1 formula notes kept: CAUGHT (3 failing) — × leaves no GM secret anywhere in the projection 8ms
PD2 batch gmNotes kept: CAUGHT (3 failing) — × leaves no GM secret anywhere in the projection 14ms
PD3 hazardEvaluation kept: CAUGHT (3 failing) — × leaves no GM secret anywhere in the projection 10ms
PE effect gm notes always kept: CAUGHT (3 failing) — × leaves no GM secret anywhere in the projection 11ms
PE2 effect gm notes always dropped: CAUGHT (1 failing) — × (E) keeps effect GM notes only when shared with players 3ms
PF location gmNotes kept: CAUGHT (3 failing) — × leaves no GM secret anywhere in the projection 14ms
PG1 gmOnly logs kept: CAUGHT (4 failing) — × leaves no GM secret anywhere in the projection 7ms
PG2 mixed not masked: CAUGHT (4 failing) — × leaves no GM secret anywhere in the projection 7ms
PG3 mixed meta kept (V2): CAUGHT (3 failing) — × leaves no GM secret anywhere in the projection 14ms
PG4 mixed title kept (V2): CAUGHT (2 failing) — × (G) drops GM-only log entries and replaces mixed ones with their masked text 4ms
PH1 gm markers kept: CAUGHT (3 failing) — × leaves no GM secret anywhere in the projection 10ms
PH2 tile markerIds not cleaned: CAUGHT (1 failing) — × drops GM markers and their tile references 4ms
PH3 gmOnly layers kept: CAUGHT (3 failing) — × leaves no GM secret anywhere in the projection 14ms
PH4 hidden tokens kept: CAUGHT (1 failing) — × uses the player label, drops hidden tokens, and keeps hidden tokens still in combat 8ms
PH5 combat exemption removed: CAUGHT (1 failing) — × uses the player label, drops hidden tokens, and keeps hidden tokens still in combat 3ms
PH6 player label not applied: CAUGHT (3 failing) — × leaves no GM secret anywhere in the projection 7ms
PH7 GM stamps kept (V1): CAUGHT (2 failing) — × a locked export does not ship the bytes of the GM stamp library 7ms
PS shape: entities key dropped: CAUGHT (1 failing) — × keeps the campaign shape so the player client can load it 7ms
PI legacy appState not redacted: CAUGHT (3 failing) — × leaves no GM secret anywhere in the projection 7ms
PX shallow copy mutates input: CAUGHT (3 failing) — × (B) drops checkpoint snapshots 4ms
W1 splitState public unprojected: CAUGHT (4 failing) — × splitState public carries no GM secret; gm keeps them all 7ms
W2 locked export collects GM assets: CAUGHT (2 failing) — × a locked export ships only player-visible asset bytes in plaintext 10ms
S1 only Player projected: CAUGHT (1 failing) — × a spectator receives the projection too 6ms
S2 unparseable returns raw: CAUGHT (1 failing) — × unparseable stored state is a 500 for players, never the raw text 7ms
S3 nobody projected: CAUGHT (3 failing) — × a player receives the projection, not the raw state 8ms
G1 running combat not reported: CAUGHT (1 failing) — × warns when a running encounter or combat history would reach players 83ms
G2 history not reported: CAUGHT (1 failing) — × warns when a running encounter or combat history would reach players 55ms
G4 tombstones not reported: CAUGHT (1 failing) — × reports combat records when only tombstones are present 7ms
V4 export allowed while lock pending: CAUGHT (1 failing) — × exports are disabled while GM content is locked, and enabled again after unlock 75ms
V5 locked import trusts the public half: CAUGHT (1 failing) — × a locked file whose public half carries secrets and GM flags loads only the player view 
V3 unlock note missing: CAUGHT (1 failing) — × the unlock dialog says the file replaces the campaign and where changes since import are
T1 file input not reset: CAUGHT (2 failing) — × an unlocked import replaces the campaign state 164ms
T2 failed unlock changes the campaign: CAUGHT (1 failing) — × a wrong password leaves GM mode off and shows the failure 144ms
T3 unlock checkpoint unlabelled: CAUGHT (1 failing) — × the right password restores GM secrets and enables GM mode 117ms
G3 panel ignores gaps: CAUGHT (1 failing) — × warns when a running encounter or combat history would reach players 1022ms
```

## Deferred (not in this phase)
See the phase status section of `docs/REFACTOR_HANDOFF.md`: combat sessions/history/tombstones, fog of war, persistent condition reveal state, the asset GET route, the pending lock's persistence across reloads, and the owner decisions (GM-authored libraries the UI does not hide, three UI leaks, V3 merge).
