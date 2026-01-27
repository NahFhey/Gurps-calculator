import { useState, ChangeEvent } from 'react';
import { Plus, Play, ChevronUp, ChevronDown, X } from 'lucide-react';
import { useCombat } from '../../contexts/CombatContext';
import { generateTurnOrder, createNumberedEnemies, generateId, createLogEntry, createTurnLogEntry } from '../../utils/combatHelpers';
import { createHistoryState } from '../../utils/combatHistory';

interface Attack {
  name: string;
  skill: number;
  damage: string;
  notes?: string;
}

interface Character {
  id: string;
  name: string;
  category: string;
  st: number;
  dx: number;
  iq: number;
  ht: number;
  hp: number;
  fp: number;
  mp: number;
  basicSpeed: number;
  basicMove: number;
  dodge: number;
  parry: number;
  block: number;
  dr: number;
  hitLocationProfileId?: string;
  drByLocation?: Record<string, number>;
  attacks?: Attack[];
  notes?: string;
}

interface Participant extends Character {
  libraryId: string;
  currentHP: number;
  currentFP: number;
  currentMP: number;
  instanceId?: string;
  shockPenalty: number;
  isStunned: boolean;
  isUnconscious: boolean;
  isDead: boolean;
  bleeding: null;
  crippled: string[];
  conditions: unknown[];
}

interface CharacterSelectorProps {
  character: Character;
  onAdd: (character: Character, quantity: number) => void;
  allowQuantity: boolean;
}

/**
 * Encounter Setup Component
 * Build encounters from character library and start combat
 */
