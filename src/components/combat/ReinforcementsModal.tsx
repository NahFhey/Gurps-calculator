import { useMemo, useState, useEffect, ChangeEvent } from 'react';
import { X, ChevronUp, ChevronDown } from 'lucide-react';

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-gray-800 p-6 rounded-lg max-w-3xl w-full m-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Add Reinforcements</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-semibold mb-2">Category</label>
            <div className="flex gap-3">
              {CATEGORY_OPTIONS.map(option => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setCategory(option.value)}
                  className={`px-4 py-2 rounded ${category === option.value ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Character</label>
            {filteredCharacters.length === 0 ? (
              <div className="text-sm text-gray-400">
                No characters in this category. Add some in the Character Library first.
              </div>
            ) : (
              <select
                value={characterId}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setCharacterId(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 rounded"
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
                className="w-full px-3 py-2 bg-gray-700 rounded"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold mb-2">Naming Prefix (optional)</label>
              <input
                type="text"
                value={prefix}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setPrefix(e.target.value)}
                placeholder="e.g. Goblin Archer"
                className="w-full px-3 py-2 bg-gray-700 rounded"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Preview</label>
            {previewNames.length === 0 ? (
              <div className="text-sm text-gray-400">Select a character to preview names.</div>
            ) : (
              <div className="bg-gray-900 rounded p-3 text-sm text-gray-300">
                {previewNames.join(', ')}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Insertion Mode</label>
            {!canInsertTurns && (
              <div className="text-xs text-gray-400 mb-2">Objects do not take turns; insertion mode is ignored.</div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {INSERTION_MODES.map(option => (
                <button
                  key={option.value}
                  type="button"
                  disabled={!canInsertTurns}
                  onClick={() => setInsertionMode(option.value)}
                  className={`px-4 py-2 rounded text-left ${insertionMode === option.value ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'} ${!canInsertTurns ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {canInsertTurns && insertionMode === 'manual' && (
            <div>
              <label className="block text-sm font-semibold mb-2">Manual Turn Order</label>
              <div className="bg-gray-900 rounded p-3 space-y-2 text-sm">
                {manualOrder.map((entryId, index) => {
                  const isNew = entryId.startsWith('new-');
                  const nameIndex = isNew ? Number(entryId.replace('new-', '')) : null;
                  const displayName = isNew
                    ? previewNames[nameIndex ?? 0] || 'New Reinforcement'
                    : participants.find(p => p.instanceId === entryId)?.name || 'Unknown';
                  const isCurrent = entryId === currentActorInstanceId;

                  return (
                    <div key={entryId} className={`flex items-center justify-between ${isCurrent ? 'text-blue-300' : ''}`}>
                      <div>{displayName}{isCurrent ? ' (Current)' : ''}</div>
                      {isNew && (
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => handleMove(index, -1)}
                            className="p-1 bg-gray-700 rounded hover:bg-gray-600"
                          >
                            <ChevronUp size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMove(index, 1)}
                            className="p-1 bg-gray-700 rounded hover:bg-gray-600"
                          >
                            <ChevronDown size={16} />
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
              className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selectedCharacter}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add Reinforcements
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
