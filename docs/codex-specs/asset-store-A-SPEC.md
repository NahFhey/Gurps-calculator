# DISPATCH: asset store separation — part A (client store, migration, renderer, import/export)

You are working in a git worktree on branch `codex/asset-store` of a GURPS virtual tabletop
(React 18 + TypeScript strict + Vite + three.js; Vitest with jsdom). Do not commit. Do not run
`npm install` — `node_modules` is symlinked and complete. Do not touch `server/` or `src/net/` in
this part; a second dispatch covers the multiplayer side. Do not add `as any`, `@ts-ignore`, or
`@ts-expect-error`. Use `import type` for type-only imports. Keep business logic out of components.

## Background (why)

Map image layers (`MapImageLayer` in `src/types/map.ts:193-216`) store their pixels as a base64
JPEG data URL in the `src` field, inside the campaign state. That state is persisted whole to
IndexedDB (`src/persistence/campaignStorage.ts` → `src/utils/storage.ts`), copied into every
combat checkpoint snapshot (`createCheckpointSnapshot`, `src/state/campaignReducer.ts` ~:351),
included verbatim in JSON exports (`src/utils/exportImport.ts`), and uploaded whole to the
multiplayer server (10 MB cap). One 4.5 MB map already blew the localStorage quota and forced the
IndexedDB move. The next roadmap items (a library of room-stamp images) need dozens of images per
campaign, so pixels must leave the state blob. This dispatch moves them into a content-addressed
asset store and makes state reference assets by id.

## Deliverables

### A1. Types — `src/types/map.ts`

Add `export type AssetId = string;` (SHA-256 hex of the asset bytes, lowercase, 64 chars).

Change `MapImageLayer`:
- Add `assetId?: AssetId;` — the stored image. Comment: "Content hash of the image bytes in the asset store."
- Add `mime?: string;` — e.g. `'image/jpeg'`.
- Keep `src?: string;` but make it **optional** and re-comment it as
  "Legacy inline data URL. Ingested into the asset store on load/import; new layers never set it."
- Invariant (document it in a comment): a layer has `assetId` or `src`, never neither after
  ingestion.

Fix every compile error this causes; `npx tsc --noEmit -p tsconfig.json` must be clean at the end.

### A2. Asset store — new `src/assets/assetStore.ts`

```ts
export interface AssetRecord {
  id: AssetId;
  mime: string;
  bytes: Uint8Array;
  size: number;       // bytes.byteLength
  createdAt: number;  // Date.now()
}

export interface AssetStore {
  /** Idempotent: hashing the bytes gives the id; storing an existing id is a no-op. Returns the id. */
  put(bytes: Uint8Array, mime: string): Promise<AssetId>;
  get(id: AssetId): Promise<AssetRecord | null>;
  has(id: AssetId): Promise<boolean>;
  delete(id: AssetId): Promise<void>;
  list(): Promise<AssetId[]>;
  /** Object URL for rendering; cached per id, revoked by `releaseObjectUrl`/`clear`. null if missing. */
  getObjectUrl(id: AssetId): Promise<string | null>;
  releaseObjectUrl(id: AssetId): void;
  /** Remove everything (tests, "reset app" paths). */
  clear(): Promise<void>;
}

export function createIndexedDbAssetStore(): AssetStore;   // DB 'gurps-vtt-assets', store 'assets', version 1, key = id
export function createMemoryAssetStore(): AssetStore;      // Map-backed; used when indexedDB is unavailable and in tests
export function getAssetStore(): AssetStore;               // lazy singleton: IndexedDB if `typeof indexedDB !== 'undefined'` and the open succeeds, else memory (console.warn once)
export function setAssetStoreForTests(store: AssetStore | null): void;
```

- Follow the open/fallback pattern in `src/utils/storage.ts:40-73` (it opens `gurps-vtt-storage`;
  yours is a separate database — do not reuse the `kv` store).
