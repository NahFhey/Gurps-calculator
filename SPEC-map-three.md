# SPEC-map-three — three.js map renderer + elevation + line-of-sight vision

## Background (why)

The GURPS VTT's overworld travel map currently renders as a virtualized grid of
absolutely-positioned DOM divs (`MapGrid.tsx` + `MapTile.tsx`). We are replacing
that view with a real three.js 3D scene — instanced colored tile columns with
per-tile elevation, an orbitable perspective camera, raycast picking, billboard
markers — modeled on a proven renderer from a sibling project. Alongside the
renderer swap, the map system gains **editable elevation** (per terrain, with
per-tile override) and a **line-of-sight vision system**: tiles are revealed when
seen, currently-visible tiles render in full color, revealed-but-out-of-sight
tiles render greyed, and each map can opt out of LOS entirely ("open" vision =
whole map visible).

This is a **full replacement**: `MapGrid.tsx` and `MapTile.tsx` are deleted at
the end, not kept behind a toggle.

All state management, travel, marker, link, and terrain-painting semantics stay
exactly as they are unless this spec says otherwise. Only the view layer and the
specific data-model additions below change.

## Codebase orientation

- React 18 + TypeScript (**`strict: true` — tsc must pass clean, zero new
  `as any`, no `@ts-ignore`**), Tailwind CSS, Vite, Vitest (jsdom), Electron.
- Redux-style state with Immer. Map domain: `src/state/map/mapActions.ts`,
  `src/state/map/mapReducer.ts`. Store wiring: `src/state/campaignStore.tsx`
  (interface `CampaignActions` + implementation lower in the same file).
- Map types: `src/types/map.ts`. Map constants: `src/constants/map.ts`.
- Map utils (pure): `src/utils/mapUtils.ts`. Persistence:
  `src/persistence/campaignStorage.ts`.
- Map UI: `src/components/map/MapPanel.tsx` (thin router holding state +
  dispatch) and `src/components/map/views/*` (pure-ish view components).
- Components must not contain business logic — pure computation goes in
  `src/utils/`, state mutation in reducers.
- Use `import type { ... }` for type-only imports.
- `three@0.185` and `@types/three@0.185` are ALREADY INSTALLED in package.json /
  node_modules. **No network access — do not run npm install.**

## Deliverables (files)

NEW:
1. `src/utils/lineOfSight.ts` — pure elevation + LOS + visibility functions.
2. `src/utils/mapSceneMath.ts` — pure camera math (no `three` imports).
3. `src/components/map/three/MapScene.ts` — the three.js scene owner
   (framework-free class; the only file that imports `three`).
4. `src/components/map/views/Map3DView.tsx` — React wrapper mounting MapScene;
   replaces MapGrid.
5. `src/components/map/views/ElevationDialog.tsx` — small GM dialog for per-tile
   elevation override.
6. `src/utils/__tests__/lineOfSight.test.ts`
7. `src/utils/__tests__/mapSceneMath.test.ts`

MODIFIED:
- `src/types/map.ts`, `src/constants/map.ts`, `src/state/map/mapActions.ts`,
  `src/state/map/mapReducer.ts`, `src/state/campaignStore.tsx`,
  `src/utils/mapUtils.ts`, `src/persistence/campaignStorage.ts`,
  `src/components/map/MapPanel.tsx`, `src/components/map/views/MapHeader.tsx`,
  `src/components/map/views/TerrainEditor.tsx`,
  `src/components/map/views/MapContextMenu.tsx`,
  `src/components/map/views/index.ts` (or `src/components/map/index.ts` —
  whichever re-exports the deleted components),
  `src/state/map/__tests__/mapReducer.test.ts`,
  `src/components/map/views/__tests__/MapViewComponents.test.tsx`.

DELETED:
- `src/components/map/views/MapGrid.tsx`
- `src/components/map/views/MapTile.tsx`
- `src/utils/fogOfWar.ts` (verify it has no importers first; last check showed
  none)
- `getVisibleTileIds` in `src/utils/mapUtils.ts` (replaced by lineOfSight.ts)

At the end, `grep -rn "MapGrid\|MapTile\|fogOfWar\|getVisibleTileIds" src/`
must return zero hits outside this spec file and test-name strings.

## Data model (exact)

In `src/types/map.ts`:

