import { useMemo, useState, useEffect, ChangeEvent } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { Modal } from '../ui/Modal';

type InsertionModeValue = 'next_turn' | 'end_of_round' | 'auto' | 'manual';
type CategoryValue = 'enemy' | 'ally' | 'object';

interface InsertionModeOption {
  value: InsertionModeValue;
  label: string;
}

interface CategoryOption {
  value: CategoryValue;
  label: string;
}

const INSERTION_MODES: InsertionModeOption[] = [
  { value: 'next_turn', label: 'Next Turn' },
  { value: 'end_of_round', label: 'End of Round' },
  { value: 'auto', label: 'Auto (by Basic Speed)' },
  { value: 'manual', label: 'Manual' }
];

const CATEGORY_OPTIONS: CategoryOption[] = [
  { value: 'enemy', label: 'Enemy' },
  { value: 'ally', label: 'Ally' },
  { value: 'object', label: 'Object' }
];

interface CombatCharacter {
  id: string;
  name: string;
  category: string;
}

interface Participant {
  instanceId: string;
  name: string;
}

interface ReinforcementData {
  category: CategoryValue;
  characterId: string;
  quantity: number;
  prefix: string;
  insertionMode: InsertionModeValue;
  manualOrder: string[] | null;
  previewNames: string[];
}

interface ReinforcementsModalProps {
  onClose: () => void;
  onConfirm: (data: ReinforcementData) => void;
  combatCharacters: CombatCharacter[];
  participants: Participant[];
  turnOrder: string[];
  currentActorInstanceId: string | null;
}

function buildNumberedNames(baseName: string, quantity: number, existingNames: string[]): string[] {
  const normalizedBase = baseName.trim();
  if (!normalizedBase) return [];

  let maxNumber = 0;
  const escapedBase = normalizedBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  existingNames.forEach((name) => {
    if (name === normalizedBase) {
      maxNumber = Math.max(maxNumber, 1);
    }
    const match = name.match(new RegExp(`^${escapedBase} #(?<num>\\d+)$`));
    if (match?.groups?.num) {
      maxNumber = Math.max(maxNumber, parseInt(match.groups.num, 10));
    }
  });

  return Array.from({ length: quantity }).map((_, index) => {
    const number = maxNumber + index + 1;
    if (quantity === 1 && maxNumber === 0) {
      return normalizedBase;
    }
    return `${normalizedBase} #${number}`;
  });
}

