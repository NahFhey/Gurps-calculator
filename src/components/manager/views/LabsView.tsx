import { useState } from 'react';
import { Plus, Save, X, Trash2 } from 'lucide-react';
import { toNumberOr } from '../../../utils/helpers';
import type { LabsViewProps } from '../../../types/views';
import type { AlchemyLab, FacilityAttachment } from '../../../types/campaign';
import { FacilityAttachmentControl } from './FacilityAttachmentControl';

/**
 * LabsView - Manages alchemy laboratory facilities
 *
 * Labs provide skill bonuses to alchemy processing based on their rating.
 * Higher-rated labs reduce difficulty and improve success rates.
 */
export function LabsView({ alchemyLabs, saveAlchemyLabs, onDelete, locations = [], vehicles = [] }: LabsViewProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [newLabName, setNewLabName] = useState('');
  const [newLabRating, setNewLabRating] = useState('0');
  const [newLabDescription, setNewLabDescription] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [newAttachment, setNewAttachment] = useState<FacilityAttachment | undefined>();

  function addLab() {
    if (!newLabName.trim()) {
      alert('Enter a lab name');
      return;
    }

    if (alchemyLabs.some(l => l.name === newLabName.trim())) {
      alert('Duplicate lab name');
      return;
    }

    const rating = Math.max(0, Math.min(4, toNumberOr(newLabRating, 0)));
    const newLab: AlchemyLab = {
      id: crypto.randomUUID(),
      name: newLabName.trim(),
      rating: rating,
      description: newLabDescription.trim(),
      attachment: newAttachment,
    };

    saveAlchemyLabs([...alchemyLabs, newLab]);
    setNewLabName('');
    setNewLabRating('0');
    setNewLabDescription('');
    setNewAttachment(undefined);
    setShowAdd(false);
  }

  return (
    <div>
      <div className="flex justify-between mb-4">
        <h2 className="text-xl font-bold">Alchemy Labs</h2>
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
            <label className="block text-xs text-fg-muted mb-1">Lab Name</label>
            <input
              value={newLabName}
              onChange={(e) => setNewLabName(e.target.value)}
              placeholder="Lab name (e.g., 'Master's Workshop')"
              className="w-full bg-surface-3 px-3 py-2 rounded"
            />
          </div>
          <FacilityAttachmentControl value={newAttachment} locations={locations} vehicles={vehicles} onChange={setNewAttachment} />
          <div>
            <label className="block text-xs text-fg-muted mb-1">Lab Rating (0-4)</label>
            <input
              type="number"
              min="0"
              max="4"
              value={newLabRating}
              onChange={(e) => setNewLabRating(e.target.value)}
              className="w-full bg-surface-3 px-3 py-2 rounded"
            />
            <p className="text-xs text-fg-faint mt-1">Higher rating = better equipment, reduces processing difficulty</p>
          </div>
          <div>
            <label className="block text-xs text-fg-muted mb-1">Description (optional)</label>
            <textarea
              value={newLabDescription}
              onChange={(e) => setNewLabDescription(e.target.value)}
              placeholder="Lab description or notes..."
              className="w-full bg-surface-3 px-3 py-2 rounded"
              rows={2}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={addLab}
              className="flex-1 bg-success-600 px-4 py-2 rounded"
            >
              <Save size={20} className="inline" /> Save
            </button>
            <button
              onClick={() => {
                setShowAdd(false);
                setNewLabName('');
                setNewLabRating('0');
                setNewLabDescription('');
              }}
              className="bg-danger-600 px-4 py-2 rounded"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {alchemyLabs.map(lab => (
          <div key={lab.id} className="bg-surface-2 rounded">
            <div
              className="flex items-center gap-3 p-3 cursor-pointer hover:bg-surface-3"
              onClick={() => setExpanded(p => ({...p, [lab.id]: !p[lab.id]}))}
            >
              <span className="flex-1 font-semibold">{lab.name}</span>
              <span className="text-sm px-2 py-1 bg-accent-600 rounded">Rating {lab.rating}</span>
              <span className="text-xs text-fg-muted">+{lab.rating} to processing skill</span>
              <span className="text-fg-muted">{expanded[lab.id] ? '▼' : '▶'}</span>
            </div>

            {expanded[lab.id] && (
              <div className="px-3 pb-3 space-y-3 border-t border-edge-strong pt-3">
                <div>
                  <label className="block text-xs text-fg-muted mb-1">Lab Name</label>
                  <input
                    value={lab.name}
                    onChange={(e) => {
                      const newName = e.target.value;
                      if (alchemyLabs.some(x => x.name === newName && x.id !== lab.id)) {
                        alert('Duplicate name');
                        return;
                      }
                      saveAlchemyLabs(alchemyLabs.map(x => x.id === lab.id ? {...x, name: newName} : x));
                    }}
                    className="w-full bg-surface-3 px-3 py-2 rounded"
                  />
                </div>
                <div>
                  <label className="block text-xs text-fg-muted mb-1">Lab Rating (0-4)</label>
                  <input
                    type="number"
                    min="0"
                    max="4"
                    value={lab.rating}
                    onChange={(e) => {
                      const rating = Math.max(0, Math.min(4, toNumberOr(e.target.value, 0)));
                      saveAlchemyLabs(alchemyLabs.map(x => x.id === lab.id ? {...x, rating} : x));
                    }}
                    className="w-full bg-surface-3 px-3 py-2 rounded"
                  />
                  <p className="text-xs text-fg-faint mt-1">Current bonus: +{lab.rating} to Alchemy skill during processing</p>
                </div>
                <div>
                  <label className="block text-xs text-fg-muted mb-1">Description</label>
                  <textarea
                    value={lab.description || ''}
                    onChange={(e) => {
                      saveAlchemyLabs(alchemyLabs.map(x => x.id === lab.id ? {...x, description: e.target.value} : x));
                    }}
                    className="w-full bg-surface-3 px-3 py-2 rounded"
                    rows={2}
                  />
                </div>
                <FacilityAttachmentControl
                  value={lab.attachment}
                  locations={locations}
                  vehicles={vehicles}
                  onChange={(attachment) => saveAlchemyLabs(alchemyLabs.map((entry) => entry.id === lab.id ? { ...entry, attachment } : entry))}
                />
                <button
                  onClick={() => onDelete('lab', lab.name, { id: lab.id })}
                  className="w-full bg-danger-600 py-2 rounded text-sm"
                >
                  <Trash2 size={16} className="inline" /> Delete Lab
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
