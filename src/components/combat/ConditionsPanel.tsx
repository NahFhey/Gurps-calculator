import { useState, ChangeEvent } from 'react';
import { Plus, X } from 'lucide-react';
import ConditionBadge from './ConditionBadge';
import {
  getAllConditions,
  DurationType,
  getCondition
} from '../../constants/conditions';
import {
  getActiveConditions,
  createConditionInstance
} from '../../utils/conditionsEngine';
import { ConfirmDialog, useConfirmDialog, useToast } from '../ui';

interface ConditionInstance {
  instanceId: string;
  conditionId: string;
  label: string;
  severity?: number | null;
  source?: string | null;
  startedAtRound?: number;
  startedAtTurn?: number;
  duration?: any;
  expiresAt?: number | null;
  notes?: string | null;
}

interface Participant {
  id: string;
  name: string;
  conditions?: ConditionInstance[];
}

interface ConditionsPanelProps {
  participant: Participant;
  currentRound: number;
  currentTurn: number;
  onAddCondition: (conditionInstance: ConditionInstance) => void;
  onRemoveCondition: (conditionInstanceId: string) => void;
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
  onRemoveCondition
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

  const activeConditions = getActiveConditions(participant) as ConditionInstance[];
  const availableConditions = getAllConditions();

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
    } as any);

    if (!conditionInstance) {
      showError('Failed to create condition');
      return;
    }

    // Call handler
    onAddCondition(conditionInstance as ConditionInstance);

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
        <h3 className="text-lg font-bold text-blue-400">Conditions</h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
        >
          {showAddForm ? <X size={14} /> : <Plus size={14} />}
          {showAddForm ? 'Cancel' : 'Add Condition'}
        </button>
      </div>

      {/* Active Conditions */}
      {activeConditions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {activeConditions.map(condition => (
            <ConditionBadge
              key={condition.instanceId}
              condition={condition}
              currentRound={currentRound}
              showDuration={true}
              onRemove={() => handleRemoveCondition(condition.instanceId)}
            />
          ))}
        </div>
      ) : (
        <div className="text-gray-500 text-sm italic">No active conditions</div>
      )}

      {/* Add Condition Form */}
      {showAddForm && (
        <div className="bg-gray-800 border border-gray-700 rounded p-4 space-y-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Condition *
            </label>
            <select
              value={selectedConditionId}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedConditionId(e.target.value)}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white"
            >
              <option value="">-- Select Condition --</option>
              {availableConditions.map(cond => (
                <option key={cond.id} value={cond.id}>
                  {cond.icon} {cond.label}
                </option>
              ))}
            </select>
            {selectedConditionId && (
              <div className="mt-1 text-xs text-gray-500">
                {getCondition(selectedConditionId)?.description}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Duration Type
              </label>
              <select
                value={durationType}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setDurationType(e.target.value)}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white"
              >
                <option value={DurationType.PERMANENT}>Permanent</option>
                <option value={DurationType.TURNS}>Turns</option>
                <option value={DurationType.ROUNDS}>Rounds</option>
                <option value={DurationType.UNTIL_END_OF_COMBAT}>Until End of Combat</option>
              </select>
            </div>

            {(durationType === DurationType.TURNS || durationType === DurationType.ROUNDS) && (
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Duration Value
                </label>
                <input
                  type="number"
                  value={durationValue}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setDurationValue(e.target.value)}
                  min="1"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white"
                  placeholder="1"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Severity (optional)
              </label>
              <input
                type="number"
                value={severity}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSeverity(e.target.value)}
                min="1"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white"
                placeholder="Leave blank for none"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Source (optional)
              </label>
              <input
                type="text"
                value={source}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSource(e.target.value)}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white"
                placeholder="e.g., Fireball, Goblin #1"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Notes (optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white"
              placeholder="Additional notes"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleAddCondition}
              className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 rounded font-medium"
            >
              Add Condition
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded"
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