```ts
export type VisionMode = 'lineOfSight' | 'open';

export interface TerrainModel {
  // ...existing fields unchanged...
  /** Elevation in levels (integer >= 0). Omitted = DEFAULT_TERRAIN_ELEVATION. */
  elevation?: number;
}

export interface TileModel {
  // ...existing fields unchanged...
  /** Per-tile elevation override. Omitted/undefined = use terrain elevation. */
  elevationOverride?: number;
}

export interface MapModel {
  // ...existing fields unchanged...
  /** Vision regime for players. Missing on old saves — hydrate to 'lineOfSight'. */
  visionMode: VisionMode;
  /** Sight range in tiles (Chebyshev). Omitted = DEFAULT_SIGHT_RANGE_TILES. */
  sightRangeTiles?: number;
}
```

In `src/constants/map.ts`:

```ts
export const DEFAULT_TERRAIN_ELEVATION = 1;
export const MAX_ELEVATION = 20;
export const DEFAULT_SIGHT_RANGE_TILES = 8;
```

Preset terrains in `createPresetTerrains()` gain explicit `elevation`:
water 0; plains, road, desert, swamp, urban 1; forest 2; hills 2; mountains 4.

`createNewMap` (mapUtils) sets `visionMode: 'lineOfSight'` and leaves
`sightRangeTiles` undefined.

`hydrateMapState` in `src/persistence/campaignStorage.ts` must materialize
`visionMode: map.visionMode ?? 'lineOfSight'` for every hydrated map (old saves
lack the field). No other persistence changes — all new fields are plain
JSON-safe primitives.

## Line of sight (exact algorithm)

`src/utils/lineOfSight.ts`, all pure functions:

```ts
export function getEffectiveElevation(
  map: Pick<MapModel, 'tilesById' | 'terrainById'>,
  tileId: TileId
): number;
```
- tile missing → 0. `tile.elevationOverride` if defined, else terrain's
  `elevation ?? DEFAULT_TERRAIN_ELEVATION`, else (null terrain) 0.

```ts
export function hasLineOfSight(
  map: Pick<MapModel, 'grid' | 'rows' | 'cols' | 'tilesById' | 'terrainById'>,
  fromTileId: TileId,
  toTileId: TileId
): boolean;
```
- Observer eye height `eyeH = getEffectiveElevation(from) + 1`.
- Target height `targetH = getEffectiveElevation(to) + 1`.
- Walk the integer Bresenham line between the two grid positions (row/col).
  For each **intermediate** cell (endpoints excluded) at parameter
  `t = i / steps` (where `steps = max(|dr|, |dc|)` and `i` is the step index),
  the sight ray height is `h(t) = eyeH + (targetH - eyeH) * t`.
- The cell **blocks** sight iff `getEffectiveElevation(cell) >= h(t) - 1e-9`.
- Adjacent tiles (no intermediate cells) always have LOS. A tile has LOS to
  itself.

Consequences to preserve (these become tests): a hill (elev 2) between two
plains tiles (elev 1, eye 2) blocks; looking from a mountain (elev 4, eye 5)
down across that same hill to plains does NOT block; flat water (elev 0)
never blocks between elev-0 shores.

```ts
export function getSightRangeTiles(map: Pick<MapModel, 'sightRangeTiles'>): number;
// map.sightRangeTiles ?? DEFAULT_SIGHT_RANGE_TILES

export function computeVisibleTiles(
  map: Pick<MapModel, 'grid' | 'rows' | 'cols' | 'tilesById' | 'terrainById' | 'sightRangeTiles'>,
  observerTileIds: TileId[]
): Set<TileId>;
```
- Union over observers: every tile within Chebyshev distance
  `getSightRangeTiles(map)` of the observer that `hasLineOfSight` from the
  observer. Includes the observer tile. Observers not on the grid contribute
  nothing. Written to accept multiple observers even though today only the
  party token observes.

## Actions & reducer (exact)

New action in `src/state/map/mapActions.ts`, following the existing pattern
(string constant + interface + creator + union membership + type guard already
handled by the union):

```ts
export const MAP_SET_TILE_ELEVATION = 'MAP_SET_TILE_ELEVATION';
// payload: { mapId: MapId; tileIds: TileId[]; elevation: number | null }
```
- Reducer: for each tile, `elevation === null` → delete `elevationOverride`;
  otherwise set `elevationOverride` to the integer clamped to
  `[0, MAX_ELEVATION]`.

Extend `MAP_UPDATE`'s payload type so `changes` is
`Partial<Pick<MapModel, 'name' | 'description' | 'visionMode' | 'sightRangeTiles'>>`
and the reducer applies all four fields when present (`sightRangeTiles`
clamped to `[1, 30]`, integer).

