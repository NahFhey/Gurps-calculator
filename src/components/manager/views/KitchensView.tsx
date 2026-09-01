import { useState } from 'react';
import { Plus, Save, X, Trash2 } from 'lucide-react';
import { toNumberOr } from '../../../utils/helpers';
import type { KitchensViewProps } from '../../../types/views';
import type { FacilityAttachment, Kitchen } from '../../../types/campaign';
import { FacilityAttachmentControl } from './FacilityAttachmentControl';

/**
 * KitchensView - Manages kitchen facilities
 *
 * Kitchens provide skill bonuses to cooking based on their rating.
 * Higher-rated kitchens improve cooking rolls and meal quality.
 */
export function KitchensView({ kitchens, saveKitchens, onDelete, locations = [], vehicles = [] }: KitchensViewProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [newKitchenName, setNewKitchenName] = useState('');
  const [newKitchenRating, setNewKitchenRating] = useState('0');
  const [newKitchenDescription, setNewKitchenDescription] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [newAttachment, setNewAttachment] = useState<FacilityAttachment | undefined>();

  function addKitchen() {
    if (!newKitchenName.trim()) {
      alert('Enter a kitchen name');
      return;
    }

    if (kitchens.some(k => k.name === newKitchenName.trim())) {
      alert('Duplicate kitchen name');
      return;
    }

    const rating = Math.max(0, Math.min(4, toNumberOr(newKitchenRating, 0)));
    const newKitchen: Kitchen = {
      id: crypto.randomUUID(),
      name: newKitchenName.trim(),
      rating: rating,
      description: newKitchenDescription.trim(),
      attachment: newAttachment,
    };

    saveKitchens([...kitchens, newKitchen]);
    setNewKitchenName('');
    setNewKitchenRating('0');
    setNewKitchenDescription('');
    setNewAttachment(undefined);
    setShowAdd(false);
  }

  return (
    <div>
      <div className="flex justify-between mb-4">
        <h2 className="text-xl font-bold">Kitchens</h2>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="bg-success-600 px-4 py-2 rounded"
        >
          <Plus size={20} className="inline" /> Add
        </button>
      </div>

      {showAdd && (
        <div className="bg-surface-2 p-4 rounded mb-4 space-y-3">
          <div>
            <label className="block text-xs text-fg-muted mb-1">Kitchen Name</label>
            <input
              value={newKitchenName}
              onChange={(e) => setNewKitchenName(e.target.value)}
              placeholder="Kitchen name (e.g., 'Master Chef Kitchen')"
              className="w-full bg-surface-3 px-3 py-2 rounded"
            />
          </div>
          <FacilityAttachmentControl value={newAttachment} locations={locations} vehicles={vehicles} onChange={setNewAttachment} />
          <div>
            <label className="block text-xs text-fg-muted mb-1">Kitchen Rating (0-4)</label>
            <input
              type="number"
              min="0"
              max="4"
              value={newKitchenRating}
              onChange={(e) => setNewKitchenRating(e.target.value)}
              className="w-full bg-surface-3 px-3 py-2 rounded"
            />
            <p className="text-xs text-fg-faint mt-1">Higher rating = better equipment, improves cooking rolls</p>
          </div>
          <div>
            <label className="block text-xs text-fg-muted mb-1">Description (optional)</label>
            <textarea
              value={newKitchenDescription}
              onChange={(e) => setNewKitchenDescription(e.target.value)}
              placeholder="Kitchen description or notes..."
              className="w-full bg-surface-3 px-3 py-2 rounded"
              rows={2}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={addKitchen}
              className="flex-1 bg-success-600 px-4 py-2 rounded"
            >
              <Save size={20} className="inline" /> Save
            </button>
            <button
              onClick={() => {
                setShowAdd(false);
                setNewKitchenName('');
                setNewKitchenRating('0');
                setNewKitchenDescription('');
              }}
              className="bg-danger-600 px-4 py-2 rounded"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {kitchens.map(kitchen => (
          <div key={kitchen.id} className="bg-surface-2 rounded">
            <div
              className="flex items-center gap-3 p-3 cursor-pointer hover:bg-surface-3"
              onClick={() => setExpanded(p => ({...p, [kitchen.id]: !p[kitchen.id]}))}
            >
              <span className="flex-1 font-semibold">{kitchen.name}</span>
              <span className="text-sm px-2 py-1 bg-accent-600 rounded">Rating {kitchen.rating}</span>
              <span className="text-xs text-fg-muted">+{kitchen.rating} to cooking skill</span>
              <span className="text-fg-muted">{expanded[kitchen.id] ? '▼' : '▶'}</span>
            </div>

            {expanded[kitchen.id] && (
              <div className="px-3 pb-3 space-y-3 border-t border-edge-strong pt-3">
                <div>
                  <label className="block text-xs text-fg-muted mb-1">Kitchen Name</label>
                  <input
                    value={kitchen.name}
                    onChange={(e) => {
                      const newName = e.target.value;
                      if (kitchens.some(x => x.name === newName && x.id !== kitchen.id)) {
                        alert('Duplicate name');
                        return;
                      }
                      saveKitchens(kitchens.map(x => x.id === kitchen.id ? {...x, name: newName} : x));
                    }}
                    className="w-full bg-surface-3 px-3 py-2 rounded"
                  />
                </div>
                <div>
                  <label className="block text-xs text-fg-muted mb-1">Kitchen Rating (0-4)</label>
                  <input
                    type="number"
                    min="0"
                    max="4"
                    value={kitchen.rating}
                    onChange={(e) => {
                      const rating = Math.max(0, Math.min(4, toNumberOr(e.target.value, 0)));
                      saveKitchens(kitchens.map(x => x.id === kitchen.id ? {...x, rating} : x));
                    }}
                    className="w-full bg-surface-3 px-3 py-2 rounded"
                  />
                  <p className="text-xs text-fg-faint mt-1">Current bonus: +{kitchen.rating} to Cooking skill</p>
                </div>
                <div>
                  <label className="block text-xs text-fg-muted mb-1">Description</label>
                  <textarea
                    value={kitchen.description || ''}
                    onChange={(e) => {
                      saveKitchens(kitchens.map(x => x.id === kitchen.id ? {...x, description: e.target.value} : x));
                    }}
                    className="w-full bg-surface-3 px-3 py-2 rounded"
                    rows={2}
                  />
                </div>
                <FacilityAttachmentControl
                  value={kitchen.attachment}
                  locations={locations}
                  vehicles={vehicles}
                  onChange={(attachment) => saveKitchens(kitchens.map((entry) => entry.id === kitchen.id ? { ...entry, attachment } : entry))}
                />
                <button
                  onClick={() => onDelete('kitchen', kitchen.name, { id: kitchen.id })}
                  className="w-full bg-danger-600 py-2 rounded text-sm"
                >
                  <Trash2 size={16} className="inline" /> Delete Kitchen
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
