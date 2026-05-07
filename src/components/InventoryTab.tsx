import { useState, useMemo, useCallback } from 'react';
import { Plus, Save, X, Trash2, ArrowRight } from 'lucide-react';
import { toNumberOr } from '../utils/helpers';
import { useCampaignStore } from '../state/campaignStore';
import { normalizeArray, denormalizeObject } from '../state/campaignUtils';
import type { Inventory, ToolTemplate, Character } from '../types/campaign';
import { inventoryLog } from '../utils/activityLogger';

// ============================================================================
// Types
// ============================================================================

interface Material {
  id: string;
  name: string;
  type: string;
  quantity: number;
  [key: string]: unknown;
}

interface Food {
  id: string;
  name: string;
  types: string[];
  quantity: number;
  [key: string]: unknown;
}

interface MaterialType {
  name: string;
  difficulty: number;
  ht: number;
  weightMod?: number;
  hpMod?: number;
  [key: string]: unknown;
}

interface FoodType {
  name: string;
  color: string;
}

interface DeleteConfirm {
  type: 'mat' | 'food';
  id: string;
  name: string;
}

interface TransferState {
  type: 'item' | 'tool' | 'currency';
  itemId?: string;
  toolId?: string;
  currencyKey?: string;
  amount?: string;
  sourceInventoryId: string;
  targetInventoryId: string;
}

type InventoryView = 'materials' | 'foods' | 'stash';

// ============================================================================
// InventoryTab Component
// ============================================================================

/**
 * InventoryTab Component - Manages raw materials and food supplies inventory
 *
 * MIGRATED: Now uses useCampaignStore directly instead of bridge contexts.
 */