**Reveal-on-sight** in `src/state/map/mapReducer.ts`:
- In `MAP_SET_PARTY_TILE`: after setting `partyTileId`, if
  `map.visionMode === 'lineOfSight'`, add every tile in
  `computeVisibleTiles(map, [tileId])` to `revealedTileIds`, then run the
  existing `expandMapIfNeeded` logic (reuse the same pattern as
  `MAP_REVEAL_TILES`).
- In `MAP_EXECUTE_TRAVEL`: keep the existing route reveal, and additionally
  (when `visionMode === 'lineOfSight'`) reveal `computeVisibleTiles(map,
  [destinationTileId])` before the expansion check.
- `'open'` mode: no auto-reveal (rendering ignores reveal state in open mode
  anyway).

Store wiring in `src/state/campaignStore.tsx`: add
`mapSetTileElevation(mapId, tileIds, elevation)` to the `CampaignActions`
interface and implementation, and widen `mapUpdateMap`'s `changes` type to
match the new `MAP_UPDATE` payload. Follow the exact style of the neighboring
map actions.

## Rendering — `MapScene.ts` (three.js scene owner)

A plain class (no React imports). Public surface (exact names, so the React
wrapper and tests are stable):

```ts
export interface MapSceneCallbacks {
  onTileClick(tileId: TileId, row: number, col: number, ev: TilePointerEvent): void;
  onTileContextMenu(tileId: TileId, row: number, col: number, ev: TilePointerEvent): void;
  onTilePaintStart(tileId: TileId, row: number, col: number, ev: TilePointerEvent): void;
  onTilePaintEnter(tileId: TileId, row: number, col: number, ev: TilePointerEvent): void;
  onHoverTile(info: { tileId: TileId; row: number; col: number; clientX: number; clientY: number } | null): void;
}
export interface TilePointerEvent { clientX: number; clientY: number; button: number; preventDefault(): void; }

export type FogMode = 'gm' | 'player-los' | 'player-open';

export interface MapSceneFrameData {
  map: MapModel;
  fog: FogMode;
  visibleTileIds: Set<TileId> | null;   // null when fog !== 'player-los'
  selectedTileIds: Set<TileId> | null;
  routeTileIds: TileId[] | null;
  reachableTileIds: Set<TileId> | null;
  paintModeActive: boolean;             // true when GM paint mode is on
  placingParty: boolean;
}

export class MapScene {
  constructor(canvas: HTMLCanvasElement, callbacks: MapSceneCallbacks);
  /** False when WebGL init failed; wrapper shows the fallback banner. */
  readonly ok: boolean;
  update(data: MapSceneFrameData): void;  // diffs and rebuilds as needed
  resize(): void;
  frameParty(): void;                     // recenter camera on party (or map center)
  dispose(): void;                        // full cleanup: geometries, materials, textures, listeners
}
```

Construction and behavior:

- **Renderer**: `new THREE.WebGLRenderer({ canvas, antialias: true })` inside
  try/catch. On throw, set `ok = false` and do nothing else (the wrapper
  renders the fallback banner — this is also what makes jsdom tests work
  without mocking). Handle `webglcontextlost` (prevent default, set a flag,
  surface via an `onContextLost` optional callback or the same banner path)
  and `webglcontextrestored`. `setClearColor('#0a0a0f')`,
  `outputColorSpace = THREE.SRGBColorSpace`, pixel ratio from
  `window.devicePixelRatio`.
- **Camera**: `PerspectiveCamera(45, aspect, 0.1, 500)` positioned from the
  spherical state in `mapSceneMath` (below). Persist camera state per map to
  localStorage key `` `vtt_cam_${map.id}` `` (wrap in try/catch), restore on
  map switch; when absent, frame the party tile (else map center) at the
  default angle.
- **Tiles**: one `THREE.InstancedMesh` of a unit box (`BoxGeometry(1,1,1)`
  translated so its top face is at y=0 scale-independent — same approach as
  "geo.translate(0,-.5,0)" then scale by height and position at
  `y = height`). For each renderable tile: world x = col, z = row (tile center
  at `col + 0.5, row + 0.5`), height `h = max(effElev * TILE_LIFT,
  BASE_PLATE)` with `TILE_LIFT = 0.35`, `BASE_PLATE = 0.06` (so elevation-0
  water still renders a thin slab). XZ instance scale `0.98` so the dark clear
  color shows through as tile borders.
