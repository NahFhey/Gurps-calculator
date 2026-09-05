# DISPATCH: asset store separation — part B (server asset endpoints + client sync)

You are working in a git worktree on branch `codex/asset-store` of a GURPS virtual tabletop
(React 18 + TypeScript strict + Vite; Express + Socket.io + sql.js server in `server/`; shared
protocol types in `shared/`). Part A already landed on this branch: read `DISPATCH-asset-store.md`
for its API, then `src/assets/assetStore.ts`, `src/assets/assetMigration.ts`, and the changed
`MapImageLayer` in `src/types/map.ts`. Do not commit. Do not run `npm install`. Do not add
`as any`, `@ts-ignore`, or `@ts-expect-error`. Use `import type` for type-only imports.

## Background (why)

Map image pixels now live in a client-side content-addressed asset store and campaign state
references them by `assetId` (SHA-256 hex of the bytes). Multiplayer still ships only the state
JSON: the host uploads it once at host time (`hostGame` in `src/net/ConnectionManager.ts:87`,
called from `src/components/ConnectionDialog.tsx:43`), players fetch it on join (`joinGame`, :138)
and whenever the server emits `STATE_UPDATED` (`src/net/SyncProvider.tsx:103-112` →
`fetchState`). A player who receives a state referencing assets they do not have sees missing
images. This part adds asset upload/download to the server and makes the client push assets when
hosting and pull missing ones when receiving state.

## Deliverables

### B1. Server storage — `server/src/db.ts`

- New table, created in the same `initDB` block as the others (:49-68):
  `assets(campaign_id TEXT NOT NULL, id TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (campaign_id, id), FOREIGN KEY (campaign_id) REFERENCES campaigns(id))`.
  Existing databases must get the table on open (`CREATE TABLE IF NOT EXISTS`).
- Bytes go on disk, not in the sql.js file (the whole DB is rewritten on every `saveDB`):
  `path.join(DATA_DIR, 'assets', campaignId, assetId)` — respecting `setDataDir` (:25). Write via
  temp file + rename like `saveDB` (:83-89).
- Helpers: `putAsset(campaignId, id, mime, bytes: Uint8Array): { created: boolean }` (idempotent),
  `getAssetMeta(campaignId, id): { mime; size; createdAt } | null`, `readAssetBytes(campaignId, id): Uint8Array | null`,
  `listAssets(campaignId): { id; mime; size }[]`, `getCampaignAssetTotal(campaignId): number` (bytes).
- Validate `campaignId` and `id` before touching the filesystem: `id` must match `/^[a-f0-9]{64}$/`,
  `campaignId` must be an existing campaign row. Never build a path from an unvalidated string.

### B2. Routes — `server/src/routes.ts` and `server/src/index.ts`

Constants next to `MAX_STATE_SIZE` (:31): `MAX_ASSET_SIZE = 8 * 1024 * 1024`,
`MAX_CAMPAIGN_ASSET_TOTAL = 256 * 1024 * 1024`.

- `PUT /api/campaigns/:id/assets/:assetId` — auth + `requireRole(Role.GM)` + `requireCampaignAccess`
  (same stack as `PUT /campaigns/:id/state`, :105-109). Body is the raw bytes: mount
  `express.raw({ type: () => true, limit: MAX_ASSET_SIZE })` on this route only (the global
  `express.json` at index.ts:122 must not try to parse it). `Content-Type` header is the mime; only
  `image/jpeg`, `image/png`, `image/webp` are accepted (415 otherwise). Server computes SHA-256 of the
  body (`node:crypto`) and returns 400 if it differs from `:assetId`. 413 if the body exceeds
  `MAX_ASSET_SIZE` or would push the campaign over `MAX_CAMPAIGN_ASSET_TOTAL`. 201 on create, 200 if
  already present. Response JSON `{ id, size, created }`.
- `GET /api/campaigns/:id/assets/:assetId` — auth + `requireCampaignAccess` (any role). Returns the
  bytes with the stored `Content-Type`, `Content-Length`, and `Cache-Control: private, max-age=31536000, immutable`
  (content-addressed, so this is safe). 404 if missing.
- `HEAD` for the same path with the same headers and no body.
- `GET /api/campaigns/:id/assets` — auth + `requireCampaignAccess`. JSON `{ assets: [{ id, mime, size }] }`.
- Rate limiting: the global `/api` limiter at index.ts:125 is 100/min per IP; a map with many layers
  would trip it on join. Give `/api/campaigns/:id/assets` its own limiter of 600/min per IP mounted
  before the general one, or exclude that path prefix from the general limiter via its `skip`
  option. Either is fine; say which in your summary.
