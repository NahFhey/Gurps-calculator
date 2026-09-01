import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { toNumberOr } from '../../utils/helpers';

// ============================================================================
// TYPES
// ============================================================================

export interface Trait {
  id?: string;
  name: string;
  cost: number;
  notes?: string;
}

export interface TBBuilderPanelProps {
  traitBudget: number;
  initialTraits?: Trait[];
  onUpdate: (traits: Trait[]) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function TBBuilderPanel({ traitBudget, initialTraits = [], onUpdate }: TBBuilderPanelProps) {
  const [traits, setTraits] = useState<Trait[]>(initialTraits);
  const [showAdd, setShowAdd] = useState(false);
  const [newTraitName, setNewTraitName] = useState('');
  const [newTraitCost, setNewTraitCost] = useState('');
  const [newTraitNotes, setNewTraitNotes] = useState('');

  const totalUsed = traits.reduce((sum, t) => sum + (t.cost || 0), 0);
  const remaining = traitBudget - totalUsed;
  const isOverBudget = remaining < 0;

  function addTrait() {
    if (!newTraitName.trim()) {
      alert('Enter trait name');
      return;
    }

    const cost = toNumberOr(newTraitCost, 0);
    const newTrait: Trait = {
      id: crypto.randomUUID(),
      name: newTraitName.trim(),
      cost,
      notes: newTraitNotes.trim()
    };

    const updatedTraits = [...traits, newTrait];
    setTraits(updatedTraits);
    if (onUpdate) onUpdate(updatedTraits);

    setNewTraitName('');
    setNewTraitCost('');
    setNewTraitNotes('');
    setShowAdd(false);
  }

  function removeTrait(id: Trait['id']) {
    const updatedTraits = traits.filter(t => t.id !== id);
    setTraits(updatedTraits);
    if (onUpdate) onUpdate(updatedTraits);
  }

  function updateTrait(id: Trait['id'], field: keyof Trait, value: string | number) {
    const updatedTraits = traits.map(t => {
      if (t.id === id) {
        return { ...t, [field]: field === 'cost' ? toNumberOr(value, 0) : value };
      }
      return t;
    });
    setTraits(updatedTraits);
    if (onUpdate) onUpdate(updatedTraits);
  }

  return (
    <div className="bg-surface-1 border border-edge-strong rounded-lg p-4">
      <div className="flex justify-between items-center mb-3">
        <h4 className="font-semibold">Trait Budget (TB) Builder</h4>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="bg-success-600 px-3 py-1 rounded text-sm"
        >
          {showAdd ? 'Cancel' : <><Plus size={14} className="inline" /> Add Trait</>}
        </button>
      </div>

      {/* Budget Summary */}
      <div className="bg-surface-2 p-3 rounded mb-3">
        <div className="flex justify-between items-center mb-2">
          <div>
            <span className="text-sm text-fg-muted">Budget:</span>
            <span className="ml-2 font-bold text-purple-400">{traitBudget} pts</span>
          </div>
          <div>
            <span className="text-sm text-fg-muted">Used:</span>
            <span className={`ml-2 font-bold ${isOverBudget ? 'text-danger-400' : 'text-accent-400'}`}>
              {totalUsed} pts
            </span>
          </div>
          <div>
            <span className="text-sm text-fg-muted">Remaining:</span>
            <span className={`ml-2 font-bold ${isOverBudget ? 'text-danger-400' : 'text-success-400'}`}>
              {remaining} pts
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-surface-3 rounded-full h-3">
          <div
            className={`h-3 rounded-full ${isOverBudget ? 'bg-danger-500' : 'bg-purple-500'}`}
            style={{ width: `${Math.min(100, (totalUsed / traitBudget) * 100)}%` }}
          />
        </div>

        {isOverBudget && (
          <div className="mt-2 text-xs text-danger-400">
            Over budget by {Math.abs(remaining)} points!
          </div>
        )}
      </div>

      {/* Add Trait Form */}
      {showAdd && (
        <div className="bg-surface-2 p-3 rounded mb-3 space-y-2">
          <div>
            <label className="block text-xs text-fg-muted mb-1">Trait Name</label>
            <input
              value={newTraitName}
              onChange={(e) => setNewTraitName(e.target.value)}
              placeholder="e.g., Accelerated Healing"
              className="w-full bg-surface-3 px-3 py-2 rounded text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-fg-muted mb-1">Point Cost</label>
              <input
                type="number"
                value={newTraitCost}
                onChange={(e) => setNewTraitCost(e.target.value)}
                placeholder="10"
                className="w-full bg-surface-3 px-3 py-2 rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-fg-muted mb-1">Notes (optional)</label>
              <input
                value={newTraitNotes}
                onChange={(e) => setNewTraitNotes(e.target.value)}
                placeholder="Level, modifiers, etc."
                className="w-full bg-surface-3 px-3 py-2 rounded text-sm"
              />
            </div>
          </div>

          <button onClick={addTrait} className="w-full bg-success-600 px-3 py-2 rounded text-sm">
            Add Trait
          </button>
        </div>
      )}

      {/* Trait List */}
      <div className="space-y-2">
        {traits.length === 0 && (
          <div className="text-fg-faint text-center text-sm py-3">
            No traits added yet. Click "Add Trait" to start building your potion effect.
          </div>
        )}

        {traits.map(trait => (
          <div key={trait.id} className="bg-surface-2 p-3 rounded">
            <div className="flex items-start gap-2">
              <div className="flex-1 space-y-2">
                <input
                  value={trait.name}
                  onChange={(e) => updateTrait(trait.id, 'name', e.target.value)}
                  className="w-full bg-surface-3 px-2 py-1 rounded text-sm font-semibold"
                  placeholder="Trait name"
                />

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-fg-muted mb-1">Cost</label>
                    <input
                      type="number"
                      value={trait.cost}
                      onChange={(e) => updateTrait(trait.id, 'cost', e.target.value)}
                      className="w-full bg-surface-3 px-2 py-1 rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-fg-muted mb-1">Notes</label>
                    <input
                      value={trait.notes || ''}
                      onChange={(e) => updateTrait(trait.id, 'notes', e.target.value)}
                      className="w-full bg-surface-3 px-2 py-1 rounded text-sm"
                      placeholder="Level, modifiers..."
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={() => removeTrait(trait.id)}
                className="text-danger-400 px-2 py-1"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      {traits.length > 0 && (
        <div className="mt-3 bg-surface-2 p-2 rounded text-xs text-fg-muted">
          Total Traits: {traits.length} | Total Cost: {totalUsed} points
          {traits.map(t => ` • ${t.name} (${t.cost})`).join('')}
        </div>
      )}
    </div>
  );
}
