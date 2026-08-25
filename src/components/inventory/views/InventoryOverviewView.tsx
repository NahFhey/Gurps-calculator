import type { Dispatch, SetStateAction } from 'react';
import { Plus, Save, Trash2, X } from 'lucide-react';
import { toNumberOr } from '../../../utils/helpers';
import type {
  DeleteConfirm,
  Food,
  FoodType,
  Material,
  MaterialType,
} from '../types';

export interface InventoryOverviewViewProps {
  view: 'materials' | 'foods';
  materials: Material[];
  foods: Food[];
  foodTypes: Array<string | FoodType>;
  materialTypes: MaterialType[];
  gmMode: boolean;
  showAddMat: boolean;
  setShowAddMat: Dispatch<SetStateAction<boolean>>;
  showAddFood: boolean;
  setShowAddFood: Dispatch<SetStateAction<boolean>>;
  useExistingMat: boolean;
  setUseExistingMat: Dispatch<SetStateAction<boolean>>;
  useExistingFood: boolean;
  setUseExistingFood: Dispatch<SetStateAction<boolean>>;
  selectedExistingMatId: string;
  setSelectedExistingMatId: Dispatch<SetStateAction<string>>;
  selectedExistingFoodId: string;
  setSelectedExistingFoodId: Dispatch<SetStateAction<string>>;
  newMatName: string;
  setNewMatName: Dispatch<SetStateAction<string>>;
  newMatQty: string;
  setNewMatQty: Dispatch<SetStateAction<string>>;
  newMatType: string;
  setNewMatType: Dispatch<SetStateAction<string>>;
  newFoodName: string;
  setNewFoodName: Dispatch<SetStateAction<string>>;
  newFoodQty: string;
  setNewFoodQty: Dispatch<SetStateAction<string>>;
  newFoodTypes: string[];
  setNewFoodTypes: Dispatch<SetStateAction<string[]>>;
  expanded: Record<string, boolean>;
  setExpanded: Dispatch<SetStateAction<Record<string, boolean>>>;
  deleteConfirm: DeleteConfirm | null;
  setDeleteConfirm: Dispatch<SetStateAction<DeleteConfirm | null>>;
  onAddMaterial: () => void;
  onAddFood: () => void;
  onSaveMaterials: (materials: Material[]) => void;
  onSaveFoods: (foods: Food[]) => void;
}