export default function ReinforcementsModal({
  onClose,
  onConfirm,
  combatCharacters,
  participants,
  turnOrder,
  currentActorInstanceId
}: ReinforcementsModalProps) {
  const [category, setCategory] = useState<CategoryValue>('enemy');
  const [characterId, setCharacterId] = useState('');
  const [quantity, setQuantity] = useState<number | string>(1);
  const [prefix, setPrefix] = useState('');
  const [insertionMode, setInsertionMode] = useState<InsertionModeValue>('next_turn');
  const [manualOrder, setManualOrder] = useState<string[]>([]);

  const filteredCharacters = useMemo(
    () => combatCharacters.filter(char => char.category === category),
    [combatCharacters, category]
  );

  const selectedCharacter = filteredCharacters.find(char => char.id === characterId) || null;
  const existingNames = participants.map(participant => participant.name);
  const baseName = prefix.trim() || selectedCharacter?.name || '';
  const resolvedQuantity = Math.max(1, Number(quantity) || 1);
  const previewNames = useMemo(
    () => buildNumberedNames(baseName, resolvedQuantity, existingNames),
    [baseName, resolvedQuantity, existingNames]
  );

  const canInsertTurns = category !== 'object';

  useEffect(() => {
    if (filteredCharacters.length === 0) {
      setCharacterId('');
      return;
    }

    const stillValid = filteredCharacters.some(char => char.id === characterId);
    if (!stillValid) {
      setCharacterId(filteredCharacters[0].id);
    }
  }, [filteredCharacters, characterId]);

  useEffect(() => {
    if (!canInsertTurns) {
      setInsertionMode('end_of_round');
    }
  }, [canInsertTurns]);

  useEffect(() => {
    if (insertionMode !== 'manual' || !canInsertTurns) return;

    const placeholders = previewNames.map((_, index) => `new-${index}`);
    setManualOrder([...turnOrder, ...placeholders]);
  }, [insertionMode, previewNames, turnOrder, canInsertTurns]);

  const handleMove = (index: number, direction: number) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= manualOrder.length) return;

    const newOrder = [...manualOrder];
    [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
    setManualOrder(newOrder);
  };

  const handleConfirm = () => {
    if (!selectedCharacter) return;

    onConfirm({
      category,
      characterId: selectedCharacter.id,
      quantity: resolvedQuantity,
      prefix: prefix.trim(),
      insertionMode: canInsertTurns ? insertionMode : 'end_of_round',
      manualOrder: insertionMode === 'manual' ? manualOrder : null,
      previewNames
    });
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Add Reinforcements"
      size="xl"
      closeOnBackdrop={false}
    >
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-semibold mb-2">Category</label>
            <div className="flex gap-3">
              {CATEGORY_OPTIONS.map(option => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setCategory(option.value)}
                  className={`px-4 py-2 rounded ${category === option.value ? 'bg-accent-600' : 'bg-surface-2 hover:bg-surface-3'}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Character</label>
            {filteredCharacters.length === 0 ? (
              <div className="text-sm text-fg-muted">
                No characters in this category. Add some in the Character Library first.
              </div>
            ) : (
              <select
                value={characterId}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setCharacterId(e.target.value)}
                className="w-full px-3 py-2 bg-surface-2 rounded"
              >
                {filteredCharacters.map(character => (
                  <option key={character.id} value={character.id}>
                    {character.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-2">Quantity</label>
              <input
                type="number"
                min={1}
                value={resolvedQuantity}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setQuantity(e.target.value)}
                className="w-full px-3 py-2 bg-surface-2 rounded"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold mb-2">Naming Prefix (optional)</label>
              <input
                type="text"
                value={prefix}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setPrefix(e.target.value)}
                placeholder="e.g. Goblin Archer"
                className="w-full px-3 py-2 bg-surface-2 rounded"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Preview</label>
            {previewNames.length === 0 ? (
              <div className="text-sm text-fg-muted">Select a character to preview names.</div>
            ) : (
              <div className="bg-surface-0 rounded p-3 text-sm text-fg-secondary">
                {previewNames.join(', ')}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Insertion Mode</label>
            {!canInsertTurns && (
              <div className="text-xs text-fg-muted mb-2">Objects do not take turns; insertion mode is ignored.</div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {INSERTION_MODES.map(option => (
                <button
                  key={option.value}
                  type="button"
                  disabled={!canInsertTurns}
                  onClick={() => setInsertionMode(option.value)}
                  className={`px-4 py-2 rounded text-left ${insertionMode === option.value ? 'bg-accent-600' : 'bg-surface-2 hover:bg-surface-3'} ${!canInsertTurns ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {canInsertTurns && insertionMode === 'manual' && (
            <div>
              <label className="block text-sm font-semibold mb-2">Manual Turn Order</label>
              <div className="bg-surface-0 rounded p-3 space-y-2 text-sm">
                {manualOrder.map((entryId, index) => {
                  const isNew = entryId.startsWith('new-');
                  const nameIndex = isNew ? Number(entryId.replace('new-', '')) : null;
                  const displayName = isNew
                    ? previewNames[nameIndex ?? 0] || 'New Reinforcement'
                    : participants.find(p => p.instanceId === entryId)?.name || 'Unknown';
                  const isCurrent = entryId === currentActorInstanceId;

                  return (
                    <div key={entryId} className={`flex items-center justify-between ${isCurrent ? 'text-accent-300' : ''}`}>
                      <div>{displayName}{isCurrent ? ' (Current)' : ''}</div>
                      {isNew && (
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => handleMove(index, -1)}
                            aria-label={`Move ${displayName} earlier in turn order`}
                            className="p-1 bg-surface-2 rounded hover:bg-surface-3"
                          >
                            <ChevronUp size={16} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMove(index, 1)}
                            aria-label={`Move ${displayName} later in turn order`}
                            className="p-1 bg-surface-2 rounded hover:bg-surface-3"
                          >
                            <ChevronDown size={16} aria-hidden="true" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex gap-4 justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-surface-2 hover:bg-surface-3 rounded"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selectedCharacter}
              className="px-6 py-2 bg-success-600 hover:bg-success-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add Reinforcements
            </button>
          </div>
        </div>
    </Modal>
  );
}
