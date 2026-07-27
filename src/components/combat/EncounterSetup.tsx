import { useState, ChangeEvent } from 'react';
import { Plus, Play, ChevronUp, ChevronDown, X, Users, Lock, AlertTriangle, Save, FolderOpen, Trash2, UserPlus } from 'lucide-react';
import { useCombatStore } from '../../hooks/useCombatStore';
import { useCampaignStore } from '../../state/campaignStore';
import { generateTurnOrder, createNumberedEnemies, generateId, createLogEntry, createTurnLogEntry } from '../../utils/combatHelpers';
import type { Character as PartyCharacter } from '../../types/campaign';
import type {
  ConditionInstance,
  EncounterTemplate,
  EncounterTemplateParticipant,
} from '../../types/combatTracker';
import { DEFAULT_HIT_LOCATION_PROFILE } from '../../types/characterSheet';
import { calculateCharacterEncumbrance, calculateLocationDR } from '../../utils/encumbrance';
import { COMBAT_CATEGORIES } from '../../constants';
import { ConfirmDialog, useConfirmDialog, useToast } from '../ui';

interface Attack {
  name: string;
  skill: number;
  damage?: string;
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
  fp?: number;
  mp?: number;
  basicSpeed?: number;
  basicMove?: number;
  dodge: number;
  parry?: number;
  block?: number;
  dr: number;
  hitLocationProfileId?: string;
  drByLocation?: Record<string, number>;
  attacks?: Attack[];
  notes?: string;
  // Party character integration
  isFromParty?: boolean;
  partyCharacterId?: string;
  // Phase 12a: images and encumbrance
  tokenImage?: string;
  armorByLocation?: Array<{ location: string; dr: number }>;
  encumbranceDodge?: number;
  encumbranceMove?: number;
}

/**
 * Convert a party character (with gcsData) to combat character format
 */
function partyCharacterToCombat(partyChar: PartyCharacter): Character {
  const gcs = partyChar.gcsData;
  const attrs = gcs?.attributes || { ST: 10, DX: 10, IQ: 10, HT: 10 };
  const pools = gcs?.pools || { HP: { current: 10, max: 10 }, FP: { current: 10, max: 10 } };
  const secondary = gcs?.secondaryAttributes;
  const equipment = gcs?.equipment || [];

  // Calculate derived stats
  const basicSpeed = secondary?.basicSpeed?.value ?? (attrs.DX + attrs.HT) / 4;
  const basicMove = secondary?.basicMove?.value ?? Math.floor(basicSpeed);
  const baseDodge = Math.floor(basicSpeed) + 3;

  // Phase 12a: Calculate encumbrance-adjusted move and dodge
  let adjustedMove = basicMove;
  let adjustedDodge = baseDodge;
  let armorByLocation: Array<{ location: string; dr: number }> | undefined;

  if (secondary) {
    const encumbrance = calculateCharacterEncumbrance(attrs, secondary, equipment);
    adjustedMove = encumbrance.adjustedMove;
    adjustedDodge = encumbrance.adjustedDodge;
  }

  // Phase 12a: Calculate per-location DR from equipped armor
  const locationDR = calculateLocationDR(equipment);
  if (locationDR.length > 0) {
    armorByLocation = locationDR.map(({ location, dr }) => ({ location, dr }));
  }

  // Phase 12a: Token image for initiative timeline
  const tokenImage = partyChar.images?.token;

  return {
    id: partyChar.id,
    name: partyChar.name,
    category: 'player',
    st: attrs.ST,
    dx: attrs.DX,
    iq: attrs.IQ,
    ht: attrs.HT,
    hp: pools.HP.max,
    fp: pools.FP.max,
    mp: 0,
    basicSpeed,
    basicMove: adjustedMove,
    dodge: adjustedDodge,
    parry: 0,
    block: 0,
    dr: 0,
    hitLocationProfileId: partyChar.hitLocationProfileId || DEFAULT_HIT_LOCATION_PROFILE,
    attacks: [],
    notes: gcs?.notes || '',
    isFromParty: true,
    partyCharacterId: partyChar.id,
    tokenImage,
    armorByLocation,
    encumbranceDodge: adjustedDodge !== baseDodge ? adjustedDodge : undefined,
    encumbranceMove: adjustedMove !== basicMove ? adjustedMove : undefined,
  };
}