- **Shading, no lights**: `MeshBasicMaterial({ vertexColors: true })` with
  baked per-face vertex color factors on the box geometry — top faces 1.0,
  x-facing sides 0.62, z-facing sides 0.45 — multiplied by the per-instance
  color (`setColorAt`). Colors in sRGB via `THREE.Color().setStyle(hex)`.
- **Per-instance color by fog regime** (recomputed in `update`):
  - Base color: terrain color; null terrain `#1f2937`.
  - `gm`: revealed → base; unrevealed → base × 0.4. All tiles rendered.
  - `player-open`: every tile base color, all rendered.
  - `player-los`: visible → base; revealed-but-not-visible → greyed
    (lerp toward its luminance grey by 0.7, then × 0.5 brightness);
    unrevealed-and-not-visible → **not rendered at all** (void).
- **Overlay highlight quads**: a second small `InstancedMesh` of
  `PlaneGeometry(1,1)` rotated flat, `MeshBasicMaterial({ transparent: true,
  opacity: 0.4, depthWrite: false })`, one instance per highlighted tile,
  placed `0.02` above that tile's top. Colors: selected `#facc15`, route
  `#60a5fa`, reachable `#22c55e`, hover `#ffffff` (hover opacity ~0.25).
  Priority when a tile is in several sets: route > selected > reachable.
- **Party token**: white sphere (`SphereGeometry(0.22)`, basic material
  `#ffffff`) at party tile center, resting on the tile top, plus a flat
  white ring/disc quad under it at ~0.5 tile size for glow. Hidden when the
  party is not on this map. In `player-los` mode the party token is always
  shown (the party sees itself).
- **Markers**: one `THREE.Sprite` per tile-with-visible-markers, using a
  canvas-baked pin texture (a simple filled circle-on-triangle pin shape,
  white with dark outline, ~64px canvas — bake once, reuse the texture).
  Scale ~0.5 tile, anchored so the pin tip sits at the tile top center.
  Visibility filter identical to the old MapTile: GM sees all markers,
  players only `visibility === 'player'` markers, and markers only appear on
  tiles the current fog regime renders. When a tile has multiple visible
  markers, render one pin (no count badge needed).
- **Links**: small cyan (`#22d3ee`) octahedron (`OctahedronGeometry(0.12)`)
  floating 0.3 above the tile top corner (offset +0.3,+0.3 in xz from
  center) on tiles with `linkIds.length > 0`, same fog gating.
- **Render loop**: render-on-demand. Maintain a `needsRender` flag set by
  `update()`, camera input, hover changes, and resize; a single rAF loop
  renders only when the flag is set then clears it. No continuous rendering
  when idle.
- **Rebuild strategy**: `update(data)` stores the new frame data; if the
  `MapModel` object identity, `rows`, `cols`, or fog inputs changed, rebuild
  instance buffers (dispose old geometries/materials properly). Immer gives
  a new map object on every state change, so a full instanced rebuild per
  map change is acceptable — it is a handful of milliseconds at overworld
  scale. Camera state must survive rebuilds. Do NOT recreate the renderer.
- **Picking**: raycast against the tile `InstancedMesh` (instanceId → row/col
  → tileId). Store the instanceId→(row,col,tileId) table at build time.

### Camera math — `mapSceneMath.ts` (pure, no three imports)

```ts
export interface CameraState { azimuth: number; elevation: number; distance: number; targetX: number; targetZ: number; }
export const CAMERA_DEFAULT: Omit<CameraState, 'targetX' | 'targetZ'>; // azimuth 0, elevation ~0.96 rad (55°), distance 14
export function clampCamera(s: CameraState, cols: number, rows: number): CameraState;
export function orbit(s: CameraState, dAz: number, dEl: number, cols: number, rows: number): CameraState;
export function zoom(s: CameraState, factor: number, cols: number, rows: number): CameraState;
export function pan(s: CameraState, dx: number, dz: number, cols: number, rows: number): CameraState;
export function dragPan(s: CameraState, dxPx: number, dyPx: number, viewportHeightPx: number, fovDeg: number, cols: number, rows: number): CameraState;
export function cameraPosition(s: CameraState): [number, number, number]; // spherical → cartesian around (targetX, 0, targetZ)
export function frameTiles(row: number, col: number, cols: number, rows: number): CameraState; // default framing centered on a tile
```

