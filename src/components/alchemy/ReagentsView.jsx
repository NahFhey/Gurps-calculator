import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { ASPECTS } from '../../constants';
import { toNumberOr } from '../../utils/helpers';
import { getReagentAspectPoints } from '../../utils/alchemy';

export function ReagentsView({ reagents, saveReagents }) {
  const [showAdd, setShowAdd] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const [newName, setNewName] = useState('');
  const [newPrimary, setNewPrimary] = useState('Water');
  const [newSecondary, setNewSecondary] = useState('Air');
  const [newTertiary, setNewTertiary] = useState('Fire');
  const [newQuantity, setNewQuantity] = useState('10');

  function addReagent() {
    if (!newName.trim() || !newQuantity) {
      alert('Enter name and quantity');
      return;
    }

    const newReagent = {
      id: crypto.randomUUID(),
      name: newName.trim(),
      aspects: {
        primary: newPrimary,
        secondary: newSecondary,
        tertiary: newTertiary
      },
      refinement: 'crude',
      potency: 1,
      concentrationSteps: 0,
      quantity: Math.max(0, toNumberOr(newQuantity, 0))
    };

    saveReagents([...reagents, newReagent]);
    setNewName('');
    setNewQuantity('10');
    setShowAdd(false);
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg max-w-md">
            <h3 className="text-xl font-bold mb-4">Confirm Delete</h3>
            <p className="mb-6">Delete reagent "{deleteConfirm.name}"?</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 bg-gray-600 rounded">Cancel</button>
              <button onClick={() => {
                saveReagents(reagents.filter(r => r.id !== deleteConfirm.id));
                setDeleteConfirm(null);
              }} className="px-4 py-2 bg-red-600 rounded">Delete</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Alchemy Reagents</h2>
        <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-2 bg-green-600 px-4 py-2 rounded">
          <Plus size={20} /> Add Reagent
        </button>
      </div>

      {showAdd && (
        <div className="bg-gray-700 p-4 rounded mb-4 space-y-3">
          <div>
            <label className="block text-sm mb-1">Reagent Name</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full bg-gray-600 px-3 py-2 rounded"
              placeholder="e.g., Lunar Moss"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm mb-1">Primary Aspect (3)</label>
              <select value={newPrimary} onChange={(e) => setNewPrimary(e.target.value)} className="w-full bg-gray-600 px-3 py-2 rounded">
                {ASPECTS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1">Secondary Aspect (2)</label>
              <select value={newSecondary} onChange={(e) => setNewSecondary(e.target.value)} className="w-full bg-gray-600 px-3 py-2 rounded">
                {ASPECTS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1">Tertiary Aspect (1)</label>
              <select value={newTertiary} onChange={(e) => setNewTertiary(e.target.value)} className="w-full bg-gray-600 px-3 py-2 rounded">
                {ASPECTS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm mb-1">Quantity (Units)</label>
            <input
              type="number"
              value={newQuantity}
              onChange={(e) => setNewQuantity(e.target.value)}
              className="w-full bg-gray-600 px-3 py-2 rounded"
              min="0"
            />
          </div>

          <div className="flex gap-2">
            <button onClick={addReagent} className="bg-green-600 px-4 py-2 rounded flex-1">Save Reagent</button>
            <button onClick={() => setShowAdd(false)} className="bg-red-600 px-4 py-2 rounded">×</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {reagents.map(r => (
          <div key={r.id} className="bg-gray-700 rounded">
            <div
              className="flex items-center gap-4 p-3 cursor-pointer hover:bg-gray-600"
              onClick={() => setExpanded(p => ({...p, [r.id]: !p[r.id]}))}
            >
              <span className="flex-1 font-medium">{r.name}</span>
              <span className="text-sm text-blue-400">{r.aspects.primary}/{r.aspects.secondary}/{r.aspects.tertiary}</span>
              <span className="text-sm text-gray-400">{r.quantity}U</span>
              <span className="text-sm text-purple-400">Potency {(r.potency || 1) + (r.concentrationSteps || 0)}</span>
              <span className="text-gray-400">{expanded[r.id] ? '▼' : '▶'}</span>
            </div>

            {expanded[r.id] && (
              <div className="px-3 pb-3 space-y-3 border-t border-gray-600 pt-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Name</label>
                    <input
                      value={r.name}
                      onChange={(e) => saveReagents(reagents.map(x => x.id === r.id ? {...x, name: e.target.value} : x))}
                      className="w-full bg-gray-600 px-3 py-1 rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Quantity (Units)</label>
                    <input
                      type="number"
                      value={r.quantity}
                      onChange={(e) => saveReagents(reagents.map(x => x.id === r.id ? {...x, quantity: Math.max(0, toNumberOr(e.target.value, r.quantity))} : x))}
                      className="w-full bg-gray-600 px-3 py-1 rounded"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Primary (3)</label>
                    <select
                      value={r.aspects.primary}
                      onChange={(e) => saveReagents(reagents.map(x => x.id === r.id ? {...x, aspects: {...x.aspects, primary: e.target.value}} : x))}
                      className="w-full bg-gray-600 px-3 py-1 rounded"
                    >
                      {ASPECTS.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Secondary (2)</label>
                    <select
                      value={r.aspects.secondary}
                      onChange={(e) => saveReagents(reagents.map(x => x.id === r.id ? {...x, aspects: {...x.aspects, secondary: e.target.value}} : x))}
                      className="w-full bg-gray-600 px-3 py-1 rounded"
                    >
                      {ASPECTS.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Tertiary (1)</label>
                    <select
                      value={r.aspects.tertiary}
                      onChange={(e) => saveReagents(reagents.map(x => x.id === r.id ? {...x, aspects: {...x.aspects, tertiary: e.target.value}} : x))}
                      className="w-full bg-gray-600 px-3 py-1 rounded"
                    >
                      {ASPECTS.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Refinement Level</label>
                    <select
                      value={r.refinement}
                      onChange={(e) => saveReagents(reagents.map(x => x.id === r.id ? {...x, refinement: e.target.value} : x))}
                      className="w-full bg-gray-600 px-3 py-1 rounded"
                    >
                      <option value="crude">Crude (3/2/1)</option>
                      <option value="prepared">Prepared (3/2)</option>
                      <option value="refined">Refined (3 only)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Base Potency</label>
                    <input
                      type="number"
                      value={r.potency || 1}
                      min="1"
                      onChange={(e) => saveReagents(reagents.map(x => x.id === r.id ? {...x, potency: Math.max(1, toNumberOr(e.target.value, 1))} : x))}
                      className="w-full bg-gray-600 px-3 py-1 rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Concentration Steps</label>
                    <input
                      type="number"
                      value={r.concentrationSteps || 0}
                      min="0"
                      max="5"
                      onChange={(e) => {
                        const steps = Math.max(0, Math.min(5, toNumberOr(e.target.value, 0)));
                        saveReagents(reagents.map(x => x.id === r.id ? {...x, concentrationSteps: steps} : x));
                      }}
                      className="w-full bg-gray-600 px-3 py-1 rounded"
                    />
                    <div className="text-xs text-gray-400 mt-1">
                      Effective: {(r.potency || 1) + (r.concentrationSteps || 0)}
                    </div>
                  </div>
                </div>

                <div className="bg-gray-600 p-3 rounded">
                  <div className="text-xs font-semibold mb-2">Active Aspects</div>
                  <div className="text-sm">
                    {Object.entries(getReagentAspectPoints(r)).map(([aspect, points]) => (
                      <span key={aspect} className="inline-block mr-3 text-blue-400">
                        {aspect}: {points}
                      </span>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => setDeleteConfirm({id: r.id, name: r.name})}
                  className="w-full bg-red-600 px-4 py-2 rounded flex items-center justify-center gap-2"
                >
                  <Trash2 size={16} /> Delete Reagent
                </button>
              </div>
            )}
          </div>
        ))}

        {reagents.length === 0 && (
          <div className="text-gray-500 text-center py-8">No reagents yet. Add some to get started!</div>
        )}
      </div>
    </div>
  );
}
