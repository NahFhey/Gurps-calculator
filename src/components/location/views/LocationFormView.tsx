import type { ClimateType, Location, TerrainType } from '../../../types/location';
import { createDefaultLocationModifiers } from '../../../utils/weatherSystem';

export interface LocationFormViewProps {
  isEdit: boolean;
  editForm: Partial<Location>;
  allClimateLabels: Record<string, string>;
  allTerrainLabels: Record<string, string>;
  onChange: (form: Partial<Location>) => void;
  onCancel: () => void;
  onSubmit: () => void;
}

export function LocationFormView({
  isEdit,
  editForm,
  allClimateLabels,
  allTerrainLabels,
  onChange,
  onCancel,
  onSubmit,
}: LocationFormViewProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-fg-bright">
          {isEdit ? 'Edit Location' : 'Create Location'}
        </h3>
        <button onClick={onCancel} className="text-fg-muted hover:text-fg-primary">
          Cancel
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-sm text-fg-muted mb-1">Name</label>
          <input
            type="text"
            value={editForm.name || ''}
            onChange={(e) => onChange({ ...editForm, name: e.target.value })}
            className="w-full px-3 py-2 bg-surface-2 border border-edge-strong rounded text-fg-bright"
            placeholder="Location name"
          />
        </div>

        <div>
          <label className="block text-sm text-fg-muted mb-1">Description</label>
          <textarea
            value={editForm.description || ''}
            onChange={(e) => onChange({ ...editForm, description: e.target.value })}
            className="w-full px-3 py-2 bg-surface-2 border border-edge-strong rounded text-fg-bright"
            rows={2}
            placeholder="Optional description"
          />
        </div>

        <div>
          <label className="block text-sm text-fg-muted mb-1">GM Notes</label>
          <textarea
            value={editForm.gmNotes || ''}
            onChange={(e) => onChange({ ...editForm, gmNotes: e.target.value })}
            className="w-full px-3 py-2 bg-surface-2 border border-edge-strong rounded text-fg-bright"
            rows={3}
            placeholder="Private notes for the GM"
          />
        </div>

        <div>
          <label className="block text-sm text-fg-muted mb-1">Climate</label>
          <select
            value={editForm.climate || 'temperate'}
            onChange={(e) => onChange({ ...editForm, climate: e.target.value as ClimateType })}
            className="w-full px-3 py-2 bg-surface-2 border border-edge-strong rounded text-fg-bright"
          >
            {Object.entries(allClimateLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-fg-muted mb-1">Terrain</label>
          <select
            value={editForm.terrain || 'plains'}
            onChange={(e) => onChange({ ...editForm, terrain: e.target.value as TerrainType })}
            className="w-full px-3 py-2 bg-surface-2 border border-edge-strong rounded text-fg-bright"
          >
            {Object.entries(allTerrainLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-fg-muted mb-1">Location Modifiers</label>
          <div className="grid grid-cols-2 gap-2">
            {([
              ['gathering', 'Gathering'],
              ['hunting', 'Hunting'],
              ['foraging', 'Foraging'],
              ['travel', 'Travel'],
            ] as const).map(([key, label]) => (
              <div key={key}>
                <label className="text-xs text-fg-faint">{label}</label>
                <input
                  type="number"
                  value={editForm.modifiers?.[key] ?? 0}
                  onChange={(e) => onChange({
                    ...editForm,
                    modifiers: {
                      ...createDefaultLocationModifiers(),
                      ...editForm.modifiers,
                      [key]: parseInt(e.target.value) || 0,
                    },
                  })}
                  className="w-full px-2 py-1 bg-surface-2 border border-edge-strong rounded text-fg-bright text-sm"
                />
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={onSubmit}
          disabled={!editForm.name?.trim()}
          className="w-full py-2 bg-accent-600 hover:bg-accent-700 disabled:bg-surface-3 disabled:cursor-not-allowed text-white rounded"
        >
          {isEdit ? 'Save Changes' : 'Create Location'}
        </button>
      </div>
    </div>
  );
}
