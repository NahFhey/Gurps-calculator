import * as THREE from 'three';
import type { MapModel, TileId } from '../../../types/map';
import { getEffectiveElevation } from '../../../utils/lineOfSight';
import {
  cameraPosition,
  dragPan,
  frameTiles,
  clampCamera,
  orbit,
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
  onContextLost?(): void;
  onContextRestored?(): void;
}

export type FogMode = 'gm' | 'player-los' | 'player-open';

export interface MapSceneFrameData {
  map: MapModel;
  fog: FogMode;
  visibleTileIds: Set<TileId> | null;
  selectedTileIds: Set<TileId> | null;
  routeTileIds: TileId[] | null;
  reachableTileIds: Set<TileId> | null;
  paintModeActive: boolean;
  placingParty: boolean;
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
  private partyGroup: THREE.Group | null = null;
  private markerGroup: THREE.Group | null = null;
  private linkGroup: THREE.Group | null = null;
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
      || oldData.visibleTileIds !== data.visibleTileIds;
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

  frameParty(): void {
    if (!this.data) return;
    const partyPosition = this.data.map.partyTileId
      ? findTileGridPos(this.data.map, this.data.map.partyTileId)
      : null;
    const row = partyPosition?.row ?? (this.data.map.rows - 1) / 2;
    const col = partyPosition?.col ?? (this.data.map.cols - 1) / 2;
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
    };
    if (event.button === 0 && this.data?.paintModeActive) {
      const hit = this.pick(event.clientX, event.clientY);
      if (hit) {
        this.pointerDrag.lastPaintedTileId = hit.tileId;
        this.callbacks.onTilePaintStart(hit.tileId, hit.row, hit.col, event);
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
    if (!drag.dragged && !(drag.button === 0 && this.data?.paintModeActive)) {
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
    this.frameParty();
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
    this.buildMarkersAndLinks();
    this.buildParty();
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
    color.setStyle(terrain?.color ?? '#1f2937');
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

  private buildParty(): void {
    if (!this.data?.map.partyTileId) return;
    const position = findTileGridPos(this.data.map, this.data.map.partyTileId);
    if (!position) return;
    const height = this.tileHeight(this.data.map.partyTileId);
    const group = new THREE.Group();
    const sphereGeometry = new THREE.SphereGeometry(0.22, 16, 12);
    const sphereMaterial = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    sphere.position.set(position.col + 0.5, height + 0.22, position.row + 0.5);
    group.add(sphere);
    const ringGeometry = new THREE.RingGeometry(0.18, 0.28, 24);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: '#ffffff', transparent: true, opacity: 0.6, side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(position.col + 0.5, height + 0.015, position.row + 0.5);
    group.add(ring);
    this.partyGroup = group;
    this.scene.add(group);
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
    this.disposeGroup(this.partyGroup);
    this.disposeGroup(this.markerGroup);
    this.disposeGroup(this.linkGroup);
    this.partyGroup = null;
    this.markerGroup = null;
    this.linkGroup = null;
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