- IndexedDB values are the `AssetRecord` objects; `Uint8Array` is structured-cloneable.
- `getObjectUrl` builds `URL.createObjectURL(new Blob([bytes], { type: mime }))` once per id and
  caches it. In environments without `URL.createObjectURL` (jsdom lacks it) fall back to a data URL
  built from the bytes so the method still returns a usable string.
- Hashing: new `src/assets/sha256.ts` exporting `sha256Hex(bytes: Uint8Array): Promise<string>`
  using `globalThis.crypto.subtle.digest('SHA-256', …)`. Vitest's jsdom environment may not expose
  `crypto.subtle`; if it does not, install `webcrypto` from `node:crypto` onto `globalThis.crypto`
  inside the test files' `beforeAll` (not in production code).

### A3. Data-URL codec — new `src/assets/dataUrl.ts`

```ts
export function parseDataUrl(dataUrl: string): { mime: string; bytes: Uint8Array } | null; // base64 data URLs only; null for anything else
export function toDataUrl(bytes: Uint8Array, mime: string): string;
```

Must work in browsers and in jsdom (`atob`/`btoa` are available in both; avoid `Buffer`).

### A4. Migration and GC — new `src/assets/assetMigration.ts`

```ts
/** Every asset id referenced from state: all maps' imageLayers, plus imageLayers inside any
 *  embedded checkpoint snapshots (see createCheckpointSnapshot in src/state/campaignReducer.ts). */
export function collectReferencedAssetIds(state: CampaignState): Set<AssetId>;

/** For every MapImageLayer in `state` (maps and checkpoint snapshots) that has a data-URL `src`
 *  and no `assetId`: parse it, `put` it in the store, and return a NEW state (do not mutate the
 *  input) where the layer has `assetId` + `mime` set and `src` removed. Layers whose `src` is not
 *  a parseable base64 data URL are left untouched. Returns the same object reference if nothing
 *  changed. Report `{ state, ingested: number }`. */
export async function ingestInlineImageLayers(
  state: CampaignState, store: AssetStore = getAssetStore(),
): Promise<{ state: CampaignState; ingested: number }>;

/** Delete every stored asset not in collectReferencedAssetIds(state). Returns the deleted ids. */
export async function pruneUnreferencedAssets(
  state: CampaignState, store: AssetStore = getAssetStore(),
): Promise<AssetId[]>;
```

Wire it in:
- `loadCampaignState()` in `src/persistence/campaignStorage.ts:257` — after hydration, run
  `ingestInlineImageLayers`; if anything was ingested, save the rewritten state back with the
  existing save path so the next load is clean. Then run `pruneUnreferencedAssets`. Both wrapped so
  an asset-store failure logs and returns the un-migrated state rather than throwing (the map must
  still load with its legacy `src`).
- `importFile()` in `src/utils/exportImport.ts:747` — ingest embedded assets (A5) and inline
  data URLs before returning the result, so imported state is asset-referenced.

### A5. Export / import with assets — `src/utils/exportImport.ts`

The export envelope gains an optional `assets?: Record<AssetId, { mime: string; base64: string }>`
containing every asset referenced by the exported state (public and gm halves both reference the
same ids; include each once). Add `collectExportAssets(state, store?)` (async) and make the two
export entry points and their callers (`src/components/ImportExportPanel.tsx`) await it —
`exportUnlocked` becomes async. On import, `assets` entries are decoded and `put`; if the stored
hash differs from the key (tampered/corrupt), skip that entry and leave the referencing layers
with a dangling `assetId` (they render as missing, see A6) — do not throw. Validation in
`validateImport`/`src/utils/importSchemas.ts` must accept envelopes with and without `assets`.

### A6. Renderer — `src/components/map/three/MapScene.ts` and `src/components/map/views/Map3DView.tsx`

`getImageTexture` (MapScene.ts:744) currently loads `layer.src` synchronously through
`THREE.TextureLoader` and keys its cache on `src`. Change to:
- Cache keyed by layer id storing `{ key: string; texture: THREE.Texture | null }` where `key` is
  `layer.assetId ?? layer.src ?? ''`.
