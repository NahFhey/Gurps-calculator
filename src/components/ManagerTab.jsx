import React, { useState } from 'react';
import { Plus, Save, X, Trash2, Eye, EyeOff } from 'lucide-react';
import { toNumberOr, refundMaterialsFromProject } from '../utils/helpers';
import { TEMPLATES, ASPECTS, POTENCY_LEVELS, INGREDIENT_ROLES, HAZARD_TAGS, VECTORS } from '../constants';
import { calculateFormulaStats } from '../utils/alchemy';
import { TBBuilderPanel } from './alchemy/TBBuilderPanel';

export function ManagerTab({ foodTypes, materialTypes, workers, crafts, craftDesigns, customTemplates, materials, effectFamilyMap, alchemySettings, alchemyReagents, alchemyFormulas, saveMaterials, saveFoodTypes, saveMaterialTypes, saveWorkers, saveCrafts, saveCraftDesigns, saveCustomTemplates, saveEffectFamilyMap, saveAlchemySettings, saveAlchemyReagents, saveAlchemyFormulas, renameMaterialType }) {
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

  // Formula designer state
  const [formulaName, setFormulaName] = useState('');
  const [ingredients, setIngredients] = useState([]);
  const [selectedVector, setSelectedVector] = useState('Potion');
  const [selectedTier, setSelectedTier] = useState(1);
  const [formulaTraits, setFormulaTraits] = useState([]);
  const [expandedFormula, setExpandedFormula] = useState(null);

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

  // Formula helper functions
  function addIngredient() {
    if (alchemyReagents.length === 0) {
      alert('No reagents available!');
      return;
    }
    setIngredients([...ingredients, {
      id: crypto.randomUUID(),
      reagentId: alchemyReagents[0].id,
      role: 'Active',
      unitsUsed: 1,
      refinement: 'crude'
    }]);
  }

  function removeIngredient(id) {
    setIngredients(ingredients.filter(i => i.id !== id));
  }

  function updateIngredient(id, field, value) {
    setIngredients(ingredients.map(i => i.id === id ? {...i, [field]: value} : i));
  }

  function createFormula() {
    if (!formulaName.trim()) {
      alert('Enter formula name');
      return;
    }
    if (ingredients.length === 0) {
      alert('Add at least one ingredient');
      return;
    }

    const reagentsMap = new Map(alchemyReagents.map(r => [r.id, r]));

    const ingredientsSnapshot = ingredients.map(ing => {
      const r = reagentsMap.get(ing.reagentId);
      return {
        reagentId: ing.reagentId,
        reagentName: r?.name || 'Unknown',
        role: ing.role,
        unitsUsed: ing.unitsUsed,
        refinement: ing.refinement,
        aspects: r ? {...r.aspects} : {}
      };
    });

    const tempFormula = { ingredients: ingredientsSnapshot };
    const stats = calculateFormulaStats(tempFormula, reagentsMap, selectedVector);

    // Check for critical validation failures
    if (!stats.batchValidation.valid) {
      alert('Cannot save formula: ' + stats.batchValidation.errors.join(', '));
      return;
    }

    if (stats.roleCoverage.wrDelta >= 999) {
      alert('Cannot save formula: Missing Active ingredient (required)');
      return;
    }

    const newFormula = {
      id: crypto.randomUUID(),
      name: formulaName,
      ingredients: ingredientsSnapshot,
      tier: stats.tier, // Auto-calculated
      calculatedTier: stats.calculatedTier,
      potencyLoad: stats.potencyLoad,
      vector: stats.vector,
      baseWR: stats.baseWR,
      baseDM: stats.baseDM,
      dominantAspect: stats.dominantAspect,
      secondaryAspect: stats.secondaryAspect,
      basePotency: stats.basePotency,
      finalPotency: stats.finalPotency,
      concentrationSteps: stats.concentrationSteps,
      totalConcentrationSteps: stats.totalConcentrationSteps,
      traitBudget: stats.traitBudget,
      hasMatchingStabilizer: stats.hasMatchingStabilizer,
      traits: [...formulaTraits],
      // Store validation results for future reference
      roleCoverage: stats.roleCoverage,
      hazards: stats.hazardEvaluation.hazards
    };

    saveAlchemyFormulas([...alchemyFormulas, newFormula]);
    setFormulaName('');
    setIngredients([]);
    setSelectedVector('Potion');
    setFormulaTraits([]);
    setShowAdd(false);
    alert('Formula created!');
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg max-w-md border-2 border-gray-600">
            <h3 className="text-xl font-bold mb-4">Confirm Delete</h3>
            <p className="mb-6">{deleteConfirm.type === 'foodType' ? `Delete type "${deleteConfirm.value}"?` : deleteConfirm.type === 'materialType' ? `Delete type "${deleteConfirm.value}"?` : deleteConfirm.type === 'worker' ? `Delete worker "${deleteConfirm.value}"?` : deleteConfirm.type === 'project' ? `Delete project "${deleteConfirm.name}"?` : deleteConfirm.type === 'reagent' ? `Delete reagent "${deleteConfirm.name}"?` : deleteConfirm.type === 'formula' ? `Delete formula "${deleteConfirm.name}"?` : `Delete template "${deleteConfirm.name}"?`}</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 bg-gray-600 rounded">Cancel</button>
              <button onClick={() => {
                if (deleteConfirm.type === 'foodType') saveFoodTypes(foodTypes.filter(t => t !== deleteConfirm.value));
                else if (deleteConfirm.type === 'materialType') saveMaterialTypes(materialTypes.filter(t => t.name !== deleteConfirm.value));
                else if (deleteConfirm.type === 'worker') saveWorkers(workers.filter(w => w.id !== deleteConfirm.id));
                else if (deleteConfirm.type === 'reagent') saveAlchemyReagents((alchemyReagents || []).filter(r => r.id !== deleteConfirm.id));
                else if (deleteConfirm.type === 'formula') saveAlchemyFormulas(alchemyFormulas.filter(f => f.id !== deleteConfirm.id));
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
        <button onClick={() => setView('reagents')} className={`px-4 py-2 ${view === 'reagents' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400'}`}>Reagents</button>
        <button onClick={() => setView('formulas')} className={`px-4 py-2 ${view === 'formulas' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400'}`}>Formulas</button>
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
            <div className="bg-gray-700 p-4 rounded mb-4 space-y-3">
              <input value={newType} onChange={(e) => setNewType(e.target.value)} placeholder="Worker name" className="w-full bg-gray-600 px-3 py-2 rounded" />
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Cooking</label>
                  <input type="number" defaultValue="10" id="newWorkerCooking" className="w-full bg-gray-600 px-3 py-2 rounded" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Designing</label>
                  <input type="number" defaultValue="10" id="newWorkerDesigning" className="w-full bg-gray-600 px-3 py-2 rounded" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Crafting</label>
                  <input type="number" defaultValue="10" id="newWorkerCrafting" className="w-full bg-gray-600 px-3 py-2 rounded" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Alchemy</label>
                  <input type="number" defaultValue="10" id="newWorkerAlchemy" className="w-full bg-gray-600 px-3 py-2 rounded" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => {
                  if (!newType.trim()) { alert('Enter a name'); return; }
                  if (workers.some(w => w.name === newType.trim())) { alert('Duplicate name'); return; }
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
                  setNewType(''); setShowAdd(false);
                }} className="flex-1 bg-green-600 px-4 py-2 rounded"><Save size={20} className="inline" /> Save</button>
                <button onClick={() => setShowAdd(false)} className="bg-red-600 px-4 py-2 rounded"><X size={20} /></button>
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
                  <span className="text-xs text-gray-400">Cook: {w.skills.cooking}</span>
                  <span className="text-xs text-gray-400">Design: {w.skills.designing}</span>
                  <span className="text-xs text-gray-400">Craft: {w.skills.crafting}</span>
                  <span className="text-xs text-gray-400">Alch: {w.skills.alchemy}</span>
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
                          if (workers.some(x => x.name === newName && x.id !== w.id)) { alert('Duplicate name'); return; }
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
                          value={w.skills.cooking}
                          onChange={(e) => {
                            saveWorkers(workers.map(x => x.id === w.id ? {...x, skills: {...x.skills, cooking: toNumberOr(e.target.value, 10)}} : x));
                          }}
                          className="w-full bg-gray-600 px-3 py-2 rounded"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Designing Skill</label>
                        <input
                          type="number"
                          value={w.skills.designing}
                          onChange={(e) => {
                            saveWorkers(workers.map(x => x.id === w.id ? {...x, skills: {...x.skills, designing: toNumberOr(e.target.value, 10)}} : x));
                          }}
                          className="w-full bg-gray-600 px-3 py-2 rounded"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Crafting Skill</label>
                        <input
                          type="number"
                          value={w.skills.crafting}
                          onChange={(e) => {
                            saveWorkers(workers.map(x => x.id === w.id ? {...x, skills: {...x.skills, crafting: toNumberOr(e.target.value, 10)}} : x));
                          }}
                          className="w-full bg-gray-600 px-3 py-2 rounded"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Alchemy Skill</label>
                        <input
                          type="number"
                          value={w.skills.alchemy}
                          onChange={(e) => {
                            saveWorkers(workers.map(x => x.id === w.id ? {...x, skills: {...x.skills, alchemy: toNumberOr(e.target.value, 10)}} : x));
                          }}
                          className="w-full bg-gray-600 px-3 py-2 rounded"
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => setDeleteConfirm({type: 'worker', value: w.name, id: w.id})}
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

      {view === 'reagents' && (
        <div>
          <div className="flex justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold">Reagent Management</h2>
              <p className="text-sm text-gray-400 mt-1">
                Full reagent properties including identification data. Players see limited info based on identification level.
              </p>
            </div>
            <button onClick={() => setShowAdd(!showAdd)} className="bg-green-600 px-4 py-2 rounded h-fit">
              <Plus size={20} className="inline" /> Add Reagent
            </button>
          </div>

          {showAdd && (
            <div className="bg-gray-700 p-4 rounded mb-4 space-y-3">
              <div>
                <label className="block text-sm mb-1">Reagent Name</label>
                <input
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  className="w-full bg-gray-600 px-3 py-2 rounded"
                  placeholder="e.g., Lunar Moss"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm mb-1">Primary Aspect (3pts)</label>
                  <select
                    value={expanded.newPrimary || 'Water'}
                    onChange={(e) => setExpanded({...expanded, newPrimary: e.target.value})}
                    className="w-full bg-gray-600 px-3 py-2 rounded"
                  >
                    {ASPECTS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm mb-1">Secondary Aspect (2pts)</label>
                  <select
                    value={expanded.newSecondary || 'Air'}
                    onChange={(e) => setExpanded({...expanded, newSecondary: e.target.value})}
                    className="w-full bg-gray-600 px-3 py-2 rounded"
                  >
                    {ASPECTS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm mb-1">Tertiary Aspect (1pt)</label>
                  <select
                    value={expanded.newTertiary || 'Fire'}
                    onChange={(e) => setExpanded({...expanded, newTertiary: e.target.value})}
                    className="w-full bg-gray-600 px-3 py-2 rounded"
                  >
                    {ASPECTS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm mb-1">Base Potency</label>
                  <select
                    value={expanded.newPotency || 'P1'}
                    onChange={(e) => setExpanded({...expanded, newPotency: e.target.value})}
                    className="w-full bg-gray-600 px-3 py-2 rounded"
                  >
                    {POTENCY_LEVELS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm mb-1">Refinement</label>
                  <select
                    value={expanded.newRefinement || 'crude'}
                    onChange={(e) => setExpanded({...expanded, newRefinement: e.target.value})}
                    className="w-full bg-gray-600 px-3 py-2 rounded"
                  >
                    <option value="crude">Crude</option>
                    <option value="prepared">Prepared</option>
                    <option value="refined">Refined</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm mb-1">Quantity (Units)</label>
                  <input
                    type="number"
                    value={expanded.newQuantity || '10'}
                    onChange={(e) => setExpanded({...expanded, newQuantity: e.target.value})}
                    className="w-full bg-gray-600 px-3 py-2 rounded"
                    min="0"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm mb-2">Roles</label>
                <div className="grid grid-cols-4 gap-2">
                  {INGREDIENT_ROLES.map(role => (
                    <label key={role} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={(expanded.newRoles || []).includes(role)}
                        onChange={(e) => {
                          const roles = expanded.newRoles || [];
                          setExpanded({
                            ...expanded,
                            newRoles: e.target.checked
                              ? [...roles, role]
                              : roles.filter(r => r !== role)
                          });
                        }}
                        className="w-4 h-4"
                      />
                      <span>{role}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm mb-2">Hazards</label>
                <div className="grid grid-cols-3 gap-2">
                  {HAZARD_TAGS.map(hazard => (
                    <label key={hazard} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={(expanded.newHazards || []).includes(hazard)}
                        onChange={(e) => {
                          const hazards = expanded.newHazards || [];
                          setExpanded({
                            ...expanded,
                            newHazards: e.target.checked
                              ? [...hazards, hazard]
                              : hazards.filter(h => h !== hazard)
                          });
                        }}
                        className="w-4 h-4"
                      />
                      <span>{hazard}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (!newType.trim()) { alert('Enter reagent name'); return; }
                    const newReagent = {
                      id: crypto.randomUUID(),
                      name: newType.trim(),
                      aspects: {
                        primary: expanded.newPrimary || 'Water',
                        secondary: expanded.newSecondary || 'Air',
                        tertiary: expanded.newTertiary || 'Fire'
                      },
                      refinement: expanded.newRefinement || 'crude',
                      basePotency: expanded.newPotency || 'P1',
                      concentrationSteps: 0,
                      roles: expanded.newRoles || ['Active'],
                      primaryRole: (expanded.newRoles || ['Active'])[0],
                      hazards: expanded.newHazards || [],
                      processingNotes: '',
                      quantity: toNumberOr(expanded.newQuantity, 10),
                      identificationLevel: 4, // New reagents start fully identified for GM
                      analysisHistory: [],
                      falseProfile: null
                    };
                    saveAlchemyReagents([...(alchemyReagents || []), newReagent]);
                    setNewType('');
                    setExpanded({});
                    setShowAdd(false);
                  }}
                  className="flex-1 bg-green-600 px-4 py-2 rounded"
                >
                  <Save size={20} className="inline" /> Save Reagent
                </button>
                <button onClick={() => { setShowAdd(false); setNewType(''); setExpanded({}); }} className="bg-red-600 px-4 py-2 rounded">
                  <X size={20} />
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {(alchemyReagents || []).map(r => (
              <div key={r.id} className="bg-gray-700 rounded">
                <div
                  className="flex items-center gap-4 p-3 cursor-pointer hover:bg-gray-600"
                  onClick={() => setExpanded(p => ({...p, [r.id]: !p[r.id]}))}
                >
                  <span className="flex-1 font-medium">{r.name}</span>
                  <span className="text-sm text-blue-400">
                    {r.aspects?.primary}/{r.aspects?.secondary}/{r.aspects?.tertiary}
                  </span>
                  <span className="text-sm text-gray-400">{r.quantity}U</span>
                  <span className="text-sm text-purple-400">{r.basePotency || 'P1'}</span>
                  {r.identificationLevel < 4 && (
                    <span className="text-xs px-2 py-1 bg-yellow-600 rounded">
                      ID: {r.identificationLevel}/4
                    </span>
                  )}
                  {r.falseProfile && (
                    <span className="text-xs text-red-400">⚠️ False</span>
                  )}
                  <span className="text-gray-400">{expanded[r.id] ? '▼' : '▶'}</span>
                </div>

                {expanded[r.id] && (
                  <div className="px-3 pb-3 space-y-3 border-t border-gray-600 pt-3">
                    {/* Basic Info */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Name</label>
                        <input
                          value={r.name}
                          onChange={(e) => saveAlchemyReagents(alchemyReagents.map(x => x.id === r.id ? {...x, name: e.target.value} : x))}
                          className="w-full bg-gray-600 px-3 py-1 rounded"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Quantity (Units)</label>
                        <input
                          type="number"
                          value={r.quantity}
                          onChange={(e) => saveAlchemyReagents(alchemyReagents.map(x => x.id === r.id ? {...x, quantity: toNumberOr(e.target.value, 0)} : x))}
                          className="w-full bg-gray-600 px-3 py-1 rounded"
                        />
                      </div>
                    </div>

                    {/* Aspects */}
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Primary (3pts)</label>
                        <select
                          value={r.aspects?.primary || 'Water'}
                          onChange={(e) => saveAlchemyReagents(alchemyReagents.map(x => x.id === r.id ? {...x, aspects: {...x.aspects, primary: e.target.value}} : x))}
                          className="w-full bg-gray-600 px-3 py-1 rounded"
                        >
                          {ASPECTS.map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Secondary (2pts)</label>
                        <select
                          value={r.aspects?.secondary || 'Air'}
                          onChange={(e) => saveAlchemyReagents(alchemyReagents.map(x => x.id === r.id ? {...x, aspects: {...x.aspects, secondary: e.target.value}} : x))}
                          className="w-full bg-gray-600 px-3 py-1 rounded"
                        >
                          {ASPECTS.map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Tertiary (1pt)</label>
                        <select
                          value={r.aspects?.tertiary || 'Fire'}
                          onChange={(e) => saveAlchemyReagents(alchemyReagents.map(x => x.id === r.id ? {...x, aspects: {...x.aspects, tertiary: e.target.value}} : x))}
                          className="w-full bg-gray-600 px-3 py-1 rounded"
                        >
                          {ASPECTS.map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                      </div>
                    </div>

                    {/* Potency & Refinement */}
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Base Potency</label>
                        <select
                          value={r.basePotency || 'P1'}
                          onChange={(e) => saveAlchemyReagents(alchemyReagents.map(x => x.id === r.id ? {...x, basePotency: e.target.value} : x))}
                          className="w-full bg-gray-600 px-3 py-1 rounded"
                        >
                          {POTENCY_LEVELS.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Refinement</label>
                        <select
                          value={r.refinement || 'crude'}
                          onChange={(e) => saveAlchemyReagents(alchemyReagents.map(x => x.id === r.id ? {...x, refinement: e.target.value} : x))}
                          className="w-full bg-gray-600 px-3 py-1 rounded"
                        >
                          <option value="crude">Crude</option>
                          <option value="prepared">Prepared</option>
                          <option value="refined">Refined</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Concentration Steps</label>
                        <input
                          type="number"
                          value={r.concentrationSteps || 0}
                          onChange={(e) => saveAlchemyReagents(alchemyReagents.map(x => x.id === r.id ? {...x, concentrationSteps: toNumberOr(e.target.value, 0)} : x))}
                          className="w-full bg-gray-600 px-3 py-1 rounded"
                          min="0"
                        />
                      </div>
                    </div>

                    {/* Roles */}
                    <div>
                      <label className="block text-xs text-gray-400 mb-2">Roles</label>
                      <div className="grid grid-cols-4 gap-2">
                        {INGREDIENT_ROLES.map(role => (
                          <label key={role} className="flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={(r.roles || []).includes(role)}
                              onChange={(e) => {
                                const roles = r.roles || [];
                                const newRoles = e.target.checked
                                  ? [...roles, role]
                                  : roles.filter(rl => rl !== role);
                                saveAlchemyReagents(alchemyReagents.map(x => x.id === r.id ? {...x, roles: newRoles, primaryRole: newRoles[0] || 'Active'} : x));
                              }}
                              className="w-4 h-4"
                            />
                            <span>{role}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Hazards */}
                    <div>
                      <label className="block text-xs text-gray-400 mb-2">Hazards</label>
                      <div className="grid grid-cols-3 gap-2">
                        {HAZARD_TAGS.map(hazard => (
                          <label key={hazard} className="flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={(r.hazards || []).includes(hazard)}
                              onChange={(e) => {
                                const hazards = r.hazards || [];
                                const newHazards = e.target.checked
                                  ? [...hazards, hazard]
                                  : hazards.filter(h => h !== hazard);
                                saveAlchemyReagents(alchemyReagents.map(x => x.id === r.id ? {...x, hazards: newHazards} : x));
                              }}
                              className="w-4 h-4"
                            />
                            <span>{hazard}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Processing Notes */}
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Processing Notes</label>
                      <textarea
                        value={r.processingNotes || ''}
                        onChange={(e) => saveAlchemyReagents(alchemyReagents.map(x => x.id === r.id ? {...x, processingNotes: e.target.value} : x))}
                        className="w-full bg-gray-600 px-3 py-2 rounded text-sm"
                        rows="2"
                        placeholder="e.g., must be ground, requires heating"
                      />
                    </div>

                    {/* Identification Level */}
                    <div className="bg-gray-800 p-3 rounded">
                      <label className="block text-xs text-gray-400 mb-2">
                        Identification Level (affects player view)
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min="0"
                          max="4"
                          value={r.identificationLevel || 0}
                          onChange={(e) => saveAlchemyReagents(alchemyReagents.map(x => x.id === r.id ? {...x, identificationLevel: parseInt(e.target.value)} : x))}
                          className="flex-1"
                        />
                        <span className="text-sm font-semibold">{r.identificationLevel || 0}/4</span>
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {r.identificationLevel === 0 && 'Unidentified'}
                        {r.identificationLevel === 1 && 'Partial (Primary Aspect)'}
                        {r.identificationLevel === 2 && 'Basic (Primary + Secondary)'}
                        {r.identificationLevel === 3 && 'Complete (All Aspects)'}
                        {r.identificationLevel === 4 && 'Full Profile'}
                      </div>
                    </div>

                    {/* False Profile Warning/Editor */}
                    {r.falseProfile && (
                      <div className="bg-red-900 bg-opacity-30 border border-red-500 p-3 rounded">
                        <div className="flex justify-between items-center mb-2">
                          <label className="text-sm font-semibold text-red-400">
                            ⚠️ False Profile (from critical failure)
                          </label>
                          <button
                            onClick={() => saveAlchemyReagents(alchemyReagents.map(x => x.id === r.id ? {...x, falseProfile: null} : x))}
                            className="text-xs px-2 py-1 bg-red-600 rounded"
                          >
                            Clear False Profile
                          </button>
                        </div>
                        <div className="text-xs text-gray-300">
                          Players see: {r.falseProfile.aspects?.primary}/{r.falseProfile.aspects?.secondary}/{r.falseProfile.aspects?.tertiary} | {r.falseProfile.basePotency}
                        </div>
                      </div>
                    )}

                    {/* Delete Button */}
                    <button
                      onClick={() => setDeleteConfirm({type: 'reagent', id: r.id, name: r.name})}
                      className="w-full bg-red-600 py-2 rounded text-sm"
                    >
                      <Trash2 size={16} className="inline" /> Delete Reagent
                    </button>
                  </div>
                )}
              </div>
            ))}

            {(!alchemyReagents || alchemyReagents.length === 0) && (
              <div className="text-center py-8 text-gray-500">
                No reagents. Add your first reagent above.
              </div>
            )}
          </div>
        </div>
      )}

      {view === 'formulas' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-xl font-bold">Formula Design</h2>
              <p className="text-sm text-gray-400 mt-1">
                Design and manage alchemy formulas. Players can view and start batches from formulas in the Formulas tab.
              </p>
            </div>
            <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-2 bg-green-600 px-4 py-2 rounded h-fit">
              <Plus size={20} /> {showAdd ? 'Cancel' : 'Design Formula'}
            </button>
          </div>

          {showAdd && (
            <div className="bg-gray-700 p-4 rounded mb-4 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-3 sm:col-span-1">
                  <label className="block text-sm mb-1">Formula Name</label>
                  <input
                    value={formulaName}
                    onChange={(e) => setFormulaName(e.target.value)}
                    className="w-full bg-gray-600 px-3 py-2 rounded"
                    placeholder="e.g., Healing Draught"
                  />
                </div>
                <div className="bg-gray-700 p-3 rounded">
                  <div className="text-xs text-gray-400 mb-1">Tier (Auto-calculated from potency)</div>
                  <div className="text-sm text-gray-300">
                    Tier is now automatically determined by the potency load of active ingredients.
                    The tier calculation happens when you add ingredients below.
                  </div>
                </div>
                <div>
                  <label className="block text-sm mb-1">Vector Type</label>
                  <select
                    value={selectedVector}
                    onChange={(e) => setSelectedVector(e.target.value)}
                    className="w-full bg-gray-600 px-3 py-2 rounded"
                  >
                    {VECTORS.map(v => (
                      <option key={v.name} value={v.name}>
                        {v.name} (WR {v.wrMod >= 0 ? '+' : ''}{v.wrMod}, DM {v.dmMod >= 0 ? '+' : ''}{v.dmMod})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-semibold">Ingredients</label>
                  <button onClick={addIngredient} className="bg-blue-600 px-3 py-1 rounded text-sm">
                    <Plus size={14} className="inline" /> Add Ingredient
                  </button>
                </div>

                {ingredients.map(ing => {
                  return (
                    <div key={ing.id} className="bg-gray-600 p-3 rounded mb-2 space-y-2">
                      <div className="grid grid-cols-4 gap-2">
                        <select
                          value={ing.reagentId}
                          onChange={(e) => updateIngredient(ing.id, 'reagentId', e.target.value)}
                          className="bg-gray-700 px-2 py-1 rounded text-sm"
                        >
                          {alchemyReagents.map(r => (
                            <option key={r.id} value={r.id}>{r.name} ({r.quantity}U)</option>
                          ))}
                        </select>
                        <select
                          value={ing.role}
                          onChange={(e) => updateIngredient(ing.id, 'role', e.target.value)}
                          className="bg-gray-700 px-2 py-1 rounded text-sm"
                        >
                          {INGREDIENT_ROLES.map(role => (
                            <option key={role} value={role}>{role}</option>
                          ))}
                        </select>
                        <select
                          value={ing.refinement}
                          onChange={(e) => updateIngredient(ing.id, 'refinement', e.target.value)}
                          className="bg-gray-700 px-2 py-1 rounded text-sm"
                        >
                          <option value="crude">Crude</option>
                          <option value="prepared">Prepared</option>
                          <option value="refined">Refined</option>
                        </select>
                        <div className="flex gap-1">
                          <input
                            type="number"
                            value={ing.unitsUsed}
                            onChange={(e) => updateIngredient(ing.id, 'unitsUsed', Math.max(1, toNumberOr(e.target.value, 1)))}
                            className="w-full bg-gray-700 px-2 py-1 rounded text-sm"
                            min="1"
                          />
                          <button
                            onClick={() => removeIngredient(ing.id)}
                            className="bg-red-600 px-2 rounded"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {ingredients.length > 0 && (() => {
                const reagentsMap = new Map(alchemyReagents.map(r => [r.id, r]));
                const actives = ingredients.filter(i => i.role === 'Active' || i.role === 'active');
                if (actives.length === 0) return null;

                const ingredientsSnapshot = ingredients.map(ing => {
                  const r = reagentsMap.get(ing.reagentId);
                  return {
                    reagentId: ing.reagentId,
                    role: ing.role,
                    unitsUsed: ing.unitsUsed,
                    refinement: ing.refinement,
                    aspects: r ? {...r.aspects} : {}
                  };
                });

                const tempFormula = { ingredients: ingredientsSnapshot };
                const stats = calculateFormulaStats(tempFormula, reagentsMap, selectedVector);

                return (
                  <div className="space-y-3">
                    {/* Validation warnings */}
                    {!stats.roleCoverage.valid && (
                      <div className="bg-red-900 bg-opacity-30 border border-red-500 p-3 rounded">
                        <div className="text-sm font-semibold text-red-300 mb-1">⚠️ Missing Required Roles</div>
                        <div className="text-xs text-red-200 space-y-1">
                          {stats.roleCoverage.messages.map((msg, idx) => (
                            <div key={idx}>• {msg}</div>
                          ))}
                        </div>
                      </div>
                    )}

                    {!stats.batchValidation.valid && (
                      <div className="bg-red-900 bg-opacity-30 border border-red-500 p-3 rounded">
                        <div className="text-sm font-semibold text-red-300 mb-1">⚠️ Constraint Violations</div>
                        <div className="text-xs text-red-200 space-y-1">
                          {stats.batchValidation.errors.map((err, idx) => (
                            <div key={idx}>• {err}</div>
                          ))}
                        </div>
                      </div>
                    )}

                    {stats.batchValidation.warnings.length > 0 && (
                      <div className="bg-yellow-900 bg-opacity-30 border border-yellow-500 p-3 rounded">
                        <div className="text-sm font-semibold text-yellow-300 mb-1">⚠️ Warnings</div>
                        <div className="text-xs text-yellow-200 space-y-1">
                          {stats.batchValidation.warnings.map((warn, idx) => (
                            <div key={idx}>• {warn}</div>
                          ))}
                        </div>
                      </div>
                    )}

                    {stats.hazardEvaluation.count > 0 && (
                      <div className="bg-orange-900 bg-opacity-30 border border-orange-500 p-3 rounded">
                        <div className="text-sm font-semibold text-orange-300 mb-1">⚠️ Hazards Present ({stats.hazardEvaluation.count})</div>
                        <div className="text-xs text-orange-200 space-y-1">
                          {stats.hazardEvaluation.details.map((h, idx) => (
                            <div key={idx}>
                              <strong>{h.hazard}</strong> ({h.source}): {h.effect}
                              {h.wrMod > 0 && ` [+${h.wrMod} WR]`}
                              {h.dmMod !== 0 && ` [${h.dmMod >= 0 ? '+' : ''}${h.dmMod} DM]`}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="bg-gray-600 p-3 rounded">
                      <div className="text-sm font-semibold mb-2">Formula Preview</div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="space-y-1">
                          <div>
                            Tier: <span className="text-yellow-400 font-bold">{stats.tier}</span>
                            <span className="text-xs text-gray-400 ml-2">(Potency Load: {stats.potencyLoad})</span>
                          </div>
                          <div>Dominant: <span className="text-blue-400">{stats.dominantAspect || 'None'}</span></div>
                          <div>Secondary: <span className="text-blue-400">{stats.secondaryAspect || 'None'}</span></div>
                          <div>Potency: <span className="text-green-400">{stats.basePotency} {stats.concentrationSteps > 0 ? `+${stats.concentrationSteps} → ${stats.finalPotency}` : ''}</span></div>
                        </div>
                        <div className="space-y-1">
                          <div>WR: <span className="text-orange-400">{stats.baseWR}</span></div>
                          <div>DM: <span className="text-orange-400">{stats.baseDM >= 0 ? '+' : ''}{stats.baseDM}</span></div>
                          <div>TB: <span className="text-purple-400">{stats.traitBudget} points</span></div>
                          <div>Vector: <span className="text-gray-300">{stats.vector}</span></div>
                        </div>
                      </div>
                    </div>

                    <TBBuilderPanel
                      traitBudget={stats.traitBudget}
                      initialTraits={formulaTraits}
                      onUpdate={setFormulaTraits}
                    />
                  </div>
                );
              })()}

              <button onClick={createFormula} className="w-full bg-green-600 px-4 py-2 rounded">
                Save Formula
              </button>
            </div>
          )}

          <div className="space-y-3">
            {alchemyFormulas.map(f => (
              <div key={f.id} className="bg-gray-700 p-4 rounded">
                <div className="flex justify-between mb-2">
                  <h3 className="font-semibold text-lg">{f.name}</h3>
                  <div className="flex gap-2">
                    <button onClick={() => setDeleteConfirm({type: 'formula', id: f.id, name: f.name})} className="bg-red-600 px-3 py-1 rounded text-sm">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="text-sm space-y-1">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-gray-400">Tier:</span> <span className="text-yellow-400 font-bold">{f.tier || 1}</span> |
                      <span className="text-gray-400 ml-2">TB:</span> <span className="text-purple-400">{f.traitBudget || 10}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Vector:</span> <span className="text-gray-300">{f.vector || 'Potion'}</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-400">Aspects:</span> <span className="text-blue-400">{f.dominantAspect}</span> / <span className="text-blue-400">{f.secondaryAspect}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Potency:</span> <span className="text-green-400">{f.finalPotency || f.potency || 'P1'}</span> |
                    <span className="text-gray-400 ml-2">WR:</span> <span className="text-orange-400">{f.baseWR}</span> |
                    <span className="text-gray-400 ml-2">DM:</span> <span className="text-orange-400">{f.baseDM >= 0 ? '+' : ''}{f.baseDM}</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-2">
                    {f.ingredients.map(i => `${i.reagentName} (${i.role}, ${i.unitsUsed}U)`).join(', ')}
                  </div>

                  {f.traits && f.traits.length > 0 && (
                    <div className="text-xs text-purple-400 mt-2">
                      Traits: {f.traits.map(t => `${t.name} (${t.cost}pts)`).join(', ')}
                    </div>
                  )}
                </div>

                {expandedFormula === f.id && f.traits && (
                  <div className="mt-3">
                    <TBBuilderPanel
                      traitBudget={f.traitBudget || 10}
                      initialTraits={f.traits || []}
                      onUpdate={(newTraits) => {
                        const updatedFormulas = alchemyFormulas.map(formula =>
                          formula.id === f.id ? {...formula, traits: newTraits} : formula
                        );
                        saveAlchemyFormulas(updatedFormulas);
                      }}
                    />
                  </div>
                )}

                {(f.traits && f.traits.length > 0) || expandedFormula === f.id ? (
                  <button
                    onClick={() => setExpandedFormula(expandedFormula === f.id ? null : f.id)}
                    className="mt-2 text-xs text-purple-400 hover:text-purple-300"
                  >
                    {expandedFormula === f.id ? '▼ Hide Traits' : '▶ Show Traits'}
                  </button>
                ) : null}
              </div>
            ))}

            {alchemyFormulas.length === 0 && (
              <div className="text-gray-500 text-center py-8">No formulas yet. Design one to get started!</div>
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

            <div className="border-t border-gray-600 pt-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={alchemySettings.showObviousRoles !== false}
                  onChange={(e) => {
                    saveAlchemySettings({
                      ...alchemySettings,
                      showObviousRoles: e.target.checked
                    });
                  }}
                  className="w-5 h-5"
                />
                <div>
                  <div className="text-sm font-semibold">Show Obvious Physical Roles</div>
                  <p className="text-xs text-gray-400">
                    Allow physical roles (Solvent, Binder, Tool) to be known from mundane inspection even when reagent is unidentified
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
                <li>Reagent identification requires Analysis (consumes 1U per attempt)</li>
                <li>Physical roles setting allows Solvent/Binder/Tool to be visible even when unidentified</li>
                <li>These are defaults; you can override them per batch</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