export function InventoryTab() {
  const { state, actions } = useCampaignStore();

  // Derive data from normalized state
  const materials = useMemo(() =>
    denormalizeObject(state.entities.materials) as Material[],
    [state.entities.materials]
  );

  const foods = useMemo(() =>
    denormalizeObject(state.entities.foods) as Food[],
    [state.entities.foods]
  );

  const foodTypes = state.entities.foodTypes as (string | FoodType)[];
  const materialTypes = (state.entities.materialTypes as unknown) as MaterialType[];
  const gmMode = state.ui.gmModeEnabled;

  // Party Stash data
  const inventories = useMemo(() =>
    Object.values(state.entities.inventories) as Inventory[],
    [state.entities.inventories]
  );
  const characters = state.entities.characters as Record<string, Character>;
  const toolTemplates = state.entities.toolTemplates as Record<string, ToolTemplate>;

  // Save callbacks
  const saveMaterials = useCallback((materialsArray: Material[]) => {
    actions.setMaterials(normalizeArray(materialsArray));
  }, [actions]);

  const saveFoods = useCallback((foodsArray: Food[]) => {
    actions.setFoods(normalizeArray(foodsArray));
  }, [actions]);

  // Local state
  const [view, setView] = useState<InventoryView>('materials');
  const [showAddMat, setShowAddMat] = useState(false);
  const [showAddFood, setShowAddFood] = useState(false);
  const [useExistingMat, setUseExistingMat] = useState(false);
  const [useExistingFood, setUseExistingFood] = useState(false);
  const [selectedExistingMatId, setSelectedExistingMatId] = useState('');
  const [selectedExistingFoodId, setSelectedExistingFoodId] = useState('');
  const [newMatName, setNewMatName] = useState('');
  const [newMatQty, setNewMatQty] = useState('');
  const [newMatType, setNewMatType] = useState('');
  const [newFoodName, setNewFoodName] = useState('');
  const [newFoodQty, setNewFoodQty] = useState('');
  const [newFoodTypes, setNewFoodTypes] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirm | null>(null);
  const [transferState, setTransferState] = useState<TransferState | null>(null);

  /**
   * Adds a new material or quantity to existing material
   */
  function addMat() {
    if (useExistingMat) {
      if (!selectedExistingMatId || !newMatQty) {
        alert('Select existing material and enter quantity');
        return;
      }
      saveMaterials(materials.map(m =>
        m.id === selectedExistingMatId
          ? { ...m, quantity: m.quantity + Math.max(0, toNumberOr(newMatQty, 0)) }
          : m
      ));
      setUseExistingMat(false);
      setSelectedExistingMatId('');
      setNewMatQty('');
      setShowAddMat(false);
      return;
    }

    if (!newMatName.trim() || !newMatQty || !newMatType) {
      alert('Fill all fields including material type');
      return;
    }

    const existing = materials.find(m => m.name === newMatName.trim() && m.type === newMatType);
    if (existing) {
      saveMaterials(materials.map(m =>
        m.id === existing.id
          ? { ...m, quantity: m.quantity + Math.max(0, toNumberOr(newMatQty, 0)) }
          : m
      ));
    } else {
      saveMaterials([...materials, {
        id: crypto.randomUUID(),
        name: newMatName.trim(),
        quantity: Math.max(0, toNumberOr(newMatQty, 0)),
        type: newMatType
      }]);
    }

    setNewMatName('');
    setNewMatQty('');
    setNewMatType('');
    setShowAddMat(false);
  }

  /**
   * Adds a new food item or quantity to existing food
   */
  function addFood() {
    if (useExistingFood) {
      if (!selectedExistingFoodId || !newFoodQty) {
        alert('Select existing food and enter quantity');
        return;
      }
      saveFoods(foods.map(f =>
        f.id === selectedExistingFoodId
          ? { ...f, quantity: f.quantity + Math.max(0, toNumberOr(newFoodQty, 0)) }
          : f
      ));
      setUseExistingFood(false);
      setSelectedExistingFoodId('');
      setNewFoodQty('');
      setShowAddFood(false);
      return;
    }

    if (!newFoodName.trim() || !newFoodQty || newFoodTypes.length === 0) {
      alert('Fill all fields and add at least one type');
      return;
    }

    const sortedNewTypes = [...newFoodTypes].sort().join(',');
    const existing = foods.find(f => {
      const sortedExistingTypes = [...(f.types || [])].sort().join(',');
      return f.name === newFoodName.trim() && sortedExistingTypes === sortedNewTypes;
    });

    if (existing) {
      saveFoods(foods.map(f =>
        f.id === existing.id
          ? { ...f, quantity: f.quantity + Math.max(0, toNumberOr(newFoodQty, 0)) }
          : f
      ));
    } else {
      saveFoods([...foods, {
        id: crypto.randomUUID(),
        name: newFoodName.trim(),
        quantity: Math.max(0, toNumberOr(newFoodQty, 0)),
        types: [...newFoodTypes]
      }]);
    }

    setNewFoodName('');
    setNewFoodQty('');
    setNewFoodTypes([]);
    setShowAddFood(false);
  }

  const grouped = foods.reduce((g: Record<string, Food[]>, f) => {
    const k = f.types?.length > 0 ? [...f.types].sort().join('/') : 'no-type';
    if (!g[k]) g[k] = [];
    g[k].push(f);
    return g;
  }, {});

  return (
    <div>
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg max-w-md">
            <h3 className="text-xl font-bold mb-4">Confirm Delete</h3>
            <p className="mb-6">Delete "{deleteConfirm.name}"?</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 bg-gray-600 rounded">Cancel</button>
              <button onClick={() => {
                if (deleteConfirm.type === 'mat') saveMaterials(materials.filter(m => m.id !== deleteConfirm.id));
                else saveFoods(foods.filter(f => f.id !== deleteConfirm.id));
                setDeleteConfirm(null);
              }} className="px-4 py-2 bg-red-600 rounded">Delete</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-4">
        <button onClick={() => setView('materials')} className={`px-4 py-2 rounded ${view === 'materials' ? 'bg-blue-600' : 'bg-gray-700'}`}>Raw Materials</button>
        <button onClick={() => setView('foods')} className={`px-4 py-2 rounded ${view === 'foods' ? 'bg-blue-600' : 'bg-gray-700'}`}>Food Supplies</button>
        <button onClick={() => setView('stash')} className={`px-4 py-2 rounded ${view === 'stash' ? 'bg-blue-600' : 'bg-gray-700'}`}>Party Stash</button>
      </div>

      {view === 'materials' && (
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex justify-between mb-4">
            <h2 className="text-xl font-bold">Raw Materials</h2>
            <button onClick={() => setShowAddMat(!showAddMat)} className="bg-green-600 px-4 py-2 rounded"><Plus size={20} className="inline" /> Add</button>
          </div>
          {showAddMat && (
            <div className="bg-gray-700 p-4 rounded mb-4 space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={useExistingMat}
                  onChange={(e) => {
                    setUseExistingMat(e.target.checked);
                    if (e.target.checked) {
                      setNewMatName('');
                      setNewMatType('');
                    } else {
                      setSelectedExistingMatId('');
                    }
                  }}
                  className="w-4 h-4"
                />
                Use existing material
              </label>
              {useExistingMat ? (
                <>
                  <select
                    value={selectedExistingMatId}
                    onChange={(e) => setSelectedExistingMatId(e.target.value)}
                    className="w-full bg-gray-600 px-3 py-2 rounded"
                  >
                    <option value="">Select material...</option>
                    {materials
                      .filter(m => !newMatType || m.type === newMatType)
                      .map(m => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.type}) - {m.quantity} lbs
                        </option>
                      ))}
                  </select>
                  {newMatType && (
                    <div className="text-xs text-gray-400">
                      Showing only {newMatType} materials
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="flex gap-2">
                    <input
                      value={newMatName}
                      onChange={(e) => setNewMatName(e.target.value)}
                      placeholder="Name"
                      className="flex-1 bg-gray-600 px-3 py-2 rounded"
                    />
                  </div>
                  <select
                    value={newMatType}
                    onChange={(e) => setNewMatType(e.target.value)}
                    className="w-full bg-gray-600 px-3 py-2 rounded"
                  >
                    <option value="">Select Type</option>
                    {materialTypes.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                  </select>
                </>
              )}
              <input
                type="number"
                value={newMatQty}
                onChange={(e) => setNewMatQty(e.target.value)}
                placeholder="Quantity to add"
                className="w-full bg-gray-600 px-3 py-2 rounded"
              />
              <div className="flex gap-2">
                <button onClick={addMat} className="flex-1 bg-green-600 px-4 py-2 rounded">
                  <Save size={20} className="inline" /> {useExistingMat ? 'Add to Existing' : 'Save'}
                </button>
                <button
                  onClick={() => {
                    setShowAddMat(false);
                    setUseExistingMat(false);
                    setSelectedExistingMatId('');
                    setNewMatName('');
                    setNewMatQty('');
                    setNewMatType('');
                  }}
                  className="bg-red-600 px-4 py-2 rounded"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
          )}
          <div className="space-y-2">
            {materials.map(m => (
              <div key={m.id} className="bg-gray-700 rounded">
                <div className="flex items-center gap-4 p-3 cursor-pointer hover:bg-gray-600" onClick={() => setExpanded(p => ({...p, [`mat-${m.id}`]: !p[`mat-${m.id}`]}))}>
                  <span className="flex-1">{m.name}</span>
                  <span className="text-blue-400 text-sm">{m.type || 'no type'}</span>
                  <span className="text-gray-400">{m.quantity} lbs</span>
                  <span className="text-gray-400">{expanded[`mat-${m.id}`] ? '▼' : '▶'}</span>
                </div>
                {expanded[`mat-${m.id}`] && (
                  <div className="px-3 pb-3 space-y-3 border-t border-gray-600 pt-3">
                    <div className="flex gap-4 items-end">
                      <div className="flex-1">
                        <label className="block text-xs text-gray-400 mb-1">Name</label>
                        <input value={m.name} onChange={(e) => saveMaterials(materials.map(x => x.id === m.id ? {...x, name: e.target.value} : x))} className="w-full bg-gray-600 px-3 py-1 rounded" />
                      </div>
                      <div className="w-32">
                        <label className="block text-xs text-gray-400 mb-1">Quantity</label>
                        <input type="number" value={m.quantity} onChange={(e) => saveMaterials(materials.map(x => x.id === m.id ? {...x, quantity: Math.max(0, toNumberOr(e.target.value, m.quantity))} : x))} className="w-full bg-gray-600 px-3 py-1 rounded" />
                      </div>
                      <span className="text-gray-400 pb-1">lbs</span>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Type {!gmMode && <span className="text-yellow-400">(GM mode required to edit)</span>}</label>
                      <select
                        value={m.type || ''}
                        onChange={(e) => saveMaterials(materials.map(x => x.id === m.id ? {...x, type: e.target.value} : x))}
                        className="w-full bg-gray-600 px-3 py-1 rounded"
                        disabled={!gmMode}
                      >
                        <option value="">No Type</option>
                        {materialTypes.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                      </select>
                    </div>
                    <button onClick={() => setDeleteConfirm({type:'mat', id:m.id, name:m.name})} className="w-full bg-red-600 py-2 rounded text-sm"><Trash2 size={16} className="inline" /> Delete</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {view === 'foods' && (
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex justify-between mb-4">
            <h2 className="text-xl font-bold">Food Supplies</h2>
            <button onClick={() => setShowAddFood(!showAddFood)} className="bg-green-600 px-4 py-2 rounded"><Plus size={20} className="inline" /> Add</button>
          </div>
          {showAddFood && (
            <div className="bg-gray-700 p-4 rounded mb-4 space-y-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={useExistingFood}
                  onChange={(e) => {
                    setUseExistingFood(e.target.checked);
                    if (e.target.checked) {
                      setNewFoodName('');
                      setNewFoodTypes([]);
                    } else {
                      setSelectedExistingFoodId('');
                    }
                  }}
                  className="w-4 h-4"
                />
                Use existing food
              </label>
              {useExistingFood ? (
                <>
                  <select
                    value={selectedExistingFoodId}
                    onChange={(e) => setSelectedExistingFoodId(e.target.value)}
                    className="w-full bg-gray-600 px-3 py-2 rounded"
                  >
                    <option value="">Select food...</option>
                    {foods
                      .filter(f => newFoodTypes.length === 0 || newFoodTypes.some(t => f.types?.includes(t)))
                      .map(f => (
                        <option key={f.id} value={f.id}>
                          {f.name} ({f.types?.join(', ') || 'no type'}) - {f.quantity} lbs
                        </option>
                      ))}
                  </select>
                  {newFoodTypes.length > 0 && (
                    <div className="text-xs text-gray-400">
                      Showing foods with selected types
                    </div>
                  )}
                </>
              ) : (
                <>
                  <input
                    value={newFoodName}
                    onChange={(e) => setNewFoodName(e.target.value)}
                    placeholder="Name"
                    className="w-full bg-gray-600 px-3 py-2 rounded"
                  />
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm">Types (required):</span>
                      {newFoodTypes.length < 4 && <button onClick={() => {
                        const firstType = typeof foodTypes[0] === 'string' ? foodTypes[0] : (foodTypes[0] as FoodType).name;
                        setNewFoodTypes([...newFoodTypes, firstType]);
                      }} className="bg-blue-600 px-3 py-1 rounded text-sm"><Plus size={14} className="inline" /> Add</button>}
                    </div>
                    {newFoodTypes.map((t, i) => (
                      <div key={i} className="flex gap-2 mb-2">
                        <select value={t} onChange={(e) => { const u = [...newFoodTypes]; u[i] = e.target.value; setNewFoodTypes(u); }} className="flex-1 bg-gray-600 px-3 py-1 rounded">
                          {foodTypes.map(ft => {
                            const ftName = typeof ft === 'string' ? ft : ft.name;
                            const ftColor = typeof ft === 'object' ? ft.color : '#60A5FA';
                            return <option key={ftName} value={ftName} style={{color: ftColor}}>{ftName}</option>;
                          })}
                        </select>
                        <button onClick={() => setNewFoodTypes(newFoodTypes.filter((_, j) => j !== i))} className="text-red-400"><X size={18} /></button>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <input
                type="number"
                value={newFoodQty}
                onChange={(e) => setNewFoodQty(e.target.value)}
                placeholder="Quantity to add"
                className="w-full bg-gray-600 px-3 py-2 rounded"
              />
              <div className="flex gap-2">
                <button onClick={addFood} className="flex-1 bg-green-600 py-2 rounded">
                  {useExistingFood ? 'Add to Existing' : 'Save'}
                </button>
                <button
                  onClick={() => {
                    setShowAddFood(false);
                    setUseExistingFood(false);
                    setSelectedExistingFoodId('');
                    setNewFoodName('');
                    setNewFoodQty('');
                    setNewFoodTypes([]);
                  }}
                  className="bg-red-600 px-4 py-2 rounded"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
          )}
          <div className="space-y-4">
            {Object.keys(grouped).sort().map(k => {
              const firstItemTypes = grouped[k][0]?.types || [];
              const typeColor = firstItemTypes.length > 0 ? (() => {
                const firstTypeName = firstItemTypes[0];
                const typeObj = foodTypes.find(ft => (typeof ft === 'string' ? ft : ft.name) === firstTypeName);
                return typeof typeObj === 'object' ? (typeObj as FoodType).color : '#60A5FA';
              })() : '#60A5FA';

              return (<div key={k}>
                <div className="bg-gray-700 px-4 py-2 rounded font-semibold text-sm" style={{color: typeColor}}>{k === 'no-type' ? 'No Type' : k}</div>
                {grouped[k].map(f => (
                  <div key={f.id} className="bg-gray-700 rounded mt-2">
                    <div className="flex items-center gap-4 p-3 cursor-pointer hover:bg-gray-600" onClick={() => setExpanded(p => ({...p, [f.id]: !p[f.id]}))}>
                      <span className="flex-1 flex items-center gap-2">
                        {f.name}
                        <span className="flex gap-1">
                          {f.types?.map((typeName, idx) => {
                            const typeObj = foodTypes.find(ft => (typeof ft === 'string' ? ft : ft.name) === typeName);
                            const color = typeof typeObj === 'object' ? (typeObj as FoodType).color : '#60A5FA';
                            return <span key={idx} className="w-3 h-3 rounded-full" style={{backgroundColor: color}} title={typeName}></span>;
                          })}
                        </span>
                      </span>
                      <span className="text-gray-400">{f.quantity} lbs</span>
                      <span className="text-gray-400">{expanded[f.id] ? '▼' : '▶'}</span>
                    </div>
                    {expanded[f.id] && (
                      <div className="px-3 pb-3 space-y-3 border-t border-gray-600 pt-3">
                        <div className="flex gap-4">
                          <input value={f.name} onChange={(e) => saveFoods(foods.map(x => x.id === f.id ? {...x, name: e.target.value} : x))} className="flex-1 bg-gray-600 px-3 py-1 rounded" />
                          <input type="number" value={f.quantity} onChange={(e) => saveFoods(foods.map(x => x.id === f.id ? {...x, quantity: Math.max(0, toNumberOr(e.target.value, f.quantity))} : x))} className="w-24 bg-gray-600 px-3 py-1 rounded" />
                          <span>lbs</span>
                          <button onClick={() => setDeleteConfirm({type:'food', id:f.id, name:f.name})} className="text-red-400"><Trash2 size={20} /></button>
                        </div>
                        <div>
                          <div className="flex gap-2 mb-2">
                            <span className="text-sm">Types: {!gmMode && <span className="text-yellow-400">(GM mode required to edit)</span>}</span>
                            {gmMode && (f.types || []).length < 4 && <button onClick={() => {
                              const firstType = typeof foodTypes[0] === 'string' ? foodTypes[0] : (foodTypes[0] as FoodType).name;
                              saveFoods(foods.map(x => x.id === f.id ? {...x, types: [...(x.types || []), firstType]} : x));
                            }} className="bg-blue-600 px-3 py-1 text-sm rounded"><Plus size={14} className="inline" /> Add</button>}
                          </div>
                          {(f.types || []).map((t, i) => {
                            const selectedType = foodTypes.find(ft => (typeof ft === 'string' ? ft : ft.name) === t);
                            const selectedColor = typeof selectedType === 'object' ? (selectedType as FoodType).color : '#60A5FA';

                            return (<div key={i} className="flex gap-2 mb-2 items-center">
                              <span className="w-4 h-4 rounded-full flex-shrink-0" style={{backgroundColor: selectedColor}} title={t}></span>
                              <select
                                value={t}
                                onChange={(e) => saveFoods(foods.map(x => { if (x.id === f.id) { const nt = [...(x.types || [])]; nt[i] = e.target.value; return {...x, types: nt}; } return x; }))}
                                className="flex-1 bg-gray-600 px-3 py-1 rounded"
                                disabled={!gmMode}
                              >
                                {foodTypes.map(ft => {
                                  const ftName = typeof ft === 'string' ? ft : ft.name;
                                  const ftColor = typeof ft === 'object' ? ft.color : '#60A5FA';
                                  return <option key={ftName} value={ftName} style={{color: ftColor}}>{ftName}</option>;
                                })}
                              </select>
                              {gmMode && <button onClick={() => saveFoods(foods.map(x => x.id === f.id ? {...x, types: (x.types || []).filter((_, j) => j !== i)} : x))} className="text-red-400"><X size={18} /></button>}
                            </div>);
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>);
            })}
          </div>
        </div>
      )}

      {view === 'stash' && (
        <PartyStashView
          inventories={inventories}
          characters={characters}
          toolTemplates={toolTemplates}
          transferState={transferState}
          setTransferState={setTransferState}
          actions={actions}
        />
      )}
    </div>
  );
}

// ============================================================================
// PartyStashView Component
// ============================================================================

/**
 * Helper function to get inventory label
 */
function getInventoryLabel(inventory: Inventory, characters: Record<string, Character>): string {
  if (inventory.ownerType === 'party') {
    return 'Party Stash';
  }
  if (inventory.ownerId && characters[inventory.ownerId]?.name) {
    return `${characters[inventory.ownerId].name}'s Pack`;
  }
  return 'Unknown Inventory';
}

interface PartyStashViewProps {
  inventories: Inventory[];
  characters: Record<string, Character>;
  toolTemplates: Record<string, ToolTemplate>;
  transferState: TransferState | null;
  setTransferState: (state: TransferState | null) => void;
  actions: ReturnType<typeof useCampaignStore>['actions'];
}

/**
 * PartyStashView - Displays all inventories (party stash + character packs)
 * with items, tools, and currency. Allows transfers between inventories.
 *
 * Part of Phase 3: Activities Panel Simplification
 * Migrated from PartyToolApp.jsx Inventories tab
 */
function PartyStashView({
  inventories,
  characters,
  toolTemplates,
  transferState,
  setTransferState,
  actions,
}: PartyStashViewProps) {
  // Filter to only show party-owned inventories (not character packs)
  const partyInventories = useMemo(
    () => inventories.filter((inv) => inv.ownerType === 'party'),
    [inventories]
  );

  /**
   * Handle transfer between inventories
   */
  const handleTransfer = useCallback(() => {
    if (!transferState || !transferState.targetInventoryId) {
      alert('Select a destination inventory');
      return;
    }

    const sourceInv = inventories.find(inv => inv.id === transferState.sourceInventoryId);
    const targetInv = inventories.find(inv => inv.id === transferState.targetInventoryId);

    if (!sourceInv || !targetInv) {
      alert('Invalid source or target inventory');
      return;
    }

    // Create updated inventories
    let updatedSource = { ...sourceInv };
    let updatedTarget = { ...targetInv };

    if (transferState.type === 'item' && transferState.itemId) {
      const itemIndex = updatedSource.items.findIndex(item => item.id === transferState.itemId);
      if (itemIndex === -1) {
        alert('Item not found in source inventory');
        return;
      }
      const [item] = updatedSource.items.splice(itemIndex, 1);
      updatedTarget.items = [...updatedTarget.items, item];
    } else if (transferState.type === 'tool' && transferState.toolId) {
      const toolIndex = updatedSource.tools.findIndex(tool => tool.toolId === transferState.toolId);
      if (toolIndex === -1) {
        alert('Tool not found in source inventory');
        return;
      }
      const [tool] = updatedSource.tools.splice(toolIndex, 1);
      updatedTarget.tools = [...updatedTarget.tools, tool];
    } else if (transferState.type === 'currency' && transferState.currencyKey) {
      const amount = parseInt(transferState.amount || '0', 10);
      if (amount <= 0) {
        alert('Enter a valid amount');
        return;
      }
      const available = updatedSource.currency[transferState.currencyKey] || 0;
      if (amount > available) {
        alert(`Not enough ${transferState.currencyKey}. Available: ${available}`);
        return;
      }
      updatedSource.currency = {
        ...updatedSource.currency,
        [transferState.currencyKey]: available - amount,
      };
      updatedTarget.currency = {
        ...updatedTarget.currency,
        [transferState.currencyKey]: (updatedTarget.currency[transferState.currencyKey] || 0) + amount,
      };
    }

    // Update state through actions
    actions.updateInventory(updatedSource.id, {
      items: updatedSource.items,
      tools: updatedSource.tools,
      currency: updatedSource.currency,
    });
    actions.updateInventory(updatedTarget.id, {
      items: updatedTarget.items,
      tools: updatedTarget.tools,
      currency: updatedTarget.currency,
    });

    // Log the transfer
    const sourceLabel = getInventoryLabel(sourceInv, characters);
    const targetLabel = getInventoryLabel(targetInv, characters);
    if (transferState.type === 'item' && transferState.itemId) {
      const item = sourceInv.items.find(i => i.id === transferState.itemId);
      actions.addLogEntry(inventoryLog.itemTransferred(
        item?.name || 'Unknown',
        sourceLabel,
        targetLabel,
        item?.quantity
      ));
    } else if (transferState.type === 'tool' && transferState.toolId) {
      const tool = sourceInv.tools.find(t => t.toolId === transferState.toolId);
      const template = toolTemplates[tool?.templateId || ''];
      actions.addLogEntry(inventoryLog.itemTransferred(
        template?.name || 'Unknown Tool',
        sourceLabel,
        targetLabel
      ));
    } else if (transferState.type === 'currency' && transferState.currencyKey) {
      const amount = parseInt(transferState.amount || '0', 10);
      actions.addLogEntry(inventoryLog.currencyTransferred(
        amount,
        transferState.currencyKey,
        sourceLabel,
        targetLabel
      ));
    }

    setTransferState(null);
  }, [transferState, inventories, actions, setTransferState, characters, toolTemplates]);

  return (
    <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      {/* Inventories List */}
      <div className="space-y-6">
        {partyInventories.map((inventory) => (
          <div
            key={inventory.id}
            className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">
                {getInventoryLabel(inventory, characters)}
              </h3>
              <span className="text-xs text-slate-400">{inventory.id}</span>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {/* Items Column */}
              <div>
                <h4 className="text-sm font-semibold text-slate-300">Items</h4>
                <ul className="mt-2 space-y-2 text-sm text-slate-200">
                  {inventory.items.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2"
                    >
                      <span>
                        {item.name} <span className="text-slate-400">x{item.quantity}</span>
                      </span>
                      <button
                        onClick={() =>
                          setTransferState({
                            type: 'item',
                            itemId: item.id,
                            sourceInventoryId: inventory.id,
                            targetInventoryId: '',
                          })
                        }
                        className="rounded-full bg-indigo-500/20 px-3 py-1 text-xs text-indigo-200 hover:bg-indigo-500/30"
                      >
                        Transfer
                      </button>
                    </li>
                  ))}
                  {inventory.items.length === 0 && (
                    <li className="text-xs text-slate-500">No items.</li>
                  )}
                </ul>
              </div>

              {/* Tools Column */}
              <div>
                <h4 className="text-sm font-semibold text-slate-300">Tools</h4>
                <ul className="mt-2 space-y-2 text-sm text-slate-200">
                  {inventory.tools.map((tool) => {
                    const template = toolTemplates[tool.templateId];
                    return (
                      <li
                        key={tool.toolId}
                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2"
                      >
                        <span>
                          {template?.name ?? 'Unknown Tool'}
                          <span className="text-slate-400"> ({tool.conditionId})</span>
                        </span>
                        <button
                          onClick={() =>
                            setTransferState({
                              type: 'tool',
                              toolId: tool.toolId,
                              sourceInventoryId: inventory.id,
                              targetInventoryId: '',
                            })
                          }
                          className="rounded-full bg-indigo-500/20 px-3 py-1 text-xs text-indigo-200 hover:bg-indigo-500/30"
                        >
                          Transfer
                        </button>
                      </li>
                    );
                  })}
                  {inventory.tools.length === 0 && (
                    <li className="text-xs text-slate-500">No tools.</li>
                  )}
                </ul>
              </div>

              {/* Currency Column */}
              <div>
                <h4 className="text-sm font-semibold text-slate-300">Currency</h4>
                <ul className="mt-2 space-y-2 text-sm text-slate-200">
                  {Object.entries(inventory.currency).map(([currencyKey, amount]) => (
                    <li
                      key={currencyKey}
                      className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2"
                    >
                      <span>
                        {currencyKey}: <span className="text-slate-400">{amount}</span>
                      </span>
                      <button
                        onClick={() =>
                          setTransferState({
                            type: 'currency',
                            currencyKey,
                            amount: '',
                            sourceInventoryId: inventory.id,
                            targetInventoryId: '',
                          })
                        }
                        className="rounded-full bg-indigo-500/20 px-3 py-1 text-xs text-indigo-200 hover:bg-indigo-500/30"
                      >
                        Transfer
                      </button>
                    </li>
                  ))}
                  {Object.keys(inventory.currency).length === 0 && (
                    <li className="text-xs text-slate-500">No currency.</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        ))}
        {partyInventories.length === 0 && (
          <div className="text-center text-slate-400 py-8">
            No party stash found.
          </div>
        )}
      </div>

      {/* Transfer Console */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 h-fit">
        <h3 className="text-lg font-semibold text-white">Transfer Console</h3>
        {!transferState && (
          <p className="mt-3 text-sm text-slate-400">
            Select an item, tool, or currency to initiate a transfer between inventories.
          </p>
        )}
        {transferState && (
          <div className="mt-4 space-y-4 text-sm text-slate-200">
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2">
              <p className="text-xs uppercase text-slate-400">Source</p>
              <p>{getInventoryLabel(
                inventories.find(inv => inv.id === transferState.sourceInventoryId) || {} as Inventory,
                characters
              )}</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2">
              <p className="text-xs uppercase text-slate-400">Transferring</p>
              <p className="flex items-center gap-2">
                {transferState.type === 'item' && 'Item'}
                {transferState.type === 'tool' && 'Tool'}
                {transferState.type === 'currency' && `Currency: ${transferState.currencyKey}`}
                <ArrowRight size={14} className="text-slate-400" />
              </p>
            </div>
            <label className="flex flex-col gap-2">
              Target Inventory
              <select
                value={transferState.targetInventoryId}
                onChange={(event) =>
                  setTransferState({
                    ...transferState,
                    targetInventoryId: event.target.value,
                  })
                }
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
              >
                <option value="">Select destination</option>
                {partyInventories
                  .filter((inv) => inv.id !== transferState.sourceInventoryId)
                  .map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {getInventoryLabel(inv, characters)}
                    </option>
                  ))}
              </select>
            </label>
            {transferState.type === 'currency' && (
              <label className="flex flex-col gap-2">
                Amount
                <input
                  type="number"
                  value={transferState.amount || ''}
                  onChange={(event) =>
                    setTransferState({ ...transferState, amount: event.target.value })
                  }
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
                />
              </label>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleTransfer}
                className="flex-1 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
              >
                Confirm Transfer
              </button>
              <button
                onClick={() => setTransferState(null)}
                className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
