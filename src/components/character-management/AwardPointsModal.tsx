import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useCampaignStore } from '../../state/campaignStore';
import { characterLog } from '../../utils/activityLogger';
import type { Character } from '../../types/campaign';
import type { PointLedgerEntry } from '../../types/characterSheet';
import { createDefaultGCSData } from '../../types/characterSheet';

interface AwardPointsModalProps {
  characters: Character[];
  onClose: () => void;
}

const ledgerId = (): string =>
  `points-award-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export function AwardPointsModal({ characters, onClose }: AwardPointsModalProps) {
  const { actions } = useCampaignStore();
  const defaultIds = useMemo(
    () => characters.filter((character) => character.isPlayer !== false).map((character) => character.id),
    [characters]
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(defaultIds));
  const [amount, setAmount] = useState(1);
  const [note, setNote] = useState('');

  const toggleCharacter = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirm = () => {
    if (amount < 1 || selectedIds.size === 0) return;
    const selected = characters.filter((character) => selectedIds.has(character.id));
    const date = new Date().toISOString();
    for (const character of selected) {
      const gcsData = character.gcsData ?? createDefaultGCSData();
      const entry: PointLedgerEntry = {
        id: ledgerId(),
        date,
        kind: 'award',
        points: amount,
        label: note.trim() || `Awarded ${amount} point${amount === 1 ? '' : 's'}`,
      };
      actions.updateCharacter(character.id, {
        gcsData: {
          ...gcsData,
          unspentPoints: (gcsData.unspentPoints ?? 0) + amount,
          pointLedger: [...(gcsData.pointLedger ?? []), entry],
        },
      });
    }
    actions.addLogEntry(characterLog.pointsAwarded(
      selected.map((character) => character.name),
      amount,
      note,
      { characterIds: selected.map((character) => character.id), quantity: amount }
    ));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="award-points-title" className="w-full max-w-lg rounded-lg border border-edge-strong bg-surface-1">
        <header className="flex items-center justify-between border-b border-edge px-5 py-4">
          <h2 id="award-points-title" className="text-lg font-semibold text-fg-bright">Award Points</h2>
          <button type="button" onClick={onClose} aria-label="Close award points" className="text-fg-muted hover:text-fg-primary"><X className="h-5 w-5" /></button>
        </header>
        <div className="space-y-4 p-5">
          <label className="block text-sm text-fg-secondary">
            <span className="mb-1 block">Amount</span>
            <input data-testid="award-amount-input" type="number" min={1} value={amount} onChange={(event) => setAmount(Math.max(1, Number(event.target.value) || 1))} className="w-full rounded border border-edge-strong bg-surface-0 px-3 py-2 text-fg-bright" />
          </label>
          <label className="block text-sm text-fg-secondary">
            <span className="mb-1 block">Note</span>
            <input data-testid="award-note-input" type="text" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Session 12: rescued the caravan" className="w-full rounded border border-edge-strong bg-surface-0 px-3 py-2 text-fg-bright" />
          </label>
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-fg-secondary">Characters</legend>
            <div className="max-h-64 space-y-2 overflow-y-auto rounded border border-edge bg-surface-0/50 p-3">
              {characters.map((character) => (
                <label key={character.id} className="flex items-center justify-between gap-3 text-sm text-fg-primary">
                  <span><input data-testid={`award-character-${character.id}`} type="checkbox" checked={selectedIds.has(character.id)} onChange={() => toggleCharacter(character.id)} className="mr-2" />{character.name}</span>
                  <span className="text-xs text-fg-faint">{character.isPlayer === false ? 'NPC' : 'Player'}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        <footer className="flex justify-end gap-2 border-t border-edge px-5 py-4">
          <button type="button" onClick={onClose} className="rounded border border-edge-strong px-4 py-2 text-fg-secondary hover:bg-surface-2">Cancel</button>
          <button type="button" onClick={handleConfirm} disabled={selectedIds.size === 0 || amount < 1} data-testid="confirm-award-points-button" className="rounded bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50">Award</button>
        </footer>
      </div>
    </div>
  );
}