export default function EncounterSetup() {
  const {
    combatCharacters,
    saveCombatActive,
    saveCombatActiveHistory,
    combatHistory,
    saveCombatHistory
  } = useCombat();

  const [encounterName, setEncounterName] = useState('');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [turnOrder, setTurnOrder] = useState<string[]>([]);
  const [showTurnOrderPreview, setShowTurnOrderPreview] = useState(false);

  // Categorize characters
  const characters = combatCharacters as Character[];
  const players = characters.filter(c => c.category === 'player');
  const allies = characters.filter(c => c.category === 'ally');
  const enemies = characters.filter(c => c.category === 'enemy');
  const objects = characters.filter(c => c.category === 'object');

  // Add character to encounter
  const addCharacter = (character: Character, quantity = 1) => {
    if (character.category === 'enemy' && quantity > 1) {
      // Create numbered enemies
      const numbered = createNumberedEnemies(character.name, quantity, character) as Participant[];
      setParticipants([...participants, ...numbered]);
    } else {
      // Add single character
      const participant: Participant = {
        ...character,
        id: generateId(),
        libraryId: character.id, // Track original library character
        currentHP: character.hp,
        currentFP: character.fp || 0,
        currentMP: character.mp || 0,
        // Phase 4 fields
        shockPenalty: 0,
        isStunned: false,
        isUnconscious: false,
        isDead: false,
        bleeding: null,
        crippled: [],
        // Phase 6 fields
        conditions: []
      };
      setParticipants([...participants, participant]);
    }
  };

  // Remove character from encounter
  const removeCharacter = (id: string) => {
    setParticipants(participants.filter(p => p.id !== id));
  };

  // Generate turn order preview
  const handleGenerateTurnOrder = () => {
    const order = generateTurnOrder(participants) as string[];
    setTurnOrder(order);
    setShowTurnOrderPreview(true);
  };

  // Manual reorder: move character up
  const moveUp = (index: number) => {
    if (index === 0) return;
    const newOrder = [...turnOrder];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    setTurnOrder(newOrder);
  };

  // Manual reorder: move character down
  const moveDown = (index: number) => {
    if (index === turnOrder.length - 1) return;
    const newOrder = [...turnOrder];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    setTurnOrder(newOrder);
  };

  // Start combat
  const handleStartCombat = () => {
    if (participants.length === 0) {
      alert('Add at least one participant to start combat');
      return;
    }

    if (turnOrder.length === 0) {
      alert('Generate turn order first');
      return;
    }

    // Migrate participants to use instanceId
    const migratedParticipants = participants.map(p => ({
      ...p,
      instanceId: p.id, // Use the encounter-generated ID as instanceId
      id: p.id // Keep for backward compatibility
    }));

    // Get first actor
    const firstActorInstanceId = turnOrder[0];
    const firstActor = migratedParticipants.find(p => p.instanceId === firstActorInstanceId);

    // Create Phase 2 combat state
    const combat = {
      version: 2, // Phase 2
      id: generateId(),
      name: encounterName || `Combat ${(combatHistory as unknown[]).length + 1}`,
      startTime: Date.now(),
      participants: migratedParticipants,
      turnOrder: turnOrder, // Already uses instanceIds
      currentTurnIndex: 0,
      currentRound: 1,
      turnDecisions: {},
      log: [
        createLogEntry({
          entryType: 'note',
          round: 1,
          turn: 0,
          text: 'Combat started'
        }),
        createLogEntry({
          entryType: 'turn',
          round: 1,
          turn: 0,
          text: `=== Round 1 ===`
        }),
        createTurnLogEntry(1, 0, firstActorInstanceId, firstActor?.name)
      ]
    };

    // Create empty history state for Phase 2
    const history = createHistoryState();

    saveCombatActive(combat);
    saveCombatActiveHistory(history);
  };

  // Clear encounter
  const handleClear = () => {
    if (confirm('Clear all participants?')) {
      setParticipants([]);
      setTurnOrder([]);
      setShowTurnOrderPreview(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Encounter Setup</h2>
        <div className="flex gap-2">
          <button
            onClick={handleClear}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded"
            disabled={participants.length === 0}
          >
            Clear
          </button>
        </div>
      </div>

      {/* Encounter Name */}
      <div>
        <label className="block text-sm mb-2">Encounter Name (optional)</label>
        <input
          type="text"
          value={encounterName}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setEncounterName(e.target.value)}
          className="w-full px-3 py-2 bg-gray-700 rounded"
          placeholder="e.g., Goblin Ambush"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Character Library Selection */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Add from Library</h3>

          {/* Players */}
          {players.length > 0 && (
            <div className="bg-gray-800 rounded p-4">
              <h4 className="font-semibold text-blue-400 mb-2">Player Characters</h4>
              <div className="space-y-2">
                {players.map(char => (
                  <CharacterSelector
                    key={char.id}
                    character={char}
                    onAdd={addCharacter}
                    allowQuantity={false}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Allies */}
          {allies.length > 0 && (
            <div className="bg-gray-800 rounded p-4">
              <h4 className="font-semibold text-green-400 mb-2">Allies</h4>
              <div className="space-y-2">
                {allies.map(char => (
                  <CharacterSelector
                    key={char.id}
                    character={char}
                    onAdd={addCharacter}
                    allowQuantity={true}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Enemies */}
          {enemies.length > 0 && (
            <div className="bg-gray-800 rounded p-4">
              <h4 className="font-semibold text-red-400 mb-2">Enemies</h4>
              <div className="space-y-2">
                {enemies.map(char => (
                  <CharacterSelector
                    key={char.id}
                    character={char}
                    onAdd={addCharacter}
                    allowQuantity={true}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Objects */}
          {objects.length > 0 && (
            <div className="bg-gray-800 rounded p-4">
              <h4 className="font-semibold text-gray-400 mb-2">Objects</h4>
              <div className="space-y-2">
                {objects.map(char => (
                  <CharacterSelector
                    key={char.id}
                    character={char}
                    onAdd={addCharacter}
                    allowQuantity={true}
                  />
                ))}
              </div>
            </div>
          )}

          {characters.length === 0 && (
            <div className="text-center text-gray-400 py-8">
              No characters in library. Create some in the Character Library tab first.
            </div>
          )}
        </div>

        {/* Right: Current Encounter */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Current Encounter</h3>

          {participants.length === 0 ? (
            <div className="bg-gray-800 rounded p-8 text-center text-gray-400">
              Add participants from the library
            </div>
          ) : (
            <div className="space-y-2">
              {participants.map(p => (
                <div key={p.id} className="flex justify-between items-center bg-gray-800 rounded p-3">
                  <div>
                    <div className="font-semibold">{p.name}</div>
                    <div className="text-sm text-gray-400">
                      Speed: {p.basicSpeed} | HP: {p.hp}
                    </div>
                  </div>
                  <button
                    onClick={() => removeCharacter(p.id)}
                    className="p-2 bg-red-600 hover:bg-red-700 rounded"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Turn Order Actions */}
          {participants.length > 0 && (
            <div className="space-y-2">
              {!showTurnOrderPreview ? (
                <button
                  onClick={handleGenerateTurnOrder}
                  className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded"
                >
                  Generate Turn Order
                </button>
              ) : (
                <>
                  <div className="bg-gray-800 rounded p-4">
                    <h4 className="font-semibold mb-3">Turn Order Preview</h4>
                    <div className="space-y-1">
                      {turnOrder.map((id, index) => {
                        const char = participants.find(p => p.id === id);
                        if (!char) return null;
                        return (
                          <div key={id} className="flex items-center gap-2 bg-gray-700 rounded p-2">
                            <span className="text-gray-400 w-6">{index + 1}.</span>
                            <span className="flex-1">{char.name}</span>
                            <span className="text-sm text-gray-400">Speed: {char.basicSpeed}</span>
                            <div className="flex gap-1">
                              <button
                                onClick={() => moveUp(index)}
                                disabled={index === 0}
                                className="p-1 bg-gray-600 hover:bg-gray-500 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <ChevronUp size={16} />
                              </button>
                              <button
                                onClick={() => moveDown(index)}
                                disabled={index === turnOrder.length - 1}
                                className="p-1 bg-gray-600 hover:bg-gray-500 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <ChevronDown size={16} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <button
                    onClick={handleStartCombat}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 rounded font-semibold"
                  >
                    <Play size={20} />
                    Start Combat
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Character Selector Component
 * Shows a character from library with add button and optional quantity input
 */
function CharacterSelector({ character, onAdd, allowQuantity }: CharacterSelectorProps) {
  const [quantity, setQuantity] = useState(1);

  const handleAdd = () => {
    onAdd(character, allowQuantity ? quantity : 1);
    setQuantity(1); // Reset
  };

  return (
    <div className="flex items-center gap-2 bg-gray-700 rounded p-2">
      <div className="flex-1">
        <div className="font-semibold text-sm">{character.name}</div>
        <div className="text-xs text-gray-400">Speed: {character.basicSpeed}</div>
      </div>
      {allowQuantity && (
        <input
          type="number"
          min="1"
          max="20"
          value={quantity}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setQuantity(parseInt(e.target.value) || 1)}
          className="w-16 px-2 py-1 bg-gray-600 rounded text-sm"
        />
      )}
      <button
        onClick={handleAdd}
        className="p-1.5 bg-green-600 hover:bg-green-700 rounded"
      >
        <Plus size={16} />
      </button>
    </div>
  );
}
