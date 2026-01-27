import { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import { X, Plus, Trash2, Copy } from 'lucide-react';
import { COMBAT_CATEGORIES } from '../../constants';
import { HUMANOID_DR_FIELDS, HIT_LOCATION_PROFILES } from '../../constants/hitLocationConstants';

interface Attack {
  name: string;
  skill: number;
  damage: string;
  notes: string;
}

interface CharacterData {
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
  hitLocationProfileId: string;
  drByLocation: Record<string, number>;
  attacks: Attack[];
  notes: string;
}

interface Character extends CharacterData {
  id?: string;
}

interface DRField {
  key: string;
  label: string;
}

interface CharacterFormProps {
  character?: Character | null;
  onSave: (data: CharacterData) => void;
  onCancel: () => void;
}

/**
 * Character Form - Create/Edit character modal
 * Handles manual creation and editing of character sheets
 */
export default function CharacterForm({ character, onSave, onCancel }: CharacterFormProps) {
  const isEditing = !!character;

  const [formData, setFormData] = useState<CharacterData>({
    name: '',
    category: 'player',
    st: 10,
    dx: 10,
    iq: 10,
    ht: 10,
    hp: 10,
    fp: 10,
    mp: 0,
    basicSpeed: 5.0,
    basicMove: 5,
    dodge: 8,
    parry: 8,
    block: 8,
    dr: 0,
    hitLocationProfileId: HIT_LOCATION_PROFILES.HUMANOID,
    drByLocation: {},
    attacks: [],
    notes: ''
  });

  // Load character data if editing
  useEffect(() => {
    if (character) {
      setFormData({
        name: character.name || '',
        category: character.category || 'player',
        st: character.st || 10,
        dx: character.dx || 10,
        iq: character.iq || 10,
        ht: character.ht || 10,
        hp: character.hp || 10,
        fp: character.fp || 10,
        mp: character.mp || 0,
        basicSpeed: character.basicSpeed || 5.0,
        basicMove: character.basicMove || 5,
        dodge: character.dodge || 8,
        parry: character.parry || 8,
        block: character.block || 8,
        dr: character.dr || 0,
        hitLocationProfileId: character.hitLocationProfileId || HIT_LOCATION_PROFILES.HUMANOID,
        drByLocation: character.drByLocation || {},
        attacks: character.attacks || [],
        notes: character.notes || ''
      });
    }
  }, [character]);

  const handleChange = (field: keyof CharacterData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Attack management
  const addAttack = () => {
    setFormData(prev => ({
      ...prev,
      attacks: [...prev.attacks, { name: '', skill: 10, damage: '', notes: '' }]
    }));
  };

  const removeAttack = (index: number) => {
    setFormData(prev => ({
      ...prev,
      attacks: prev.attacks.filter((_, i) => i !== index)
    }));
  };

  const updateAttack = (index: number, field: keyof Attack, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      attacks: prev.attacks.map((attack, i) =>
        i === index ? { ...attack, [field]: value } : attack
      )
    }));
  };

  // DR by location management
  const setLocationDR = (key: string, valueStr: string) => {
    setFormData(prev => {
      const next = { ...prev, drByLocation: { ...(prev.drByLocation || {}) } };
      if (valueStr === '' || valueStr == null) {
        delete next.drByLocation[key];
      } else {
        const n = Math.max(0, Math.floor(Number(valueStr)));
        if (Number.isFinite(n)) {
          next.drByLocation[key] = n;
        }
      }
      return next;
    });
  };

  const copyGeneralDRToAll = () => {
    const generalDR = formData.dr || 0;
    const newDrByLocation: Record<string, number> = {};
    (HUMANOID_DR_FIELDS as DRField[]).forEach(field => {
      newDrByLocation[field.key] = generalDR;
    });
    setFormData(prev => ({
      ...prev,
      drByLocation: newDrByLocation
    }));
  };

  const clearLocationDR = () => {
    setFormData(prev => ({
      ...prev,
      drByLocation: {}
    }));
  };

  // Auto-calculate derived stats when base attributes change
  useEffect(() => {
    const newBasicSpeed = (formData.dx + formData.ht) / 4;
    const newBasicMove = Math.floor(newBasicSpeed);
    const newDodge = Math.floor(newBasicSpeed) + 3;

    setFormData(prev => ({
      ...prev,
      basicSpeed: newBasicSpeed,
      basicMove: newBasicMove,
      dodge: newDodge,
      hp: prev.hp === 10 ? formData.ht : prev.hp, // Update HP if it's still default
      fp: prev.fp === 10 ? formData.ht : prev.fp  // Update FP if it's still default
    }));
  }, [formData.dx, formData.ht]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert('Character name is required');
      return;
    }

    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-gray-800 p-6 rounded-lg max-w-4xl w-full m-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">
            {isEditing ? 'Edit Character' : 'Create Character'}
          </h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-2">Character Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange('name', e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 rounded"
                required
              />
            </div>
            <div>
              <label className="block text-sm mb-2">Category</label>
              <select
                value={formData.category}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => handleChange('category', e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 rounded"
              >
                {COMBAT_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Primary Attributes */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Primary Attributes</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm mb-2">ST</label>
                <input
                  type="number"
                  value={formData.st}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange('st', parseInt(e.target.value) || 10)}
                  className="w-full px-3 py-2 bg-gray-700 rounded"
                  min="1"
                  max="50"
                />
              </div>
              <div>
                <label className="block text-sm mb-2">DX</label>
                <input
                  type="number"
                  value={formData.dx}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange('dx', parseInt(e.target.value) || 10)}
                  className="w-full px-3 py-2 bg-gray-700 rounded"
                  min="1"
                  max="50"
                />
              </div>
              <div>
                <label className="block text-sm mb-2">IQ</label>
                <input
                  type="number"
                  value={formData.iq}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange('iq', parseInt(e.target.value) || 10)}
                  className="w-full px-3 py-2 bg-gray-700 rounded"
                  min="1"
                  max="50"
                />
              </div>
              <div>
                <label className="block text-sm mb-2">HT</label>
                <input
                  type="number"
                  value={formData.ht}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange('ht', parseInt(e.target.value) || 10)}
                  className="w-full px-3 py-2 bg-gray-700 rounded"
                  min="1"
                  max="50"
                />
              </div>
            </div>
          </div>

          {/* Secondary Characteristics */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Secondary Characteristics</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm mb-2">HP</label>
                <input
                  type="number"
                  value={formData.hp}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange('hp', parseInt(e.target.value) || 10)}
                  className="w-full px-3 py-2 bg-gray-700 rounded"
                  min="1"
                />
              </div>
              <div>
                <label className="block text-sm mb-2">FP</label>
                <input
                  type="number"
                  value={formData.fp}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange('fp', parseInt(e.target.value) || 10)}
                  className="w-full px-3 py-2 bg-gray-700 rounded"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm mb-2">MP</label>
                <input
                  type="number"
                  value={formData.mp}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange('mp', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-gray-700 rounded"
                  min="0"
                />
              </div>
            </div>
          </div>

          {/* Combat Stats */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Combat Stats</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm mb-2">Basic Speed</label>
                <input
                  type="number"
                  step="0.25"
                  value={formData.basicSpeed}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange('basicSpeed', parseFloat(e.target.value) || 5.0)}
                  className="w-full px-3 py-2 bg-gray-700 rounded"
                />
              </div>
              <div>
                <label className="block text-sm mb-2">Basic Move</label>
                <input
                  type="number"
                  value={formData.basicMove}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange('basicMove', parseInt(e.target.value) || 5)}
                  className="w-full px-3 py-2 bg-gray-700 rounded"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm mb-2">Dodge</label>
                <input
                  type="number"
                  value={formData.dodge}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange('dodge', parseInt(e.target.value) || 8)}
                  className="w-full px-3 py-2 bg-gray-700 rounded"
                  min="0"
                />
              </div>
            </div>
          </div>

          {/* Defenses */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Defenses</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm mb-2">Parry</label>
                <input
                  type="number"
                  value={formData.parry}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange('parry', parseInt(e.target.value) || 8)}
                  className="w-full px-3 py-2 bg-gray-700 rounded"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm mb-2">Block</label>
                <input
                  type="number"
                  value={formData.block}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange('block', parseInt(e.target.value) || 8)}
                  className="w-full px-3 py-2 bg-gray-700 rounded"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm mb-2">General DR</label>
                <input
                  type="number"
                  value={formData.dr}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange('dr', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-gray-700 rounded"
                  min="0"
                />
                <div className="text-xs text-gray-400 mt-1">Fallback for all locations</div>
              </div>
            </div>
          </div>

          {/* Hit Location Profile */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Hit Location Profile</h3>
            <div className="mb-3">
              <label className="block text-sm mb-2">Profile</label>
              <select
                value={formData.hitLocationProfileId}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => handleChange('hitLocationProfileId', e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 rounded"
              >
                <option value={HIT_LOCATION_PROFILES.HUMANOID}>Humanoid</option>
              </select>
            </div>

            {/* DR by Location Editor */}
            {formData.hitLocationProfileId === HIT_LOCATION_PROFILES.HUMANOID && (
              <div className="bg-gray-900 rounded p-4">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-semibold">DR by Location</h4>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={copyGeneralDRToAll}
                      className="flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
                      title="Copy General DR to all locations"
                    >
                      <Copy size={14} />
                      Copy General DR
                    </button>
                    <button
                      type="button"
                      onClick={clearLocationDR}
                      className="px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded text-sm"
                      title="Clear all location DR"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {(HUMANOID_DR_FIELDS as DRField[]).map(field => {
                    const value = formData.drByLocation[field.key];
                    return (
                      <div key={field.key}>
                        <label className="block text-xs text-gray-400 mb-1">{field.label}</label>
                        <input
                          type="number"
                          value={value !== undefined ? value : ''}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => setLocationDR(field.key, e.target.value)}
                          placeholder={`(General DR: ${formData.dr})`}
                          className="w-full px-2 py-1 bg-gray-700 rounded text-sm"
                          min="0"
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="text-xs text-gray-400 mt-3">
                  Empty fields will use General DR ({formData.dr})
                </div>
              </div>
            )}
          </div>

          {/* Attacks (Phase 3) */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold">Attacks</h3>
              <button
                type="button"
                onClick={addAttack}
                className="flex items-center gap-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
              >
                <Plus size={16} />
                Add Attack
              </button>
            </div>

            {formData.attacks.length === 0 ? (
              <div className="text-sm text-gray-400 text-center py-4 bg-gray-900 rounded">
                No attacks configured. Click "Add Attack" to add one.
              </div>
            ) : (
              <div className="space-y-3">
                {formData.attacks.map((attack, index) => (
                  <div key={index} className="bg-gray-900 rounded p-3 space-y-2">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-semibold text-gray-400">Attack #{index + 1}</span>
                      <button
                        type="button"
                        onClick={() => removeAttack(index)}
                        className="p-1 text-red-400 hover:text-red-300"
                        title="Remove attack"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Name</label>
                        <input
                          type="text"
                          value={attack.name}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => updateAttack(index, 'name', e.target.value)}
                          placeholder="e.g., Broadsword, Punch"
                          className="w-full px-2 py-1 bg-gray-700 rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Skill</label>
                        <input
                          type="number"
                          value={attack.skill}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => updateAttack(index, 'skill', parseInt(e.target.value) || 10)}
                          className="w-full px-2 py-1 bg-gray-700 rounded text-sm"
                          min="0"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Damage</label>
                        <input
                          type="text"
                          value={attack.damage}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => updateAttack(index, 'damage', e.target.value)}
                          placeholder="e.g., 2d+1, sw+2"
                          className="w-full px-2 py-1 bg-gray-700 rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Notes</label>
                        <input
                          type="text"
                          value={attack.notes}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => updateAttack(index, 'notes', e.target.value)}
                          placeholder="Optional"
                          className="w-full px-2 py-1 bg-gray-700 rounded text-sm"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm mb-2">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => handleChange('notes', e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 rounded"
              rows={4}
              placeholder="Additional notes about this character..."
            />
          </div>

          {/* Actions */}
          <div className="flex gap-4 justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-green-600 hover:bg-green-700 rounded"
            >
              {isEditing ? 'Save Changes' : 'Create Character'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
