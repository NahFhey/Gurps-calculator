import { useState, useMemo, ChangeEvent } from 'react';
import { Plus, Search, Download, Upload, FileText, Users, Info } from 'lucide-react';
import { useCombatStore } from '../../hooks/useCombatStore';
import { COMBAT_CATEGORIES } from '../../constants';
import { generateId, deriveCombatCategory } from '../../utils/combatHelpers';
import { CharacterArraySchema, exceedsImportSizeLimit } from '../../utils/importSchemas';
import CharacterSheet from './CharacterSheet';
import CharacterForm from './CharacterForm';
import GCSImportModal from './GCSImportModal';
import { useToast } from '../ui';
import type { Character as PartyCharacter, CombatCharacter, CombatSession } from '../../types/campaign';

// Local interface matching CharacterSheet's expected Character type
interface LibraryCharacter {
  id: string;
  name: string;
  category: string;
  st: number;
  dx: number;
  iq: number;
  ht: number;
  hp: number;
  currentHP?: number;
  fp?: number;
  currentFP?: number;
  mp?: number;
  currentMP?: number;
  basicSpeed: number;
  basicMove?: number;
  dodge?: number;
  parry?: number;
  block?: number;
  dr?: number;
  notes?: string;
}

// Alias for form input - represents the data structure for create/update operations
type CharacterData = LibraryCharacter;

// Convert CombatCharacter to LibraryCharacter for display
// Exported for tests.
export function combatCharacterToLibrary(char: CombatCharacter): LibraryCharacter {
  return {
    id: char.id,
    name: char.name,
    category: deriveCombatCategory(char.category, char.isNPC),
    st: char.st,
    dx: char.dx,
    iq: char.iq,
    ht: char.ht,
    hp: char.maxHP,
    currentHP: char.maxHP,
    fp: char.maxFP || 0,
    currentFP: char.maxFP || 0,
    mp: 0,
    currentMP: 0,
    basicSpeed: 0,
    dodge: char.dodge,
    parry: char.parry,
    block: char.block,
    dr: char.dr,
    notes: char.notes
  };
}

// Convert LibraryCharacter to CombatCharacter for storage
// Exported for tests.
export function libraryCharacterToCombat(char: LibraryCharacter): CombatCharacter {
  const category = deriveCombatCategory(char.category);
  return {
    id: char.id,
    name: char.name,
    category,
    isNPC: category !== 'player',
    hp: char.currentHP ?? char.hp,
    maxHP: char.hp,
    fp: char.currentFP ?? char.fp ?? 0,
    maxFP: char.fp || 0,
    st: char.st,
    dx: char.dx,
    iq: char.iq,
    ht: char.ht,
    dodge: char.dodge || 0,
    parry: char.parry,
    block: char.block,
    dr: char.dr || 0,
    skills: {},
    weapons: [],
    notes: char.notes
  };
}

type SortByValue = 'name' | 'category' | 'basicSpeed';

/**
 * Character Library - CRUD for character sheets
 * Handles create, read, update, delete, duplicate, search, filter, sort, import/export
 */
