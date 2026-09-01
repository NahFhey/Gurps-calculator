import { Plus, Trash2, AlertCircle } from 'lucide-react';
import type { Reaction, ConditionalModifier } from '../../types/characterSheet';

interface ModifiersSectionProps {
  reactions: Reaction[];
  conditionalModifiers: ConditionalModifier[];
  editMode: boolean;
  onReactionsChange: (reactions: Reaction[]) => void;
  onModifiersChange: (modifiers: ConditionalModifier[]) => void;
}

export function ModifiersSection({
  reactions,
  conditionalModifiers,
  editMode,
  onReactionsChange,
  onModifiersChange,
}: ModifiersSectionProps) {
  // Reactions handlers
  const handleAddReaction = () => {
    onReactionsChange([...reactions, { modifier: 0, condition: '' }]);
  };

  const handleRemoveReaction = (index: number) => {
    onReactionsChange(reactions.filter((_, i) => i !== index));
  };

  const handleReactionChange = (index: number, field: keyof Reaction, value: unknown) => {
    onReactionsChange(
      reactions.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    );
  };

  // Conditional modifiers handlers
  const handleAddModifier = () => {
    onModifiersChange([...conditionalModifiers, { modifier: 0, condition: '' }]);
  };

  const handleRemoveModifier = (index: number) => {
    onModifiersChange(conditionalModifiers.filter((_, i) => i !== index));
  };

  const handleModifierChange = (index: number, field: keyof ConditionalModifier, value: unknown) => {
    onModifiersChange(
      conditionalModifiers.map((m, i) => (i === index ? { ...m, [field]: value } : m))
    );
  };

  const formatModifier = (mod: number) => (mod >= 0 ? `+${mod}` : `${mod}`);

  if (!editMode && reactions.length === 0 && conditionalModifiers.length === 0) {
    return null; // Don't show section if empty and not editing
  }

  return (
    <div className="bg-surface-1 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertCircle size={20} className="text-yellow-400" />
        <h3 className="text-lg font-semibold text-fg-bright">Reactions & Conditional Modifiers</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Reactions */}
        <div className="bg-surface-2 rounded p-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-fg-secondary">Reactions</h4>
            {editMode && (
              <button
                onClick={handleAddReaction}
                className="p-1 hover:bg-surface-3 rounded"
                title="Add Reaction"
              >
                <Plus size={14} className="text-fg-muted" />
              </button>
            )}
          </div>

          {reactions.length === 0 ? (
            <div className="text-sm text-fg-faint italic">No reaction modifiers</div>
          ) : (
            <div className="space-y-2">
              {reactions.map((reaction, index) => (
                <div key={index} className="flex items-center gap-2">
                  {editMode ? (
                    <>
                      <input
                        type="number"
                        value={reaction.modifier}
                        onChange={(e) => handleReactionChange(index, 'modifier', parseInt(e.target.value) || 0)}
                        className="w-14 bg-surface-3 border border-edge-bright rounded px-1 py-0.5 text-sm text-fg-bright text-center"
                      />
                      <input
                        type="text"
                        value={reaction.condition}
                        onChange={(e) => handleReactionChange(index, 'condition', e.target.value)}
                        placeholder="Condition"
                        className="flex-1 bg-surface-3 border border-edge-bright rounded px-2 py-0.5 text-sm text-fg-bright"
                      />
                      <button
                        onClick={() => handleRemoveReaction(index)}
                        className="p-0.5 hover:bg-surface-4 rounded text-danger-400"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  ) : (
                    <span className="text-sm text-fg-secondary">
                      <span className={reaction.modifier >= 0 ? 'text-success-400' : 'text-danger-400'}>
                        {formatModifier(reaction.modifier)}
                      </span>
                      {' '}{reaction.condition}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Conditional Modifiers */}
        <div className="bg-surface-2 rounded p-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-fg-secondary">Conditional Modifiers</h4>
            {editMode && (
              <button
                onClick={handleAddModifier}
                className="p-1 hover:bg-surface-3 rounded"
                title="Add Modifier"
              >
                <Plus size={14} className="text-fg-muted" />
              </button>
            )}
          </div>

          {conditionalModifiers.length === 0 ? (
            <div className="text-sm text-fg-faint italic">No conditional modifiers</div>
          ) : (
            <div className="space-y-2">
              {conditionalModifiers.map((modifier, index) => (
                <div key={index} className="flex items-center gap-2">
                  {editMode ? (
                    <>
                      <input
                        type="number"
                        value={modifier.modifier}
                        onChange={(e) => handleModifierChange(index, 'modifier', parseInt(e.target.value) || 0)}
                        className="w-14 bg-surface-3 border border-edge-bright rounded px-1 py-0.5 text-sm text-fg-bright text-center"
                      />
                      <input
                        type="text"
                        value={modifier.condition}
                        onChange={(e) => handleModifierChange(index, 'condition', e.target.value)}
                        placeholder="Condition"
                        className="flex-1 bg-surface-3 border border-edge-bright rounded px-2 py-0.5 text-sm text-fg-bright"
                      />
                      <button
                        onClick={() => handleRemoveModifier(index)}
                        className="p-0.5 hover:bg-surface-4 rounded text-danger-400"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  ) : (
                    <span className="text-sm text-fg-secondary">
                      <span className={modifier.modifier >= 0 ? 'text-success-400' : 'text-danger-400'}>
                        {formatModifier(modifier.modifier)}
                      </span>
                      {' '}{modifier.condition}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
