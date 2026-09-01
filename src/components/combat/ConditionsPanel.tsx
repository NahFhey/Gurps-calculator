import { useState, ChangeEvent } from 'react';
import { Plus, X, Eye, EyeOff } from 'lucide-react';
import ConditionBadge from './ConditionBadge';
import {
  getAllConditions,
  DurationType,
  getCondition,
  isConditionObvious
} from '../../constants/conditions';
import {
  getActiveConditions,
  createConditionInstance
} from '../../utils/conditionsEngine';
import { ConfirmDialog, useConfirmDialog, useToast } from '../ui';
import type { ConditionInstance, ConditionRevealState } from '../../types/combatTracker';

interface Participant {
  id: string;
  name: string;
  category?: string;
  conditions?: ConditionInstance[];
}

interface ConditionsPanelProps {
  participant: Participant;
  currentRound: number;
  currentTurn: number;
  onAddCondition: (conditionInstance: ConditionInstance) => void;
  onRemoveCondition: (conditionInstanceId: string) => void;
  /** Phase 12a.6: cycle the per-instance eye state. GM view + NPCs only. */
  onCycleRevealed?: (conditionInstanceId: string) => void;
}

// ============================================================================
// Phase 12a.6: three-state eye control
// ============================================================================

const EYE_TITLES: Record<ConditionRevealState, string> = {
  closed: "Hidden from players — click to telegraph as 'Afflicted'",
  half: "Telegraphed as 'Afflicted' — click to reveal fully",
  open: 'Visible to players — click to hide',
};

function EyeToggle({
  revealed,
  onCycle,
}: {
  revealed: ConditionRevealState;
  onCycle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onCycle}
      title={EYE_TITLES[revealed]}
      aria-label={EYE_TITLES[revealed]}
      className="flex-none p-1 rounded hover:bg-surface-2 transition-colors"
    >
      {revealed === 'closed' && <EyeOff size={14} className="text-fg-faint" />}
      {revealed === 'half' && <Eye size={14} className="text-warning-400 opacity-70" />}
      {revealed === 'open' && <Eye size={14} className="text-success-400" />}
    </button>
  );
}

/**
 * Phase 6: Conditions Panel Component
 *
 * Allows GM to add, remove, and edit conditions on the current actor.
 */