export default function CharacterLibrary() {
  const { combatCharacters, saveCombatCharacters, combatTombstones, saveCombatTombstones, combatHistory, partyCharacters } = useCombatStore();

  // Toast notifications
  const { success: showSuccess, error: showError } = useToast();

  // Count party characters for informational display
  const partyCharacterCount = (partyCharacters as PartyCharacter[] || []).length;

  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [sortBy, setSortBy] = useState<SortByValue>('name');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showGCSImport, setShowGCSImport] = useState(false);

  // Filtered and sorted characters
  const displayCharacters = useMemo(() => {
    const libraryChars = (combatCharacters as CombatCharacter[]).map(combatCharacterToLibrary);
    let filtered = libraryChars.filter(char => {
      const matchesSearch = char.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = filterCategory === 'all' || char.category === filterCategory;
      return matchesSearch && matchesCategory;
    });

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'category':
          return a.category.localeCompare(b.category) || a.name.localeCompare(b.name);
        case 'basicSpeed':
          return b.basicSpeed - a.basicSpeed || a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });

    return filtered;
  }, [combatCharacters, searchTerm, filterCategory, sortBy]);

  // Create new character
  const handleCreate = (characterData: CharacterData) => {
    const newLibChar: LibraryCharacter = {
      ...characterData,
      id: generateId(),
      currentHP: characterData.currentHP ?? characterData.hp,
      currentFP: characterData.currentFP ?? characterData.fp ?? 0,
      currentMP: characterData.mp || 0
    };
    const newCombatChar = libraryCharacterToCombat(newLibChar);
    saveCombatCharacters([...(combatCharacters as CombatCharacter[]), newCombatChar]);
    setShowForm(false);
  };

  // Update existing character
  const handleUpdate = (characterData: CharacterData) => {
    const updatedLibChar: LibraryCharacter = { ...characterData, id: editingId || '' };
    const updatedCombatChar = libraryCharacterToCombat(updatedLibChar);
    saveCombatCharacters(
      (combatCharacters as CombatCharacter[]).map(char =>
        char.id === editingId ? updatedCombatChar : char
      )
    );
    setEditingId(null);
  };

  // Delete character
  const handleDelete = (id: string) => {
    const charToDelete = (combatCharacters as CombatCharacter[]).find(c => c.id === id);

    // Check if this character is referenced in combat history
    const isReferenced = (combatHistory as CombatSession[]).some(session =>
      session.participants?.some(p => p.characterId === id)
    );

    if (isReferenced && charToDelete) {
      // Move to tombstones instead of deleting
      saveCombatTombstones([...(combatTombstones as CombatCharacter[]), charToDelete]);
    }

    // Remove from active characters
    saveCombatCharacters((combatCharacters as CombatCharacter[]).filter(c => c.id !== id));
  };

  // Duplicate character
  const handleDuplicate = (id: string) => {
    const original = (combatCharacters as CombatCharacter[]).find(c => c.id === id);
    if (!original) return;

    const dupLibChar: LibraryCharacter = {
      ...combatCharacterToLibrary(original),
      id: generateId(),
      name: `${original.name} (Copy)`
    };
    const dupCombatChar = libraryCharacterToCombat(dupLibChar);

    saveCombatCharacters([...(combatCharacters as CombatCharacter[]), dupCombatChar]);
  };

  // Export library as JSON
  const handleExport = () => {
    const dataStr = JSON.stringify(combatCharacters, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gurps-combat-library-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Import library from JSON
  const handleImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reject oversized files before reading
    if (exceedsImportSizeLimit(file)) {
      showError('File too large (max 50 MB)');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const raw = JSON.parse(e.target?.result as string);

        // Validate structure with Zod schema
        const result = CharacterArraySchema.safeParse(raw);
        if (!result.success) {
          const issue = result.error.issues[0];
          const path = issue?.path?.join('.') || '';
          showError(`Invalid character data${path ? ` at ${path}` : ''}: ${issue?.message}`);
          return;
        }

        // Merge with existing, regenerating IDs to avoid conflicts.
        // Pre-1.5.1 library exports carry isNPC but no category — derive it.
        const newLibChars: LibraryCharacter[] = result.data.map((char) => ({
          ...char,
          id: generateId(),
          category: deriveCombatCategory(char.category, char.isNPC),
          currentHP: char.hp,
          currentFP: char.fp || 0,
          currentMP: char.mp || 0
        }));
        const newCombatChars = newLibChars.map(libraryCharacterToCombat);

        saveCombatCharacters([...(combatCharacters as CombatCharacter[]), ...newCombatChars]);
        showSuccess(`Imported ${newLibChars.length} characters`);
      } catch (error) {
        showError('Error parsing JSON file: ' + (error as Error).message);
      }
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset input
  };

  return (
    <div className="space-y-4">
      {/* Header and Actions */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Character Library</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowGCSImport(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded"
          >
            <FileText size={16} />
            Import GCS
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded"
          >
            <Plus size={16} />
            New Character
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded"
            disabled={(combatCharacters as CombatCharacter[]).length === 0}
          >
            <Download size={16} />
            Export
          </button>
          <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded cursor-pointer">
            <Upload size={16} />
            Import
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex gap-4 items-center bg-gray-800 p-4 rounded">
        <div className="flex-1 relative">
          <Search size={20} className="absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search characters..."
            value={searchTerm}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-700 rounded"
          />
        </div>
        <select
          value={filterCategory}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => setFilterCategory(e.target.value)}
          className="px-4 py-2 bg-gray-700 rounded"
        >
          <option value="all">All Categories</option>
          {COMBAT_CATEGORIES.map(cat => (
            <option key={cat} value={cat}>
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => setSortBy(e.target.value as SortByValue)}
          className="px-4 py-2 bg-gray-700 rounded"
        >
          <option value="name">Sort by Name</option>
          <option value="category">Sort by Category</option>
          <option value="basicSpeed">Sort by Speed</option>
        </select>
      </div>

      {/* Party Characters Info Banner */}
      {partyCharacterCount > 0 && (
        <div className="flex items-center gap-3 bg-purple-900/30 border border-purple-600/50 rounded p-3">
          <Users size={20} className="text-purple-400" />
          <div className="flex-1">
            <span className="text-purple-200 font-medium">{partyCharacterCount} Party Character{partyCharacterCount !== 1 ? 's' : ''}</span>
            <span className="text-gray-400 ml-2 text-sm">
              Party characters are managed in the Party tab and can be added to encounters from Encounter Setup.
            </span>
          </div>
          <Info size={16} className="text-gray-500" />
        </div>
      )}

      {/* Character List */}
      <div className="space-y-2">
        {displayCharacters.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            {(combatCharacters as CombatCharacter[]).length === 0 ? (
              <p>No characters in library. Create one to get started!</p>
            ) : (
              <p>No characters match your search.</p>
            )}
          </div>
        ) : (
          displayCharacters.map(char => (
            <CharacterSheet
              key={char.id}
              character={char as any}
              onEdit={() => setEditingId(char.id!)}
              onDelete={() => handleDelete(char.id!)}
              onDuplicate={() => handleDuplicate(char.id!)}
            />
          ))
        )}
      </div>

      {/* Create/Edit Form Modal */}
      {(showForm || editingId) && (
        <CharacterForm
          character={editingId ? (combatCharacterToLibrary((combatCharacters as CombatCharacter[]).find(c => c.id === editingId)!) as any) : null}
          onSave={(data) => (editingId ? handleUpdate(data as unknown as CharacterData) : handleCreate(data as unknown as CharacterData))}
          onCancel={() => {
            setShowForm(false);
            setEditingId(null);
          }}
        />
      )}

      {/* GCS Import Modal */}
      {showGCSImport && (
        <GCSImportModal
          onImport={(data) => handleCreate(data as unknown as CharacterData)}
          onCancel={() => setShowGCSImport(false)}
        />
      )}
    </div>
  );
}
