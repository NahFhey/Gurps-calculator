import { useState } from 'react';
import { Plus, Save, X, Trash2, ChevronDown, ChevronRight, Edit2 } from 'lucide-react';
import {
  SPECIES_TAGS,
  FISH_SECONDARY_MATERIALS,
  FISH_ST_RANGE
} from '../../../constants';
import type { SpeciesViewProps, GatheringSpeciesExtended } from '../../../types/gathering';

/**
 * SpeciesView - Manages fish and other gatherable species
 *
 * Allows creating, editing, and deleting species with their yields,
 * secondary materials, tags, and special properties like ST for large fish.
 */
export function SpeciesView({ species, foodTypes, saveSpecies, onDelete }: SpeciesViewProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [newSpeciesName, setNewSpeciesName] = useState('');
  const [newSpeciesType, setNewSpeciesType] = useState<'fish' | 'shellfish' | 'crustacean'>('fish');
  const [newSpeciesTags, setNewSpeciesTags] = useState<string[]>([]);
  const [newSpeciesFoodType, setNewSpeciesFoodType] = useState('fish');
  const [newSpeciesMeatFormula, setNewSpeciesMeatFormula] = useState('2d');
  const [newSpeciesSecondaryType, setNewSpeciesSecondaryType] = useState('');
  const [newSpeciesSecondaryFormula, setNewSpeciesSecondaryFormula] = useState('');
  const [newSpeciesSecondaryNameOverride, setNewSpeciesSecondaryNameOverride] = useState('');
  const [newSpeciesST, setNewSpeciesST] = useState('14');
  const [newSpeciesSpecialRules, setNewSpeciesSpecialRules] = useState<string[]>([]);

  function addSpecies() {
    if (!newSpeciesName.trim()) {
      alert('Enter species name');
      return;
    }

    const entryData: Omit<GatheringSpeciesExtended, 'id'> = {
      name: newSpeciesName.trim(),
      type: newSpeciesType,
      tags: newSpeciesTags,
      foodType: newSpeciesFoodType,
      yieldMeatFormula: newSpeciesMeatFormula || '1d',
      secondaryMaterialType: newSpeciesSecondaryType || null,
      yieldSecondaryFormula: newSpeciesSecondaryFormula || null,
      secondaryNameOverride: newSpeciesSecondaryNameOverride.trim() || null,
      st: newSpeciesTags.includes('LargeFish') ? parseInt(newSpeciesST) || 14 : null,
      specialRules: newSpeciesSpecialRules
    };

    if (editingId) {
      saveSpecies(species.map(s => s.id === editingId ? { ...s, ...entryData } : s));
    } else {
      saveSpecies([...species, { id: crypto.randomUUID(), ...entryData }]);
    }
    resetForm();
  }

  function editSpecies(s: GatheringSpeciesExtended) {
    setEditingId(s.id);
    setNewSpeciesName(s.name);
    setNewSpeciesType(s.type || 'fish');
    setNewSpeciesTags(s.tags || []);
    setNewSpeciesFoodType(s.foodType || 'fish');
    setNewSpeciesMeatFormula(s.yieldMeatFormula || '2d');
    setNewSpeciesSecondaryType(s.secondaryMaterialType || '');
    setNewSpeciesSecondaryFormula(s.yieldSecondaryFormula || '');
    setNewSpeciesSecondaryNameOverride(s.secondaryNameOverride || '');
    setNewSpeciesST(String(s.st || 14));
    setNewSpeciesSpecialRules(s.specialRules || []);
    setShowAdd(true);
  }

  function resetForm() {
    setEditingId(null);
    setNewSpeciesName('');
    setNewSpeciesType('fish');
    setNewSpeciesTags([]);
    setNewSpeciesFoodType('fish');
    setNewSpeciesMeatFormula('2d');
    setNewSpeciesSecondaryType('');
    setNewSpeciesSecondaryFormula('');
    setNewSpeciesSecondaryNameOverride('');
    setNewSpeciesST('14');
    setNewSpeciesSpecialRules([]);
    setShowAdd(false);
  }

  return (
    <div>
      <div className="flex justify-between mb-4">
        <h3 className="text-lg font-bold">Species ({species.length})</h3>
        <button onClick={() => setShowAdd(!showAdd)} className="bg-success-600 px-3 py-1 rounded text-sm">
          <Plus size={16} className="inline" /> Add Species
        </button>
      </div>

      {showAdd && (
        <div className="bg-surface-2 p-4 rounded mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-fg-muted mb-1">Name *</label>
              <input
                value={newSpeciesName}
                onChange={(e) => setNewSpeciesName(e.target.value)}
                placeholder="e.g., Coastal Trout"
                className="w-full bg-surface-3 px-3 py-2 rounded"
              />
            </div>
            <div>
              <label className="block text-xs text-fg-muted mb-1">Type</label>
              <select
                value={newSpeciesType}
                onChange={(e) => setNewSpeciesType(e.target.value as 'fish' | 'shellfish' | 'crustacean')}
                className="w-full bg-surface-3 px-3 py-2 rounded"
              >
                <option value="fish">Fish</option>
                <option value="shellfish">Shellfish</option>
                <option value="crustacean">Crustacean</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-fg-muted mb-1">Tags</label>
            <div className="flex flex-wrap gap-2">
              {SPECIES_TAGS.map(tag => (
                <label key={tag} className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={newSpeciesTags.includes(tag)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setNewSpeciesTags([...newSpeciesTags, tag]);
                      } else {
                        setNewSpeciesTags(newSpeciesTags.filter(t => t !== tag));
                      }
                    }}
                    className="w-4 h-4"
                  />
                  {tag}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-fg-muted mb-1">Food Type</label>
              <select
                value={newSpeciesFoodType}
                onChange={(e) => setNewSpeciesFoodType(e.target.value)}
                className="w-full bg-surface-3 px-3 py-2 rounded"
              >
                {foodTypes.length > 0 ? (
                  foodTypes.map(ft => (
                    <option key={ft} value={ft}>{ft.charAt(0).toUpperCase() + ft.slice(1)}</option>
                  ))
                ) : (
                  <>
                    <option value="fish">Fish</option>
                    <option value="shellfish">Shellfish</option>
                  </>
                )}
              </select>
            </div>
            <div>
              <label className="block text-xs text-fg-muted mb-1">Meat Yield Formula</label>
              <input
                value={newSpeciesMeatFormula}
                onChange={(e) => setNewSpeciesMeatFormula(e.target.value)}
                placeholder="e.g., 2d+1"
                className="w-full bg-surface-3 px-3 py-2 rounded"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-fg-muted mb-1">Secondary Material</label>
              <select
                value={newSpeciesSecondaryType}
                onChange={(e) => setNewSpeciesSecondaryType(e.target.value)}
                className="w-full bg-surface-3 px-3 py-2 rounded"
              >
                <option value="">None</option>
                {FISH_SECONDARY_MATERIALS.map(mat => (
                  <option key={mat} value={mat}>{mat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-fg-muted mb-1">Secondary Yield Formula</label>
              <input
                value={newSpeciesSecondaryFormula}
                onChange={(e) => setNewSpeciesSecondaryFormula(e.target.value)}
                placeholder="e.g., 1d"
                disabled={!newSpeciesSecondaryType}
                className="w-full bg-surface-3 px-3 py-2 rounded disabled:opacity-50"
              />
            </div>
          </div>

          {newSpeciesSecondaryType && (
            <div>
              <label className="block text-xs text-fg-muted mb-1">Secondary Name Override (optional)</label>
              <input
                value={newSpeciesSecondaryNameOverride}
                onChange={(e) => setNewSpeciesSecondaryNameOverride(e.target.value)}
                placeholder={`Default: ${newSpeciesName || 'Species'} ${newSpeciesSecondaryType || 'Material'}`}
                className="w-full bg-surface-3 px-3 py-2 rounded"
              />
              <p className="text-xs text-fg-faint mt-1">Leave blank for "{newSpeciesName || 'Species'} {newSpeciesSecondaryType || 'Material'}"</p>
            </div>
          )}

          {newSpeciesTags.includes('LargeFish') && (
            <div className="w-1/2">
              <label className="block text-xs text-fg-muted mb-1">ST (for struggle, {FISH_ST_RANGE.min}-{FISH_ST_RANGE.max})</label>
              <input
                type="number"
                value={newSpeciesST}
                onChange={(e) => setNewSpeciesST(e.target.value)}
                min={FISH_ST_RANGE.min}
                max={FISH_ST_RANGE.max}
                className="w-full bg-surface-3 px-3 py-2 rounded"
              />
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button onClick={addSpecies} className="flex-1 bg-success-600 px-4 py-2 rounded">
              <Save size={16} className="inline mr-1" /> {editingId ? 'Update' : 'Save'}
            </button>
            <button onClick={resetForm} className="bg-danger-600 px-4 py-2 rounded">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {species.length === 0 ? (
          <p className="text-fg-faint italic">No species defined. Add some to enable fishing!</p>
        ) : (
          species.map(s => (
            <div key={s.id} className="bg-surface-2 rounded">
              <div
                className="flex items-center gap-4 p-3 cursor-pointer hover:bg-surface-3"
                onClick={() => setExpanded(prev => ({ ...prev, [s.id]: !prev[s.id] }))}
              >
                <span>{expanded[s.id] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</span>
                <span className="flex-1 font-medium">{s.name}</span>
                <span className="text-sm text-fg-muted">{s.type}</span>
                {s.tags?.includes('LargeFish') && (
                  <span className="text-xs bg-orange-600 px-2 py-1 rounded">Large</span>
                )}
              </div>
              {expanded[s.id] && (
                <div className="px-3 pb-3 space-y-2 border-t border-edge-strong pt-2">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-fg-muted">Meat:</span> {s.yieldMeatFormula} &rarr; {s.foodType}</div>
                    {s.secondaryMaterialType && (
                      <div><span className="text-fg-muted">Secondary:</span> {s.yieldSecondaryFormula} &rarr; {s.secondaryNameOverride || `${s.name} ${s.secondaryMaterialType}`}</div>
                    )}
                    {s.st && <div><span className="text-fg-muted">ST:</span> {s.st}</div>}
                  </div>
                  {s.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {s.tags.map(tag => (
                        <span key={tag} className="text-xs bg-surface-3 px-2 py-1 rounded">{tag}</span>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-4">
                    <button
                      onClick={(e) => { e.stopPropagation(); editSpecies(s); }}
                      className="text-accent-400 text-sm"
                    >
                      <Edit2 size={14} className="inline mr-1" /> Edit
                    </button>
                    <button
                      onClick={() => onDelete('species', s.id, s.name)}
                      className="text-danger-400 text-sm"
                    >
                      <Trash2 size={14} className="inline mr-1" /> Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
