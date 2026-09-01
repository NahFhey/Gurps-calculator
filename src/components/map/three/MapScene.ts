import * as THREE from 'three';
import type { MapImageLayer, MapModel, TerrainId, TileId } from '../../../types/map';
import { getEffectiveElevation } from '../../../utils/lineOfSight';
import {
  cameraPosition,
  dragPan,
  frameTiles,
  clampCamera,
  orbit,
  tokenOffsets,
  zoom,
  type CameraState,
} from '../../../utils/mapSceneMath';
import { findTileGridPos } from '../../../utils/mapUtils';

export interface TilePointerEvent {
  clientX: number;
  clientY: number;
  button: number;
  preventDefault(): void;
}

export interface MapSceneCallbacks {
  onTileClick(tileId: TileId, row: number, col: number, ev: TilePointerEvent): void;
  onTileContextMenu(tileId: TileId, row: number, col: number, ev: TilePointerEvent): void;
  onTilePaintStart(tileId: TileId, row: number, col: number, ev: TilePointerEvent): void;
  onTilePaintEnter(tileId: TileId, row: number, col: number, ev: TilePointerEvent): void;
  onHoverTile(info: { tileId: TileId; row: number; col: number; clientX: number; clientY: number } | null): void;
  /**
   * Return true to begin dragging the token on this tile (left-drag).
   * When false/absent, a left-drag on the tile orbits the camera as usual.
   */
  onTokenDragStart?(tileId: TileId, row: number, col: number): boolean;
  /** A token drag ended over a different tile. */
  onTokenDrop?(from: TokenDragTile, to: TokenDragTile): void;
  /**
   * Wheel with Ctrl/Cmd ('brush') or Shift ('elevation') held.
   * direction is +1 scrolling up, -1 scrolling down. Return true when
   * handled; false falls through to camera zoom.
   */
  onModifierWheel?(kind: 'brush' | 'elevation', direction: 1 | -1): boolean;
  onContextLost?(): void;
  onContextRestored?(): void;
}

export interface TokenDragTile {
  tileId: TileId;
  row: number;
  col: number;
}

export type FogMode = 'gm' | 'player-los' | 'player-open';

/** A group, vehicle, or combat actor token rendered on a tile. */
export interface MapToken {
  id: string;
  tileId: TileId;
  /** CSS color for the token body (e.g. category color). */
  color: string;
  kind?: 'group' | 'vehicle';
  image?: string;
  label?: string;
  dimmed?: boolean;
  /** Current actor: rendered larger with a white base ring. */
  isCurrent?: boolean;
  /** Selected token: yellow base ring. */
  isSelected?: boolean;
}

export interface MapSceneFrameData {
  map: MapModel;
  fog: FogMode;
  visibleTileIds: Set<TileId> | null;
  selectedTileIds: Set<TileId> | null;
  routeTileIds: TileId[] | null;
  reachableTileIds: Set<TileId> | null;
  tokens: MapToken[] | null;
  paintModeActive: boolean;
  placingToken: boolean;
}

interface PickEntry {
  tileId: TileId;
  row: number;
  col: number;
}

interface PointerDrag {
  button: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  dragged: boolean;
  lastPaintedTileId: TileId | null;
  /** Set when the drag started on a draggable token — moves the token, not the camera. */
  tokenFrom: PickEntry | null;
}

const TILE_LIFT = 0.35;
const BASE_PLATE = 0.06;
const CAMERA_FOV = 45;
const DRAG_THRESHOLD = 5;

