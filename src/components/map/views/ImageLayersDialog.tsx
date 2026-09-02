/**
 * ImageLayersDialog — GM manager for imported image under/overlays.
 * Changes apply live to the map (no confirm step).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Upload, Trash2, Eye, EyeOff, Grid3x3, Magnet, Maximize2, BoxSelect } from 'lucide-react';
import type { ImageLayerId, MapImageLayer, MapModel } from '../../../types/map';
import { DEFAULT_TERRAIN_ELEVATION, MAX_ELEVATION } from '../../../constants/map';
import { Modal } from '../../ui/Modal';

interface ImageLayersDialogProps {
  map: MapModel;
  onAddLayer: (layer: MapImageLayer) => void;
  onUpdateLayer: (layerId: ImageLayerId, changes: Partial<Omit<MapImageLayer, 'id'>>) => void;
  onRemoveLayer: (layerId: ImageLayerId) => void;
  /** Enter draw-a-3×3-box alignment mode on the map for this layer. */
  onStartAlign: (layerId: ImageLayerId) => void;
  onClose: () => void;
}

/** Images are stored as base64 in campaign state — cap the longest edge on import. */
const IMAGE_MAX_DIM = 2048;

/** Keep coordinates tidy after center-preserving resize math. */
const round3 = (value: number) => Math.round(value * 1000) / 1000;