export function InventoryOverviewView({
  view,
  materials,
  foods,
  foodTypes,
  materialTypes,
  gmMode,
  showAddMat,
  setShowAddMat,
  showAddFood,
  setShowAddFood,
  useExistingMat,
  setUseExistingMat,
  useExistingFood,
  setUseExistingFood,
  selectedExistingMatId,
  setSelectedExistingMatId,
  selectedExistingFoodId,
  setSelectedExistingFoodId,
  newMatName,
  setNewMatName,
  newMatQty,
  setNewMatQty,
  newMatType,
  setNewMatType,
  newFoodName,
  setNewFoodName,
  newFoodQty,
  setNewFoodQty,
  newFoodTypes,
  setNewFoodTypes,
  expanded,
  setExpanded,
  deleteConfirm,
  setDeleteConfirm,
  onAddMaterial,
  onAddFood,
  onSaveMaterials,
  onSaveFoods,
}: InventoryOverviewViewProps) {
  const grouped = foods.reduce((groups: Record<string, Food[]>, food) => {
    const key = food.types?.length > 0 ? [...food.types].sort().join('/') : 'no-type';
    if (!groups[key]) groups[key] = [];
    groups[key].push(food);
    return groups;
  }, {});

  return (
    <>
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg max-w-md">
            <h3 className="text-xl font-bold mb-4">Confirm Delete</h3>
            <p className="mb-6">Delete "{deleteConfirm.name}"?</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 bg-gray-600 rounded">Cancel</button>
              <button onClick={() => {
                if (deleteConfirm.type === 'mat') onSaveMaterials(materials.filter(m => m.id !== deleteConfirm.id));
                else onSaveFoods(foods.filter(f => f.id !== deleteConfirm.id));
                setDeleteConfirm(null);
              }} className="px-4 py-2 bg-red-600 rounded">Delete</button>
            </div>
          </div>
        </div>
      )}

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
                <button onClick={onAddMaterial} className="flex-1 bg-green-600 px-4 py-2 rounded">
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
                        <input value={m.name} onChange={(e) => onSaveMaterials(materials.map(x => x.id === m.id ? {...x, name: e.target.value} : x))} className="w-full bg-gray-600 px-3 py-1 rounded" />
                      </div>
                      <div className="w-32">
                        <label className="block text-xs text-gray-400 mb-1">Quantity</label>
                        <input type="number" value={m.quantity} onChange={(e) => onSaveMaterials(materials.map(x => x.id === m.id ? {...x, quantity: Math.max(0, toNumberOr(e.target.value, m.quantity))} : x))} className="w-full bg-gray-600 px-3 py-1 rounded" />
                      </div>
                      <span className="text-gray-400 pb-1">lbs</span>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Type {!gmMode && <span className="text-yellow-400">(GM mode required to edit)</span>}</label>
                      <select
                        value={m.type || ''}
                        onChange={(e) => onSaveMaterials(materials.map(x => x.id === m.id ? {...x, type: e.target.value} : x))}
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
                        const firstType = typeof foodTypes[0] === 'string' ? foodTypes[0] : foodTypes[0].name;
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
                <button onClick={onAddFood} className="flex-1 bg-green-600 py-2 rounded">
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
                return typeof typeObj === 'object' ? typeObj.color : '#60A5FA';
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
                            const color = typeof typeObj === 'object' ? typeObj.color : '#60A5FA';
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
                          <input value={f.name} onChange={(e) => onSaveFoods(foods.map(x => x.id === f.id ? {...x, name: e.target.value} : x))} className="flex-1 bg-gray-600 px-3 py-1 rounded" />
                          <input type="number" value={f.quantity} onChange={(e) => onSaveFoods(foods.map(x => x.id === f.id ? {...x, quantity: Math.max(0, toNumberOr(e.target.value, f.quantity))} : x))} className="w-24 bg-gray-600 px-3 py-1 rounded" />
                          <span>lbs</span>
                          <button onClick={() => setDeleteConfirm({type:'food', id:f.id, name:f.name})} className="text-red-400"><Trash2 size={20} /></button>
                        </div>
                        <div>
                          <div className="flex gap-2 mb-2">
                            <span className="text-sm">Types: {!gmMode && <span className="text-yellow-400">(GM mode required to edit)</span>}</span>
                            {gmMode && (f.types || []).length < 4 && <button onClick={() => {
                              const firstType = typeof foodTypes[0] === 'string' ? foodTypes[0] : foodTypes[0].name;
                              onSaveFoods(foods.map(x => x.id === f.id ? {...x, types: [...(x.types || []), firstType]} : x));
                            }} className="bg-blue-600 px-3 py-1 text-sm rounded"><Plus size={14} className="inline" /> Add</button>}
                          </div>
                          {(f.types || []).map((t, i) => {
                            const selectedType = foodTypes.find(ft => (typeof ft === 'string' ? ft : ft.name) === t);
                            const selectedColor = typeof selectedType === 'object' ? selectedType.color : '#60A5FA';

                            return (<div key={i} className="flex gap-2 mb-2 items-center">
                              <span className="w-4 h-4 rounded-full flex-shrink-0" style={{backgroundColor: selectedColor}} title={t}></span>
                              <select
                                value={t}
                                onChange={(e) => onSaveFoods(foods.map(x => { if (x.id === f.id) { const nt = [...(x.types || [])]; nt[i] = e.target.value; return {...x, types: nt}; } return x; }))}
                                className="flex-1 bg-gray-600 px-3 py-1 rounded"
                                disabled={!gmMode}
                              >
                                {foodTypes.map(ft => {
                                  const ftName = typeof ft === 'string' ? ft : ft.name;
                                  const ftColor = typeof ft === 'object' ? ft.color : '#60A5FA';
                                  return <option key={ftName} value={ftName} style={{color: ftColor}}>{ftName}</option>;
                                })}
                              </select>
                              {gmMode && <button onClick={() => onSaveFoods(foods.map(x => x.id === f.id ? {...x, types: (x.types || []).filter((_, j) => j !== i)} : x))} className="text-red-400"><X size={18} /></button>}
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
    </>
  );
}
