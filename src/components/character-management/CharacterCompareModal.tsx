import { useMemo, useState } from 'react';
import type { Character } from '../../types/campaign';
import { buildComparisonRows } from '../../utils/characterDiff';
import { Modal } from '../ui/Modal';

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
    <Modal isOpen onClose={onClose} title="Compare characters" size="full" bodyClassName="p-5">
          <label className="mb-4 block text-sm text-fg-secondary">Compare {character.name} with
            <select aria-label="Compare with character" value={comparisonId} onChange={(event) => setComparisonId(event.target.value)} className="ml-2 rounded border border-edge-strong bg-surface-2 px-3 py-2">
              {candidates.length === 0 && <option value="">No other characters</option>}
              {candidates.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
            </select>
          </label>
          {comparison && (
            <div data-testid="character-comparison-rows" className="max-h-[68vh] overflow-auto rounded border border-edge">
              <div className="sticky top-0 grid grid-cols-[minmax(9rem,0.7fr)_1fr_1fr] bg-surface-0 px-3 py-2 font-semibold text-fg-primary"><span>Field</span><span>{character.name}</span><span>{comparison.name}</span></div>
              {rows.map((row, index) => (
                <div key={`${row.section}-${row.label}-${index}`} data-status={row.status} className="grid grid-cols-[minmax(9rem,0.7fr)_1fr_1fr] border-t border-edge px-3 py-2 text-sm">
                  <span className="pr-3 text-fg-muted"><span className="block text-[10px] uppercase text-fg-disabled">{row.section}</span>{row.label}</span>
                  <span className={row.status === 'changed' || row.status === 'missing' ? 'text-warning-300' : 'text-fg-primary'}>{row.a}{row.status === 'missing' && <em className="ml-2 text-xs text-danger-400">missing right</em>}</span>
                  <span className={row.status === 'changed' || row.status === 'added' ? 'text-warning-300' : 'text-fg-primary'}>{row.b}{row.status === 'added' && <em className="ml-2 text-xs text-emerald-400">added</em>}</span>
                </div>
              ))}
            </div>
          )}
    </Modal>
  );
}
