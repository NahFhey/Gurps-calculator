/**
 * MarkerEditor — modal for creating/editing markers on a tile.
 */

import { useState } from 'react';
import type { MarkerModel, MarkerType, MarkerVisibility, TileId } from '../../../types/map';
import { X } from 'lucide-react';
import { MarkerIcon } from './MarkerIcon';

const MARKER_TYPES: { value: MarkerType; label: string }[] = [
  { value: 'note', label: 'Note' },
  { value: 'settlement', label: 'Settlement' },
  { value: 'mining_node', label: 'Mining Node' },
  { value: 'danger', label: 'Danger' },
];

interface MarkerEditorProps {
  tileId: TileId;
  existing?: MarkerModel;
  onConfirm: (marker: MarkerModel) => void;
  onCancel: () => void;
}

export function MarkerEditor({ tileId, existing, onConfirm, onCancel }: MarkerEditorProps) {
  const [type, setType] = useState<MarkerType>(existing?.type ?? 'note');
  const [label, setLabel] = useState(existing?.label ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [visibility, setVisibility] = useState<MarkerVisibility>(existing?.visibility ?? 'player');

  const canConfirm = label.trim().length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canConfirm) return;

    const marker: MarkerModel = {
      id: existing?.id ?? crypto.randomUUID(),
      tileId,
      type,
      label: label.trim(),
      notes: notes.trim() || undefined,
      visibility,
      tags: existing?.tags,
      resources: existing?.resources,
      discoveredAt: existing?.discoveredAt,
    };
    onConfirm(marker);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-sm bg-gray-800 border border-gray-600 rounded-lg shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <h2 className="text-sm font-semibold text-gray-100">
            {existing ? 'Edit Marker' : 'Add Marker'}
          </h2>
          <button onClick={onCancel} className="p-1 rounded hover:bg-gray-700">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-4 py-3 space-y-3">
          {/* Type */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Type</label>
            <div className="grid grid-cols-4 gap-1.5">
              {MARKER_TYPES.map((mt) => (
                <button
                  key={mt.value}
                  type="button"
                  className={[
                    'flex flex-col items-center gap-1 px-2 py-1.5 rounded text-[10px] border transition-colors',
                    type === mt.value
                      ? 'bg-gray-600 border-white/30 text-white'
                      : 'bg-gray-700/30 border-gray-600 text-gray-400 hover:bg-gray-600/30',
                  ].join(' ')}
                  onClick={() => setType(mt.value)}
                >
                  <MarkerIcon type={mt.value} size={14} />
                  {mt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Label */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              Label <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g., Iron Deposit"
              className="w-full px-2.5 py-1.5 bg-gray-900 border border-gray-600 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes"
              rows={2}
              className="w-full px-2.5 py-1.5 bg-gray-900 border border-gray-600 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Visibility */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Visibility</label>
            <div className="flex gap-2">
              <button
                type="button"
                className={[
                  'flex-1 px-3 py-1.5 rounded text-xs border transition-colors',
                  visibility === 'player'
                    ? 'bg-green-900/40 border-green-600 text-green-300'
                    : 'bg-gray-700/30 border-gray-600 text-gray-400 hover:bg-gray-600/30',
                ].join(' ')}
                onClick={() => setVisibility('player')}
              >
                Player Visible
              </button>
              <button
                type="button"
                className={[
                  'flex-1 px-3 py-1.5 rounded text-xs border transition-colors',
                  visibility === 'gm'
                    ? 'bg-purple-900/40 border-purple-600 text-purple-300'
                    : 'bg-gray-700/30 border-gray-600 text-gray-400 hover:bg-gray-600/30',
                ].join(' ')}
                onClick={() => setVisibility('gm')}
              >
                GM Only
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 text-xs text-gray-300 hover:text-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canConfirm}
              className={[
                'px-3 py-1.5 text-xs font-medium rounded transition-colors',
                canConfirm
                  ? 'bg-blue-600 hover:bg-blue-500 text-white'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed',
              ].join(' ')}
            >
              {existing ? 'Save' : 'Add Marker'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