interface Participant extends Character {
  libraryId?: string;
  currentHP: number;
  currentFP: number;
  currentMP: number;
  instanceId?: string;
  shockPenalty: number;
  isDead: boolean;
  bleeding: null;
  crippled: string[];
  conditions: ConditionInstance[];
  // Party character tracking
  isFromParty?: boolean;
  partyCharacterId?: string;
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
    partyCharacters,
    saveCombatActive,
    encounterTemplates,
    addEncounterTemplate,
    removeEncounterTemplate
  } = useCombatStore();

  // Access GM mode from campaign store
  const { state } = useCampaignStore();
  const gmModeEnabled = state.ui.gmModeEnabled;

  const [encounterName, setEncounterName] = useState('');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [turnOrder, setTurnOrder] = useState<string[]>([]);
  const [showTurnOrderPreview, setShowTurnOrderPreview] = useState(false);

  const [showTemplatePanel, setShowTemplatePanel] = useState(false);
  const [templateName, setTemplateName] = useState('');

  // Toast notifications
  const { warning: showWarning, success: showSuccess } = useToast();

  // Confirm dialog for clearing
  const clearDialog = useConfirmDialog({
    title: 'Clear Encounter',
    message: 'Are you sure you want to clear all participants? This cannot be undone.',
    confirmLabel: 'Clear All',
    variant: 'danger',
  });

  // Categorize combat library characters
  const characters: Character[] = combatCharacters || [];
  const players = characters.filter(c => c.category === 'player');
  const allies = characters.filter(c => c.category === 'ally');
  const enemies = characters.filter(c => c.category === 'enemy');
  const objects = characters.filter(c => c.category === 'object');

  // Convert party characters to combat format
  const partyCharsForCombat = (partyCharacters as PartyCharacter[] || []).map(partyCharacterToCombat);

  // Check if a party character is already in the encounter
  const isPartyCharInEncounter = (partyCharId: string) => {
    return participants.some(p => p.partyCharacterId === partyCharId);
  };

  // Add all party characters at once
  const handleAddAllParty = () => {
    const toAdd = partyCharsForCombat.filter(
      c => !isPartyCharInEncounter(c.partyCharacterId || c.id)
    );
    if (toAdd.length === 0) {
      showWarning('All party characters are already in the encounter');
      return;
    }
    for (const char of toAdd) {
      addCharacter(char, 1);
    }
    showSuccess(`Added ${toAdd.length} party character${toAdd.length !== 1 ? 's' : ''}`);
  };

  // Save current encounter as a template
  const handleSaveTemplate = () => {
    if (!templateName.trim()) {
      showWarning('Enter a template name');
      return;
    }
    if (participants.length === 0) {
      showWarning('Add participants before saving a template');
      return;
    }

    // Build template from non-party participants (party chars are added separately)
    const templateParticipants: EncounterTemplateParticipant[] = participants
      .filter(p => !p.isFromParty)
      .map(p => ({
        libraryId: p.libraryId || p.id,
        name: p.name,
        category: p.category,
        quantity: 1
      }));

    // Collapse duplicates by libraryId
    const collapsed: Record<string, EncounterTemplateParticipant> = {};
    for (const tp of templateParticipants) {
      const key = tp.libraryId;
      if (collapsed[key]) {
        collapsed[key].quantity += 1;
      } else {
        collapsed[key] = { ...tp };
      }
    }

    const template: EncounterTemplate = {
      id: generateId(),
      name: templateName.trim(),
      description: encounterName || undefined,
      participants: Object.values(collapsed),
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    addEncounterTemplate(template);
    setTemplateName('');
    showSuccess(`Template "${template.name}" saved`);
  };

  // Load a template into the encounter
  const handleLoadTemplate = (template: EncounterTemplate) => {
    for (const tp of template.participants) {
      // Try to find the character in the combat library
      const libChar = characters.find(c => c.id === tp.libraryId);
      if (libChar) {
        addCharacter(libChar, tp.quantity);
      } else {
        // Library char was deleted — show warning
        showWarning(`Character "${tp.name}" not found in library, skipped`);
      }
    }
    if (template.description && !encounterName) {
      setEncounterName(template.description);
    }
    showSuccess(`Loaded template "${template.name}"`);
  };

  // Delete a template
  const handleDeleteTemplate = (id: string) => {
    removeEncounterTemplate(id);
  };

  // Update participant category (for GM override)
  const updateParticipantCategory = (id: string, newCategory: string) => {
    setParticipants(participants.map(p =>
      p.id === id ? { ...p, category: newCategory } : p
    ));
  };

  // Add character to encounter
  const addCharacter = (character: Character, quantity = 1) => {
    if (character.category === 'enemy' && quantity > 1) {
      // Create numbered enemies
      const numbered = createNumberedEnemies(character.name, quantity, character);
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
        isDead: false,
        bleeding: null,
        crippled: [],
        // Phase 6 fields
        conditions: [],
        // Party character tracking
        isFromParty: character.isFromParty || false,
        partyCharacterId: character.partyCharacterId
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
    const order = generateTurnOrder(participants);
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
      showWarning('Add at least one participant to start combat');
      return;
    }

    if (turnOrder.length === 0) {
      showWarning('Generate turn order first');
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
      name: encounterName || `Combat ${Date.now()}`,
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

    saveCombatActive(combat);
  };

  // Clear encounter
  const handleClear = async () => {
    const confirmed = await clearDialog.confirm();
    if (confirmed) {
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
            onClick={() => setShowTemplatePanel(!showTemplatePanel)}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm"
          >
            <FolderOpen size={16} />
            Templates
          </button>
          <button
            onClick={handleClear}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded"
            disabled={participants.length === 0}
          >
            Clear
          </button>
        </div>
      </div>

      {/* Encounter Templates Panel */}
      {showTemplatePanel && (
        <div className="bg-gray-800 rounded-lg p-4 border border-blue-600/50 space-y-3">
          <h3 className="font-semibold text-blue-300">Encounter Templates</h3>

          {/* Save current encounter */}
          <div className="flex gap-2">
            <input
              type="text"
              value={templateName}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setTemplateName(e.target.value)}
              placeholder="Template name..."
              className="flex-1 px-3 py-2 bg-gray-700 rounded text-sm"
              onKeyDown={e => e.key === 'Enter' && handleSaveTemplate()}
            />
            <button
              onClick={handleSaveTemplate}
              disabled={!templateName.trim() || participants.length === 0}
              className="flex items-center gap-1 px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-sm transition-colors"
            >
              <Save size={14} />
              Save
            </button>
          </div>

          {/* Template list */}
          {Object.keys(encounterTemplates).length > 0 ? (
            <div className="space-y-2">
              {Object.values(encounterTemplates).map(t => (
                <div key={t.id} className="flex items-center gap-2 bg-gray-700 rounded p-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{t.name}</div>
                    <div className="text-xs text-gray-400">
                      {t.participants.reduce((sum, p) => sum + p.quantity, 0)} combatants
                      {t.description && ` — ${t.description}`}
                    </div>
                  </div>
                  <button
                    onClick={() => handleLoadTemplate(t)}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs transition-colors"
                  >
                    Load
                  </button>
                  <button
                    onClick={() => handleDeleteTemplate(t.id)}
                    className="p-1 text-red-400 hover:bg-red-900/30 rounded transition-colors"
                    title="Delete template"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-500">
              No saved templates. Build an encounter and save it as a template.
            </div>
          )}
        </div>
      )}

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
        {/* Left: Character Selection */}
        <div className="space-y-4">
          {/* Party Characters Section */}
          {partyCharsForCombat.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Users size={20} className="text-purple-400" />
                  Party Characters
                </h3>
                <button
                  onClick={handleAddAllParty}
                  className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded text-sm font-medium transition-colors"
                  title="Add all party characters to encounter"
                >
                  <UserPlus size={14} />
                  Add All
                </button>
              </div>
              <div className="bg-gray-800 rounded p-4 border-2 border-purple-600/50">
                <div className="space-y-2">
                  {partyCharsForCombat.map(char => {
                    const alreadyAdded = isPartyCharInEncounter(char.partyCharacterId || char.id);
                    return (
                      <div key={char.id} className="flex items-center gap-2 bg-gray-700 rounded p-2">
                        <div className="flex-1">
                          <div className="font-semibold text-sm flex items-center gap-2">
                            {char.name}
                            <span className="text-xs px-1.5 py-0.5 bg-purple-600/30 text-purple-300 rounded">Party</span>
                          </div>
                          <div className="text-xs text-gray-400">
                            Speed: {char.basicSpeed} | HP: {char.hp}
                          </div>
                        </div>
                        <button
                          onClick={() => addCharacter(char, 1)}
                          disabled={alreadyAdded}
                          className={`p-1.5 rounded ${
                            alreadyAdded
                              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                              : 'bg-green-600 hover:bg-green-700'
                          }`}
                          title={alreadyAdded ? 'Already in encounter' : 'Add to encounter'}
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  Party characters are locked as Players in combat
                </div>
              </div>
            </>
          )}

          {/* Combat Library Section */}
          <h3 className="text-lg font-semibold">Add from Library</h3>

          {/* Players from library */}
          {players.length > 0 && (
            <div className="bg-gray-800 rounded p-4">
              <h4 className="font-semibold text-blue-400 mb-2">Player Characters (Library)</h4>
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
              Add participants from the party or library
            </div>
          ) : (
            <div className="space-y-2">
              {participants.map(p => {
                const isPartyChar = p.isFromParty === true;
                const categoryLocked = isPartyChar && !gmModeEnabled;

                return (
                  <div key={p.id} className={`flex justify-between items-center rounded p-3 ${
                    isPartyChar ? 'bg-gray-800 border border-purple-600/50' : 'bg-gray-800'
                  }`}>
                    <div className="flex-1">
                      <div className="font-semibold flex items-center gap-2">
                        {p.name}
                        {isPartyChar && (
                          <span className="text-xs px-1.5 py-0.5 bg-purple-600/30 text-purple-300 rounded flex items-center gap-1">
                            <Lock size={10} />
                            Party
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-400">
                        Speed: {p.basicSpeed} | HP: {p.hp}
                      </div>
                    </div>

                    {/* Category Selector */}
                    <div className="flex items-center gap-2">
                      {categoryLocked ? (
                        <div className="flex items-center gap-1 px-2 py-1 bg-gray-700 text-gray-300 rounded text-sm">
                          <Lock size={12} className="text-purple-400" />
                          Player
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          {isPartyChar && gmModeEnabled && (
                            <AlertTriangle size={14} className="text-yellow-500" />
                          )}
                          <select
                            value={p.category}
                            onChange={(e: ChangeEvent<HTMLSelectElement>) => updateParticipantCategory(p.id, e.target.value)}
                            className={`px-2 py-1 rounded text-sm ${
                              isPartyChar && gmModeEnabled
                                ? 'bg-yellow-900/30 border border-yellow-600/50 text-yellow-200'
                                : 'bg-gray-700 text-gray-100'
                            }`}
                          >
                            {COMBAT_CATEGORIES.map(cat => (
                              <option key={cat} value={cat}>
                                {cat.charAt(0).toUpperCase() + cat.slice(1)}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <button
                        onClick={() => removeCharacter(p.id)}
                        className="p-2 bg-red-600 hover:bg-red-700 rounded"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
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

      {/* Clear Confirmation Dialog */}
      <ConfirmDialog {...clearDialog.dialogProps} />
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
