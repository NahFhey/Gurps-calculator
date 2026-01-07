import React, { useState } from 'react';
import { Plus, Save, X, Trash2, Eye, EyeOff } from 'lucide-react';
import { toNumberOr, refundMaterialsFromProject } from '../utils/helpers';
import { TEMPLATES, ASPECTS } from '../constants';

export function ManagerTab({ foodTypes, materialTypes, workers, crafts, customTemplates, materials, effectFamilyMap, alchemySettings, saveMaterials, saveFoodTypes, saveMaterialTypes, saveWorkers, saveCrafts, saveCustomTemplates, saveEffectFamilyMap, saveAlchemySettings, renameMaterialType }) {
  const [view, setView] = useState('foodTypes');
  const [showAdd, setShowAdd] = useState(false);
  const [newType, setNewType] = useState('');
  const [templateType, setTemplateType] = useState('weapons');
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
  const [newMatType, setNewMatType] = useState('');
  const [newMatDiff, setNewMatDiff] = useState('0');
  const [newMatHT, setNewMatHT] = useState('10');
  const [newMatDR, setNewMatDR] = useState('0');
  const [newMatWeightMod, setNewMatWeightMod] = useState('0');
  const [newMatHPMod, setNewMatHPMod] = useState('0');
  const [newMatEffects, setNewMatEffects] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [draftMatTypeName, setDraftMatTypeName] = useState({});

  const [newTypeColor, setNewTypeColor] = useState('#60A5FA');

  function addType() {
    const typeName = newType.trim().toLowerCase();
    if (!typeName) { alert('Enter a type name'); return; }

    // Check for duplicates in both old and new format
    const exists = foodTypes.some(ft => (typeof ft === 'string' ? ft : ft.name) === typeName);
    if (exists) { alert('Duplicate type'); return; }

    saveFoodTypes([...foodTypes, { name: typeName, color: newTypeColor }]);
    setNewType('');
    setNewTypeColor('#60A5FA');
    setShowAdd(false);
  }

  function addTemplate() {
    if (!newTName.trim() || !newTWeight || !newTHP) { alert('Fill all required fields'); return; }
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

    setNewTName(''); setNewTWeight(''); setNewTHP(''); setNewTDamage(''); setNewTReach(''); setNewTParry('');
    setNewTCost(''); setNewTST(''); setNewTNotes(''); setNewTAcc(''); setNewTRange(''); setNewTRoF('');
    setNewTShots(''); setNewTBulk(''); setNewTRCl(''); setNewTLC(''); setNewTLocation(''); setNewTDR(''); setNewTFuse('');
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg max-w-md border-2 border-gray-600">
            <h3 className="text-xl font-bold mb-4">Confirm Delete</h3>
            <p className="mb-6">{deleteConfirm.type === 'foodType' ? `Delete type "${deleteConfirm.value}"?` : deleteConfirm.type === 'materialType' ? `Delete type "${deleteConfirm.value}"?` : deleteConfirm.type === 'worker' ? `Delete worker "${deleteConfirm.value}"?` : deleteConfirm.type === 'project' ? `Delete project "${deleteConfirm.name}"?` : `Delete template "${deleteConfirm.name}"?`}</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 bg-gray-600 rounded">Cancel</button>
              <button onClick={() => {
                if (deleteConfirm.type === 'foodType') saveFoodTypes(foodTypes.filter(t => t !== deleteConfirm.value));
                else if (deleteConfirm.type === 'materialType') saveMaterialTypes(materialTypes.filter(t => t.name !== deleteConfirm.value));
                else if (deleteConfirm.type === 'worker') saveWorkers(workers.filter(w => w !== deleteConfirm.value));
                else if (deleteConfirm.type === 'project') {
                  const proj = crafts.find(c => c.id === deleteConfirm.id);
                  if (proj && !proj.completed) {
                    const refunded = refundMaterialsFromProject(proj, materials);
                    saveMaterials(refunded);
                  }
                  saveCrafts(crafts.filter(c => c.id !== deleteConfirm.id));
                }
                else {
                  const typeTemplates = { ...customTemplates[deleteConfirm.templateType] };
                  delete typeTemplates[deleteConfirm.name];
                  saveCustomTemplates({
                    ...customTemplates,
                    [deleteConfirm.templateType]: typeTemplates
                  });
                }
                setDeleteConfirm(null);
              }} className="px-4 py-2 bg-red-600 rounded">Delete</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-6 border-b border-gray-700">
        <button onClick={() => setView('foodTypes')} className={`px-4 py-2 ${view === 'foodTypes' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400'}`}>Food Types</button>
        <button onClick={() => setView('materialTypes')} className={`px-4 py-2 ${view === 'materialTypes' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400'}`}>Material Types</button>
        <button onClick={() => setView('workers')} className={`px-4 py-2 ${view === 'workers' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400'}`}>Workers</button>
        <button onClick={() => setView('projects')} className={`px-4 py-2 ${view === 'projects' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400'}`}>Projects</button>
        <button onClick={() => setView('templates')} className={`px-4 py-2 ${view === 'templates' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400'}`}>Templates</button>
        <button onClick={() => setView('effectFamilyMap')} className={`px-4 py-2 ${view === 'effectFamilyMap' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400'}`}>Effect Map</button>
        <button onClick={() => setView('alchemySettings')} className={`px-4 py-2 ${view === 'alchemySettings' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400'}`}>Alchemy Settings</button>
      </div>

      {view === 'foodTypes' && (
        <div>
          <div className="flex justify-between mb-4">
            <h2 className="text-xl font-bold">Food Types</h2>
            <button onClick={() => setShowAdd(!showAdd)} className="bg-green-600 px-4 py-2 rounded"><Plus size={20} className="inline" /> Add</button>
          </div>
          {showAdd && (
            <div className="bg-gray-700 p-4 rounded mb-4 space-y-3">
              <div className="flex gap-2">
                <input value={newType} onChange={(e) => setNewType(e.target.value)} placeholder="Type name" className="flex-1 bg-gray-600 px-3 py-2 rounded" />
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-400">Color:</label>
                  <input type="color" value={newTypeColor} onChange={(e) => setNewTypeColor(e.target.value)} className="w-16 h-10 bg-gray-600 rounded cursor-pointer" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={addType} className="flex-1 bg-green-600 px-4 py-2 rounded"><Save size={20} className="inline" /> Save</button>
                <button onClick={() => setShowAdd(false)} className="bg-red-600 px-4 py-2 rounded"><X size={20} /></button>
              </div>
            </div>
          )}
          <div className="space-y-2">
            {foodTypes.map(t => {
              const tName = typeof t === 'string' ? t : t.name;
              const tColor = typeof t === 'object' ? t.color : '#60A5FA';

              return (<div key={tName} className="flex items-center gap-4 bg-gray-700 p-3 rounded">
                <span className="w-6 h-6 rounded-full flex-shrink-0" style={{backgroundColor: tColor}}></span>
                <input
                  value={tName}
                  onChange={(e) => {
                    const v = e.target.value.toLowerCase();
                    const exists = foodTypes.some(ft => {
                      const ftName = typeof ft === 'string' ? ft : ft.name;
                      return ftName === v && ftName !== tName;
                    });
                    if (exists) { alert('Duplicate'); return; }

                    saveFoodTypes(foodTypes.map(x => {
                      const xName = typeof x === 'string' ? x : x.name;
                      if (xName === tName) {
                        return typeof x === 'object' ? {...x, name: v} : { name: v, color: '#60A5FA' };
                      }
                      return x;
                    }));
                  }}
                  className="flex-1 bg-gray-600 px-3 py-1 rounded"
                />
                <input
                  type="color"
                  value={tColor}
                  onChange={(e) => {
                    saveFoodTypes(foodTypes.map(x => {
                      const xName = typeof x === 'string' ? x : x.name;
                      if (xName === tName) {
                        return { name: xName, color: e.target.value };
                      }
                      return x;
                    }));
                  }}
                  className="w-16 h-8 bg-gray-600 rounded cursor-pointer"
                  title="Change color"
                />
                <button onClick={() => setDeleteConfirm({type: 'foodType', value: tName})} className="text-red-400"><Trash2 size={20} /></button>
              </div>);
            })}
          </div>
        </div>
      )}

      {view === 'materialTypes' && (
        <div>
          <div className="flex justify-between mb-4">
            <h2 className="text-xl font-bold">Material Types</h2>
            <button onClick={() => setShowAdd(!showAdd)} className="bg-green-600 px-4 py-2 rounded"><Plus size={20} className="inline" /> Add</button>
          </div>
          {showAdd && (
            <div className="bg-gray-700 p-4 rounded mb-4 space-y-3">
              <input value={newMatType} onChange={(e) => setNewMatType(e.target.value)} placeholder="Type name" className="w-full bg-gray-600 px-3 py-2 rounded" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Difficulty Modifier</label>
                  <input type="number" value={newMatDiff} onChange={(e) => setNewMatDiff(e.target.value)} className="w-full bg-gray-600 px-3 py-2 rounded" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">HT</label>
                  <input type="number" value={newMatHT} onChange={(e) => setNewMatHT(e.target.value)} className="w-full bg-gray-600 px-3 py-2 rounded" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">DR Shift</label>
                  <input type="number" value={newMatDR} onChange={(e) => setNewMatDR(e.target.value)} className="w-full bg-gray-600 px-3 py-2 rounded" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Weight Mod (%)</label>
                  <input type="number" min="-100" max="100" value={newMatWeightMod} onChange={(e) => setNewMatWeightMod(e.target.value)} className="w-full bg-gray-600 px-3 py-2 rounded" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">HP Mod (%)</label>
                  <input type="number" min="-100" max="100" value={newMatHPMod} onChange={(e) => setNewMatHPMod(e.target.value)} className="w-full bg-gray-600 px-3 py-2 rounded" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Effects</label>
                <textarea value={newMatEffects} onChange={(e) => setNewMatEffects(e.target.value)} placeholder="Special effects or notes" className="w-full bg-gray-600 px-3 py-2 rounded" rows="2" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => {
                  if (!newMatType.trim()) { alert('Enter a name'); return; }
                  if (materialTypes.find(t => t.name === newMatType.toLowerCase())) { alert('Duplicate name'); return; }
                  saveMaterialTypes([...materialTypes, {
                    name: newMatType.toLowerCase(),
                    difficulty: toNumberOr(newMatDiff, 0),
                    ht: toNumberOr(newMatHT, 10),
                    drShift: toNumberOr(newMatDR, 0),
                    weightMod: toNumberOr(newMatWeightMod, 0),
                    hpMod: toNumberOr(newMatHPMod, 0),
                    effects: newMatEffects
                  }]);
                  setNewMatType(''); setNewMatDiff('0'); setNewMatHT('10'); setNewMatDR('0'); setNewMatWeightMod('0'); setNewMatHPMod('0'); setNewMatEffects(''); setShowAdd(false);
                }} className="flex-1 bg-green-600 py-2 rounded"><Save size={20} className="inline" /> Save</button>
                <button onClick={() => setShowAdd(false)} className="bg-red-600 px-4 py-2 rounded"><X size={20} /></button>
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
                        onBlur={(e) => {
                          const newName = e.target.value.toLowerCase().trim();
                          if (newName === t.name) {
                            setDraftMatTypeName({...draftMatTypeName, [t.name]: undefined});
                            return;
                          }
                          if (!newName) {
                            alert('Name cannot be empty');
                            setDraftMatTypeName({...draftMatTypeName, [t.name]: t.name});
                            return;
                          }
                          if (materialTypes.find(x => x.name === newName && x.name !== t.name)) {
                            alert('Duplicate name');
                            setDraftMatTypeName({...draftMatTypeName, [t.name]: t.name});
                            return;
                          }
                          renameMaterialType(t.name, newName);
                          setDraftMatTypeName({...draftMatTypeName, [t.name]: undefined});
                        }}
                        className="w-full bg-gray-600 px-3 py-1 rounded"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Difficulty</label>
                        <input
                          type="number"
                          value={t.difficulty}
                          onChange={(e) => saveMaterialTypes(materialTypes.map(x => x.name === t.name ? {...x, difficulty: toNumberOr(e.target.value, t.difficulty)} : x))}
                          className="w-full bg-gray-600 px-2 py-1 rounded"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">HT</label>
                        <input
                          type="number"
                          value={t.ht}
                          onChange={(e) => saveMaterialTypes(materialTypes.map(x => x.name === t.name ? {...x, ht: toNumberOr(e.target.value, t.ht)} : x))}
                          className="w-full bg-gray-600 px-2 py-1 rounded"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">DR Shift</label>
                        <input
                          type="number"
                          value={t.drShift}
                          onChange={(e) => saveMaterialTypes(materialTypes.map(x => x.name === t.name ? {...x, drShift: toNumberOr(e.target.value, t.drShift)} : x))}
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
                          onChange={(e) => saveMaterialTypes(materialTypes.map(x => x.name === t.name ? {...x, weightMod: toNumberOr(e.target.value, t.weightMod)} : x))}
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
                          onChange={(e) => saveMaterialTypes(materialTypes.map(x => x.name === t.name ? {...x, hpMod: toNumberOr(e.target.value, t.hpMod)} : x))}
                          className="w-full bg-gray-600 px-2 py-1 rounded"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Effects</label>
                      <textarea
                        value={t.effects || ''}
                        onChange={(e) => saveMaterialTypes(materialTypes.map(x => x.name === t.name ? {...x, effects: e.target.value} : x))}
                        placeholder="Special effects or notes"
                        className="w-full bg-gray-600 px-3 py-2 rounded"
                        rows="2"
                      />
                    </div>
                    <button
                      onClick={() => setDeleteConfirm({type: 'materialType', value: t.name})}
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
      )}

      {view === 'workers' && (
        <div>
          <div className="flex justify-between mb-4">
            <h2 className="text-xl font-bold">Workers</h2>
            <button onClick={() => setShowAdd(!showAdd)} className="bg-green-600 px-4 py-2 rounded"><Plus size={20} className="inline" /> Add</button>
          </div>
          {showAdd && (
            <div className="bg-gray-700 p-4 rounded mb-4 flex gap-2">
              <input value={newType} onChange={(e) => setNewType(e.target.value)} placeholder="Worker name" className="flex-1 bg-gray-600 px-3 py-2 rounded" />
              <button onClick={() => {
                if (!newType.trim() || workers.includes(newType)) { alert('Invalid or duplicate'); return; }
                saveWorkers([...workers, newType]);
                setNewType(''); setShowAdd(false);
              }} className="bg-green-600 px-4 py-2 rounded"><Save size={20} /></button>
              <button onClick={() => setShowAdd(false)} className="bg-red-600 px-4 py-2 rounded"><X size={20} /></button>
            </div>
          )}
          <div className="space-y-2">
            {workers.map(w => (
              <div key={w} className="flex items-center gap-4 bg-gray-700 p-3 rounded">
                <input value={w} onChange={(e) => { const v = e.target.value; if (workers.includes(v) && v !== w) { alert('Duplicate'); return; } saveWorkers(workers.map(x => x === w ? v : x)); }} className="flex-1 bg-gray-600 px-3 py-1 rounded" />
                <button onClick={() => setDeleteConfirm({type: 'worker', value: w})} className="text-red-400"><Trash2 size={20} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {view === 'projects' && (
        <div>
          <h2 className="text-xl font-bold mb-4">Project Manager</h2>

          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3 text-yellow-400">In-Progress Projects ({crafts.filter(c => !c.completed).length})</h3>
            <div className="space-y-2">
              {crafts.filter(c => !c.completed).map(c => (
                <div key={c.id} className="flex items-center gap-4 bg-yellow-900 bg-opacity-30 border border-yellow-600 p-3 rounded">
                  <div className="flex-1">
                    <div className="font-semibold capitalize">{c.name || `${c.currentQuality} ${c.template}`}</div>
                    <div className="text-sm text-gray-400">Phase: {c.phase} | Started: {c.startDate || 'unknown'}</div>
                  </div>
                  <button onClick={() => {
                    const projectName = c.name || `${c.currentQuality} ${c.template}`;
                    setDeleteConfirm({type: 'project', id: c.id, name: projectName});
                  }} className="text-red-400"><Trash2 size={20} /></button>
                </div>
              ))}
              {crafts.filter(c => !c.completed).length === 0 && (
                <div className="text-gray-500 italic">No in-progress projects</div>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-3 text-green-400">Completed Projects ({crafts.filter(c => c.completed).length})</h3>
            <div className="space-y-2">
              {crafts.filter(c => c.completed).map(c => (
                <div key={c.id} className="flex items-center gap-4 bg-gray-700 p-3 rounded">
                  <div className="flex-1">
                    <div className="font-semibold capitalize">{c.name || `${c.currentQuality} ${c.template}`}</div>
                    <div className="text-sm text-gray-400">Completed: {c.completedDate || 'unknown'}</div>
                  </div>
                  <button onClick={() => {
                    const projectName = c.name || `${c.currentQuality} ${c.template}`;
                    setDeleteConfirm({type: 'project', id: c.id, name: projectName});
                  }} className="text-red-400"><Trash2 size={20} /></button>
                </div>
              ))}
              {crafts.filter(c => c.completed).length === 0 && (
                <div className="text-gray-500 italic">No completed projects</div>
              )}
            </div>
          </div>
        </div>
      )}

      {view === 'templates' && (
        <div>
          <h2 className="text-xl font-bold mb-4">Templates</h2>
          <select value={templateType} onChange={(e) => setTemplateType(e.target.value)} className="w-full bg-gray-700 px-3 py-2 rounded mb-4">
            <option value="weapons">Weapons</option>
            <option value="armor">Armor</option>
            <option value="ranged">Ranged</option>
            <option value="explosives">Explosives</option>
          </select>
          <div className="space-y-3 mb-6 bg-gray-700 p-4 rounded">
            <h3 className="font-semibold mb-3">Add New {templateType.charAt(0).toUpperCase() + templateType.slice(1)} Template</h3>
            <input value={newTName} onChange={(e) => setNewTName(e.target.value)} placeholder="Name" className="w-full bg-gray-600 px-3 py-2 rounded" />
            <div className="grid grid-cols-2 gap-3">
              <input type="number" value={newTWeight} onChange={(e) => setNewTWeight(e.target.value)} placeholder="Weight (lbs)" className="bg-gray-600 px-3 py-2 rounded" />
              <input type="number" value={newTHP} onChange={(e) => setNewTHP(e.target.value)} placeholder="HP" className="bg-gray-600 px-3 py-2 rounded" />
            </div>

            {templateType === 'weapons' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <input value={newTDamage} onChange={(e) => setNewTDamage(e.target.value)} placeholder="Damage (e.g., sw+1 cut)" className="bg-gray-600 px-3 py-2 rounded" />
                  <input value={newTReach} onChange={(e) => setNewTReach(e.target.value)} placeholder="Reach (e.g., 1 or C,1)" className="bg-gray-600 px-3 py-2 rounded" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <input value={newTParry} onChange={(e) => setNewTParry(e.target.value)} placeholder="Parry (e.g., 0 or -1)" className="bg-gray-600 px-3 py-2 rounded" />
                  <input type="number" value={newTCost} onChange={(e) => setNewTCost(e.target.value)} placeholder="Cost ($)" className="bg-gray-600 px-3 py-2 rounded" />
                  <input type="number" value={newTST} onChange={(e) => setNewTST(e.target.value)} placeholder="ST" className="bg-gray-600 px-3 py-2 rounded" />
                </div>
                <textarea value={newTNotes} onChange={(e) => setNewTNotes(e.target.value)} placeholder="Notes" className="w-full bg-gray-600 px-3 py-2 rounded" rows="2" />
              </>
            )}

            {templateType === 'ranged' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <input value={newTDamage} onChange={(e) => setNewTDamage(e.target.value)} placeholder="Damage (e.g., thr+1 imp)" className="bg-gray-600 px-3 py-2 rounded" />
                  <input type="number" value={newTAcc} onChange={(e) => setNewTAcc(e.target.value)} placeholder="Acc" className="bg-gray-600 px-3 py-2 rounded" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <input value={newTRange} onChange={(e) => setNewTRange(e.target.value)} placeholder="Range (e.g., 150/200)" className="bg-gray-600 px-3 py-2 rounded" />
                  <input type="number" value={newTRoF} onChange={(e) => setNewTRoF(e.target.value)} placeholder="RoF" className="bg-gray-600 px-3 py-2 rounded" />
                  <input value={newTShots} onChange={(e) => setNewTShots(e.target.value)} placeholder="Shots (e.g., 1(2))" className="bg-gray-600 px-3 py-2 rounded" />
                </div>
                <div className="grid grid-cols-4 gap-3">
                  <input type="number" value={newTCost} onChange={(e) => setNewTCost(e.target.value)} placeholder="Cost" className="bg-gray-600 px-3 py-2 rounded" />
                  <input type="number" value={newTST} onChange={(e) => setNewTST(e.target.value)} placeholder="ST" className="bg-gray-600 px-3 py-2 rounded" />
                  <input type="number" value={newTBulk} onChange={(e) => setNewTBulk(e.target.value)} placeholder="Bulk" className="bg-gray-600 px-3 py-2 rounded" />
                  <input type="number" value={newTRCl} onChange={(e) => setNewTRCl(e.target.value)} placeholder="RCl" className="bg-gray-600 px-3 py-2 rounded" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input type="number" value={newTLC} onChange={(e) => setNewTLC(e.target.value)} placeholder="LC (0-4)" className="bg-gray-600 px-3 py-2 rounded" />
                  <textarea value={newTNotes} onChange={(e) => setNewTNotes(e.target.value)} placeholder="Notes" className="bg-gray-600 px-3 py-2 rounded" rows="1" />
                </div>
              </>
            )}

            {templateType === 'armor' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <input value={newTLocation} onChange={(e) => setNewTLocation(e.target.value)} placeholder="Location (e.g., torso)" className="bg-gray-600 px-3 py-2 rounded" />
                  <input type="number" value={newTDR} onChange={(e) => setNewTDR(e.target.value)} placeholder="DR" className="bg-gray-600 px-3 py-2 rounded" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input type="number" value={newTCost} onChange={(e) => setNewTCost(e.target.value)} placeholder="Cost" className="bg-gray-600 px-3 py-2 rounded" />
                  <input type="number" value={newTLC} onChange={(e) => setNewTLC(e.target.value)} placeholder="LC (0-4)" className="bg-gray-600 px-3 py-2 rounded" />
                </div>
                <textarea value={newTNotes} onChange={(e) => setNewTNotes(e.target.value)} placeholder="Notes" className="w-full bg-gray-600 px-3 py-2 rounded" rows="2" />
              </>
            )}

            {templateType === 'explosives' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <input value={newTDamage} onChange={(e) => setNewTDamage(e.target.value)} placeholder="Damage (e.g., 2d cr)" className="bg-gray-600 px-3 py-2 rounded" />
                  <input value={newTFuse} onChange={(e) => setNewTFuse(e.target.value)} placeholder="Fuse (e.g., 4 sec)" className="bg-gray-600 px-3 py-2 rounded" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input type="number" value={newTCost} onChange={(e) => setNewTCost(e.target.value)} placeholder="Cost" className="bg-gray-600 px-3 py-2 rounded" />
                  <input type="number" value={newTLC} onChange={(e) => setNewTLC(e.target.value)} placeholder="LC (0-4)" className="bg-gray-600 px-3 py-2 rounded" />
                </div>
                <textarea value={newTNotes} onChange={(e) => setNewTNotes(e.target.value)} placeholder="Notes" className="w-full bg-gray-600 px-3 py-2 rounded" rows="2" />
              </>
            )}

            <button onClick={addTemplate} className="w-full bg-green-600 py-2 rounded">Add Template</button>
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
                      onClick={() => setDeleteConfirm({type: 'template', templateType, name: n})}
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
      )}

      {view === 'effectFamilyMap' && (
        <div>
          <h2 className="text-xl font-bold mb-4">Effect Family Map (Aspect Pairings)</h2>
          <p className="text-sm text-gray-400 mb-6">
            Define possible effects for each aspect pairing. Click a pairing to expand and add effects.
          </p>

          <div className="space-y-2">
            {ASPECTS.map(dominant =>
              ASPECTS.map(secondary => {
                const pairKey = `${dominant}/${secondary}`;
                const pairData = effectFamilyMap[pairKey] || { summary: '', effects: [] };
                const isExpanded = expanded[pairKey];

                return (
                  <div key={pairKey} className="bg-gray-700 rounded">
                    <div
                      className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-600"
                      onClick={() => setExpanded(p => ({...p, [pairKey]: !p[pairKey]}))}
                    >
                      <span className="font-semibold w-32">{dominant}/{secondary}</span>
                      <span className="flex-1 text-sm text-gray-400 italic">
                        {pairData.summary || 'No summary'}
                      </span>
                      <span className="text-xs text-blue-400">
                        {pairData.effects?.length || 0} effect{pairData.effects?.length !== 1 ? 's' : ''}
                      </span>
                      <span className="text-gray-400">{isExpanded ? '▼' : '▶'}</span>
                    </div>

                    {isExpanded && (
                      <div className="px-3 pb-3 space-y-4 border-t border-gray-600 pt-3">
                        {/* Summary field */}
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Summary (quick reference)</label>
                          <textarea
                            value={pairData.summary || ''}
                            onChange={(e) => {
                              saveEffectFamilyMap({
                                ...effectFamilyMap,
                                [pairKey]: {
                                  ...pairData,
                                  summary: e.target.value
                                }
                              });
                            }}
                            placeholder="Brief summary of possible effects for this pairing..."
                            className="w-full bg-gray-600 px-3 py-2 rounded text-sm"
                            rows="2"
                          />
                        </div>

                        {/* Effects list */}
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <label className="text-sm font-semibold">Named Effects</label>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const newEffect = {
                                  id: crypto.randomUUID(),
                                  name: '',
                                  keywords: '',
                                  notes: '',
                                  gmNotes: '',
                                  gmNotesVisible: false
                                };
                                saveEffectFamilyMap({
                                  ...effectFamilyMap,
                                  [pairKey]: {
                                    ...pairData,
                                    effects: [...(pairData.effects || []), newEffect]
                                  }
                                });
                              }}
                              className="bg-blue-600 px-3 py-1 rounded text-sm"
                            >
                              <Plus size={14} className="inline" /> Add Effect
                            </button>
                          </div>

                          {(!pairData.effects || pairData.effects.length === 0) && (
                            <div className="text-gray-500 text-sm italic mb-2">No effects defined</div>
                          )}

                          {pairData.effects?.map((effect, idx) => (
                            <div key={effect.id} className="bg-gray-800 p-3 rounded mb-2 space-y-2">
                              <div className="flex gap-2">
                                <input
                                  value={effect.name}
                                  onChange={(e) => {
                                    const updatedEffects = [...pairData.effects];
                                    updatedEffects[idx] = {...effect, name: e.target.value};
                                    saveEffectFamilyMap({
                                      ...effectFamilyMap,
                                      [pairKey]: {...pairData, effects: updatedEffects}
                                    });
                                  }}
                                  placeholder="Effect name (e.g., 'Quicksilver Reflex')"
                                  className="flex-1 bg-gray-600 px-3 py-1 rounded text-sm font-semibold"
                                />
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const updatedEffects = pairData.effects.filter((_, i) => i !== idx);
                                    saveEffectFamilyMap({
                                      ...effectFamilyMap,
                                      [pairKey]: {...pairData, effects: updatedEffects}
                                    });
                                  }}
                                  className="text-red-400 px-2"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>

                              <div>
                                <label className="block text-xs text-gray-500 mb-1">Keywords/Tags</label>
                                <input
                                  value={effect.keywords}
                                  onChange={(e) => {
                                    const updatedEffects = [...pairData.effects];
                                    updatedEffects[idx] = {...effect, keywords: e.target.value};
                                    saveEffectFamilyMap({
                                      ...effectFamilyMap,
                                      [pairKey]: {...pairData, effects: updatedEffects}
                                    });
                                  }}
                                  placeholder="speed, reflex, stamina"
                                  className="w-full bg-gray-600 px-3 py-1 rounded text-sm"
                                />
                              </div>

                              <div>
                                <label className="block text-xs text-gray-500 mb-1">Notes / Trait Packages</label>
                                <textarea
                                  value={effect.notes}
                                  onChange={(e) => {
                                    const updatedEffects = [...pairData.effects];
                                    updatedEffects[idx] = {...effect, notes: e.target.value};
                                    saveEffectFamilyMap({
                                      ...effectFamilyMap,
                                      [pairKey]: {...pairData, effects: updatedEffects}
                                    });
                                  }}
                                  placeholder="Player-facing notes, trait packages, etc."
                                  className="w-full bg-gray-600 px-3 py-1 rounded text-sm"
                                  rows="2"
                                />
                              </div>

                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <label className="text-xs text-gray-500">GM Notes</label>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const updatedEffects = [...pairData.effects];
                                      updatedEffects[idx] = {...effect, gmNotesVisible: !effect.gmNotesVisible};
                                      saveEffectFamilyMap({
                                        ...effectFamilyMap,
                                        [pairKey]: {...pairData, effects: updatedEffects}
                                      });
                                    }}
                                    className="text-xs px-2 py-1 bg-gray-700 rounded flex items-center gap-1"
                                  >
                                    {effect.gmNotesVisible ? <Eye size={12} /> : <EyeOff size={12} />}
                                    {effect.gmNotesVisible ? 'Visible' : 'Hidden'}
                                  </button>
                                </div>
                                <textarea
                                  value={effect.gmNotes}
                                  onChange={(e) => {
                                    const updatedEffects = [...pairData.effects];
                                    updatedEffects[idx] = {...effect, gmNotes: e.target.value};
                                    saveEffectFamilyMap({
                                      ...effectFamilyMap,
                                      [pairKey]: {...pairData, effects: updatedEffects}
                                    });
                                  }}
                                  placeholder="Hidden GM notes..."
                                  className="w-full bg-gray-600 px-3 py-1 rounded text-sm"
                                  rows="2"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {view === 'alchemySettings' && (
        <div>
          <h2 className="text-xl font-bold mb-4">Alchemy Settings</h2>
          <p className="text-sm text-gray-400 mb-6">
            Configure default settings for alchemy batches. These can be overridden per batch.
          </p>

          <div className="bg-gray-700 p-6 rounded-lg space-y-6 max-w-2xl">
            <div>
              <label className="block text-sm font-semibold mb-2">Default Lab Rating (LR)</label>
              <p className="text-xs text-gray-400 mb-3">
                Lab equipment quality reduces Work Requirement (WR). Recommended range: 0 to 4
              </p>
              <input
                type="number"
                min="0"
                max="4"
                value={alchemySettings.defaultLabRating}
                onChange={(e) => {
                  const clamped = Math.max(0, Math.min(4, toNumberOr(e.target.value, 0)));
                  saveAlchemySettings({
                    ...alchemySettings,
                    defaultLabRating: clamped
                  });
                }}
                className="w-full bg-gray-600 px-4 py-2 rounded text-lg"
                placeholder="0"
              />
              <p className="text-xs text-gray-500 mt-2">
                Current: LR {alchemySettings.defaultLabRating} (reduces WR by {alchemySettings.defaultLabRating})
              </p>
            </div>

            <div className="border-t border-gray-600 pt-6">
              <label className="block text-sm font-semibold mb-2">Work Block Duration (minutes)</label>
              <p className="text-xs text-gray-400 mb-3">
                Standard time unit for alchemy work. Progress is tracked in work blocks.
              </p>
              <input
                type="number"
                min="1"
                value={alchemySettings.workBlockMinutes}
                onChange={(e) => {
                  saveAlchemySettings({
                    ...alchemySettings,
                    workBlockMinutes: Math.max(1, toNumberOr(e.target.value, 120))
                  });
                }}
                className="w-full bg-gray-600 px-4 py-2 rounded text-lg"
                placeholder="120"
              />
              <p className="text-xs text-gray-500 mt-2">
                Current: {alchemySettings.workBlockMinutes} minutes ({(alchemySettings.workBlockMinutes / 60).toFixed(1)} hours)
              </p>
            </div>

            <div className="border-t border-gray-600 pt-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={alchemySettings.autoSaveRecipes || false}
                  onChange={(e) => {
                    saveAlchemySettings({
                      ...alchemySettings,
                      autoSaveRecipes: e.target.checked
                    });
                  }}
                  className="w-5 h-5"
                />
                <div>
                  <div className="text-sm font-semibold">Auto-Save Recipes on Batch Completion</div>
                  <p className="text-xs text-gray-400">
                    Automatically save successful batches as new recipes without prompting
                  </p>
                </div>
              </label>
            </div>

            <div className="bg-gray-800 p-4 rounded text-sm">
              <div className="font-semibold mb-2">Notes:</div>
              <ul className="list-disc list-inside space-y-1 text-gray-300">
                <li>Lab Rating (LR) reduces WR directly: LR 4 reduces WR by 4</li>
                <li>Higher lab rating = easier brewing, fewer work blocks needed</li>
                <li>Work blocks can be customized for different campaign pacing</li>
                <li>Auto-save creates a recipe copy when a batch completes successfully</li>
                <li>These are defaults; you can override them per batch</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