function importImage(file: File): Promise<{ src: string; aspect: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > IMAGE_MAX_DIM || height > IMAGE_MAX_DIM) {
          const scale = IMAGE_MAX_DIM / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve({ src: canvas.toDataURL('image/jpeg', 0.85), aspect: height / width });
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function numberField(value: number, onChange: (value: number) => void, opts: {
  label: string; min?: number; max?: number; step?: number;
}) {
  return (
    <label className="flex flex-col gap-0.5 text-[10px] uppercase tracking-wider text-fg-faint">
      {opts.label}
      <input
        type="number"
        min={opts.min}
        max={opts.max}
        step={opts.step ?? 1}
        value={value}
        onChange={(event) => {
          const next = event.target.valueAsNumber;
          if (Number.isFinite(next)) onChange(next);
        }}
        className="w-16 rounded border border-edge-strong bg-surface-0 px-1.5 py-1 text-xs normal-case tracking-normal text-fg-primary focus:outline-none focus:ring-1 focus:ring-accent-500"
      />
    </label>
  );
}

interface LayerCardProps {
  layer: MapImageLayer;
  map: MapModel;
  onUpdateLayer: (layerId: ImageLayerId, changes: Partial<Omit<MapImageLayer, 'id'>>) => void;
  onRemoveLayer: (layerId: ImageLayerId) => void;
  onStartAlign: (layerId: ImageLayerId) => void;
}

function LayerCard({ layer, map, onUpdateLayer, onRemoveLayer, onStartAlign }: LayerCardProps) {
  // "Size to grid": how many grid cells the imported image's own printed grid
  // has — applying makes each image cell exactly one map tile.
  const [gridCols, setGridCols] = useState(() => Math.max(1, Math.round(layer.width)));
  const [gridRows, setGridRows] = useState(() => Math.max(1, Math.round(layer.height)));
  const [rowsTouched, setRowsTouched] = useState(false);
  /** Natural height/width ratio of the image, for deriving rows from cols. */
  const [aspect, setAspect] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled && img.naturalWidth > 0) {
        setAspect(img.naturalHeight / img.naturalWidth);
      }
    };
    img.src = layer.src;
    return () => {
      cancelled = true;
    };
  }, [layer.src]);

  const handleColsChange = (cols: number) => {
    const next = Math.max(1, Math.round(cols));
    setGridCols(next);
    // Until the user types their own row count, follow the image's aspect so
    // square-cell battlemaps only need one number.
    if (!rowsTouched && aspect !== null) {
      setGridRows(Math.max(1, Math.round(next * aspect)));
    }
  };

  const applyGridSize = () => {
    onUpdateLayer(layer.id, {
      width: gridCols,
      height: gridRows,
      x: Math.round(layer.x),
      y: Math.round(layer.y),
    });
  };

  const snapToTiles = () => {
    onUpdateLayer(layer.id, {
      x: Math.round(layer.x),
      y: Math.round(layer.y),
      width: Math.max(1, Math.round(layer.width)),
      height: Math.max(1, Math.round(layer.height)),
    });
  };

  const fitToMap = () => {
    setGridCols(map.cols);
    setGridRows(map.rows);
    onUpdateLayer(layer.id, { x: 0, y: 0, width: map.cols, height: map.rows });
  };

  return (
    <div className="rounded border border-edge bg-surface-0/50 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <img
          src={layer.src}
          alt=""
          className="h-10 w-10 rounded object-cover border border-edge flex-shrink-0"
        />
        <input
          type="text"
          value={layer.name}
          onChange={(event) => onUpdateLayer(layer.id, { name: event.target.value })}
          className="flex-1 min-w-0 rounded border border-edge-strong bg-surface-0 px-2 py-1 text-sm text-fg-primary focus:outline-none focus:ring-1 focus:ring-accent-500"
        />
        <button
          type="button"
          aria-label={layer.visible ? 'Hide image' : 'Show image'}
          title={layer.visible ? 'Hide image' : 'Show image'}
          onClick={() => onUpdateLayer(layer.id, { visible: !layer.visible })}
          className="rounded p-1.5 text-fg-secondary hover:bg-surface-2"
        >
          {layer.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </button>
        <button
          type="button"
          aria-label="Delete image"
          title="Delete image"
          onClick={() => onRemoveLayer(layer.id)}
          className="rounded p-1.5 text-danger-400 hover:bg-surface-2"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-0.5 text-[10px] uppercase tracking-wider text-fg-faint">
          Placement
          <select
            value={layer.placement}
            onChange={(event) => onUpdateLayer(layer.id, {
              placement: event.target.value === 'overlay' ? 'overlay' : 'underlay',
            })}
            className="rounded border border-edge-strong bg-surface-0 px-1.5 py-1 text-xs normal-case tracking-normal text-fg-primary"
          >
            <option value="underlay">Underlay</option>
            <option value="overlay">Overlay</option>
          </select>
        </label>
        <label className="flex flex-col gap-0.5 text-[10px] uppercase tracking-wider text-fg-faint">
          Opacity {Math.round(layer.opacity * 100)}%
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={layer.opacity}
            onChange={(event) => onUpdateLayer(layer.id, { opacity: event.target.valueAsNumber })}
            className="w-24"
          />
        </label>
        <label
          className="flex items-center gap-1.5 pb-1 text-xs text-fg-secondary"
          title="Only the GM ever sees this image (tracing reference)"
        >
          <input
            type="checkbox"
            checked={layer.gmOnly}
            onChange={(event) => onUpdateLayer(layer.id, { gmOnly: event.target.checked })}
          />
          GM only
        </label>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        {numberField(layer.x, (x) => onUpdateLayer(layer.id, { x }), { label: 'X (col)', step: 0.5 })}
        {numberField(layer.y, (y) => onUpdateLayer(layer.id, { y }), { label: 'Y (row)', step: 0.5 })}
        {/* Manual width/height edits resize around the image's center; grid
            operations (Align 3×3, Size to grid, Snap) stay corner-anchored. */}
        {numberField(layer.width, (width) => onUpdateLayer(layer.id, {
          width,
          x: round3(layer.x - (width - layer.width) / 2),
        }), { label: 'Width', min: 0.1, step: 0.5 })}
        {numberField(layer.height, (height) => onUpdateLayer(layer.id, {
          height,
          y: round3(layer.y - (height - layer.height) / 2),
        }), { label: 'Height', min: 0.1, step: 0.5 })}
        {numberField(layer.elevation, (elevation) => onUpdateLayer(layer.id, { elevation }), { label: 'Elev', min: 0, max: MAX_ELEVATION })}
      </div>

      {/* Size to grid: match the image's printed grid to the tile grid */}
      <div className="flex flex-wrap items-end gap-2 rounded border border-edge/60 bg-surface-1/40 px-2 py-1.5">
        <button
          type="button"
          onClick={() => onStartAlign(layer.id)}
          className="flex items-center gap-1 rounded bg-accent-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-accent-500"
          title="Draw a box over a 3×3 block of the image's grid on the map — the image is scaled and snapped so each cell becomes one tile"
        >
          <BoxSelect className="h-3 w-3" />
          Align 3×3
        </button>
        {numberField(gridCols, handleColsChange, { label: 'Grid cols', min: 1 })}
        {numberField(gridRows, (rows) => {
          setRowsTouched(true);
          setGridRows(Math.max(1, Math.round(rows)));
        }, { label: 'Grid rows', min: 1 })}
        <button
          type="button"
          onClick={applyGridSize}
          className="flex items-center gap-1 rounded bg-surface-2 px-2 py-1.5 text-xs text-fg-primary hover:bg-surface-3"
          title="Scale the image so each of its grid cells is exactly one map tile, and snap its corner to a tile"
        >
          <Grid3x3 className="h-3 w-3" />
          Size to grid
        </button>
        <button
          type="button"
          onClick={snapToTiles}
          className="flex items-center gap-1 rounded bg-surface-2 px-2 py-1.5 text-xs text-fg-primary hover:bg-surface-3"
          title="Round position and size to whole tiles"
        >
          <Magnet className="h-3 w-3" />
          Snap
        </button>
        <button
          type="button"
          onClick={fitToMap}
          className="flex items-center gap-1 rounded bg-surface-2 px-2 py-1.5 text-xs text-fg-primary hover:bg-surface-3"
          title="Stretch the image across the entire map grid"
        >
          <Maximize2 className="h-3 w-3" />
          Fit map
        </button>
      </div>
    </div>
  );
}