export class MapScene {
  private readonly canvas: HTMLCanvasElement;
  private readonly callbacks: MapSceneCallbacks;
  private renderer: THREE.WebGLRenderer | null = null;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 500);
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointerNdc = new THREE.Vector2();
  private cameraState: CameraState = frameTiles(0, 0, 1, 1);
  private data: MapSceneFrameData | null = null;
  private tileMesh: THREE.InstancedMesh | null = null;
  private overlayMesh: THREE.InstancedMesh | null = null;
  private structureMesh: THREE.InstancedMesh | null = null;
  private imageGroup: THREE.Group | null = null;
  /** Data-URL textures cached per image layer so paint rebuilds don't re-decode. */
  private readonly imageTextures = new Map<string, { src: string; texture: THREE.Texture }>();
  /** Round-cropped portrait textures cached by stable token id and source reference. */
  private readonly tokenImageTextures = new Map<string, { src: string; texture: THREE.CanvasTexture }>();
  private markerGroup: THREE.Group | null = null;
  private linkGroup: THREE.Group | null = null;
  private tokenGroup: THREE.Group | null = null;
  private markerTexture: THREE.CanvasTexture | null = null;
  private pickEntries: PickEntry[] = [];
  private renderedTileIds = new Set<TileId>();
  private hoveredTileId: TileId | null = null;
  private pointerDrag: PointerDrag | null = null;
  private needsRender = false;
  private contextLost = false;
  private disposed = false;
  private animationFrame = 0;

  constructor(canvas: HTMLCanvasElement, callbacks: MapSceneCallbacks) {
    this.canvas = canvas;
    this.callbacks = callbacks;
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    } catch {
      this.renderer = null;
      return;
    }

    this.renderer.setClearColor('#0a0a0f');
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.bindEvents();
    this.resize();
    this.animationFrame = requestAnimationFrame(this.renderLoop);
  }

  get ok(): boolean {
    return this.renderer !== null && !this.contextLost;
  }

  update(data: MapSceneFrameData): void {
    if (!this.renderer) return;
    const oldData = this.data;
    const switchedMap = oldData?.map.id !== data.map.id;
    if (switchedMap) {
      if (oldData) this.saveCamera(oldData.map.id);
      this.data = data;
      this.restoreOrFrameCamera();
    } else {
      this.data = data;
    }

    const rebuildTiles = !oldData
      || oldData.map !== data.map
      || oldData.map.rows !== data.map.rows
      || oldData.map.cols !== data.map.cols
      || oldData.fog !== data.fog
      || oldData.visibleTileIds !== data.visibleTileIds
      || oldData.tokens !== data.tokens;
    if (rebuildTiles) this.rebuildWorld();
    else this.rebuildOverlays();
    this.applyCamera();
    this.saveCamera(this.data.map.id);
    this.needsRender = true;
  }

  resize(): void {
    if (!this.renderer) return;
    const rect = this.canvas.parentElement?.getBoundingClientRect() ?? this.canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width || this.canvas.clientWidth || 1));
    const height = Math.max(1, Math.round(rect.height || this.canvas.clientHeight || 1));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.needsRender = true;
  }

  frameActive(tileId: TileId | null): void {
    if (!this.data) return;
    const activePosition = tileId
      ? findTileGridPos(this.data.map, tileId)
      : null;
    const row = activePosition?.row ?? (this.data.map.rows - 1) / 2;
    const col = activePosition?.col ?? (this.data.map.cols - 1) / 2;
    this.cameraState = frameTiles(row, col, this.data.map.cols, this.data.map.rows);
    this.applyCamera();
    this.saveCamera(this.data.map.id);
    this.needsRender = true;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.data) this.saveCamera(this.data.map.id);
    cancelAnimationFrame(this.animationFrame);
    this.unbindEvents();
    this.disposeWorld();
    for (const entry of this.imageTextures.values()) entry.texture.dispose();
    this.imageTextures.clear();
    for (const entry of this.tokenImageTextures.values()) entry.texture.dispose();
    this.tokenImageTextures.clear();
    this.markerTexture?.dispose();
    this.markerTexture = null;
    this.renderer?.dispose();
    this.renderer = null;
  }

  private readonly renderLoop = () => {
    if (this.disposed) return;
    if (this.needsRender && this.renderer && !this.contextLost) {
      this.renderer.render(this.scene, this.camera);
      this.needsRender = false;
    }
    this.animationFrame = requestAnimationFrame(this.renderLoop);
  };

  private bindEvents(): void {
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false });
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('pointercancel', this.onPointerUp);
    this.canvas.addEventListener('pointerleave', this.onPointerLeave);
    this.canvas.addEventListener('contextmenu', this.onContextMenu);
    this.canvas.addEventListener('webglcontextlost', this.onContextLost);
    this.canvas.addEventListener('webglcontextrestored', this.onContextRestored);
  }

  private unbindEvents(): void {
    this.canvas.removeEventListener('wheel', this.onWheel);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerUp);
    this.canvas.removeEventListener('pointerleave', this.onPointerLeave);
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this.onContextRestored);
  }

  private readonly onContextLost = (event: Event) => {
    event.preventDefault();
    this.contextLost = true;
    this.callbacks.onContextLost?.();
  };

  private readonly onContextRestored = () => {
    this.contextLost = false;
    if (this.data) this.rebuildWorld();
    this.callbacks.onContextRestored?.();
    this.needsRender = true;
  };

  private readonly onContextMenu = (event: MouseEvent) => event.preventDefault();

  private readonly onWheel = (event: WheelEvent) => {
    event.preventDefault();
    if (!this.data) return;
    const direction: 1 | -1 = event.deltaY < 0 ? 1 : -1;
    if ((event.ctrlKey || event.metaKey) && this.callbacks.onModifierWheel?.('brush', direction)) {
      return;
    }
    if (event.shiftKey && !event.ctrlKey && !event.metaKey
      && this.callbacks.onModifierWheel?.('elevation', direction)) {
      return;
    }
    this.cameraState = zoom(
      this.cameraState,
      event.deltaY > 0 ? 1.1 : 1 / 1.1,
      this.data.map.cols,
      this.data.map.rows
    );
    this.applyCamera();
    this.saveCamera(this.data.map.id);
    this.needsRender = true;
  };

  private readonly onPointerDown = (event: PointerEvent) => {
    event.preventDefault();
    this.canvas.setPointerCapture?.(event.pointerId);
    this.pointerDrag = {
      button: event.button,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      dragged: false,
      lastPaintedTileId: null,
      tokenFrom: null,
    };
    if (event.button === 0 && this.data?.paintModeActive) {
      const hit = this.pick(event.clientX, event.clientY);
      if (hit) {
        this.pointerDrag.lastPaintedTileId = hit.tileId;
        this.callbacks.onTilePaintStart(hit.tileId, hit.row, hit.col, event);
      }
    } else if (event.button === 0 && this.callbacks.onTokenDragStart) {
      const hit = this.pick(event.clientX, event.clientY);
      if (hit && this.callbacks.onTokenDragStart(hit.tileId, hit.row, hit.col)) {
        this.pointerDrag.tokenFrom = hit;
        this.canvas.style.cursor = 'grabbing';
      }
    }
  };

  private readonly onPointerMove = (event: PointerEvent) => {
    const drag = this.pointerDrag;
    if (!drag) {
      this.updateHover(event.clientX, event.clientY);
      return;
    }
    const totalDx = event.clientX - drag.startX;
    const totalDy = event.clientY - drag.startY;
    if (Math.hypot(totalDx, totalDy) > DRAG_THRESHOLD) drag.dragged = true;

    if (drag.button === 0 && this.data?.paintModeActive) {
      const hit = this.pick(event.clientX, event.clientY);
      if (hit && hit.tileId !== drag.lastPaintedTileId) {
        drag.lastPaintedTileId = hit.tileId;
        this.callbacks.onTilePaintEnter(hit.tileId, hit.row, hit.col, event);
      }
    } else if (drag.tokenFrom) {
      // Token drag: the hover ring tracks the drop target; the camera stays put.
      this.updateHover(event.clientX, event.clientY);
    } else if (drag.dragged && this.data) {
      const dx = event.clientX - drag.lastX;
      const dy = event.clientY - drag.lastY;
      if (drag.button === 0) {
        this.cameraState = orbit(
          this.cameraState,
          -dx * 0.008,
          dy * 0.008,
          this.data.map.cols,
          this.data.map.rows
        );
      } else if (drag.button === 1 || drag.button === 2) {
        this.cameraState = dragPan(
          this.cameraState,
          dx,
          dy,
          Math.max(1, this.canvas.clientHeight),
          CAMERA_FOV,
          this.data.map.cols,
          this.data.map.rows
        );
      }
      this.applyCamera();
      this.needsRender = true;
    }
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
  };

  private readonly onPointerUp = (event: PointerEvent) => {
    const drag = this.pointerDrag;
    this.pointerDrag = null;
    if (!drag) return;
    this.canvas.releasePointerCapture?.(event.pointerId);
    if (drag.tokenFrom) this.canvas.style.cursor = '';
    if (drag.tokenFrom && drag.dragged) {
      const hit = this.pick(event.clientX, event.clientY);
      if (hit && hit.tileId !== drag.tokenFrom.tileId) {
        this.callbacks.onTokenDrop?.(drag.tokenFrom, hit);
      }
    } else if (!drag.dragged && !(drag.button === 0 && this.data?.paintModeActive)) {
      const hit = this.pick(event.clientX, event.clientY);
      if (hit && drag.button === 0) {
        this.callbacks.onTileClick(hit.tileId, hit.row, hit.col, event);
      } else if (hit && drag.button === 2) {
        this.callbacks.onTileContextMenu(hit.tileId, hit.row, hit.col, event);
      }
    }
    if (this.data) this.saveCamera(this.data.map.id);
    this.updateHover(event.clientX, event.clientY);
  };

  private readonly onPointerLeave = () => {
    if (!this.pointerDrag) this.setHoveredTile(null, 0, 0);
  };

  private updateHover(clientX: number, clientY: number): void {
    const hit = this.pick(clientX, clientY);
    this.setHoveredTile(hit, clientX, clientY);
  }

  private setHoveredTile(hit: PickEntry | null, clientX: number, clientY: number): void {
    if ((hit?.tileId ?? null) === this.hoveredTileId) {
      if (hit) this.callbacks.onHoverTile({ ...hit, clientX, clientY });
      return;
    }
    this.hoveredTileId = hit?.tileId ?? null;
    this.callbacks.onHoverTile(hit ? { ...hit, clientX, clientY } : null);
    this.rebuildOverlays();
    this.needsRender = true;
  }

  private pick(clientX: number, clientY: number): PickEntry | null {
    if (!this.tileMesh) return null;
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    this.pointerNdc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const hit = this.raycaster.intersectObject(this.tileMesh, false)[0];
    if (hit?.instanceId === undefined) return null;
    return this.pickEntries[hit.instanceId] ?? null;
  }

  private restoreOrFrameCamera(): void {
    if (!this.data) return;
    try {
      const raw = localStorage.getItem(`vtt_cam_${this.data.map.id}`);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (this.isCameraState(parsed)) {
          this.cameraState = clampCamera(parsed, this.data.map.cols, this.data.map.rows);
          return;
        }
      }
    } catch {
      // Storage is optional (private mode and sandboxed contexts may reject it).
    }
    this.frameActive(null);
  }

  private saveCamera(mapId: string): void {
    try {
      localStorage.setItem(`vtt_cam_${mapId}`, JSON.stringify(this.cameraState));
    } catch {
      // Camera persistence is best effort.
    }
  }

  private isCameraState(value: unknown): value is CameraState {
    if (typeof value !== 'object' || value === null) return false;
    const candidate = value as Record<string, unknown>;
    return ['azimuth', 'elevation', 'distance', 'targetX', 'targetZ']
      .every((key) => typeof candidate[key] === 'number');
  }

  private applyCamera(): void {
    const [x, y, z] = cameraPosition(this.cameraState);
    this.camera.position.set(x, y, z);
    this.camera.lookAt(this.cameraState.targetX, 0, this.cameraState.targetZ);
    this.camera.updateMatrixWorld();
  }

  private rebuildWorld(): void {
    if (!this.data) return;
    this.disposeWorld();
    this.buildTiles();
    this.buildStructures();
    this.buildImageLayers();
    this.buildMarkersAndLinks();
    this.buildTokens();
    this.rebuildOverlays();
  }

  private tileIsRendered(tileId: TileId): boolean {
    if (!this.data) return false;
    if (this.data.fog !== 'player-los') return true;
    return this.data.visibleTileIds?.has(tileId) === true
      || this.data.map.revealedTileIds.has(tileId);
  }

  private tileHeight(tileId: TileId): number {
    if (!this.data) return BASE_PLATE;
    return Math.max(getEffectiveElevation(this.data.map, tileId) * TILE_LIFT, BASE_PLATE);
  }

  private buildTiles(): void {
    if (!this.data) return;
    const entries: PickEntry[] = [];
    for (let row = 0; row < this.data.map.rows; row += 1) {
      for (let col = 0; col < this.data.map.cols; col += 1) {
        const tileId = this.data.map.grid[row][col];
        if (this.tileIsRendered(tileId)) entries.push({ tileId, row, col });
      }
    }

    const geometry = this.createTileGeometry();
    const material = new THREE.MeshBasicMaterial({ vertexColors: true });
    const mesh = new THREE.InstancedMesh(geometry, material, entries.length);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    this.renderedTileIds = new Set();

    entries.forEach((entry, index) => {
      const height = this.tileHeight(entry.tileId);
      dummy.position.set(entry.col + 0.5, height, entry.row + 0.5);
      dummy.scale.set(0.98, height, 0.98);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      this.setTileColor(color, entry.tileId);
      mesh.setColorAt(index, color);
      this.renderedTileIds.add(entry.tileId);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.tileMesh = mesh;
    this.pickEntries = entries;
    this.scene.add(mesh);
  }

  private createTileGeometry(): THREE.BufferGeometry {
    const indexed = new THREE.BoxGeometry(1, 1, 1);
    const geometry = indexed.toNonIndexed();
    indexed.dispose();
    geometry.translate(0, -0.5, 0);
    const normals = geometry.getAttribute('normal');
    const colors = new Float32Array(normals.count * 3);
    for (let index = 0; index < normals.count; index += 1) {
      const factor = Math.abs(normals.getY(index)) > 0.5
        ? 1
        : Math.abs(normals.getX(index)) > 0.5 ? 0.62 : 0.45;
      colors[index * 3] = factor;
      colors[index * 3 + 1] = factor;
      colors[index * 3 + 2] = factor;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geometry;
  }

  private setTileColor(color: THREE.Color, tileId: TileId): void {
    if (!this.data) return;
    const tile = this.data.map.tilesById[tileId];
    const terrain = tile?.terrainId ? this.data.map.terrainById[tile.terrainId] : null;
    this.setTerrainColorWithFog(color, terrain?.color ?? '#1f2937', tileId);
  }

  private setTerrainColorWithFog(color: THREE.Color, style: string, tileId: TileId): void {
    if (!this.data) return;
    color.setStyle(style);
    if (this.data.fog === 'gm' && !this.data.map.revealedTileIds.has(tileId)) {
      color.multiplyScalar(0.4);
    } else if (
      this.data.fog === 'player-los'
      && !this.data.visibleTileIds?.has(tileId)
      && this.data.map.revealedTileIds.has(tileId)
    ) {
      const luminance = color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722;
      color.lerp(new THREE.Color(luminance, luminance, luminance), 0.7).multiplyScalar(0.5);
    }
  }

  private buildStructures(): void {
    if (!this.data) return;
    const cells: Array<{ row: number; col: number; terrainId: TerrainId; base: number; height: number }> = [];
    for (const layer of this.data.map.structureLayers ?? []) {
      if (!layer.visible) continue;
      for (const [tileId, terrainId] of Object.entries(layer.cells)) {
        if (!this.renderedTileIds.has(tileId)) continue;
        const position = findTileGridPos(this.data.map, tileId);
        if (!position) continue;
        cells.push({
          ...position,
          terrainId,
          base: layer.baseElevation,
          height: Math.max(1, layer.heightLevels),
        });
      }
    }
    if (cells.length === 0) return;

    const geometry = this.createTileGeometry();
    const material = new THREE.MeshBasicMaterial({ vertexColors: true });
    const mesh = new THREE.InstancedMesh(geometry, material, cells.length);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    cells.forEach((cell, index) => {
      const top = (cell.base + cell.height) * TILE_LIFT;
      dummy.position.set(cell.col + 0.5, top, cell.row + 0.5);
      dummy.scale.set(0.98, cell.height * TILE_LIFT, 0.98);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      const tileId = this.data!.map.grid[cell.row][cell.col];
      const terrain = this.data!.map.terrainById[cell.terrainId];
      this.setTerrainColorWithFog(color, terrain?.color ?? '#6b7280', tileId);
      mesh.setColorAt(index, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.structureMesh = mesh;
    this.scene.add(mesh);
  }

  private imageLayerIsRendered(layer: MapImageLayer): boolean {
    if (!this.data || !layer.visible) return false;
    // Player LOS fog can't clip an image plane, so images would leak hidden
    // map areas — skip them entirely in that regime.
    if (this.data.fog === 'player-los') return false;
    if (layer.gmOnly && this.data.fog !== 'gm') return false;
    return true;
  }

  private getImageTexture(layer: MapImageLayer): THREE.Texture {
    const cached = this.imageTextures.get(layer.id);
    if (cached && cached.src === layer.src) return cached.texture;
    cached?.texture.dispose();
    const texture = new THREE.TextureLoader().load(layer.src, () => {
      this.needsRender = true;
    });
    texture.colorSpace = THREE.SRGBColorSpace;
    this.imageTextures.set(layer.id, { src: layer.src, texture });
    return texture;
  }

  private buildImageLayers(): void {
    if (!this.data) return;
    const layers = (this.data.map.imageLayers ?? []).filter((layer) => this.imageLayerIsRendered(layer));
    // Drop cached textures for layers that no longer exist.
    const liveIds = new Set((this.data.map.imageLayers ?? []).map((layer) => layer.id));
    for (const [id, entry] of this.imageTextures) {
      if (!liveIds.has(id)) {
        entry.texture.dispose();
        this.imageTextures.delete(id);
      }
    }
    if (layers.length === 0) return;

    const group = new THREE.Group();
    layers.forEach((layer, index) => {
      const overlay = layer.placement === 'overlay';
      const material = new THREE.MeshBasicMaterial({
        map: this.getImageTexture(layer),
        transparent: true,
        opacity: Math.max(0, Math.min(1, layer.opacity)),
        depthWrite: false,
        depthTest: !overlay,
        side: THREE.DoubleSide,
      });
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
      plane.rotation.x = -Math.PI / 2;
      plane.scale.set(layer.width, layer.height, 1);
      // Skin the tops of tiles at this elevation (same floor formula as tileHeight),
      // so an underlay at the map's ground level draws over the ground tiles.
      plane.position.set(
        layer.x + layer.width / 2,
        Math.max(layer.elevation * TILE_LIFT, BASE_PLATE) + 0.01 + index * 0.001,
        layer.y + layer.height / 2
      );
      // Overlays skip the depth test; renderOrder keeps them above everything.
      plane.renderOrder = overlay ? 1000 + index : 0;
      group.add(plane);
    });
    this.imageGroup = group;
    this.scene.add(group);
  }

  private rebuildOverlays(): void {
    if (this.overlayMesh) {
      this.scene.remove(this.overlayMesh);
      this.overlayMesh.geometry.dispose();
      this.disposeMaterial(this.overlayMesh.material);
      this.overlayMesh = null;
    }
    if (!this.data) return;
    const route = new Set(this.data.routeTileIds ?? []);
    const highlights = new Map<TileId, string>();
    for (const tileId of this.data.reachableTileIds ?? []) highlights.set(tileId, '#22c55e');
    for (const tileId of this.data.selectedTileIds ?? []) highlights.set(tileId, '#facc15');
    for (const tileId of route) highlights.set(tileId, '#60a5fa');
    if (this.hoveredTileId && !highlights.has(this.hoveredTileId)) {
      highlights.set(this.hoveredTileId, '#ffffff');
    }
    const entries = Array.from(highlights).filter(([tileId]) => this.renderedTileIds.has(tileId));
    if (entries.length === 0) return;

    const geometry = new THREE.PlaneGeometry(0.94, 0.94);
    const material = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: this.hoveredTileId && entries.length === 1 ? 0.25 : 0.4,
      depthWrite: false,
      vertexColors: true,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.InstancedMesh(geometry, material, entries.length);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    entries.forEach(([tileId, style], index) => {
      const position = findTileGridPos(this.data!.map, tileId);
      if (!position) return;
      dummy.position.set(position.col + 0.5, this.tileHeight(tileId) + 0.02, position.row + 0.5);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      mesh.setColorAt(index, color.setStyle(style));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.overlayMesh = mesh;
    this.scene.add(mesh);
  }

  private buildTokens(): void {
    if (!this.data) return;
    const tokens = this.data.tokens ?? [];
    const liveImageTokenIds = new Set(
      tokens.filter((token) => Boolean(token.image)).map((token) => token.id)
    );
    for (const [id, entry] of this.tokenImageTextures) {
      if (!liveImageTokenIds.has(id)) {
        entry.texture.dispose();
        this.tokenImageTextures.delete(id);
      }
    }
    if (tokens.length === 0) return;
    const group = new THREE.Group();
    const byTile = new Map<TileId, MapToken[]>();
    for (const token of tokens) {
      byTile.set(token.tileId, [...(byTile.get(token.tileId) ?? []), token]);
    }
    for (const [tileId, tokens] of byTile) {
      if (!this.renderedTileIds.has(tileId)) continue;
      const position = findTileGridPos(this.data.map, tileId);
      if (!position) continue;
      const height = this.tileHeight(tileId);
      const offsets = tokenOffsets(tokens.length);
      tokens.forEach((token, index) => {
        const { dx, dz } = offsets[index];
        const x = position.col + 0.5 + dx;
        const z = position.row + 0.5 + dz;
        const opacity = token.dimmed ? 0.45 : 1;
        const radius = token.isCurrent ? 0.25 : token.kind === 'vehicle' ? 0.23 : 0.2;
        if (token.image) {
          const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
            map: this.getTokenImageTexture(token.id, token.image, token.color),
            transparent: true,
            opacity,
            depthWrite: false,
          }));
          sprite.position.set(x, height + radius + 0.06, z);
          sprite.scale.set(radius * 2.15, radius * 2.15, 1);
          group.add(sprite);
        } else {
          const geometry = token.kind === 'vehicle'
            ? new THREE.BoxGeometry(radius * 1.8, radius * 1.35, radius * 1.8)
            : new THREE.SphereGeometry(radius, 16, 12);
          const mesh = new THREE.Mesh(
            geometry,
            new THREE.MeshBasicMaterial({ color: token.color, transparent: opacity < 1, opacity })
          );
          mesh.position.set(x, height + radius * 0.75, z);
          group.add(mesh);
          if (token.label) {
            const labelTexture = this.createLabelTexture(token.label, token.color);
            const labelMaterial = new THREE.SpriteMaterial({
              map: labelTexture,
              transparent: true,
              opacity,
              depthWrite: false,
            });
            labelMaterial.userData.disposeMap = true;
            const label = new THREE.Sprite(labelMaterial);
            label.position.set(x, height + radius * 2.35, z);
            label.scale.set(0.38, 0.38, 1);
            group.add(label);
          }
        }
        if (token.isCurrent || token.isSelected) {
          const ring = new THREE.Mesh(
            new THREE.RingGeometry(radius + 0.04, radius + 0.12, 24),
          new THREE.MeshBasicMaterial({
            color: token.isCurrent ? '#ffffff' : '#facc15',
            transparent: true,
            opacity: 0.85,
            side: THREE.DoubleSide,
            depthWrite: false,
          })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(x, height + 0.015, z);
        group.add(ring);
        }
      });
    }
    if (group.children.length > 0) {
      this.tokenGroup = group;
      this.scene.add(group);
    }
  }

  private getTokenImageTexture(id: string, src: string, rimColor: string): THREE.CanvasTexture {
    const cached = this.tokenImageTextures.get(id);
    if (cached?.src === src) return cached.texture;
    if (cached) cached.texture.dispose();

    const canvas = document.createElement('canvas');
    canvas.width = 96;
    canvas.height = 96;
    const context = canvas.getContext('2d');
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    this.tokenImageTextures.set(id, { src, texture });
    if (context) {
      const image = new Image();
      image.onload = () => {
        context.clearRect(0, 0, 96, 96);
        context.save();
        context.beginPath();
        context.arc(48, 48, 43, 0, Math.PI * 2);
        context.clip();
        const scale = Math.max(86 / image.naturalWidth, 86 / image.naturalHeight);
        const width = image.naturalWidth * scale;
        const height = image.naturalHeight * scale;
        context.drawImage(image, (96 - width) / 2, (96 - height) / 2, width, height);
        context.restore();
        context.beginPath();
        context.arc(48, 48, 44, 0, Math.PI * 2);
        context.strokeStyle = rimColor;
        context.lineWidth = 4;
        context.stroke();
        texture.needsUpdate = true;
        this.needsRender = true;
      };
      image.src = src;
    }
    return texture;
  }

  private createLabelTexture(label: string, color: string): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext('2d');
    if (context) {
      context.beginPath();
      context.arc(32, 32, 28, 0, Math.PI * 2);
      context.fillStyle = '#111827';
      context.fill();
      context.strokeStyle = color;
      context.lineWidth = 3;
      context.stroke();
      context.fillStyle = '#ffffff';
      context.font = 'bold 27px sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(label.slice(0, 2), 32, 34);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  private buildMarkersAndLinks(): void {
    if (!this.data) return;
    const markerGroup = new THREE.Group();
    const markerMaterial = new THREE.SpriteMaterial({ map: this.getMarkerTexture() });
    const linkGroup = new THREE.Group();
    const linkGeometry = new THREE.OctahedronGeometry(0.12);
    const linkMaterial = new THREE.MeshBasicMaterial({ color: '#22d3ee' });

    for (let row = 0; row < this.data.map.rows; row += 1) {
      for (let col = 0; col < this.data.map.cols; col += 1) {
        const tileId = this.data.map.grid[row][col];
        if (!this.renderedTileIds.has(tileId)) continue;
        const tile = this.data.map.tilesById[tileId];
        if (!tile) continue;
        const visibleMarkers = tile.markerIds.some((markerId) => {
          const marker = this.data?.map.markersById[markerId];
          return marker && (this.data?.fog === 'gm' || marker.visibility === 'player');
        });
        const height = this.tileHeight(tileId);
        if (visibleMarkers) {
          const sprite = new THREE.Sprite(markerMaterial);
          sprite.center.set(0.5, 0);
          sprite.position.set(col + 0.5, height + 0.02, row + 0.5);
          sprite.scale.set(0.5, 0.65, 1);
          markerGroup.add(sprite);
        }
        if (tile.linkIds.length > 0) {
          const link = new THREE.Mesh(linkGeometry, linkMaterial);
          link.position.set(col + 0.8, height + 0.3, row + 0.8);
          linkGroup.add(link);
        }
      }
    }
    if (markerGroup.children.length > 0) {
      this.markerGroup = markerGroup;
      this.scene.add(markerGroup);
    } else {
      markerMaterial.dispose();
    }
    if (linkGroup.children.length > 0) {
      this.linkGroup = linkGroup;
      this.scene.add(linkGroup);
    } else {
      linkGeometry.dispose();
      linkMaterial.dispose();
    }
  }

  private getMarkerTexture(): THREE.CanvasTexture {
    if (this.markerTexture) return this.markerTexture;
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 80;
    const context = canvas.getContext('2d');
    if (context) {
      context.beginPath();
      context.moveTo(32, 74);
      context.lineTo(17, 42);
      context.arc(32, 29, 21, Math.PI * 0.8, Math.PI * 0.2, false);
      context.closePath();
      context.fillStyle = '#ffffff';
      context.strokeStyle = '#111827';
      context.lineWidth = 5;
      context.fill();
      context.stroke();
      context.beginPath();
      context.arc(32, 29, 7, 0, Math.PI * 2);
      context.fillStyle = '#111827';
      context.fill();
    }
    this.markerTexture = new THREE.CanvasTexture(canvas);
    this.markerTexture.colorSpace = THREE.SRGBColorSpace;
    return this.markerTexture;
  }

  private disposeWorld(): void {
    if (this.tileMesh) {
      this.scene.remove(this.tileMesh);
      this.tileMesh.geometry.dispose();
      this.disposeMaterial(this.tileMesh.material);
      this.tileMesh = null;
    }
    if (this.overlayMesh) {
      this.scene.remove(this.overlayMesh);
      this.overlayMesh.geometry.dispose();
      this.disposeMaterial(this.overlayMesh.material);
      this.overlayMesh = null;
    }
    if (this.structureMesh) {
      this.scene.remove(this.structureMesh);
      this.structureMesh.geometry.dispose();
      this.disposeMaterial(this.structureMesh.material);
      this.structureMesh = null;
    }
    if (this.imageGroup) {
      // Materials are disposed here; the shared textures live in imageTextures
      // and are released in dispose() or when their layer disappears.
      this.scene.remove(this.imageGroup);
      this.imageGroup.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          this.disposeMaterial(object.material);
        }
      });
      this.imageGroup = null;
    }
    this.disposeGroup(this.markerGroup);
    this.disposeGroup(this.linkGroup);
    this.disposeGroup(this.tokenGroup);
    this.markerGroup = null;
    this.linkGroup = null;
    this.tokenGroup = null;
    this.pickEntries = [];
    this.renderedTileIds.clear();
  }

  private disposeGroup(group: THREE.Group | null): void {
    if (!group) return;
    this.scene.remove(group);
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    group.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        geometries.add(object.geometry);
        const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
        objectMaterials.forEach((material) => materials.add(material));
      } else if (object instanceof THREE.Sprite) {
        materials.add(object.material);
        if (object.material.userData.disposeMap && object.material.map) object.material.map.dispose();
      }
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    group.clear();
  }

  private disposeMaterial(material: THREE.Material | THREE.Material[]): void {
    if (Array.isArray(material)) material.forEach((item) => item.dispose());
    else material.dispose();
  }
}