export default function ConditionsPanel({
  participant,
  currentRound,
  currentTurn,
  onAddCondition,
  onRemoveCondition,
  onCycleRevealed
}: ConditionsPanelProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedConditionId, setSelectedConditionId] = useState('');
  const [severity, setSeverity] = useState('');
  const [durationType, setDurationType] = useState<string>(DurationType.PERMANENT);
  const [durationValue, setDurationValue] = useState('1');
  const [source, setSource] = useState('');
  const [notes, setNotes] = useState('');

  const { warning: showWarning, error: showError } = useToast();

  const removeConditionDialog = useConfirmDialog({
    title: 'Remove Condition',
    message: 'Are you sure you want to remove this condition?',
    confirmLabel: 'Remove',
    variant: 'warning',
  });

  const activeConditions = getActiveConditions(participant);
  const availableConditions = getAllConditions();

  // Eye control is NPC-only in this phase: PCs and allies always render
  // full-visible (matches filterConditions in combatViewFilter.js, which
  // treats a missing category as enemy).
  const isNPC = participant.category !== 'player' && participant.category !== 'ally';

  const handleAddCondition = () => {
    if (!selectedConditionId) {
      showWarning('Select a condition to add');
      return;
    }

    const definition = getCondition(selectedConditionId);
    if (!definition) {
      showError('Invalid condition selected');
      return;
    }

    // Build duration
    let duration: { type: string; value: number | null } | null = null;
    if (durationType !== DurationType.PERMANENT && durationType !== DurationType.UNTIL_END_OF_COMBAT) {
      const value = parseInt(durationValue, 10);
      if (isNaN(value) || value <= 0) {
        showWarning('Enter a valid duration value');
        return;
      }
      duration = { type: durationType, value };
    } else {
      duration = { type: durationType, value: null };
    }

    // Create condition instance
    const conditionInstance = createConditionInstance(selectedConditionId, {
      round: currentRound,
      turn: currentTurn,
      duration,
      severity: severity ? parseInt(severity, 10) : null,
      source: source || null,
      notes: notes || null
    });

    if (!conditionInstance) {
      showError('Failed to create condition');
      return;
    }

    // Call handler
    onAddCondition(conditionInstance);

    // Reset form
    setSelectedConditionId('');
    setSeverity('');
    setDurationType(DurationType.PERMANENT);
    setDurationValue('1');
    setSource('');
    setNotes('');
    setShowAddForm(false);
  };

  const handleRemoveCondition = async (conditionInstanceId: string) => {
    const confirmed = await removeConditionDialog.confirm();
    if (confirmed) {
      onRemoveCondition(conditionInstanceId);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-accent-400">Conditions</h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1 px-3 py-1 bg-accent-600 hover:bg-accent-700 rounded text-sm"
        >
          {showAddForm ? <X size={14} /> : <Plus size={14} />}
          {showAddForm ? 'Cancel' : 'Add Condition'}
        </button>
      </div>

      {/* Active Conditions */}
      {activeConditions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {activeConditions.map(condition => (
            <div key={condition.instanceId} className="inline-flex items-center gap-0.5">
              <ConditionBadge
                condition={condition}
                mode="full"
                currentRound={currentRound}
                showDuration={true}
                onRemove={() => handleRemoveCondition(condition.instanceId)}
              />
              {isNPC && onCycleRevealed && (
                <EyeToggle
                  revealed={
                    condition.revealed ??
                    (isConditionObvious(condition.conditionId) ? 'open' : 'closed')
                  }
                  onCycle={() => onCycleRevealed(condition.instanceId)}
                />
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-fg-faint text-sm italic">No active conditions</div>
      )}

      {/* Add Condition Form */}
      {showAddForm && (
        <div className="bg-surface-1 border border-edge rounded p-4 space-y-3">
          <div>
            <label className="block text-sm text-fg-muted mb-1">
              Condition *
            </label>
            <select
              value={selectedConditionId}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedConditionId(e.target.value)}
              className="w-full px-3 py-2 bg-surface-0 border border-edge rounded text-white"
            >
              <option value="">-- Select Condition --</option>
              {availableConditions.map(cond => (
                <option key={cond.id} value={cond.id}>
                  {cond.icon} {cond.label}
                </option>
              ))}
            </select>
            {selectedConditionId && (
              <div className="mt-1 text-xs text-fg-faint">
                {getCondition(selectedConditionId)?.description}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-fg-muted mb-1">
                Duration Type
              </label>
              <select
                value={durationType}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setDurationType(e.target.value)}
                className="w-full px-3 py-2 bg-surface-0 border border-edge rounded text-white"
              >
                <option value={DurationType.PERMANENT}>Permanent</option>
                <option value={DurationType.TURNS}>Turns</option>
                <option value={DurationType.ROUNDS}>Rounds</option>
                <option value={DurationType.UNTIL_END_OF_COMBAT}>Until End of Combat</option>
              </select>
            </div>

            {(durationType === DurationType.TURNS || durationType === DurationType.ROUNDS) && (
              <div>
                <label className="block text-sm text-fg-muted mb-1">
                  Duration Value
                </label>
                <input
                  type="number"
                  value={durationValue}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setDurationValue(e.target.value)}
                  min="1"
                  className="w-full px-3 py-2 bg-surface-0 border border-edge rounded text-white"
                  placeholder="1"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-fg-muted mb-1">
                Severity (optional)
              </label>
              <input
                type="number"
                value={severity}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSeverity(e.target.value)}
                min="1"
                className="w-full px-3 py-2 bg-surface-0 border border-edge rounded text-white"
                placeholder="Leave blank for none"
              />
            </div>

            <div>
              <label className="block text-sm text-fg-muted mb-1">
                Source (optional)
              </label>
              <input
                type="text"
                value={source}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSource(e.target.value)}
                className="w-full px-3 py-2 bg-surface-0 border border-edge rounded text-white"
                placeholder="e.g., Fireball, Goblin #1"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-fg-muted mb-1">
              Notes (optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-surface-0 border border-edge rounded text-white"
              placeholder="Additional notes"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleAddCondition}
              className="flex-1 px-4 py-2 bg-success-600 hover:bg-success-700 rounded font-medium"
            >
              Add Condition
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 bg-surface-3 hover:bg-surface-2 rounded"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Remove Condition Confirmation Dialog */}
      <ConfirmDialog {...removeConditionDialog.dialogProps} />
    </div>
  );
}
