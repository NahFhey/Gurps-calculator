import React, { useState, useMemo } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp, Package, PackageMinus, Check } from 'lucide-react';
import type { Equipment, EquipmentCategory } from '../../types/characterSheet';

interface EquipmentSectionProps {
  equipment: Equipment[];
  otherEquipment: string;
  editMode: boolean;
  onEquipmentChange: (equipment: Equipment[]) => void;
  onOtherEquipmentChange: (other: string) => void;
  onDemote?: (equipmentId: string) => void;
  currencyUnit?: string;
}

type SortField = 'name' | 'quantity' | 'weight' | 'cost' | 'equipped';
type SortDir = 'asc' | 'desc';

const EQUIPMENT_CATEGORIES: { value: EquipmentCategory; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'weapon', label: 'Weapon' },
  { value: 'armor', label: 'Armor' },
  { value: 'shield', label: 'Shield' },
  { value: 'ammo', label: 'Ammo' },
];

/** Hit locations available for armor assignment */
const HIT_LOCATIONS = [
  'skull', 'face', 'neck', 'torso', 'vitals', 'groin',
  'right arm', 'left arm', 'right leg', 'left leg',
  'right hand', 'left hand', 'right foot', 'left foot',
];

export function EquipmentSection({
  equipment,
  otherEquipment,
  editMode,
  onEquipmentChange,
  onOtherEquipmentChange,
  onDemote,
  currencyUnit = 'cp',
}: EquipmentSectionProps) {
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const sortedEquipment = useMemo(() => {
    return [...equipment].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name':
          cmp = a.name.localeCompare(b.name);
          break;
        case 'quantity':
          cmp = a.quantity - b.quantity;
          break;
        case 'weight':
          cmp = (a.weight * a.quantity) - (b.weight * b.quantity);
          break;
        case 'cost':
          cmp = (a.cost * a.quantity) - (b.cost * b.quantity);
          break;
        case 'equipped':
          cmp = (a.equipped === false ? 0 : 1) - (b.equipped === false ? 0 : 1);
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [equipment, sortField, sortDir]);

  const totals = useMemo(() => {
    return equipment.reduce(
      (acc, item) => ({
        weight: acc.weight + item.weight * item.quantity,
        cost: acc.cost + item.cost * item.quantity,
        equippedWeight: acc.equippedWeight + (item.equipped !== false ? item.weight * item.quantity : 0),
      }),
      { weight: 0, cost: 0, equippedWeight: 0 }
    );
  }, [equipment]);

  const handleAdd = () => {
    const newItem: Equipment = {
      id: `equip-${Date.now()}`,
      name: '',
      quantity: 1,
      weight: 0,
      cost: 0,
      equipped: true,
      category: 'general',
    };
    onEquipmentChange([...equipment, newItem]);
  };

  const handleRemove = (id: string) => {
    onEquipmentChange(equipment.filter((e) => e.id !== id));
  };

  const handleChange = (id: string, updates: Partial<Equipment>) => {
    onEquipmentChange(
      equipment.map((e) => (e.id === id ? { ...e, ...updates } : e))
    );
  };

  const handleToggleEquipped = (id: string) => {
    onEquipmentChange(
      equipment.map((e) => (e.id === id ? { ...e, equipped: e.equipped === false ? true : false } : e))
    );
  };

  const handleToggleDRLocation = (id: string, location: string) => {
    const item = equipment.find((e) => e.id === id);
    if (!item) return;
    const current = item.drLocations || [];
    const updated = current.includes(location)
      ? current.filter((l) => l !== location)
      : [...current, location];
    handleChange(id, { drLocations: updated });
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  const isArmorOrShield = (item: Equipment) => item.category === 'armor' || item.category === 'shield';

  return (
    <div className="bg-surface-1 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Package size={20} className="text-warning-400" />
          <h3 className="text-lg font-semibold text-fg-bright">
            Equipment <span className="text-sm text-fg-muted">({equipment.length})</span>
          </h3>
        </div>
        {editMode && (
          <button
            onClick={handleAdd}
            className="flex items-center gap-1 px-2 py-1 bg-surface-2 hover:bg-surface-3 rounded text-sm"
          >
            <Plus size={14} />
            Add Item
          </button>
        )}
      </div>

      {equipment.length === 0 ? (
        <div className="text-fg-faint italic mb-4">No equipment</div>
      ) : (
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-fg-muted border-b border-edge">
                <th
                  className="pb-2 cursor-pointer hover:text-fg-primary w-10 text-center"
                  onClick={() => handleSort('equipped')}
                  title="Equipped"
                >
                  <div className="flex items-center justify-center gap-1">
                    E <SortIcon field="equipped" />
                  </div>
                </th>
                <th
                  className="pb-2 cursor-pointer hover:text-fg-primary w-12 text-center"
                  onClick={() => handleSort('quantity')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Qty <SortIcon field="quantity" />
                  </div>
                </th>
                <th
                  className="pb-2 cursor-pointer hover:text-fg-primary"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-1">
                    Item <SortIcon field="name" />
                  </div>
                </th>
                <th
                  className="pb-2 cursor-pointer hover:text-fg-primary w-24 text-right"
                  onClick={() => handleSort('cost')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Cost ({currencyUnit}) <SortIcon field="cost" />
                  </div>
                </th>
                <th
                  className="pb-2 cursor-pointer hover:text-fg-primary w-24 text-right"
                  onClick={() => handleSort('weight')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Weight <SortIcon field="weight" />
                  </div>
                </th>
                {(editMode || onDemote) && <th className="pb-2 w-20"></th>}
              </tr>
            </thead>
            <tbody>
              {sortedEquipment.map((item) => (
                <React.Fragment key={item.id}>
                  <tr
                    className={`border-b border-edge/50 hover:bg-surface-2/30 ${
                      item.equipped === false ? 'opacity-50' : ''
                    }`}
                  >
                    {/* Equipped toggle */}
                    <td className="py-1.5 text-center">
                      <button
                        onClick={() => handleToggleEquipped(item.id)}
                        className={`w-5 h-5 rounded border inline-flex items-center justify-center ${
                          item.equipped !== false
                            ? 'bg-success-600 border-success-500 text-white'
                            : 'bg-surface-2 border-edge-strong text-fg-faint'
                        }`}
                        title={item.equipped !== false ? 'Equipped' : 'Not equipped'}
                      >
                        {item.equipped !== false && <Check size={12} />}
                      </button>
                    </td>
                    <td className="py-1.5 text-center">
                      {editMode ? (
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => handleChange(item.id, { quantity: parseInt(e.target.value) || 1 })}
                          className="w-12 bg-surface-2 border border-edge-strong rounded px-1 py-0.5 text-fg-bright text-center"
                          min={1}
                        />
                      ) : (
                        <span className="text-fg-secondary">{item.quantity}</span>
                      )}
                    </td>
                    <td className="py-1.5">
                      {editMode ? (
                        <div className="flex gap-1 items-center">
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => handleChange(item.id, { name: e.target.value })}
                            placeholder="Item name"
                            className="flex-1 bg-surface-2 border border-edge-strong rounded px-2 py-0.5 text-fg-bright"
                          />
                          <button
                            onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                            className="p-0.5 hover:bg-surface-3 rounded text-fg-muted"
                            title="Expand details"
                          >
                            {expandedId === item.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </div>
                      ) : (
                        <div>
                          <span className="text-fg-primary">{item.name}</span>
                          {item.category && item.category !== 'general' && (
                            <span className="ml-1 text-xs px-1 rounded bg-surface-2 text-fg-muted">
                              {item.category}
                            </span>
                          )}
                          {item.dr !== undefined && item.dr > 0 && (
                            <span className="ml-1 text-xs text-accent-400">DR{item.dr}</span>
                          )}
                          {item.damage && (
                            <span className="ml-1 text-xs text-danger-400">{item.damage}</span>
                          )}
                          {item.db !== undefined && item.db > 0 && (
                            <span className="ml-1 text-xs text-cyan-400">DB{item.db}</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-1.5 text-right">
                      {editMode ? (
                        <input
                          type="number"
                          value={item.cost}
                          onChange={(e) => handleChange(item.id, { cost: parseFloat(e.target.value) || 0 })}
                          className="w-20 bg-surface-2 border border-edge-strong rounded px-1 py-0.5 text-fg-bright text-right"
                          min={0}
                        />
                      ) : (
                        <span className="text-success-400">{currencyUnit} {item.cost * item.quantity}</span>
                      )}
                    </td>
                    <td className="py-1.5 text-right">
                      {editMode ? (
                        <input
                          type="number"
                          value={item.weight}
                          onChange={(e) => handleChange(item.id, { weight: parseFloat(e.target.value) || 0 })}
                          className="w-16 bg-surface-2 border border-edge-strong rounded px-1 py-0.5 text-fg-bright text-right"
                          min={0}
                          step={0.1}
                        />
                      ) : (
                        <span className="text-fg-muted">{(item.weight * item.quantity).toFixed(1)} lb</span>
                      )}
                    </td>
                    {(editMode || onDemote) && (
                      <td className="py-1.5">
                        <div className="flex justify-end gap-1">
                          {onDemote && (
                            <button
                              onClick={() => onDemote(item.id)}
                              className="p-1 hover:bg-surface-3 rounded text-warning-300"
                              title="Send to pack"
                              aria-label={`Send ${item.name} to pack`}
                            >
                              <PackageMinus size={14} />
                            </button>
                          )}
                          {editMode && (
                            <button
                              onClick={() => handleRemove(item.id)}
                              className="p-1 hover:bg-surface-3 rounded text-danger-400"
                              title="Remove"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                  {/* Expanded detail row (edit mode only) */}
                  {editMode && expandedId === item.id && (
                    <tr className="bg-surface-2">
                      <td colSpan={6} className="px-4 py-2">
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          {/* Category */}
                          <div>
                            <label className="text-xs text-fg-muted block mb-1">Category</label>
                            <select
                              value={item.category || 'general'}
                              onChange={(e) => handleChange(item.id, { category: e.target.value as EquipmentCategory })}
                              className="w-full bg-surface-2 border border-edge-strong rounded px-2 py-1 text-fg-bright"
                            >
                              {EQUIPMENT_CATEGORIES.map((cat) => (
                                <option key={cat.value} value={cat.value}>{cat.label}</option>
                              ))}
                            </select>
                          </div>
                          {/* Location (general) */}
                          <div>
                            <label className="text-xs text-fg-muted block mb-1">Carried Location</label>
                            <input
                              type="text"
                              value={item.location || ''}
                              onChange={(e) => handleChange(item.id, { location: e.target.value })}
                              placeholder="Belt, Back, etc."
                              className="w-full bg-surface-2 border border-edge-strong rounded px-2 py-1 text-fg-bright"
                            />
                          </div>
                          {/* Weapon stats */}
                          {(item.category === 'weapon' || item.damage) && (
                            <>
                              <div>
                                <label className="text-xs text-fg-muted block mb-1">Damage</label>
                                <input
                                  type="text"
                                  value={item.damage || ''}
                                  onChange={(e) => handleChange(item.id, { damage: e.target.value })}
                                  placeholder="2d+1 cut"
                                  className="w-full bg-surface-2 border border-edge-strong rounded px-2 py-1 text-fg-bright"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-fg-muted block mb-1">Reach</label>
                                <input
                                  type="text"
                                  value={item.reach || ''}
                                  onChange={(e) => handleChange(item.id, { reach: e.target.value })}
                                  placeholder="1, 2 or C,1"
                                  className="w-full bg-surface-2 border border-edge-strong rounded px-2 py-1 text-fg-bright"
                                />
                              </div>
                            </>
                          )}
                          {/* Armor/Shield stats */}
                          {isArmorOrShield(item) && (
                            <>
                              <div>
                                <label className="text-xs text-fg-muted block mb-1">DR</label>
                                <input
                                  type="number"
                                  value={item.dr || 0}
                                  onChange={(e) => handleChange(item.id, { dr: parseInt(e.target.value) || 0 })}
                                  className="w-full bg-surface-2 border border-edge-strong rounded px-2 py-1 text-fg-bright"
                                  min={0}
                                />
                              </div>
                              {item.category === 'shield' && (
                                <div>
                                  <label className="text-xs text-fg-muted block mb-1">DB (Defense Bonus)</label>
                                  <input
                                    type="number"
                                    value={item.db || 0}
                                    onChange={(e) => handleChange(item.id, { db: parseInt(e.target.value) || 0 })}
                                    className="w-full bg-surface-2 border border-edge-strong rounded px-2 py-1 text-fg-bright"
                                    min={0}
                                  />
                                </div>
                              )}
                              {/* DR Locations multi-select */}
                              <div className="col-span-2">
                                <label className="text-xs text-fg-muted block mb-1">DR Covers Locations</label>
                                <div className="flex flex-wrap gap-1">
                                  {HIT_LOCATIONS.map((loc) => {
                                    const selected = (item.drLocations || []).includes(loc);
                                    return (
                                      <button
                                        key={loc}
                                        onClick={() => handleToggleDRLocation(item.id, loc)}
                                        className={`px-2 py-0.5 rounded text-xs ${
                                          selected
                                            ? 'bg-accent-600 text-white'
                                            : 'bg-surface-2 text-fg-muted hover:bg-surface-3'
                                        }`}
                                      >
                                        {loc}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </>
                          )}
                          {/* Notes */}
                          <div className="col-span-2">
                            <label className="text-xs text-fg-muted block mb-1">Notes</label>
                            <input
                              type="text"
                              value={item.notes || ''}
                              onChange={(e) => handleChange(item.id, { notes: e.target.value })}
                              placeholder="Item notes..."
                              className="w-full bg-surface-2 border border-edge-strong rounded px-2 py-1 text-fg-bright"
                            />
                          </div>
                          {/* Reference */}
                          <div>
                            <label className="text-xs text-fg-muted block mb-1">Reference</label>
                            <input
                              type="text"
                              value={item.reference || ''}
                              onChange={(e) => handleChange(item.id, { reference: e.target.value })}
                              placeholder="B270"
                              className="w-full bg-surface-2 border border-edge-strong rounded px-2 py-1 text-fg-bright"
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-edge-strong font-semibold">
                <td colSpan={3} className="pt-2 text-fg-secondary">
                  Total
                  {totals.equippedWeight !== totals.weight && (
                    <span className="text-xs text-fg-faint font-normal ml-2">
                      ({totals.equippedWeight.toFixed(1)} lb equipped)
                    </span>
                  )}
                </td>
                <td className="pt-2 text-right text-success-400">{currencyUnit} {totals.cost.toFixed(0)}</td>
                <td className="pt-2 text-right text-fg-secondary">{totals.weight.toFixed(1)} lb</td>
                {(editMode || onDemote) && <td></td>}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Other Equipment (text) */}
      <div>
        <h4 className="text-sm font-medium text-fg-muted mb-2">Other Equipment</h4>
        {editMode ? (
          <textarea
            value={otherEquipment}
            onChange={(e) => onOtherEquipmentChange(e.target.value)}
            placeholder="Additional equipment notes..."
            className="w-full h-20 bg-surface-2 border border-edge-strong rounded px-3 py-2 text-fg-bright text-sm resize-y"
          />
        ) : (
          <div className="text-sm text-fg-muted">
            {otherEquipment || <span className="italic">None</span>}
          </div>
        )}
      </div>
    </div>
  );
}
