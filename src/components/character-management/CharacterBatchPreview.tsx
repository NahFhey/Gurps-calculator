import type { Character } from '../../types/campaign';

export interface CharacterBatchRow {
  key: string;
  character: Character;
  existing?: Character;
  selected: boolean;
}

interface CharacterBatchPreviewProps {
  rows: CharacterBatchRow[];
  onToggle: (key: string) => void;
  onImport: () => void;
  onCancel: () => void;
}

export function CharacterBatchPreview({ rows, onToggle, onImport, onCancel }: CharacterBatchPreviewProps) {
  const selectedCount = rows.filter((row) => row.selected).length;

  return (
    <div className="space-y-4">
      <div className="max-h-72 space-y-2 overflow-y-auto">
        {rows.map((row) => (
          <label
            key={row.key}
            className="flex cursor-pointer items-center gap-3 rounded border border-slate-600 bg-slate-800/60 p-3"
          >
            <input
              type="checkbox"
              checked={row.selected}
              onChange={() => onToggle(row.key)}
              aria-label={`Import ${row.character.name}`}
              className="h-4 w-4 accent-indigo-500"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium text-slate-100">{row.character.name}</span>
              <span className="text-xs text-slate-400">{row.character.gcsData?.totalPoints ?? 0} points</span>
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                row.existing
                  ? 'bg-amber-500/15 text-amber-300'
                  : 'bg-emerald-500/15 text-emerald-300'
              }`}
            >
              {row.existing ? 'update' : 'new'}
            </span>
          </label>
        ))}
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded border border-slate-600 px-4 py-2 text-slate-300 hover:bg-slate-700"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onImport}
          disabled={selectedCount === 0}
          className="flex-1 rounded bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Import selected ({selectedCount})
        </button>
      </div>
    </div>
  );
}