Clamps: elevation angle 15°–85° (radians), distance `[3, max(cols, rows) * 2]`,
target clamped to the grid rectangle expanded by 2 tiles. Azimuth wraps freely.
`dragPan` converts pixel deltas to world units at the target plane
(`worldPerPx = 2 * distance * tan(fov/2) / viewportHeightPx`) and moves the
target opposite the drag, rotated by azimuth. All functions return new objects
(no mutation).

### Input (implemented in MapScene, using pointer events on the canvas)

- **Wheel**: zoom (factor per tick ~1.1), `preventDefault`.
- **Left button**: press → track; move beyond 5px → orbit drag
  (`dAz ∝ dxPx`, `dEl ∝ dyPx`), UNLESS `paintModeActive` — then press fires
  `onTilePaintStart(tile)` immediately and every raycast-entered new tile
  during the drag fires `onTilePaintEnter` (no orbit on left-drag in paint
  mode). Release under 5px with no paint mode → `onTileClick`.
- **Right button**: press → track; move beyond 5px → pan drag; release under
  5px → `onTileContextMenu` (suppress the native contextmenu event on the
  canvas either way).
- **Middle-drag**: pan.
- **Hover** (pointermove, no buttons): raycast; when the hovered tile changes,
  call `onHoverTile` with tile + client coords (or null when leaving the
  board). Also drives the hover highlight quad.
- Camera changes persist to localStorage (throttled or on pointerup —
  pointerup is fine).

## `Map3DView.tsx` (React wrapper)

