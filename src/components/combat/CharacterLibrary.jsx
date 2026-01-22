import React, { useState, useMemo } from 'react';
import { Plus, Search, Download, Upload, FileText } from 'lucide-react';
import { useCombat } from '../../contexts/CombatContext';
import { COMBAT_CATEGORIES } from '../../constants';
import { generateId } from '../../utils/combatHelpers';
import CharacterSheet from './CharacterSheet';
import CharacterForm from './CharacterForm';
import GCSImportModal from './GCSImportModal';

/**
 * Character Library - CRUD for character sheets
 * Handles create, read, update, delete, duplicate, search, filter, sort, import/export
 */
export default function CharacterLibrary() {
  const { combatCharacters, saveCombatCharacters, combatTombstones, saveCombatTombstones, combatHistory } = useCombat();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [sortBy, setSortBy] = useState('name'); // 'name', 'category', 'basicSpeed'
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showGCSImport, setShowGCSImport] = useState(false);

  // Filtered and sorted characters
  const displayCharacters = useMemo(() => {
    let filtered = combatCharacters.filter(char => {
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
  const handleCreate = (characterData) => {
    const newChar = {
      ...characterData,
      id: generateId(),
      currentHP: characterData.hp,
      currentFP: characterData.fp || 0,
      currentMP: characterData.mp || 0
    };
    saveCombatCharacters([...combatCharacters, newChar]);
    setShowForm(false);
  };

  // Update existing character
  const handleUpdate = (characterData) => {
    saveCombatCharacters(
      combatCharacters.map(char =>
        char.id === editingId ? { ...characterData, id: editingId } : char
      )
    );
    setEditingId(null);
  };

  // Delete character
  const handleDelete = (id) => {
    const charToDelete = combatCharacters.find(c => c.id === id);

    // Check if this character is referenced in combat history
    const isReferenced = combatHistory.some(combat =>
      combat.participants?.some(p => p.id === id)
    );

    if (isReferenced) {
      // Move to tombstones instead of deleting
      saveCombatTombstones([...combatTombstones, charToDelete]);
    }

    // Remove from active characters
    saveCombatCharacters(combatCharacters.filter(c => c.id !== id));
  };

  // Duplicate character
  const handleDuplicate = (id) => {
    const original = combatCharacters.find(c => c.id === id);
    if (!original) return;

    const duplicate = {
      ...original,
      id: generateId(),
      name: `${original.name} (Copy)`,
      currentHP: original.hp,
      currentFP: original.fp || 0,
      currentMP: original.mp || 0
    };

    saveCombatCharacters([...combatCharacters, duplicate]);
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
  const handleImport = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        if (!Array.isArray(imported)) {
          alert('Invalid file format: expected an array of characters');
          return;
        }

        // Merge with existing, regenerating IDs to avoid conflicts
        const newChars = imported.map(char => ({
          ...char,
          id: generateId(),
          currentHP: char.hp,
          currentFP: char.fp || 0,
          currentMP: char.mp || 0
        }));

        saveCombatCharacters([...combatCharacters, ...newChars]);
        alert(`Imported ${newChars.length} characters`);
      } catch (error) {
        alert('Error parsing JSON file: ' + error.message);
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
            disabled={combatCharacters.length === 0}
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
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-700 rounded"
          />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
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
          onChange={(e) => setSortBy(e.target.value)}
          className="px-4 py-2 bg-gray-700 rounded"
        >
          <option value="name">Sort by Name</option>
          <option value="category">Sort by Category</option>
          <option value="basicSpeed">Sort by Speed</option>
        </select>
      </div>

      {/* Character List */}
      <div className="space-y-2">
        {displayCharacters.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            {combatCharacters.length === 0 ? (
              <p>No characters in library. Create one to get started!</p>
            ) : (
              <p>No characters match your search.</p>
            )}
          </div>
        ) : (
          displayCharacters.map(char => (
            <CharacterSheet
              key={char.id}
              character={char}
              onEdit={() => setEditingId(char.id)}
              onDelete={() => handleDelete(char.id)}
              onDuplicate={() => handleDuplicate(char.id)}
            />
          ))
        )}
      </div>

      {/* Create/Edit Form Modal */}
      {(showForm || editingId) && (
        <CharacterForm
          character={editingId ? combatCharacters.find(c => c.id === editingId) : null}
          onSave={editingId ? handleUpdate : handleCreate}
          onCancel={() => {
            setShowForm(false);
            setEditingId(null);
          }}
        />
      )}

      {/* GCS Import Modal */}
      {showGCSImport && (
        <GCSImportModal
          onImport={handleCreate}
          onCancel={() => setShowGCSImport(false)}
        />
      )}
    </div>
  );
}
