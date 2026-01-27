import { useState, useMemo } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp, Package } from 'lucide-react';
import type { Equipment } from '../../types/characterSheet';

interface EquipmentSectionProps {
  equipment: Equipment[];
  otherEquipment: string;
  editMode: boolean;
  onEquipmentChange: (equipment: Equipment[]) => void;
  onOtherEquipmentChange: (other: string) => void;
}

type SortField = 'name' | 'quantity' | 'weight' | 'cost';
type SortDir = 'asc' | 'desc';

export function EquipmentSection({
  equipment,
  otherEquipment,
  editMode,
  onEquipmentChange,
  onOtherEquipmentChange,
}: EquipmentSectionProps) {
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

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
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [equipment, sortField, sortDir]);

  const totals = useMemo(() => {
    return equipment.reduce(
      (acc, item) => ({
        weight: acc.weight + item.weight * item.quantity,
        cost: acc.cost + item.cost * item.quantity,
      }),
      { weight: 0, cost: 0 }
    );
  }, [equipment]);

  const handleAdd = () => {
    const newItem: Equipment = {
      id: `equip-${Date.now()}`,
      name: '',
      quantity: 1,
      weight: 0,
      cost: 0,
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

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Package size={20} className="text-amber-400" />
          <h3 className="text-lg font-semibold text-gray-100">
            Equipment <span className="text-sm text-gray-400">({equipment.length})</span>
          </h3>
        </div>
        {editMode && (
          <button
            onClick={handleAdd}
            className="flex items-center gap-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
          >
            <Plus size={14} />
            Add Item
          </button>
        )}
      </div>

      {equipment.length === 0 ? (
        <div className="text-gray-500 italic mb-4">No equipment</div>
      ) : (
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-700">
                <th
                  className="pb-2 cursor-pointer hover:text-gray-200 w-12 text-center"
                  onClick={() => handleSort('quantity')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Qty <SortIcon field="quantity" />
                  </div>
                </th>
                <th
                  className="pb-2 cursor-pointer hover:text-gray-200"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-1">
                    Item <SortIcon field="name" />
                  </div>
                </th>
                <th
                  className="pb-2 cursor-pointer hover:text-gray-200 w-24 text-right"
                  onClick={() => handleSort('cost')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Cost <SortIcon field="cost" />
                  </div>
                </th>
                <th
                  className="pb-2 cursor-pointer hover:text-gray-200 w-24 text-right"
                  onClick={() => handleSort('weight')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Weight <SortIcon field="weight" />
                  </div>
                </th>
                {editMode && <th className="pb-2 w-10"></th>}
              </tr>
            </thead>
            <tbody>
              {sortedEquipment.map((item) => (
                <tr key={item.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="py-1.5 text-center">
                    {editMode ? (
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => handleChange(item.id, { quantity: parseInt(e.target.value) || 1 })}
                        className="w-12 bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-gray-100 text-center"
                        min={1}
                      />
                    ) : (
                      <span className="text-gray-300">{item.quantity}</span>
                    )}
                  </td>
                  <td className="py-1.5">
                    {editMode ? (
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => handleChange(item.id, { name: e.target.value })}
                        placeholder="Item name"
                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-0.5 text-gray-100"
                      />
                    ) : (
                      <span className="text-gray-200">{item.name}</span>
                    )}
                  </td>
                  <td className="py-1.5 text-right">
                    {editMode ? (
                      <input
                        type="number"
                        value={item.cost}
                        onChange={(e) => handleChange(item.id, { cost: parseFloat(e.target.value) || 0 })}
                        className="w-20 bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-gray-100 text-right"
                        min={0}
                      />
                    ) : (
                      <span className="text-green-400">${item.cost * item.quantity}</span>
                    )}
                  </td>
                  <td className="py-1.5 text-right">
                    {editMode ? (
                      <input
                        type="number"
                        value={item.weight}
                        onChange={(e) => handleChange(item.id, { weight: parseFloat(e.target.value) || 0 })}
                        className="w-16 bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-gray-100 text-right"
                        min={0}
                        step={0.1}
                      />
                    ) : (
                      <span className="text-gray-400">{(item.weight * item.quantity).toFixed(1)} lb</span>
                    )}
                  </td>
                  {editMode && (
                    <td className="py-1.5">
                      <button
                        onClick={() => handleRemove(item.id)}
                        className="p-1 hover:bg-gray-600 rounded text-red-400"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-600 font-semibold">
                <td colSpan={2} className="pt-2 text-gray-300">Total</td>
                <td className="pt-2 text-right text-green-400">${totals.cost.toFixed(0)}</td>
                <td className="pt-2 text-right text-gray-300">{totals.weight.toFixed(1)} lb</td>
                {editMode && <td></td>}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Other Equipment (text) */}
      <div>
        <h4 className="text-sm font-medium text-gray-400 mb-2">Other Equipment</h4>
        {editMode ? (
          <textarea
            value={otherEquipment}
            onChange={(e) => onOtherEquipmentChange(e.target.value)}
            placeholder="Additional equipment notes..."
            className="w-full h-20 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-gray-100 text-sm resize-y"
          />
        ) : (
          <div className="text-sm text-gray-400">
            {otherEquipment || <span className="italic">None</span>}
          </div>
        )}
      </div>
    </div>
  );
}