Props (mirrors what MapPanel already computes — keep MapPanel's diff small):

```ts
interface Map3DViewProps {
  map: MapModel;
  isGmMode: boolean;
  visionMode: VisionMode;
  visibleTileIds?: Set<TileId>;
  selectedTileIds?: Set<TileId>;
  routeTileIds?: TileId[];
  reachableTileIds?: Set<TileId>;
  paintModeActive: boolean;
  placingParty: boolean;
  onTileClick?: (tileId: TileId, row: number, col: number) => void;
  onTileContextMenu?: (tileId: TileId, row: number, col: number, e: TilePointerEvent) => void;
  onTilePaintStart?: (tileId: TileId, row: number, col: number) => void;
  onTilePaintEnter?: (tileId: TileId, row: number, col: number) => void;
}
```

- Creates the `MapScene` once on mount (canvas ref + `useEffect`), disposes on
  unmount. If `scene.ok` is false, render a fallback `<div>` with a visible
  message: "3D map unavailable — WebGL could not start." styled like an error
  banner (this is what jsdom component tests assert).
- A `ResizeObserver` on the container calls `scene.resize()`.
- Every prop change funnels into one `scene.update({...})` effect. Fog mode
  derivation: `isGmMode` → `'gm'`; else `visionMode === 'open'` →
  `'player-open'`; else `'player-los'`.
- Renders the hover tooltip: an absolutely-positioned small dark div near the
  cursor showing what the old MapTile `title` showed — terrain name (or
  "Unassigned"), `(row, col)`, "Party here", "N marker(s)", "Has links",
  and now also `Elev N`. Driven by `onHoverTile`.
- Renders a "frame party" button (crosshair icon, top-right overlay) calling
  `scene.frameParty()`. The old zoom % buttons are gone (wheel zooms).

## MapPanel changes

- Replace the `MapGrid` usage with `Map3DView`.
- `visibleTileIds` memo becomes: GM or `visionMode === 'open'` → `undefined`;
  else `computeVisibleTiles(activeMap, activeMap.partyTileId ? [activeMap.partyTileId] : [])`.
  Delete the old travel-mode-based vision logic and the
  `getVisibleTileIds`/`activeTravelModeForVision` code.
- Painting: `onTilePaintStart` / `onTilePaintEnter` dispatch
  `mapSetTileTerrain` exactly as the old mouseDown/mouseEnter handlers did
  (travel wizard open still disables painting; keep the `isPainting`-style
  guards where still relevant — MapScene owns drag tracking now, so MapPanel
  can drop its `isPainting` state and window mouseup listener).
- `paintModeActive` = `interactionMode === 'paint' && !!selectedTerrainId &&
  isGmMode && !showTravelWizard`.
- Context menu handler signature changes from `React.MouseEvent` to
  `TilePointerEvent` (it only uses preventDefault/clientX/clientY).
- New handler for the ElevationDialog: local state
  `elevationDialogTileIds: TileId[] | null`; confirming dispatches
  `mapSetTileElevation(mapId, tileIds, valueOrNull)`.

## UI changes

**MapHeader**: add a GM-only settings control (gear icon button) opening a
small popover for the active map: a Vision select (`Line of sight` / `Open`)
bound to `map.visionMode`, and a Sight range number input (1–30) bound to
`map.sightRangeTiles ?? DEFAULT_SIGHT_RANGE_TILES`. Changes dispatch through a
new `onUpdateMapSettings(changes: Partial<Pick<MapModel, 'visionMode' | 'sightRangeTiles'>>)`
prop wired in MapPanel to `actions.mapUpdateMap`. Follow the existing dropdown
pattern in the same file for popover styling/behavior.

**TerrainEditor**: add an "Elevation" number input (integer 0–20, default
`DEFAULT_TERRAIN_ELEVATION`), included in the confirmed `TerrainModel`.

**MapContextMenu**: add a "Set Elevation…" item (visible when
`selectedTerrainId`-independent — always available to the GM). Clicking calls a
new `onSetElevation(tileIds: TileId[])` prop with either the current selection
(when non-empty AND it contains the right-clicked tile) or just the
right-clicked tile. MapPanel opens `ElevationDialog` with those ids.

**ElevationDialog**: modal matching the styling of MarkerEditor/TerrainEditor
(dark panel, Tailwind, Confirm/Cancel). Contents: number input (0–20), a
"Clear override (use terrain elevation)" button, and a note showing how many
tiles are affected. Confirm → `onConfirm(elevation: number | null)`.

## Tests (definition of done)

Use the existing test styles as reference: `src/state/map/__tests__/mapReducer.test.ts`
for reducer patterns, `MapViewComponents.test.tsx` for component patterns
(testing-library). Real-ish data: build maps via `createNewMap` / the helpers
the existing tests use, not hand-rolled cleaner shapes.

1. `src/utils/__tests__/lineOfSight.test.ts` — at least 12 cases:
   effective-elevation resolution (terrain default, per-tile override, null
   terrain → 0, missing elevation → DEFAULT_TERRAIN_ELEVATION); adjacent
   always visible; Chebyshev range cutoff; hill (2) blocks between plains (1);
   mountain observer (4) sees over hill (2) to plains (1); water corridor
   never blocks; per-tile override flipping a result; multiple observers
   union; observer off-grid contributes nothing; sight range default and
   per-map override respected.
2. `src/utils/__tests__/mapSceneMath.test.ts` — clamps (elevation, distance,
   target), azimuth wrap, zoom factor, dragPan direction/scale sanity,
   frameTiles centering, no-mutation of inputs.
3. `mapReducer.test.ts` additions — MAP_SET_TILE_ELEVATION set/clamp/clear on
   one and many tiles; MAP_UPDATE applying visionMode + sightRangeTiles
   (with clamping); MAP_SET_PARTY_TILE auto-reveals LOS-visible tiles in
   lineOfSight mode and does NOT in open mode; MAP_EXECUTE_TRAVEL reveals
   destination-visible tiles in lineOfSight mode.
4. `MapViewComponents.test.tsx` — delete the MapTile describe block; add:
   Map3DView renders the WebGL-unavailable fallback banner under jsdom
   without crashing; MapHeader settings popover renders and fires
   `onUpdateMapSettings`; MapContextMenu shows "Set Elevation…" and fires
   `onSetElevation`; ElevationDialog confirm/clear/cancel behavior.
5. Keep every other existing test green. If a test pinned deleted machinery
   (MapGrid/MapTile/getVisibleTileIds), rewrite behavior pins onto the new
   modules and delete machinery pins.

**Self-verification (run these yourself and fix failures before finishing):**

```bash
npx tsc -p tsconfig.json --noEmit
npx vitest run
npm run build
```

All three must exit 0. The vitest full suite takes ~15s here. Do not skip or
xfail anything to get green.

## Out of scope (do not touch)

Travel wizard internals, route finding (`mapRouter.ts`), travel time, markers'
data model, links' data model, multiplayer (`src/net/`, `server/`,
`shared/`), combat map, any other subsystem. No new npm dependencies. No
`package.json` script changes. Do not commit — leave all changes in the
working tree.

## Final summary (required)

End with one paragraph covering: design decisions you made where the spec left
room, especially (a) anything subtle in the Bresenham/LOS implementation,
(b) how you structured instanced-mesh rebuilds and disposal to avoid GPU
memory leaks, and (c) any deviation from this spec and why.
