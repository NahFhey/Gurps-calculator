# Typed boundaries (review phase 3) — plan

Written 2026-10-03 (design session, branch `claude/laughing-albattani-7fb610`, from Juono 5ba27f5). No source code was changed in this session.
Inputs: `docs/REFACTOR_HANDOFF.md` ("Import/visibility phase" deferred list and owner decisions; "Next phase"), `docs/codex-specs/REFACTOR_DEEP_REVIEW.md` §3.2, §3.4, §3.6 and §4 phase 3, and a read-only survey of the boundary code (summarised in §1; anchors are at 5ba27f5).

Process (owner's standing instructions): Claude writes the code; one read-only Codex gpt-6.1-sol review round for the whole phase, with a triage file and a `CODEX_PROVENANCE.jsonl` entry; the UI overhaul is out of scope.

## 1. Current boundaries (what crosses, typed how)

### 1.1 Version numbers: three unrelated ones, none on the local save
| Version | Defined | Read |
|---|---|---|
| Export envelope `schemaVersion` `'1.6.5'` | `src/utils/schemaVersioning.ts:16` (`CURRENT_SCHEMA_VERSION`, re-exported `exportImport.ts:53`) | `validateImport` `exportImport.ts:666` (the **only** future-version check), `migrateImport` :714, unlock :852 |
| `state.meta.schemaVersion` `'1.0.0'` | `CAMPAIGN_META`, `src/state/campaignReducer.ts:98` | never read, never bumped; imports overwrite it (:1023) |
| `meta.downtimeSchemaVersion` `2` | `downtimeInitialState.ts:24` | the downtime migrations (`downtimeMigration.ts`) have no production caller |
| localStorage `app_schema_version` | `schemaVersioning.ts:191` | only `storage.ts get()` for keys `appState`/`gmState`, which no production code reads (`useStorage` hook unused). Dead path. |
| Server row `version` integer | `server/src/db.ts:54` | incremented on every PUT; not compared on write |
| Inner combat/reveal/history `version` fields | `combatHelpers.ts`, `combatReveal.ts`, `combatHistory.ts` | combat import validation only |

`migrateData` (`dataMigrations.ts:84`) stamps the target version on an unknown `fromVersion` without migrating (`getMigrationPath` returns `[]`); `compareVersions` treats non-numeric parts as 0; `validateDataForVersion` compares versions as strings.

### 1.2 Local load/save (`src/persistence/campaignStorage.ts`)
- `loadCampaignStateNow` :421 → `readRawStrict` → `hydrateCampaignState(JSON.parse(raw))` :452. `hydrateCampaignState(payload: CampaignState)` :193 takes raw JSON typed as runtime state (Sets arrive as arrays). It runs `removeLegacyTravelState`, `ensureMapTokens`, 12 idempotent `ensure*` repairs, a shallow default merge, and rebuilds three Set fields by hand. It never runs the numbered `migrateTo1_x` chain.
- `hydrateMapState(maps: any)` :171 — the map shape is never validated.
- Save: `serializeCampaignState` :154 → queued `writeWithRevision` (IndexedDB compare-and-swap on `campaignStateRevision`). This is the only optimistic concurrency in the app (cross-tab, local).
- Legacy per-key migration (`dataMigration.ts:476`) builds state with `createCampaignState` and commits via `commitMigratedCampaignState`; `Record<string, any>` throughout :528-754.

### 1.3 Set fields are converted by hand in four places
serialize (`campaignStorage.ts:154`), hydrate (:171/:193), checkpoint snapshot (`campaignReducer.ts:352`), `reviveSet` (`campaignReducer.ts:462`). The Set fields are `combat.reveal.revealedTargets`, `combat.reveal.revealedHP`, `maps.mapsById[*].revealedTileIds`.

### 1.4 Whole-state replacement copies root slices by hand
`importCampaignState` (`campaignReducer.ts:1013`, 17 slices, keeps checkpoints), `applyDebugState` (:1085, does not revive `revealedTileIds`; `DebugPanel.tsx:40` passes `JSON.parse` typed as `CampaignState`), `restoreCheckpoint` (:1107, runs no repairs, so old snapshots restore as-is), `createCheckpointSnapshot` (:352, `as CampaignSnapshot` over arrays; :381 falls back to `rest as unknown as CampaignSnapshot`). Callers cast `draft as CampaignState` at :409, :1006, :1015, :1043.

### 1.5 Export/import (`src/utils/exportImport.ts`, `src/utils/campaignImport.ts`)
- Zod `CampaignImportSchema` (`importSchemas.ts:127`) checks the envelope only (`public`/`gm` are `z.record(z.unknown())`), and :791 then casts `data as CampaignImportEnvelope`, ignoring the Zod output.
- `SerializedCampaignState` (:71) converts only the reveal Sets; `revealedTileIds` is still typed `Set`. Casts: :326, :601, :741 (`migratedState as unknown as CampaignState | LegacyCampaignState`), :748, :750, :812, :844, :517-518. `isCampaignState` (:316) is a 4-key duck check.
- `prepareCampaignImport` (`campaignImport.ts:38`) hydrates `projectCampaignForPlayers(public)` for locked files and `gm ?? public` for unlocked ones.

### 1.6 Server (`server/src`)
- `POST /campaigns` :128: `req.body` is `any`; size check only if `state` is a string; non-string state reaches `createCampaign`.
- `GET /campaigns/:id` :164: GM gets raw `state_json`; other roles get `projectCampaignForPlayers(JSON.parse(state))`.
- `PUT /campaigns/:id/state` :198: size check plus `JSON.parse` succeeds; **last writer wins**. `db.updateCampaignState(id, json)` :146 runs `version = version + 1` with no expected version and reads the version back in a separate query.
- `socket.ts:62` `JOIN_ROOM` destructures an unchecked payload (a null payload throws).
- `db.ts:138/263/275` `getAsObject() as unknown as Row`; `// @ts-ignore` on the sql.js import :8.

### 1.7 Shared code
- `shared/protocol.ts`, `session.ts` have hand-committed `.js` and `.d.ts` twins (no build script produces them). The client imports `shared/protocol` without an extension; Vite and Vitest resolve `.js` before `.ts`, so **the browser runs the `.js` twin while tsc checks the `.ts`**. They agree today; any edit to the `.ts` alone would silently not ship.
- `shared/playerProjection.ts` has no imports, no immer, no `import.meta`; the server imports it with `.js` (NodeNext), the client without. `projectCampaignForPlayers<T>(state: T): T` returns `T` though Sets come back as arrays.
- Root `tsconfig.json` includes only `src` (shared is checked because src imports it); `server/tsconfig.json` is NodeNext with `rootDir: ".."` and includes `../shared/**/*`. `zod` is a root dependency (4.x), **not** a server dependency.

### 1.8 Client network (dormant)
`SyncProvider` and `ConnectionStatus` are not mounted in `App.tsx`; `ConnectionManager.pushState` (:215) has no callers. `res.json()` results are implicit `any` (:100, :111, :154, :225, :242); `SyncProvider.tsx:109` and `ConnectionDialog.tsx:48,72` cast parsed JSON to `CampaignState`. Nothing on the wire carries a schema version.

### 1.9 Combat view, conditions, fog
- `getCombatView` (`src/utils/combatViewFilter.ts:146`): the public overload claims `{participants: Participant[]} | null`; the implementation returns `GMCombatView | PlayerCombatView` whose participants carry `hp: FilteredNumericResource`. Callers at `combatReducer.ts:39`, `combatHelpers.ts:979/1020`, `mapTokens.ts:80`, `useCombatSession.ts:22` receive the wrong type.
- Player view leaks: `maxHP`/`maxFP`/`maxMP` copied raw whatever the reveal mode (:226-228); `log` passed through unfiltered (:186).
- Out-of-combat `PersistedCondition.revealed` lives on `Character.status.conditions` (`src/types/campaign.ts:48-62`).
- Fog: `MapModel.revealedTileIds` + `visionMode`; LOS is computed in components (`MapPanel.tsx:422`, `CombatMapPanel.tsx:148`, `CombatContext.tsx:262`) and fog is applied only at render (`MapScene.ts`). Nothing is projected before transmission.
- `projectCampaignForPlayers` explicitly does not cover combat sessions/history, fog, condition reveal, or assets (`playerProjection.ts:12-14`).

### 1.10 Actions
`CampaignAction` (`campaignReducer.ts:653-864`) is a discriminated union but re-declares crafting/inventory/combat variants inline instead of composing the domain unions; the reducer switch ends in `default: return` (:1492), so it is not exhaustive. Domain guards take `{type: string}` (`isGatheringAction` uses `as any` :278). `AddCustomTemplateAction.payload.template: any` (`craftingActions.ts:63`, mirrored at `campaignReducer.ts:712`, `campaignStore.tsx:283,669`).

### 1.11 Cast counts (production, src/ + server/src)
`as any`: 23 on 19 lines, **none** on these boundaries. `as unknown as`: 26 lines, 9 on boundaries (`exportImport.ts:601,741,748,750`; `campaignReducer.ts:381`; `db.ts:138,263,275`; `combatHistory.ts:260/264`). The boundary problem is the `as CampaignState` family and `JSON.parse`/`req.body`/`res.json()` flowing in as `any`, not `as any`.

## 2. Design

### 2.1 One schema-version contract
- **Format stays a semver string.** A 1.6.5 client already rejects a newer envelope version as "newer"; switching to an integer would make old clients mis-handle new files instead of refusing them. Strict parser: `MAJOR.MINOR.PATCH` of non-negative integers, anything else is `malformed`.
- **One constant**, `CAMPAIGN_SCHEMA_VERSION = '1.7.0'`, in `shared/campaignVersion.ts`, with `parseSchemaVersion`, `compareSchemaVersions`, and `classifySchemaVersion(v) → 'current' | 'older' | 'future' | 'malformed'`. `schemaVersioning.ts` re-exports it; its own `compareVersions` goes.
- **Stamped everywhere state is persisted**: `state.meta.schemaVersion` (local save, server `state_json`, checkpoint snapshots) and the export envelope. `CAMPAIGN_META.schemaVersion` reads the constant.
- **Reading a campaign payload**: a normalized campaign whose `meta.schemaVersion` is below 1.7.0 (including the never-bumped `'1.0.0'`) is "pre-contract": the meta value carries no information, so it gets today's idempotent repairs (`ensure*`), then is stamped 1.7.0. The numbered `migrateTo1_x` chain still runs only for export envelopes, whose version did mean something. From 1.7.0 on, every shape change adds an ordered, pure JSON→JSON migration and bumps the constant.
- **Future-version rejection everywhere**: local load (new `loadIssue` kind `newer-version`; saves stay blocked through the existing `CampaignSaveBlockedError` path, raw bytes kept as today), import (already), checkpoint restore, server POST/PUT (422), dormant sync paths.
- `migrateData` throws on an unknown or malformed `fromVersion` instead of stamping. The dead `app_schema_version` path (`storage.ts get()` migration branch, `useStorage`) is removed in the same step so there is one contract. `meta.downtimeSchemaVersion` is folded in: kept on read for old saves, no longer the authority; the step records whether `downtimeMigration.ts` is needed by any reachable save or is dead (phase 5 then removes it).

### 2.2 Campaign DTO and one codec
- **Type**: `CampaignDTO = Persisted<CampaignState>`, a recursive mapped type in `src/persistence/campaignDto.ts` that turns `Set<T>` into `T[]` (and leaves everything else). Deriving it from the runtime type means a new field is in the DTO automatically; a type test asserts no `Set` survives anywhere in `CampaignDTO` and `CampaignSnapshotDTO`.
- **Codec**: `toCampaignDTO(state)` / `fromCampaignDTO(dto)` in `src/persistence/campaignCodec.ts` are the only place Sets convert. Autosave, export `splitState`, checkpoint creation, checkpoint restore, debug apply, host push and join all go through it. The audited casts live inside the codec and nowhere else.
- **Whole-state replacement**: one `replaceCampaignState(draft, next, policy)` driven by a table typed `Record<keyof CampaignState, 'replace' | 'keep' | ...>` per policy (`import`, `restore`, `debug`). Adding a root key to `CampaignState` fails to compile until every policy decides what to do with it, which fixes review §3.4 "preserved in autosave yet lost on restore". The UI-preservation rules of restore (navigation, selections) are written as entries, not code paths.

### 2.3 Decoder (shared) and deep validation (client)
- **Shared, structural**: `shared/campaignDocument.ts` exports `decodeCampaignPayload(input: unknown): DecodeResult`, `{ ok: true; state: CampaignRootJSON; version: SchemaVersionInfo }` or `{ ok: false; reason: 'not-json' | 'not-a-campaign' | 'malformed-version' | 'future-version'; detail: string }`. `CampaignRootJSON` names the required root keys as JSON objects and keeps every other field. It does not know slice types, because `shared/` cannot import `src/` types (server is NodeNext with `rootDir: ".."`; src uses extensionless bundler imports). The server uses this to validate POST/PUT and nothing more.
- **Client, deep**: `src/persistence/decodeCampaign.ts` = shared decode → pre-contract repairs or migrations → Zod schemas for the slices that have actually broken (maps and `revealedTileIds`, `combat.reveal`, checkpoints, entity id maps, persisted conditions) → `fromCampaignDTO`. Schemas are loose objects (unknown keys kept): **a decoder must never drop data it does not understand**. A round-trip test with unknown fields at root, slice and nested level enforces this.
- Every entry point calls the one decoder: `loadCampaignStateNow`, `prepareCampaignImport`/`unlockGMData`, checkpoint restore, `DebugPanel`, `SyncProvider`, `ConnectionDialog`. `hydrateCampaignState` stays as the "repair" stage inside it, with its parameter retyped to the decoded JSON type.
- **shared/ rules** (enforced by test where possible): relative imports carry `.js`; no imports from `src/`; no immer, no `import.meta`, no DOM; no committed `.js`/`.d.ts` twins.

### 2.4 Server optimistic concurrency
- `PUT /campaigns/:id/state` body `{ state: string, expectedVersion: number }`. Missing or non-integer `expectedVersion` → 400 (there are no external clients). State decoded with the shared decoder: malformed → 400, future version → 422.
- `db.updateCampaignState(id, json, expectedVersion)` → `UPDATE … SET version = version + 1 … WHERE id = ? AND version = ?`, then `db.getRowsModified()`; returns `{ ok: true; version } | { ok: false; currentVersion }`. sql.js is single-threaded, so the one statement is the atomic compare-and-swap.
- Conflict → 409 `{ error: 'version-conflict', currentVersion }`. `ConnectionManager.pushState(state, expectedVersion)` returns that union. No merge; wiring a conflict UI is review phase 8 (multiplayer integration), with SyncProvider mounting.
- Request and event payload schemas (`CreateCampaignRequest`, `UpdateStateRequest`, `JoinRoomPayload`) live in `shared/protocol.ts` with small hand-written guards (or Zod, see Q4). `JOIN_ROOM` with a bad payload emits an error and does not throw.

### 2.5 Player-state DTO (combat, conditions, fog)
The player client today renders `getCombatView(truth, reveal, 'player')`, so stripping truth from state would break it. The design keeps truth types unchanged and adds a precomputed view:
- `getCombatView`'s overloads return `GMCombatView` / `PlayerCombatView`; callers are retyped. Player-view leaks fixed: `maxHP/FP/MP` follow the reveal mode; `log` goes through `combatLogFilter`.
- The pure projection (participant filter, HP bands, condition filtering, the condition-obviousness table it needs) moves to `shared/playerCombat.ts` so the server GET and the locked export run the same code; `src/utils/combatViewFilter.ts` re-exports it.
- `projectCampaignForPlayers` replaces `combat.activeSession` with `combat.playerView: PlayerCombatView`, reduces `entities.combatHistory` to player-safe summaries, and drops `combatTombstones`. `getCombatView(..., 'player')` returns `state.combat.playerView` when the truth session is absent.
- Persistent conditions: non-PC/ally `characters[*].status.conditions` with `revealed: 'closed'` are removed and `'half'` ones reduced by the same rule as `filterConditions`.
- Fog ("explored" fog): for maps with fog enabled, tiles, tokens, structures and stamps outside `revealedTileIds` are removed. Live line-of-sight stays client-side; authoritative vision belongs to multiplayer integration (phase 8) (Q1).
- `playerProjectionGaps` loses the gaps this closes; the locked-export combat warning goes once combat is projected.

### 2.6 Domain action unions
- Each domain exports its `XAction` union; `CampaignAction` is the union of domain unions plus the campaign-level actions (no inline re-declarations).
- Guards become `(a: CampaignAction): a is CombatAction` (no `as any`, no `as typeof CONST`).
- The reducer switch ends in `assertNever(action)`; actions that are intentionally no-ops get explicit cases.
- `AddCustomTemplateAction` payload becomes category-indexed (`{ category: K; template: TemplateByCategory[K] }`).
- `dispatch`'s signature in `campaignStore.tsx` stays `(action: CampaignAction) => void`; only the union tightens.

## 3. Sub-steps (one session each, in order)

Each step: write the failing tests first; then code; then the gate. **Gate** (every step): `npx tsc --noEmit`; `npx vitest run` (full suite); `cd server && npx tsc --noEmit && npx vitest run`; `node scripts/check-theme-tokens.mjs`; `graphify update .`; handoff updated. Browser pane check where named.

| # | Step | Tests first | Extra gate |
|---|---|---|---|
| **TB0** | **Shared hygiene.** Delete `shared/{protocol,session}.{js,d.ts}`; add a test that fails if `shared/` contains a `.js`/`.d.ts` next to a `.ts`, imports from `src/`, uses `import.meta`, or has an extensionless relative import. | the hygiene test (fails on today's twins) | server boots under `npx tsx src/index.ts` (it has no health route; check the listen log line) and `server/` builds with `npx tsc`; client `npx vite build` succeeds |
| **TB1** | **Version contract.** `shared/campaignVersion.ts`; `meta.schemaVersion` stamped; strict compare; `migrateData` throws on unknown/malformed; dead `app_schema_version` path removed; downtime version folded in (§2.1); local load `newer-version` issue with saves blocked. | classify table (current/older/future/malformed incl. `'1.10.0' > '1.9.0'`, `'1.6.x'`); local load of a `1.99.0` save blocks saves and keeps bytes; pre-contract `'1.0.0'` local save loads and is stamped `1.7.0`; import of a `1.99.0` file refused; `migrateData('garbage')` throws | browser: seed a `1.99.0` save, see the banner, confirm no write |
| **TB2** | **DTO and codec.** `Persisted<T>`, `CampaignDTO`, `toCampaignDTO`/`fromCampaignDTO`; the four hand conversions and `SerializedCampaignState` route through it; `replaceCampaignState` + policy table; `createCheckpointSnapshot` without the `as unknown as` fallback. | type test: no `Set` in DTO types; round trip (all three Set fields, checkpoints, combat history) is identity; debug apply revives `revealedTileIds` (fails today); restore of a snapshot keeps every root key the policy says to keep | — |
| **TB3** | **Decoder.** `shared/campaignDocument.ts` + `src/persistence/decodeCampaign.ts`; all client entry points (§2.3) use it; checkpoint restore decodes and repairs old snapshots; the `exportImport.ts`/`campaignImport.ts` casts in §1.5 go. | malformed reveal object and malformed map → `invalid` (not a thrown exception); unknown fields survive load→save at three depths; legacy fixtures from `dataMigration.test.ts` and the export fixtures 1.0.0…1.6.5 still load; restore of a pre-contract snapshot runs repairs | browser: import an old export, unlocked and locked |
| **TB4** | **Server contracts and concurrency.** §2.4. | two PUTs with the same `expectedVersion` → second is 409 with `currentVersion`; missing `expectedVersion` → 400; future-version state → 422; non-string POST `state` → 400; `JOIN_ROOM` with `null` → error event, socket alive; `db.updateCampaignState` CAS unit test | — |
| **TB5a** | **Combat view types + shared projection.** Overload fix, callers retyped, maxHP/log leaks fixed, projection moved to `shared/playerCombat.ts`. | player view with reveal mode hidden has no `maxHP`; player log is filtered; existing combat reveal tests unchanged | — |
| **TB5b** | **Combat in the player projection.** `combat.playerView`, history summaries, tombstones dropped; player client renders from `playerView`; server GET and locked export carry it. | projected state has no participant truth HP/FP/conditions for hidden targets; player-role render of a projected state shows the same bands as today's player render of truth; server GET as player has no `activeSession` | browser: locked export with a running combat, import as player, combat screen renders |
| **TB5c** | **Conditions, fog, GM libraries, UI leaks.** Persistent condition reveal projection; explored-fog projection; the five GM-authored libraries hidden from players (Q5b: `combatCharacters`, `encounterTemplates`, `travelEventTables`/`travelEventSets`, `skillAdvancements[].notes`, `activities.gmOverride`); role guards on the three player-mode UI leaks (Q5c). | closed condition on an NPC absent from projection, PC condition kept; tile/token outside `revealedTileIds` absent on a fog map, present on a no-fog map; each of the five libraries absent from the projection; the three views render no GM field in player mode | browser: player mode on a fogged map |
| **TB6** | **Domain action unions.** §2.6. | type tests (`expectTypeOf`) that each guard narrows; a routing table test that one representative action per domain reaches its reducer; `assertNever` compiles | — |
| **TB7** | **Review round.** One read-only Codex gpt-6.1-sol review of TB0-TB6 (spec in `docs/codex-specs/typed-boundaries-REVIEW-SPEC.md`), triage file, mutants script, `CODEX_PROVENANCE.jsonl` entry, squash, handoff, merge question to Devin. | — | the full gate on the squashed tree |

Size: TB2, TB3 and TB5b are the large ones; if one spills, it splits along its entry points, not across steps.

## 4. Risks
- **God Nodes** (`graphify-out/GRAPH_REPORT.md`): `useCampaignStore()` 198 edges, `Character` 183, `createCampaignState()` 150, `CampaignState` 114, `campaignReducer()` 84, `CombatState` 73. Run `graphify explain` on each before touching it.
  - `campaignReducer`: TB2 (replacement policy), TB6 (union + exhaustive switch). Keep the two in separate steps; TB6 must not change behavior, only types plus the explicit no-op cases.
  - `useCampaignStore`: TB6 tightens `CampaignAction`, which may surface latent type errors at many of its 198 callers. Fix at the source type, not with casts.
  - `Character`: the condition projection works on JSON in `shared/`; `Character`'s type does not change in this phase.
  - `createCampaignState`: TB1 changes the stamped `meta.schemaVersion`; tests that snapshot `meta` will need the constant, not a literal.
  - `CombatState` / `getCombatView`: TB5a's retyping touches the reducer and map tokens; the player render must stay pixel-identical (TB5b browser check).
- **Data loss through validation.** A strict decoder that strips unknown keys would silently delete fields on the next autosave. Loose schemas plus the three-depth unknown-field test are the guard. Do-not-break list (review §6) applies in full.
- **Older clients.** After TB1, exports are 1.7.0; players on older builds get "newer version" (Q2).
- **Shared twins.** Until TB0 lands, any edit to `shared/protocol.ts` must also be made to `protocol.js` or it will not reach the browser.
- **Locked-export shape change.** TB5b changes the public half of locked exports; files exported before TB5b are re-projected on import (V5), so they gain the new shape on load.
- **Electron** is not type-checked or run on draken; this phase does not touch `electron/`.

## 5. Decisions

Recorded by Claude (technical, no owner input needed): semver contract string (§2.1); DTO derived from the runtime type rather than hand-written (§2.2); deep validation client-side, structural validation shared (§2.3); 409 without merge (§2.4); precomputed `playerView` rather than nullable truth fields (§2.5); TB0 deletes the twins rather than generating them.

Owner questions (Devin), asked and answered 2026-10-03. All eight went as recommended.

**Prerequisite from Q4:** before TB3 (the first step that imports `zod` from `shared/`), Devin adds `zod` to `server/package.json` and runs `npm install` in the main checkout's `server/` (worktrees symlink that `node_modules`). Sessions do not run npm install; if `server/node_modules/zod` is missing at TB3, stop and ask.

- **Q1. Player-state scope.** Project combat (session, history, tombstones), persistent condition reveal, and explored fog (`revealedTileIds`) in this phase; leave live line-of-sight vision to multiplayer integration (phase 8). — **Decided 2026-10-03 (Devin): as recommended.**
- **Q2. Older clients.** Accept that exports made after TB1 (schema 1.7.0) are refused by older builds with a "newer version" message, so players must update. — **Decided 2026-10-03 (Devin): as recommended.**
- **Q3. Pre-contract saves.** Treat every existing save as pre-contract (repairs, then stamp 1.7.0) with no version-specific migration; nothing older needs special handling beyond today's repairs. — **Decided 2026-10-03 (Devin): as recommended.**
- **Q4. Zod on the server.** Add `zod` (same 4.x range as the client) to `server/package.json` so shared decoders can use it; you run `npm install` in the main checkout's `server/` (sessions do not run npm install). Alternative: hand-written guards in `shared/`, no new dependency. — **Decided 2026-10-03 (Devin): as recommended.**
- **Q5a. V3 merge-on-unlock.** Keep replace-on-unlock; do not build a merge in this phase. — **Decided 2026-10-03 (Devin): as recommended.**
- **Q5b. GM-authored libraries** (`combatCharacters` NPC library, `encounterTemplates`, `travelEventTables`/`travelEventSets`, `skillAdvancements[].notes`, `activities.gmOverride`). Hide all five from players, folded into TB5c. — **Decided 2026-10-03 (Devin): as recommended.**
- **Q5c. Player-mode UI leaks** (AnalysisView False Profile `:282,431`, BatchesView `hazardEvaluation` `:912`, LocationFormView `gmNotes` `:57`). Fold into TB5c as role guards (not overhaul work). — **Decided 2026-10-03 (Devin): as recommended.**
- **Q6. Injury/hit-location contracts** (review phase 3 lists them; casts at `ActionPanelDamageWorkflow.tsx:67`, `InjuryResolutionPanel.tsx:17`). Move to combat consolidation (phase 7), where that UI is rewritten anyway. — **Decided 2026-10-03 (Devin): as recommended.**
