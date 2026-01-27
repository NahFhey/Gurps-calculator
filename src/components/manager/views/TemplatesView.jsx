import React, { useState } from 'react';
import { Plus, X, Trash2 } from 'lucide-react';
import { toNumberOr } from '../../../utils/helpers';

/**
 * TemplatesView - Manages custom item templates for crafting
 *
 * Templates define base item properties that can be crafted with different materials.
 * Supports 4 template types: weapons, armor, ranged, and explosives.
 * Each template can specify required materials and type-specific properties.
 */
export function TemplatesView({ customTemplates, materialTypes, saveCustomTemplates, onDelete }) {
  const [templateType, setTemplateType] = useState('weapons');
  const [expanded, setExpanded] = useState({});

  // Template form state
  const [newTName, setNewTName] = useState('');
  const [newTWeight, setNewTWeight] = useState('');
  const [newTHP, setNewTHP] = useState('');
  const [newTDamage, setNewTDamage] = useState('');
  const [newTReach, setNewTReach] = useState('');
  const [newTParry, setNewTParry] = useState('');
  const [newTCost, setNewTCost] = useState('');
  const [newTST, setNewTST] = useState('');
  const [newTNotes, setNewTNotes] = useState('');
  const [newTAcc, setNewTAcc] = useState('');
  const [newTRange, setNewTRange] = useState('');
  const [newTRoF, setNewTRoF] = useState('');
  const [newTShots, setNewTShots] = useState('');
  const [newTBulk, setNewTBulk] = useState('');
  const [newTRCl, setNewTRCl] = useState('');
  const [newTLC, setNewTLC] = useState('');
  const [newTLocation, setNewTLocation] = useState('');
  const [newTDR, setNewTDR] = useState('');
  const [newTFuse, setNewTFuse] = useState('');

  function addTemplate() {
    if (!newTName.trim() || !newTWeight || !newTHP) {
      alert('Fill all required fields');
      return;
    }

    const templateName = newTName.toLowerCase();
    if (customTemplates[templateType][templateName]) {
      alert('Template already exists');
      return;
    }

    const baseTemplate = {
      weight: toNumberOr(newTWeight, 0),
      hp: Math.trunc(toNumberOr(newTHP, 0)),
      materials: []
    };

    if (templateType === 'weapons') {
      baseTemplate.damage = newTDamage || '';
      baseTemplate.reach = newTReach || '';
      baseTemplate.parry = newTParry || '';
      baseTemplate.cost = Math.trunc(toNumberOr(newTCost, 0));
      baseTemplate.ST = Math.trunc(toNumberOr(newTST, 0));
      baseTemplate.notes = newTNotes || '';
    } else if (templateType === 'ranged') {
      baseTemplate.damage = newTDamage || '';
      baseTemplate.Acc = Math.trunc(toNumberOr(newTAcc, 0));
      baseTemplate.range = newTRange || '';
      baseTemplate.RoF = Math.trunc(toNumberOr(newTRoF, 1));
      baseTemplate.shots = newTShots || '';
      baseTemplate.cost = Math.trunc(toNumberOr(newTCost, 0));
      baseTemplate.ST = Math.trunc(toNumberOr(newTST, 0));
      baseTemplate.bulk = Math.trunc(toNumberOr(newTBulk, 0));
      baseTemplate.RCl = Math.trunc(toNumberOr(newTRCl, 0));
      baseTemplate.LC = Math.trunc(toNumberOr(newTLC, 0));
      baseTemplate.notes = newTNotes || '';
    } else if (templateType === 'armor') {
      baseTemplate.location = newTLocation || '';
      baseTemplate.DR = Math.trunc(toNumberOr(newTDR, 0));
      baseTemplate.cost = Math.trunc(toNumberOr(newTCost, 0));
      baseTemplate.LC = Math.trunc(toNumberOr(newTLC, 0));
      baseTemplate.notes = newTNotes || '';
    } else if (templateType === 'explosives') {
      baseTemplate.damage = newTDamage || '';
      baseTemplate.fuse = newTFuse || '';
      baseTemplate.cost = Math.trunc(toNumberOr(newTCost, 0));
      baseTemplate.LC = Math.trunc(toNumberOr(newTLC, 0));
      baseTemplate.notes = newTNotes || '';
    }

    saveCustomTemplates({
      ...customTemplates,
      [templateType]: {
        ...customTemplates[templateType],
        [templateName]: baseTemplate
      }
    });

    // Reset all form fields
    setNewTName('');
    setNewTWeight('');
    setNewTHP('');
    setNewTDamage('');
    setNewTReach('');
    setNewTParry('');
    setNewTCost('');
    setNewTST('');
    setNewTNotes('');
    setNewTAcc('');
    setNewTRange('');
    setNewTRoF('');
    setNewTShots('');
    setNewTBulk('');
    setNewTRCl('');
    setNewTLC('');
    setNewTLocation('');
    setNewTDR('');
    setNewTFuse('');
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Templates</h2>

      <select
        value={templateType}
        onChange={(e) => setTemplateType(e.target.value)}
        className="w-full bg-gray-700 px-3 py-2 rounded mb-4"
      >
        <option value="weapons">Weapons</option>
        <option value="armor">Armor</option>
        <option value="ranged">Ranged</option>
        <option value="explosives">Explosives</option>
      </select>

      <div className="space-y-3 mb-6 bg-gray-700 p-4 rounded">
        <h3 className="font-semibold mb-3">Add New {templateType.charAt(0).toUpperCase() + templateType.slice(1)} Template</h3>

        <input
          value={newTName}
          onChange={(e) => setNewTName(e.target.value)}
          placeholder="Name"
          className="w-full bg-gray-600 px-3 py-2 rounded"
        />

        <div className="grid grid-cols-2 gap-3">
          <input
            type="number"
            value={newTWeight}
            onChange={(e) => setNewTWeight(e.target.value)}
            placeholder="Weight (lbs)"
            className="bg-gray-600 px-3 py-2 rounded"
          />
          <input
            type="number"
            value={newTHP}
            onChange={(e) => setNewTHP(e.target.value)}
            placeholder="HP"
            className="bg-gray-600 px-3 py-2 rounded"
          />
        </div>

        {templateType === 'weapons' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <input
                value={newTDamage}
                onChange={(e) => setNewTDamage(e.target.value)}
                placeholder="Damage (e.g., sw+1 cut)"
                className="bg-gray-600 px-3 py-2 rounded"
              />
              <input
                value={newTReach}
                onChange={(e) => setNewTReach(e.target.value)}
                placeholder="Reach (e.g., 1 or C,1)"
                className="bg-gray-600 px-3 py-2 rounded"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <input
                value={newTParry}
                onChange={(e) => setNewTParry(e.target.value)}
                placeholder="Parry (e.g., 0 or -1)"
                className="bg-gray-600 px-3 py-2 rounded"
              />
              <input
                type="number"
                value={newTCost}
                onChange={(e) => setNewTCost(e.target.value)}
                placeholder="Cost ($)"
                className="bg-gray-600 px-3 py-2 rounded"
              />
              <input
                type="number"
                value={newTST}
                onChange={(e) => setNewTST(e.target.value)}
                placeholder="ST"
                className="bg-gray-600 px-3 py-2 rounded"
              />
            </div>
            <textarea
              value={newTNotes}
              onChange={(e) => setNewTNotes(e.target.value)}
              placeholder="Notes"
              className="w-full bg-gray-600 px-3 py-2 rounded"
              rows="2"
            />
          </>
        )}

        {templateType === 'ranged' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <input
                value={newTDamage}
                onChange={(e) => setNewTDamage(e.target.value)}
                placeholder="Damage (e.g., thr+1 imp)"
                className="bg-gray-600 px-3 py-2 rounded"
              />
              <input
                type="number"
                value={newTAcc}
                onChange={(e) => setNewTAcc(e.target.value)}
                placeholder="Acc"
                className="bg-gray-600 px-3 py-2 rounded"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <input
                value={newTRange}
                onChange={(e) => setNewTRange(e.target.value)}
                placeholder="Range (e.g., 150/200)"
                className="bg-gray-600 px-3 py-2 rounded"
              />
              <input
                type="number"
                value={newTRoF}
                onChange={(e) => setNewTRoF(e.target.value)}
                placeholder="RoF"
                className="bg-gray-600 px-3 py-2 rounded"
              />
              <input
                value={newTShots}
                onChange={(e) => setNewTShots(e.target.value)}
                placeholder="Shots (e.g., 1(2))"
                className="bg-gray-600 px-3 py-2 rounded"
              />
            </div>
            <div className="grid grid-cols-4 gap-3">
              <input
                type="number"
                value={newTCost}
                onChange={(e) => setNewTCost(e.target.value)}
                placeholder="Cost"
                className="bg-gray-600 px-3 py-2 rounded"
              />
              <input
                type="number"
                value={newTST}
                onChange={(e) => setNewTST(e.target.value)}
                placeholder="ST"
                className="bg-gray-600 px-3 py-2 rounded"
              />
              <input
                type="number"
                value={newTBulk}
                onChange={(e) => setNewTBulk(e.target.value)}
                placeholder="Bulk"
                className="bg-gray-600 px-3 py-2 rounded"
              />
              <input
                type="number"
                value={newTRCl}
                onChange={(e) => setNewTRCl(e.target.value)}
                placeholder="RCl"
                className="bg-gray-600 px-3 py-2 rounded"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                value={newTLC}
                onChange={(e) => setNewTLC(e.target.value)}
                placeholder="LC (0-4)"
                className="bg-gray-600 px-3 py-2 rounded"
              />
              <textarea
                value={newTNotes}
                onChange={(e) => setNewTNotes(e.target.value)}
                placeholder="Notes"
                className="bg-gray-600 px-3 py-2 rounded"
                rows="1"
              />
            </div>
          </>
        )}

        {templateType === 'armor' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <input
                value={newTLocation}
                onChange={(e) => setNewTLocation(e.target.value)}
                placeholder="Location (e.g., torso)"
                className="bg-gray-600 px-3 py-2 rounded"
              />
              <input
                type="number"
                value={newTDR}
                onChange={(e) => setNewTDR(e.target.value)}
                placeholder="DR"
                className="bg-gray-600 px-3 py-2 rounded"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                value={newTCost}
                onChange={(e) => setNewTCost(e.target.value)}
                placeholder="Cost"
                className="bg-gray-600 px-3 py-2 rounded"
              />
              <input
                type="number"
                value={newTLC}
                onChange={(e) => setNewTLC(e.target.value)}
                placeholder="LC (0-4)"
                className="bg-gray-600 px-3 py-2 rounded"
              />
            </div>
            <textarea
              value={newTNotes}
              onChange={(e) => setNewTNotes(e.target.value)}
              placeholder="Notes"
              className="w-full bg-gray-600 px-3 py-2 rounded"
              rows="2"
            />
          </>
        )}

        {templateType === 'explosives' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <input
                value={newTDamage}
                onChange={(e) => setNewTDamage(e.target.value)}
                placeholder="Damage (e.g., 2d cr)"
                className="bg-gray-600 px-3 py-2 rounded"
              />
              <input
                value={newTFuse}
                onChange={(e) => setNewTFuse(e.target.value)}
                placeholder="Fuse (e.g., 4 sec)"
                className="bg-gray-600 px-3 py-2 rounded"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                value={newTCost}
                onChange={(e) => setNewTCost(e.target.value)}
                placeholder="Cost"
                className="bg-gray-600 px-3 py-2 rounded"
              />
              <input
                type="number"
                value={newTLC}
                onChange={(e) => setNewTLC(e.target.value)}
                placeholder="LC (0-4)"
                className="bg-gray-600 px-3 py-2 rounded"
              />
            </div>
            <textarea
              value={newTNotes}
              onChange={(e) => setNewTNotes(e.target.value)}
              placeholder="Notes"
              className="w-full bg-gray-600 px-3 py-2 rounded"
              rows="2"
            />
          </>
        )}

        <button onClick={addTemplate} className="w-full bg-green-600 py-2 rounded">
          Add Template
        </button>
      </div>

      <div className="space-y-2">
        {Object.keys(customTemplates[templateType] || {}).map(n => (
          <div key={n} className="bg-gray-700 rounded">
            <div
              className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-600"
              onClick={() => setExpanded(p => ({...p, [n]: !p[n]}))}
            >
              <span className="flex-1 capitalize">{n}</span>
              <span className="text-gray-400 text-sm">W: {customTemplates[templateType][n].weight}</span>
              <span className="text-gray-400 text-sm">HP: {customTemplates[templateType][n].hp}</span>
              <span className="text-gray-400 text-sm">
                {customTemplates[templateType][n].materials?.length || 0} materials
              </span>
              <span className="text-gray-400">{expanded[n] ? '▼' : '▶'}</span>
            </div>

            {expanded[n] && (
              <div className="px-3 pb-3 space-y-3 border-t border-gray-600 pt-3">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-semibold">Required Materials</label>
                    <button
                      onClick={() => {
                        const old = customTemplates[templateType][n];
                        const mats = old.materials ? [...old.materials] : [];
                        mats.push({type: materialTypes[0]?.name || '', amount: 0});

                        saveCustomTemplates({
                          ...customTemplates,
                          [templateType]: {
                            ...customTemplates[templateType],
                            [n]: { ...old, materials: mats }
                          }
                        });
                      }}
                      className="bg-blue-600 px-3 py-1 rounded text-sm"
                    >
                      <Plus size={14} className="inline" /> Add Material
                    </button>
                  </div>
                  {(customTemplates[templateType][n].materials || []).length === 0 && (
                    <div className="text-gray-500 text-sm italic">No materials required</div>
                  )}
                  {(customTemplates[templateType][n].materials || []).map((mat, idx) => (
                    <div key={idx} className="flex gap-2 mb-2">
                      <select
                        value={mat.type || ''}
                        onChange={(e) => {
                          const old = customTemplates[templateType][n];
                          const mats = [...old.materials];
                          mats[idx] = {...mats[idx], type: e.target.value};

                          saveCustomTemplates({
                            ...customTemplates,
                            [templateType]: {
                              ...customTemplates[templateType],
                              [n]: { ...old, materials: mats }
                            }
                          });
                        }}
                        className="flex-1 bg-gray-600 px-3 py-1 rounded"
                      >
                        <option value="">Select Type</option>
                        {materialTypes.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                      </select>
                      <input
                        type="number"
                        value={mat.amount}
                        onChange={(e) => {
                          const old = customTemplates[templateType][n];
                          const mats = [...old.materials];
                          mats[idx] = {...mats[idx], amount: Math.max(0, toNumberOr(e.target.value, 0))};

                          saveCustomTemplates({
                            ...customTemplates,
                            [templateType]: {
                              ...customTemplates[templateType],
                              [n]: { ...old, materials: mats }
                            }
                          });
                        }}
                        placeholder="Amount (lbs)"
                        className="w-32 bg-gray-600 px-3 py-1 rounded"
                      />
                      <button
                        onClick={() => {
                          const old = customTemplates[templateType][n];
                          const mats = old.materials.filter((_, i) => i !== idx);

                          saveCustomTemplates({
                            ...customTemplates,
                            [templateType]: {
                              ...customTemplates[templateType],
                              [n]: { ...old, materials: mats }
                            }
                          });
                        }}
                        className="text-red-400"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => onDelete('template', n, { templateType })}
                  className="w-full bg-red-600 py-2 rounded text-sm"
                >
                  <Trash2 size={16} className="inline" /> Delete Template
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
