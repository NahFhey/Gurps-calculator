import { useState } from 'react';
import { Plus, Save, X, Trash2 } from 'lucide-react';
import { toNumberOr } from '../../../utils/helpers';
import type { MaterialTypesViewProps } from '../../../types/views';

/**
 * MaterialTypesView - Manages crafting material types
 *
 * Materials have properties that affect crafting:
 * - Difficulty modifier (affects skill rolls)
 * - HT (health/durability)
 * - DR shift (damage resistance modifier)
 * - Weight/HP modifiers (percentage adjustments)
 * - Special effects
 */
export function MaterialTypesView({ materialTypes, saveMaterialTypes, renameMaterialType, onDelete }: MaterialTypesViewProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [newMatType, setNewMatType] = useState('');
  const [newMatDiff, setNewMatDiff] = useState('0');
  const [newMatHT, setNewMatHT] = useState('10');
  const [newMatDR, setNewMatDR] = useState('0');
  const [newMatWeightMod, setNewMatWeightMod] = useState('0');
  const [newMatHPMod, setNewMatHPMod] = useState('0');
  const [newMatEffects, setNewMatEffects] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [draftMatTypeName, setDraftMatTypeName] = useState<Record<string, string | undefined>>({});

  function addMaterialType() {
    if (!newMatType.trim()) {
      alert('Enter a name');
      return;
    }

    if (materialTypes.find(t => t.name === newMatType.toLowerCase())) {
      alert('Duplicate name');
      return;
    }

    saveMaterialTypes([...materialTypes, {
      name: newMatType.toLowerCase(),
      difficulty: toNumberOr(newMatDiff, 0),
      ht: toNumberOr(newMatHT, 10),
      drShift: toNumberOr(newMatDR, 0),
      weightMod: toNumberOr(newMatWeightMod, 0),
      hpMod: toNumberOr(newMatHPMod, 0),
      effects: newMatEffects
    }]);

    setNewMatType('');
    setNewMatDiff('0');
    setNewMatHT('10');
    setNewMatDR('0');
    setNewMatWeightMod('0');
    setNewMatHPMod('0');
    setNewMatEffects('');
    setShowAdd(false);
  }

  function handleRename(oldName: string, newName: string) {
    const trimmedName = newName.toLowerCase().trim();

    if (trimmedName === oldName) {
      setDraftMatTypeName({...draftMatTypeName, [oldName]: undefined});
      return;
    }

    if (!trimmedName) {
      alert('Name cannot be empty');
      setDraftMatTypeName({...draftMatTypeName, [oldName]: oldName});
      return;
    }

    if (materialTypes.find(x => x.name === trimmedName && x.name !== oldName)) {
      alert('Duplicate name');
      setDraftMatTypeName({...draftMatTypeName, [oldName]: oldName});
      return;
    }

    renameMaterialType(oldName, trimmedName);
    setDraftMatTypeName({...draftMatTypeName, [oldName]: undefined});
  }

  return (
    <div>
      <div className="flex justify-between mb-4">
        <h2 className="text-xl font-bold">Material Types</h2>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="bg-green-600 px-4 py-2 rounded"
        >
          <Plus size={20} className="inline" /> Add
        </button>
      </div>

      {showAdd && (
        <div className="bg-gray-700 p-4 rounded mb-4 space-y-3">
          <input
            value={newMatType}
            onChange={(e) => setNewMatType(e.target.value)}
            placeholder="Type name"
            className="w-full bg-gray-600 px-3 py-2 rounded"
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Difficulty Modifier</label>
              <input
                type="number"
                value={newMatDiff}
                onChange={(e) => setNewMatDiff(e.target.value)}
                className="w-full bg-gray-600 px-3 py-2 rounded"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">HT</label>
              <input
                type="number"
                value={newMatHT}
                onChange={(e) => setNewMatHT(e.target.value)}
                className="w-full bg-gray-600 px-3 py-2 rounded"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">DR Shift</label>
              <input
                type="number"
                value={newMatDR}
                onChange={(e) => setNewMatDR(e.target.value)}
                className="w-full bg-gray-600 px-3 py-2 rounded"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Weight Mod (%)</label>
              <input
                type="number"
                min="-100"
                max="100"
                value={newMatWeightMod}
                onChange={(e) => setNewMatWeightMod(e.target.value)}
                className="w-full bg-gray-600 px-3 py-2 rounded"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">HP Mod (%)</label>
              <input
                type="number"
                min="-100"
                max="100"
                value={newMatHPMod}
                onChange={(e) => setNewMatHPMod(e.target.value)}
                className="w-full bg-gray-600 px-3 py-2 rounded"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Effects</label>
            <textarea
              value={newMatEffects}
              onChange={(e) => setNewMatEffects(e.target.value)}
              placeholder="Special effects or notes"
              className="w-full bg-gray-600 px-3 py-2 rounded"
              rows={2}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={addMaterialType}
              className="flex-1 bg-green-600 py-2 rounded"
            >
              <Save size={20} className="inline" /> Save
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="bg-red-600 px-4 py-2 rounded"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {materialTypes.map(t => (
          <div key={t.name} className="bg-gray-700 rounded">
            <div
              className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-600"
              onClick={() => setExpanded(p => ({...p, [t.name]: !p[t.name]}))}
            >
              <span className="flex-1 capitalize">{t.name}</span>
              <span className="text-gray-400 text-sm">Diff: {t.difficulty >= 0 ? '+' : ''}{t.difficulty}</span>
              <span className="text-gray-400 text-sm">HT: {t.ht}</span>
              <span className="text-gray-400 text-sm">DR: {t.drShift >= 0 ? '+' : ''}{t.drShift}</span>
              <span className="text-blue-400 text-sm">W: {t.weightMod >= 0 ? '+' : ''}{t.weightMod}%</span>
              <span className="text-blue-400 text-sm">HP: {t.hpMod >= 0 ? '+' : ''}{t.hpMod}%</span>
              <span className="text-gray-400">{expanded[t.name] ? '▼' : '▶'}</span>
            </div>

            {expanded[t.name] && (
              <div className="px-3 pb-3 space-y-3 border-t border-gray-600 pt-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Name (blur to save)</label>
                  <input
                    value={draftMatTypeName[t.name] !== undefined ? draftMatTypeName[t.name] : t.name}
                    onChange={(e) => {
                      const newName = e.target.value.toLowerCase();
                      setDraftMatTypeName({...draftMatTypeName, [t.name]: newName});
                    }}
                    onBlur={(e) => handleRename(t.name, e.target.value)}
                    className="w-full bg-gray-600 px-3 py-1 rounded"
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Difficulty</label>
                    <input
                      type="number"
                      value={t.difficulty}
                      onChange={(e) => saveMaterialTypes(materialTypes.map(x =>
                        x.name === t.name ? {...x, difficulty: toNumberOr(e.target.value, t.difficulty)} : x
                      ))}
                      className="w-full bg-gray-600 px-2 py-1 rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">HT</label>
                    <input
                      type="number"
                      value={t.ht}
                      onChange={(e) => saveMaterialTypes(materialTypes.map(x =>
                        x.name === t.name ? {...x, ht: toNumberOr(e.target.value, t.ht)} : x
                      ))}
                      className="w-full bg-gray-600 px-2 py-1 rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">DR Shift</label>
                    <input
                      type="number"
                      value={t.drShift}
                      onChange={(e) => saveMaterialTypes(materialTypes.map(x =>
                        x.name === t.name ? {...x, drShift: toNumberOr(e.target.value, t.drShift)} : x
                      ))}
                      className="w-full bg-gray-600 px-2 py-1 rounded"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Weight Modifier (%)</label>
                    <input
                      type="number"
                      min="-100"
                      max="100"
                      value={t.weightMod || 0}
                      onChange={(e) => saveMaterialTypes(materialTypes.map(x =>
                        x.name === t.name ? {...x, weightMod: toNumberOr(e.target.value, t.weightMod)} : x
                      ))}
                      className="w-full bg-gray-600 px-2 py-1 rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">HP Modifier (%)</label>
                    <input
                      type="number"
                      min="-100"
                      max="100"
                      value={t.hpMod || 0}
                      onChange={(e) => saveMaterialTypes(materialTypes.map(x =>
                        x.name === t.name ? {...x, hpMod: toNumberOr(e.target.value, t.hpMod)} : x
                      ))}
                      className="w-full bg-gray-600 px-2 py-1 rounded"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Effects</label>
                  <textarea
                    value={t.effects || ''}
                    onChange={(e) => saveMaterialTypes(materialTypes.map(x =>
                      x.name === t.name ? {...x, effects: e.target.value} : x
                    ))}
                    placeholder="Special effects or notes"
                    className="w-full bg-gray-600 px-3 py-2 rounded"
                    rows={2}
                  />
                </div>
                <button
                  onClick={() => onDelete('materialType', t.name)}
                  className="w-full bg-red-600 py-2 rounded text-sm"
                >
                  <Trash2 size={16} className="inline" /> Delete Material Type
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
