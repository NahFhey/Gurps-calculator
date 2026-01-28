/**
 * Fishing Task Form
 *
 * Form component for creating new fishing tasks.
 * Handles leader/helper selection, spot, species, and tool selection
 * with validation for character assignment and tool availability.
 */

import React, { useState, useMemo } from 'react';
import { X } from 'lucide-react';
import {
  selectAvailableCharacterIdsForSlot,
  selectReservedToolIdsForSlot,
} from '../../../state/downtime';
import type { DowntimeState, FishingData } from '../../../types/downtime';
import type { Character, GatheringSpecies, GatheringTool, GatheringEnvironment } from '../../../types/campaign';

// ============================================================================
// TYPES
// ============================================================================

interface FishingTaskFormProps {
  /** Available characters to assign */
  characters: Character[];
  /** Available fishing spots */
  spots: GatheringEnvironment[];
  /** Available fish species */
  species: GatheringSpecies[];
  /** Available fishing tools */
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
    activityData: FishingData;
  }) => void;
  /** Called when form is cancelled */
  onCancel: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function FishingTaskForm({
  characters,
  spots,
  species,
  tools,
  state,
  currentDayKey,
  currentSlot,
  onSubmit,
  onCancel,
}: FishingTaskFormProps) {
  // Form state
  const [leaderId, setLeaderId] = useState('');
  const [helperIds, setHelperIds] = useState<string[]>([]);
  const [spotId, setSpotId] = useState('');
  const [speciesId, setSpeciesId] = useState('');
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>([]);
  const [targetYield, setTargetYield] = useState(1);

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

  // Get reserved tool IDs
  const reservedToolIds = useMemo(
    () => selectReservedToolIdsForSlot(state, currentDayKey, currentSlot),
    [state, currentDayKey, currentSlot]
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

  // Calculate skill modifier based on character skills and tools
  const skillModifier = useMemo(() => {
    let modifier = 0;

    // Get leader's fishing skill (simplified - would need proper skill lookup)
    const leader = characters.find((c) => c.id === leaderId);
    if (leader) {
      // Assume a default fishing skill level exists
      modifier += 0; // Base modifier from character
    }

    // Add tool bonuses (use skillBonus from GatheringTool)
    for (const toolId of selectedToolIds) {
      const tool = tools.find((t) => t.id === toolId);
      if (tool?.skillBonus) {
        modifier += tool.skillBonus;
      }
    }

    // Add helper bonus
    modifier += helperIds.length; // +1 per helper

    return modifier;
  }, [leaderId, helperIds, selectedToolIds, characters, tools]);

  // Handle helper toggle
  const toggleHelper = (helperId: string) => {
    setHelperIds((prev) =>
      prev.includes(helperId)
        ? prev.filter((id) => id !== helperId)
        : [...prev, helperId]
    );
  };

  // Handle tool toggle
  const toggleTool = (toolId: string) => {
    setSelectedToolIds((prev) =>
      prev.includes(toolId)
        ? prev.filter((id) => id !== toolId)
        : [...prev, toolId]
    );
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!leaderId || !spotId || !speciesId) {
      return; // Required fields not filled
    }

    const activityData: FishingData = {
      type: 'fishing',
      speciesId,
      spotId,
      toolIds: selectedToolIds,
      skillModifier,
      targetYield,
    };

    onSubmit({
      leaderId,
      helperIds,
      activityData,
    });
  };

  // Check if form is valid
  const isFormValid = leaderId && spotId && speciesId;

  return (
    <form
      onSubmit={handleSubmit}
      className="fishing-task-form bg-gray-800/60 border border-gray-700 rounded-lg p-4 mb-4"
      data-testid="fishing-task-form"
    >
      {/* Form Header */}
      <div className="flex justify-between items-center mb-4">
        <h4 className="font-medium text-gray-100">New Fishing Task</h4>
        <button
          type="button"
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-200"
          aria-label="Close form"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Leader Selection */}
      <div className="form-group mb-4">
        <label htmlFor="leader-select" className="block text-sm font-medium text-gray-300 mb-1">
          Leader <span className="text-red-400">*</span>
        </label>
        <select
          id="leader-select"
          value={leaderId}
          onChange={(e) => setLeaderId(e.target.value)}
          className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          required
          data-testid="leader-select"
        >
          <option value="">Select character...</option>
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
          Helpers (optional)
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
                    ? 'bg-blue-900/50 border-blue-500 text-blue-200'
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

      {/* Fishing Spot Selection */}
      <div className="form-group mb-4">
        <label htmlFor="spot-select" className="block text-sm font-medium text-gray-300 mb-1">
          Fishing Spot <span className="text-red-400">*</span>
        </label>
        <select
          id="spot-select"
          value={spotId}
          onChange={(e) => setSpotId(e.target.value)}
          className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          required
          data-testid="spot-select"
        >
          <option value="">Select spot...</option>
          {spots.map((spot) => (
            <option key={spot.id} value={spot.id}>
              {spot.name}
            </option>
          ))}
        </select>
      </div>

      {/* Species Selection */}
      <div className="form-group mb-4">
        <label htmlFor="species-select" className="block text-sm font-medium text-gray-300 mb-1">
          Target Species <span className="text-red-400">*</span>
        </label>
        <select
          id="species-select"
          value={speciesId}
          onChange={(e) => setSpeciesId(e.target.value)}
          className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          required
          data-testid="species-select"
        >
          <option value="">Select species...</option>
          {species.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.category})
            </option>
          ))}
        </select>
      </div>

      {/* Tool Selection */}
      <div className="form-group mb-4">
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Equipment (optional)
        </label>
        {tools.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No fishing tools available</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tools.map((tool) => {
              const isReserved = reservedToolIds.has(tool.id);
              const isSelected = selectedToolIds.includes(tool.id);

              return (
                <label
                  key={tool.id}
                  className={`flex items-center gap-1 px-2 py-1 rounded border transition-colors ${
                    isReserved
                      ? 'bg-gray-900/50 border-gray-700 text-gray-500 cursor-not-allowed'
                      : isSelected
                      ? 'bg-blue-900/50 border-blue-500 text-blue-200 cursor-pointer'
                      : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700 cursor-pointer'
                  }`}
                  title={isReserved ? 'Tool already in use' : undefined}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => !isReserved && toggleTool(tool.id)}
                    disabled={isReserved}
                    className="sr-only"
                  />
                  <span className="text-sm">{tool.name}</span>
                  {isReserved && (
                    <span className="text-xs text-gray-500">(in use)</span>
                  )}
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Target Yield */}
      <div className="form-group mb-4">
        <label htmlFor="yield-input" className="block text-sm font-medium text-gray-300 mb-1">
          Target Yield
        </label>
        <input
          id="yield-input"
          type="number"
          min={1}
          max={10}
          value={targetYield}
          onChange={(e) => setTargetYield(Math.max(1, parseInt(e.target.value) || 1))}
          className="w-24 px-3 py-2 bg-gray-900 border border-gray-600 rounded text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Skill Modifier Summary */}
      <div className="bg-gray-900/50 border border-gray-700 rounded p-2 mb-4">
        <p className="text-sm text-gray-300">
          Total Skill Modifier:{' '}
          <span className={`font-medium ${skillModifier >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {skillModifier >= 0 ? '+' : ''}{skillModifier}
          </span>
        </p>
      </div>

      {/* Form Actions */}
      <div className="form-actions flex gap-2">
        <button
          type="submit"
          disabled={!isFormValid}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed"
          data-testid="submit-button"
        >
          Create Task
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
