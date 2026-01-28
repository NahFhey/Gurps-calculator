/**
 * Alchemy Task Form
 *
 * Form component for creating new alchemy work session tasks.
 * Handles worker selection, batch selection, and aspect modifier display.
 * Validates character assignment and batch availability.
 */

import { useState, useMemo } from 'react';
import { X } from 'lucide-react';
import {
  selectAvailableCharacterIdsForSlot,
} from '../../../state/downtime';
import type { DowntimeState, AlchemyData } from '../../../types/downtime';
import type {
  Character,
  AlchemyReagent,
  AlchemyFormula,
  AlchemyBatch,
  AlchemyLab,
  GatheringTool,
} from '../../../types/campaign';

// ============================================================================
// TYPES
// ============================================================================

interface AlchemyTaskFormProps {
  /** Available characters to assign */
  characters: Character[];
  /** Active batches to work on */
  batches: AlchemyBatch[];
  /** Available formulas for reference */
  formulas: AlchemyFormula[];
  /** Available reagents */
  reagents: AlchemyReagent[];
  /** Available labs */
  labs: AlchemyLab[];
  /** Available tools */
  tools: GatheringTool[];
  /** Current downtime state for validation */
  state: DowntimeState;
  /** Current day key */
  currentDayKey: number;
  /** Current time slot */
  currentSlot: number;
  /** Called when form is submitted with valid data */
  onSubmit: (data: {
    leaderId: string;
    helperIds: string[];
    activityData: AlchemyData;
  }) => void;
  /** Called when form is cancelled */
  onCancel: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function AlchemyTaskForm({
  characters,
  batches,
  formulas: _formulas,
  reagents: _reagents,
  labs,
  tools: _tools,
  state,
  currentDayKey,
  currentSlot,
  onSubmit,
  onCancel,
}: AlchemyTaskFormProps) {
  // Form state
  const [leaderId, setLeaderId] = useState('');
  const [helperIds, setHelperIds] = useState<string[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [selectedLabId, setSelectedLabId] = useState(labs[0]?.id ?? '');

  // Get available (unassigned) character IDs
  const allCharacterIds = useMemo(
    () => characters.map((c) => c.id),
    [characters]
  );

  const availableCharacterIds = useMemo(
    () =>
      selectAvailableCharacterIdsForSlot(
        state,
        currentDayKey,
        currentSlot,
        allCharacterIds
      ),
    [state, currentDayKey, currentSlot, allCharacterIds]
  );

  // Filter available characters for selection
  const availableCharacters = useMemo(
    () => characters.filter((c) => availableCharacterIds.includes(c.id)),
    [characters, availableCharacterIds]
  );

  // Filter available characters for helpers (excluding selected leader)
  const availableHelpers = useMemo(
    () => availableCharacters.filter((c) => c.id !== leaderId),
    [availableCharacters, leaderId]
  );

  // Get selected batch details
  const selectedBatch = useMemo(
    () => batches.find((b) => b.id === selectedBatchId),
    [batches, selectedBatchId]
  );

  // Get selected lab details
  const selectedLab = useMemo(
    () => labs.find((l) => l.id === selectedLabId),
    [labs, selectedLabId]
  );

  // Calculate skill modifier based on character, lab, and helpers
  const skillModifier = useMemo(() => {
    let modifier = 0;

    // Add lab bonus
    if (selectedLab) {
      modifier += selectedLab.rating ?? 0;
    }

    // Add helper bonus (+1 per helper, max +2)
    modifier += Math.min(helperIds.length, 2);

    return modifier;
  }, [selectedLab, helperIds]);

  // Handle helper toggle
  const toggleHelper = (helperId: string) => {
    setHelperIds((prev) =>
      prev.includes(helperId)
        ? prev.filter((id) => id !== helperId)
        : [...prev, helperId]
    );
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!leaderId || !selectedBatchId) {
      return; // Required fields not filled
    }

    // Get formula from batch
    const batch = batches.find((b) => b.id === selectedBatchId);
    const formulaId = batch?.formulaId ?? selectedBatchId;

    const activityData: AlchemyData = {
      type: 'alchemy',
      recipeId: formulaId,
      formulaId: selectedBatchId, // Using batch ID as formula ID for task tracking
      reagentIds: [], // Reagents already consumed when batch started
      toolIds: selectedLabId ? [selectedLabId] : [],
      batchSize: 1, // One work block at a time
      aspectModifiers: {
        skill: skillModifier,
        lab: selectedLab?.rating ?? 0,
        helpers: Math.min(helperIds.length, 2),
      },
    };

    onSubmit({
      leaderId,
      helperIds,
      activityData,
    });
  };

  // Check if form is valid
  const isFormValid = leaderId && selectedBatchId;

  return (
    <form
      onSubmit={handleSubmit}
      className="alchemy-task-form bg-gray-800/60 border border-gray-700 rounded-lg p-4 mb-4"
      data-testid="alchemy-task-form"
    >
      {/* Form Header */}
      <div className="flex justify-between items-center mb-4">
        <h4 className="font-medium text-gray-100">New Work Session</h4>
        <button
          type="button"
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-200"
          aria-label="Close form"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Worker Selection */}
      <div className="form-group mb-4">
        <label htmlFor="leader-select" className="block text-sm font-medium text-gray-300 mb-1">
          Alchemist <span className="text-red-400">*</span>
        </label>
        <select
          id="leader-select"
          value={leaderId}
          onChange={(e) => setLeaderId(e.target.value)}
          className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          required
          data-testid="leader-select"
        >
          <option value="">Select worker...</option>
          {availableCharacters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {availableCharacters.length === 0 && (
          <p className="text-sm text-yellow-400 mt-1">
            All characters are already assigned to tasks in this slot
          </p>
        )}
      </div>

      {/* Helper Selection */}
      <div className="form-group mb-4">
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Assistants (optional, max +2 bonus)
        </label>
        {availableHelpers.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No available helpers</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {availableHelpers.map((c) => (
              <label
                key={c.id}
                className={`flex items-center gap-1 px-2 py-1 rounded border cursor-pointer transition-colors ${
                  helperIds.includes(c.id)
                    ? 'bg-purple-900/50 border-purple-500 text-purple-200'
                    : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700'
                }`}
              >
                <input
                  type="checkbox"
                  checked={helperIds.includes(c.id)}
                  onChange={() => toggleHelper(c.id)}
                  className="sr-only"
                />
                <span className="text-sm">{c.name}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Batch Selection */}
      <div className="form-group mb-4">
        <label htmlFor="batch-select" className="block text-sm font-medium text-gray-300 mb-1">
          Batch <span className="text-red-400">*</span>
        </label>
        <select
          id="batch-select"
          value={selectedBatchId}
          onChange={(e) => setSelectedBatchId(e.target.value)}
          className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          required
          data-testid="batch-select"
        >
          <option value="">Select batch...</option>
          {batches.map((batch) => {
            const batchName = (batch as any).formulaName ?? batch.id;
            const pp = (batch as any).PP ?? 0;
            const wr = (batch as any).WR ?? '?';
            return (
              <option key={batch.id} value={batch.id}>
                {batchName} ({pp}/{wr} PP)
              </option>
            );
          })}
        </select>
        {batches.length === 0 && (
          <p className="text-sm text-yellow-400 mt-1">
            No active batches. Start a batch in the Alchemy tab first.
          </p>
        )}
      </div>

      {/* Lab Selection */}
      <div className="form-group mb-4">
        <label htmlFor="lab-select" className="block text-sm font-medium text-gray-300 mb-1">
          Laboratory
        </label>
        <select
          id="lab-select"
          value={selectedLabId}
          onChange={(e) => setSelectedLabId(e.target.value)}
          className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          data-testid="lab-select"
        >
          <option value="">No lab (0 bonus)</option>
          {labs.map((lab) => (
            <option key={lab.id} value={lab.id}>
              {lab.name} (+{lab.rating ?? 0})
            </option>
          ))}
        </select>
      </div>

      {/* Batch Details (when selected) */}
      {selectedBatch && (
        <div className="bg-purple-900/30 border border-purple-700/50 rounded p-3 mb-4" data-testid="batch-details">
          <h5 className="text-sm font-medium text-purple-300 mb-2">Batch Details</h5>
          <div className="text-sm text-purple-200/80 space-y-1">
            <p>
              <span className="font-medium">Progress:</span>{' '}
              {(selectedBatch as any).PP ?? 0}/{(selectedBatch as any).WR ?? '?'} PP
            </p>
            <p>
              <span className="font-medium">Contamination:</span>{' '}
              {(selectedBatch as any).CP ?? 0} CP
            </p>
            {(selectedBatch as any).dominantAspect && (
              <p>
                <span className="font-medium">Aspects:</span>{' '}
                {(selectedBatch as any).dominantAspect}
                {(selectedBatch as any).secondaryAspect && ` / ${(selectedBatch as any).secondaryAspect}`}
              </p>
            )}
            {(selectedBatch as any).tier && (
              <p>
                <span className="font-medium">Tier:</span> {(selectedBatch as any).tier}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Skill Modifier Summary */}
      <div className="bg-gray-900/50 border border-gray-700 rounded p-2 mb-4">
        <p className="text-sm text-gray-300">
          Total Skill Modifier:{' '}
          <span className={`font-medium ${skillModifier >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {skillModifier >= 0 ? '+' : ''}{skillModifier}
          </span>
          <span className="text-xs text-gray-500 ml-2">
            (Lab: +{selectedLab?.rating ?? 0}, Helpers: +{Math.min(helperIds.length, 2)})
          </span>
        </p>
      </div>

      {/* Form Actions */}
      <div className="form-actions flex gap-2">
        <button
          type="submit"
          disabled={!isFormValid}
          className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed"
          data-testid="submit-button"
        >
          Start Work Session
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-600 text-gray-300 rounded hover:bg-gray-700 transition-colors"
          data-testid="cancel-button"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