export function ImageLayersDialog({ map, onAddLayer, onUpdateLayer, onRemoveLayer, onStartAlign, onClose }: ImageLayersDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const layers = map.imageLayers ?? [];

  const handleFile = useCallback(async (file: File) => {
    setImporting(true);
    setImportError(null);
    try {
      const { src, aspect } = await importImage(file);
      const width = map.cols;
      onAddLayer({
        id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: file.name.replace(/\.[^.]+$/, '') || 'Image',
        src,
        placement: 'underlay',
        opacity: 1,
        visible: true,
        gmOnly: false,
        x: 0,
        y: 0,
        width,
        height: Math.max(0.1, Math.round(width * aspect * 10) / 10),
        // Standard painted ground sits at the default terrain elevation — start
        // there so a fresh underlay is visible on top of it.
        elevation: DEFAULT_TERRAIN_ELEVATION,
      });
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  }, [map.cols, onAddLayer]);

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Map Images"
      size="md"
      bodyClassName="space-y-3 px-4 py-4"
      footer={(
        <div className="flex w-full justify-between gap-2">
          <button
            type="button"
            disabled={importing}
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 rounded bg-accent-600 px-3 py-2 text-sm font-medium text-white hover:bg-accent-500 disabled:opacity-50"
          >
            <Upload className="h-3.5 w-3.5" />
            {importing ? 'Importing…' : 'Import Image'}
          </button>
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-fg-secondary hover:text-white">
            Done
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
              event.target.value = '';
            }}
          />
        </div>
      )}
    >
          {layers.length === 0 && (
            <p className="text-sm text-fg-muted">
              No images yet. Import a battlemap to place it under the grid, or use an
              overlay as a tracing reference while painting terrain.
            </p>
          )}

          {layers.map((layer) => (
            <LayerCard
              key={layer.id}
              layer={layer}
              map={map}
              onUpdateLayer={onUpdateLayer}
              onRemoveLayer={onRemoveLayer}
              onStartAlign={onStartAlign}
            />
          ))}

          {importError && <p className="text-xs text-danger-400">{importError}</p>}
          <p className="text-xs text-fg-faint">
            Position and size are in tiles; width/height edits resize around the image&apos;s
            center. To match an image&apos;s printed grid to the map, use
            “Align 3×3”: drag a box over any 3×3 block of the image&apos;s cells and it is scaled
            and snapped automatically. Or enter its column/row count and use “Size to grid”.
            Underlays are hidden from players while a map uses line-of-sight vision (they
            can’t be clipped to explored tiles).
          </p>
    </Modal>
  );
}

export type { ImageLayersDialogProps };