- If the layer has `assetId`: resolve via `getAssetStore().getObjectUrl(id)` asynchronously; while
  resolving, `buildImageLayers` skips that layer's mesh; on resolve, load the texture, set
  `needsRender = true`, and rebuild image layers. If the id is missing from the store, skip the
  mesh and `console.warn` once per id (this is the "renders as missing" behaviour).
- If the layer has only `src`, keep today's synchronous path.
- Dispose textures and release object URLs when a layer is removed or its key changes (extend the
  existing sweep at MapScene.ts:761).

No new props on `Map3DView` are required if the scene reads the singleton store; if you need to
inject the store for tests, add an optional `assetStore?: AssetStore` prop that defaults to the
singleton.

### A7. Import dialog — `src/components/map/views/ImageLayersDialog.tsx`

`importImage` (:28-56) keeps the 2048 px downscale and JPEG 0.85 encoding but produces bytes:
use `canvas.toBlob` → `arrayBuffer` → `Uint8Array`, `put` into the asset store, and build the layer
with `assetId` + `mime` and **no `src`**. Update the `IMAGE_MAX_DIM` comment (:23) — images are no
longer stored in campaign state. Thumbnails (:150) and the aspect probe (:106) resolve the layer's
image through a new hook `useAssetUrl(layer: Pick<MapImageLayer,'assetId'|'src'>): string | null`
in `src/assets/useAssetUrl.ts` (returns `src` directly for legacy layers, otherwise the object URL
once loaded).

### A8. Storage breakdown

`getStorageBreakdown()` in `src/utils/storage.ts:315` lists kv keys with sizes. Add an async
`getAssetStorageTotal(store?): Promise<{ count: number; sizeKB: number }>` in `assetStore.ts`. Do not
change the existing breakdown UI beyond appending one "Map images (N)" row where the breakdown is
rendered, if that is a one-line change; otherwise skip the UI and note it in your summary.

## Constraints

- Vitest jsdom environment has no real IndexedDB; production code must fall back to the memory
  store there. Tests use `setAssetStoreForTests(createMemoryAssetStore())`.
- Test command: `npx vitest run <paths>` for targeted runs. Do **not** run the full suite in one
  go for the final check; run each new/changed test file and then `npx vitest run src/persistence src/utils/__tests__/exportImport src/components/map` (adjust paths to what exists).
- `npx tsc --noEmit -p tsconfig.json` must pass. There is no `typecheck` script; run tsc directly.
- Existing tests must keep passing: `src/utils/__tests__/storage.test.ts`,
  `src/persistence/__tests__/campaignStorage.test.ts`, everything under `src/utils/__tests__`
  touching exportImport, and `src/__tests__/combatIntegration.test.ts`.
- No new dependencies.

## Definition of done

1. tsc clean; the targeted test runs above pass; you ran them yourself and fixed failures.
2. New tests (at least these, in `src/assets/__tests__/`):
   - `assetStore.test.ts`: put is idempotent and returns the sha256 of the bytes; get/has/delete/list; clear; object URL is cached per id.
   - `dataUrl.test.ts`: round trip; rejects non-base64 and non-data-URL input.
   - `assetMigration.test.ts`: a state with two maps and a checkpoint snapshot containing a legacy data-URL layer → `ingestInlineImageLayers` rewrites all three, leaves a non-data-URL `src` alone, returns the same reference when nothing changes; `pruneUnreferencedAssets` deletes only unreferenced ids.
   - `exportImport.assets.test.ts` (place it beside the existing exportImport tests if that is the convention): export a state with an asset-referenced layer → envelope has `assets` with the base64; import that envelope into an empty store → the asset is present and the layer resolves; a corrupt `assets` entry is skipped without throwing; a legacy export with an inline `src` imports and is ingested.
3. `loadCampaignState` migration is covered by one test in `campaignStorage.test.ts`: a stored state with an inline data-URL layer loads with `assetId` set, `src` removed, and the asset in the store.
4. Final summary: one paragraph on design decisions, specifically (a) how the async texture resolve interacts with `buildImageLayers` and disposal, (b) what happens to a layer whose asset is missing, (c) anything in the spec you could not do and why.
