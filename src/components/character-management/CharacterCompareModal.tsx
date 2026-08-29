import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type { Character } from '../../types/campaign';
import { buildComparisonRows } from '../../utils/characterDiff';

interface CharacterCompareModalProps {
  character: Character;
  characters: Character[];
  onClose: () => void;
  initialComparisonId?: string;
}

export function CharacterCompareModal({ character, characters, onClose, initialComparisonId }: CharacterCompareModalProps) {
  const candidates = characters.filter((entry) => entry.id !== character.id);
  const [comparisonId, setComparisonId] = useState(initialComparisonId ?? candidates[0]?.id ?? '');
  const comparison = candidates.find((entry) => entry.id === comparisonId);
  const rows = useMemo(() => comparison ? buildComparisonRows(character, comparison) : [], [character, comparison]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="character-compare-title" className="max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-lg border border-gray-600 bg-gray-800">
        <header className="flex items-center justify-between border-b border-gray-700 px-5 py-4">
          <h2 id="character-compare-title" className="text-lg font-semibold text-gray-100">Compare characters</h2>
          <button type="button" aria-label="Close comparison" onClick={onClose} className="text-gray-400 hover:text-white"><X className="h-5 w-5" /></button>
        </header>
        <div className="p-5">
          <label className="mb-4 block text-sm text-gray-300">Compare {character.name} with
            <select aria-label="Compare with character" value={comparisonId} onChange={(event) => setComparisonId(event.target.value)} className="ml-2 rounded border border-gray-600 bg-gray-700 px-3 py-2">
              {candidates.length === 0 && <option value="">No other characters</option>}
              {candidates.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
            </select>
          </label>
          {comparison && (
            <div data-testid="character-comparison-rows" className="max-h-[68vh] overflow-auto rounded border border-gray-700">
              <div className="sticky top-0 grid grid-cols-[minmax(9rem,0.7fr)_1fr_1fr] bg-gray-900 px-3 py-2 font-semibold text-gray-200"><span>Field</span><span>{character.name}</span><span>{comparison.name}</span></div>
              {rows.map((row, index) => (
                <div key={`${row.section}-${row.label}-${index}`} data-status={row.status} className="grid grid-cols-[minmax(9rem,0.7fr)_1fr_1fr] border-t border-gray-700 px-3 py-2 text-sm">
                  <span className="pr-3 text-gray-400"><span className="block text-[10px] uppercase text-gray-600">{row.section}</span>{row.label}</span>
                  <span className={row.status === 'changed' || row.status === 'missing' ? 'text-amber-300' : 'text-gray-200'}>{row.a}{row.status === 'missing' && <em className="ml-2 text-xs text-red-400">missing right</em>}</span>
                  <span className={row.status === 'changed' || row.status === 'added' ? 'text-amber-300' : 'text-gray-200'}>{row.b}{row.status === 'added' && <em className="ml-2 text-xs text-emerald-400">added</em>}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
