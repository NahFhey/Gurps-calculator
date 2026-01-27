import React, { useState } from 'react';
import { Plus, Save, X, Trash2 } from 'lucide-react';
import { toNumberOr } from '../../../utils/helpers';

/**
 * WorkersView - Manages worker NPCs with skills
 *
 * Workers can perform activities like cooking, crafting, alchemy, and gathering.
 * Each worker has multiple skill levels that affect success rates.
 */
export function WorkersView({ workers, saveWorkers, onDelete }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newType, setNewType] = useState('');
  const [expanded, setExpanded] = useState({});

  function addWorker() {
    if (!newType.trim()) {
      alert('Enter a name');
      return;
    }

    if (workers.some(w => w.name === newType.trim())) {
      alert('Duplicate name');
      return;
    }

    const newWorker = {
      id: crypto.randomUUID(),
      name: newType.trim(),
      skills: {
        cooking: toNumberOr(document.getElementById('newWorkerCooking').value, 10),
        designing: toNumberOr(document.getElementById('newWorkerDesigning').value, 10),
        crafting: toNumberOr(document.getElementById('newWorkerCrafting').value, 10),
        alchemy: toNumberOr(document.getElementById('newWorkerAlchemy').value, 10)
      }
    };

    saveWorkers([...workers, newWorker]);
    setNewType('');
    setShowAdd(false);
  }

  function updateSkill(workerId, skillName, value) {
    saveWorkers(workers.map(w =>
      w.id === workerId
        ? {...w, skills: {...(w.skills || {}), [skillName]: toNumberOr(value, 10)}}
        : w
    ));
  }

  return (
    <div>
      <div className="flex justify-between mb-4">
        <h2 className="text-xl font-bold">Workers</h2>
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
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
            placeholder="Worker name"
            className="w-full bg-gray-600 px-3 py-2 rounded"
          />
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Cooking</label>
              <input
                type="number"
                defaultValue="10"
                id="newWorkerCooking"
                className="w-full bg-gray-600 px-3 py-2 rounded"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Designing</label>
              <input
                type="number"
                defaultValue="10"
                id="newWorkerDesigning"
                className="w-full bg-gray-600 px-3 py-2 rounded"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Crafting</label>
              <input
                type="number"
                defaultValue="10"
                id="newWorkerCrafting"
                className="w-full bg-gray-600 px-3 py-2 rounded"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Alchemy</label>
              <input
                type="number"
                defaultValue="10"
                id="newWorkerAlchemy"
                className="w-full bg-gray-600 px-3 py-2 rounded"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={addWorker}
              className="flex-1 bg-green-600 px-4 py-2 rounded"
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
        {workers.map(w => (
          <div key={w.id} className="bg-gray-700 rounded">
            <div
              className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-600"
              onClick={() => setExpanded(p => ({...p, [w.id]: !p[w.id]}))}
            >
              <span className="flex-1 font-semibold">{w.name}</span>
              <span className="text-xs text-gray-400">Cook: {w.skills?.cooking || 10}</span>
              <span className="text-xs text-gray-400">Design: {w.skills?.designing || 10}</span>
              <span className="text-xs text-gray-400">Craft: {w.skills?.crafting || 10}</span>
              <span className="text-xs text-gray-400">Alch: {w.skills?.alchemy || 10}</span>
              <span className="text-xs text-gray-400">Surv: {w.skills?.survival || 10}</span>
              <span className="text-gray-400">{expanded[w.id] ? '▼' : '▶'}</span>
            </div>

            {expanded[w.id] && (
              <div className="px-3 pb-3 space-y-3 border-t border-gray-600 pt-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Worker Name</label>
                  <input
                    value={w.name}
                    onChange={(e) => {
                      const newName = e.target.value;
                      if (workers.some(x => x.name === newName && x.id !== w.id)) {
                        alert('Duplicate name');
                        return;
                      }
                      saveWorkers(workers.map(x => x.id === w.id ? {...x, name: newName} : x));
                    }}
                    className="w-full bg-gray-600 px-3 py-2 rounded"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Cooking Skill</label>
                    <input
                      type="number"
                      value={w.skills?.cooking || 10}
                      onChange={(e) => updateSkill(w.id, 'cooking', e.target.value)}
                      className="w-full bg-gray-600 px-3 py-2 rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Designing Skill</label>
                    <input
                      type="number"
                      value={w.skills?.designing || 10}
                      onChange={(e) => updateSkill(w.id, 'designing', e.target.value)}
                      className="w-full bg-gray-600 px-3 py-2 rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Crafting Skill</label>
                    <input
                      type="number"
                      value={w.skills?.crafting || 10}
                      onChange={(e) => updateSkill(w.id, 'crafting', e.target.value)}
                      className="w-full bg-gray-600 px-3 py-2 rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Alchemy Skill</label>
                    <input
                      type="number"
                      value={w.skills?.alchemy || 10}
                      onChange={(e) => updateSkill(w.id, 'alchemy', e.target.value)}
                      className="w-full bg-gray-600 px-3 py-2 rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Survival Skill</label>
                    <input
                      type="number"
                      value={w.skills?.survival || 10}
                      onChange={(e) => updateSkill(w.id, 'survival', e.target.value)}
                      className="w-full bg-gray-600 px-3 py-2 rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Naturalist Skill</label>
                    <input
                      type="number"
                      value={w.skills?.naturalist || 10}
                      onChange={(e) => updateSkill(w.id, 'naturalist', e.target.value)}
                      className="w-full bg-gray-600 px-3 py-2 rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Herb Lore Skill</label>
                    <input
                      type="number"
                      value={w.skills?.herbLore || 10}
                      onChange={(e) => updateSkill(w.id, 'herbLore', e.target.value)}
                      className="w-full bg-gray-600 px-3 py-2 rounded"
                    />
                  </div>
                </div>

                <button
                  onClick={() => onDelete('worker', w.name, { id: w.id })}
                  className="w-full bg-red-600 py-2 rounded text-sm"
                >
                  <Trash2 size={16} className="inline" /> Delete Worker
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