- Add the route paths and the `{ id, mime, size }` shape to `shared/protocol.ts` as exported
  constants/types so client and server share them.

### B3. Client transport — `src/net/ConnectionManager.ts`

Following the style of `pushState`/`fetchState` (:213-245):
- `uploadAsset(id: AssetId, bytes: Uint8Array, mime: string): Promise<{ created: boolean }>`
- `fetchAsset(id: AssetId): Promise<{ bytes: Uint8Array; mime: string } | null>` (null on 404)
- `listRemoteAssets(): Promise<{ id: AssetId; mime: string; size: number }[]>`
All use the current `campaignId` and auth token the way the existing methods do.

### B4. Sync helpers — new `src/net/assetSync.ts`

```ts
export interface AssetSyncProgress { total: number; done: number; failed: AssetId[] }

/** Upload every asset referenced by `state` (collectReferencedAssetIds) that the server does not
 *  already have (one listRemoteAssets call, then diff). Missing locally → counted in `failed`, not thrown. */
export async function pushReferencedAssets(state: CampaignState, opts?: { onProgress?: (p: AssetSyncProgress) => void }): Promise<AssetSyncProgress>;

/** Fetch every asset referenced by `state` that the local store lacks; `put` each. Concurrency 4.
 *  Network failures → `failed`, not thrown. */
export async function pullMissingAssets(state: CampaignState, opts?: { onProgress?: (p: AssetSyncProgress) => void }): Promise<AssetSyncProgress>;
```

Accept an injected `ConnectionManager`-like interface and `AssetStore` as optional trailing
parameters so tests can pass fakes (default to the singletons).

### B5. Wire-in

- Host: in `src/components/ConnectionDialog.tsx` after `hostGame` succeeds, `await pushReferencedAssets(state)`.
  Show a one-line progress ("Uploading map images 3/12…") in the dialog while it runs; on `failed.length > 0`
  show a non-blocking warning listing the count, do not abort hosting.
- Join: after the joined state is hydrated (ConnectionDialog.tsx:57-60), `await pullMissingAssets(hydrated)`
  before dispatching `importCampaignState`, with the same progress line.
- Server state update: in `SyncProvider.tsx` where the fetched JSON is handed to
  `onServerStateUpdate`, hydrate → `pullMissingAssets` → hand over. If the provider currently
  passes raw JSON and hydration happens downstream, pull *after* the downstream hydration instead —
  find the single place the state becomes a `CampaignState` and hook there; do not hydrate twice.
- GM adds a layer while hosting: `mapAddImageLayer` in `src/state/campaignStore.tsx:860` is the
  facade. Do not change the reducer. In `ImageLayersDialog` after a successful `put`, if
  `connectionManager.status` is connected and `connectionManager.role` is `Role.GM` (getters at ConnectionManager.ts:55-58), fire-and-forget `uploadAsset` for that id
  (log failures). Note: live state sync is out of scope — `pushState` has no production caller
  today and you are not adding one.

## Constraints

- Server tests: `cd server && npx vitest run src/__tests__/<file>` (config `server/vitest.config.ts`,
  node environment, supertest pattern in `server/src/__tests__/routes.test.ts:1-40`, tokens via
  `signToken`). Client tests: `npx vitest run <paths>` from the repo root (jsdom).
- `npx tsc --noEmit -p tsconfig.json` at the root and `cd server && npx tsc --noEmit` must both pass.
- No new dependencies. `fetch` is available in both the browser and Node 20.
- Keep every existing test passing: `server/src/__tests__/*.test.ts`, `src/net/__tests__/ConnectionManager.test.ts`.

## Definition of done

1. Both tsc runs clean; the server suite and the targeted client suites pass; you ran them.
2. New tests:
   - `server/src/__tests__/assets.test.ts`: PUT stores and is idempotent (201 then 200); hash mismatch → 400;
     unsupported mime → 415; oversize → 413; player role cannot PUT (403); GET returns bytes + headers;
     HEAD; 404 for unknown; list; asset of campaign A is not readable with campaign B's token;
     invalid `:assetId` format → 400 and no filesystem access; bytes land under `<dataDir>/assets/<campaignId>/`.
   - `src/net/__tests__/assetSync.test.ts`: push skips ids the server already has, reports locally-missing
     ids as failed; pull fetches only what the store lacks, honours 404 as failed, and stores by the
     returned bytes' hash.
3. Final summary: one paragraph on (a) the rate-limit choice, (b) how the join path orders
   hydration, asset pull, and dispatch, (c) anything you could not do and why.
