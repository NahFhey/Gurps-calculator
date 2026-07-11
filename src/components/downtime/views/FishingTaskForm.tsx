/**
 * Fishing Task Form
 *
 * Form component for creating new fishing tasks.
 * Handles leader/helper selection, method, spot, species, tool, and bait selection
 * with validation for character assignment and tool availability.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { X, Target, Shuffle } from 'lucide-react';
import {
  selectAvailableCharacterIdsForSlot,
  selectReservedToolIdsForSlot,
} from '../../../state/downtime';
import { FISHING_METHODS } from '../../../constants';
import { characterHasAnySkill, getCharacterSkills, ACTIVITY_SKILL_REQUIREMENTS } from '../../../types/characterSheet';
import { selectCharacterFatigueStatus, getFatiguePenalty } from '../../../state/downtime/downtimeSelectors';
import type { DowntimeState, FishingData, FishingMethod } from '../../../types/downtime';
import type { Character } from '../../../types/campaign';

// ============================================================================
// TYPES
// ============================================================================

interface FishingTaskFormProps {
  /** Available characters to assign */
  characters: Character[];
  /** Available fishing spots */
  spots: any[];
  /** Available fish species */
  species: any[];
  /** Available fishing tools */
  tools: any[];
  /** Available fishing bait */
  bait: any[];
  /** Gathering tables for species filtering */
  gatheringTables?: any[];
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
  bait,
  gatheringTables = [],
  state,
  currentDayKey,
  currentSlot,
  onSubmit,
  onCancel,
}: FishingTaskFormProps) {
  // Form state
  const [leaderId, setLeaderId] = useState('');
  const [helperIds, setHelperIds] = useState<string[]>([]);
  const [method, setMethod] = useState<FishingMethod>('Line');
  const [isRandomCatch, setIsRandomCatch] = useState(true);
  const [spotId, setSpotId] = useState('');
  const [speciesId, setSpeciesId] = useState('');
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>([]);
  const [baitId, setBaitId] = useState<string | null>(null);

  // Auto-select spot when only one is available
  useEffect(() => {
    if (spots.length === 1 && !spotId) {
      setSpotId(spots[0].id);
    }
  }, [spots, spotId]);

  // Get method configuration
  const methodConfig = FISHING_METHODS[method];
  const canTarget = methodConfig?.canTarget ?? false;

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

  // Filter available characters for selection (not already assigned this slot)
  const availableUnassigned = useMemo(
    () => characters.filter((c) => availableCharacterIds.includes(c.id)),
    [characters, availableCharacterIds]
  );

  // Filter leaders to only characters with a relevant fishing skill
  const availableCharacters = useMemo(
    () => availableUnassigned.filter((c) => characterHasAnySkill(c, ACTIVITY_SKILL_REQUIREMENTS.fishing)),
    [availableUnassigned]
  );

  // Helpers can be anyone available (no skill requirement), excluding selected leader
  const availableHelpers = useMemo(
    () => availableUnassigned.filter((c) => c.id !== leaderId),
    [availableUnassigned, leaderId]
  );

  // Filter tools for the selected method
  const availableTools = useMemo(() => {
    if (!methodConfig) return [];
    return tools.filter((tool) => {
      // Check if tool type is allowed for this method
      const toolType = (tool as any).toolType;
      if (toolType && methodConfig.toolTypes) {
        return methodConfig.toolTypes.includes(toolType);
      }
      // If no toolType filter, allow all tools
      return true;
    });
  }, [tools, methodConfig]);

  // Get selected spot
  const selectedSpot = useMemo(
    () => spots.find((s) => s.id === spotId),
    [spots, spotId]
  );

  // Filter species by the selected spot's catch table
  const availableSpecies = useMemo(() => {
    if (!spotId || !selectedSpot) return [];

    // Get catch table ID from spot
    const spotDefaults = selectedSpot?.defaultsByMode?.Fishing;
    const catchTableId = spotDefaults?.randomCatchTableId;

    if (!catchTableId) {
      // No catch table configured - show all species
      return species;
    }

    // Find the catch table
    const catchTable = gatheringTables.find((t: any) => t.id === catchTableId);
    if (!catchTable || !catchTable.entries) {
      return species;
    }

    // Extract unique species IDs from the table
    const speciesIdsInTable = new Set<string>();
    for (const entry of catchTable.entries) {
      if (entry.resultType === 'species' && entry.speciesId) {
        speciesIdsInTable.add(entry.speciesId);
      }
    }

    // Filter species to only those in the table
    return species.filter((s) => speciesIdsInTable.has(s.id));
  }, [spotId, selectedSpot, species, gatheringTables]);

  // Get selected leader
  const selectedLeader = useMemo(
    () => characters.find((c) => c.id === leaderId),
    [characters, leaderId]
  );

  // Get leader's fishing skill (merged from all skill sources)
  const leaderFishingSkill = useMemo(() => {
    if (!selectedLeader) return null;
    const skills = getCharacterSkills(selectedLeader);
    if (method === 'Spear') {
      return skills.spear ?? skills.fishing ?? 10;
    }
    return skills.fishing ?? 10;
  }, [selectedLeader, method]);

  // Get leader's fatigue status and penalty
  const { fatigueStatus: leaderFatigueStatus, fatiguePenalty: leaderFatiguePenalty } = useMemo(() => {
    if (!leaderId) return { fatigueStatus: 'rested' as const, fatiguePenalty: 0 };
    const status = selectCharacterFatigueStatus(state, leaderId, currentDayKey, currentSlot);
    return { fatigueStatus: status, fatiguePenalty: getFatiguePenalty(status) };
  }, [state, leaderId, currentDayKey, currentSlot]);

  // Get selected spot's environment modifier
  const environmentMod = useMemo(() => {
    if (!selectedSpot) return 0;
    return (selectedSpot as any).skillMod ?? 0;
  }, [selectedSpot]);

  // Get selected species
  const selectedSpecies = useMemo(
    () => species.find((s) => s.id === speciesId),
    [species, speciesId]
  );

  // Check if species is large fish
  const isLargeFish = useMemo(() => {
    if (!selectedSpecies) return false;
    const tags = (selectedSpecies as any).tags;
    return Array.isArray(tags) && tags.includes('LargeFish');
  }, [selectedSpecies]);

  // Get selected bait item
  const selectedBait = useMemo(
    () => bait.find((b) => b.id === baitId),
    [bait, baitId]
  );

  // Check bait compatibility with target species
  const baitStatus = useMemo(() => {
    if (!selectedBait || !selectedSpecies || isRandomCatch) {
      return { correct: false, inappropriate: false };
    }
    // Check if bait attracts this species
    const attractsSpeciesIds = (selectedBait as any).attractsSpeciesIds;
    if (Array.isArray(attractsSpeciesIds)) {
      const attractsTarget = attractsSpeciesIds.includes(speciesId);
      return {
        correct: attractsTarget,
        inappropriate: !attractsTarget && speciesId !== '',
      };
    }
    return { correct: false, inappropriate: false };
  }, [selectedBait, selectedSpecies, speciesId, isRandomCatch]);

  // Calculate skill modifier based on character skills and tools
  const { skillModifier, baitModifier, toolModifier, helperModifier } = useMemo(() => {
    let toolMod = 0;
    let baitMod = 0;
    let helperMod = helperIds.length;

    // Add tool bonuses
    for (const toolId of selectedToolIds) {
      const tool = tools.find((t) => t.id === toolId);
      if (tool) {
        const skillBonus = (tool as any).skillBonus;
        if (skillBonus) {
          toolMod += skillBonus;
        }
        // Also check bonuses array for skill_bonus type
        const bonuses = (tool as any).bonuses;
        if (Array.isArray(bonuses)) {
          const bonus = bonuses.find((b: any) => b.type === 'skill_bonus' && b.skill === 'Fishing');
          if (bonus?.value) {
            toolMod += bonus.value;
          }
        }
      }
    }

    // Calculate bait modifier
    if (baitStatus.correct) {
      baitMod = 1;
    } else if (baitStatus.inappropriate) {
      baitMod = -2;
    }

    return {
      // skillModifier excludes bait - resolution panel handles bait via hasCorrectBait/hasInappropriateBait
      skillModifier: toolMod + helperMod,
      baitModifier: baitMod,
      toolModifier: toolMod,
      helperModifier: helperMod,
    };
  }, [selectedToolIds, helperIds, tools, baitStatus]);

  // Handle method change - reset dependent fields
  const handleMethodChange = (newMethod: FishingMethod) => {
    setMethod(newMethod);
    setSelectedToolIds([]); // Clear tools since they're method-specific

    // If new method can't target, force random catch
    const newMethodConfig = FISHING_METHODS[newMethod];
    if (!newMethodConfig?.canTarget) {
      setIsRandomCatch(true);
      setSpeciesId('');
    }
  };

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

    // Validation
    if (!leaderId || !spotId) {
      return; // Required fields not filled
    }

    // Species is required only for targeted fishing
    if (!isRandomCatch && !speciesId) {
      return;
    }

    const activityData: FishingData = {
      type: 'fishing',
      method,
      speciesId: isRandomCatch ? '' : speciesId,
      isRandomCatch,
      spotId,
      toolIds: selectedToolIds,
      baitId: baitId || null,
      retryAttempt: 0, // First attempt
      skillModifier,
      targetYield: 1, // Deprecated, but keeping for compatibility
    };

    // Diagnostic: log stored skillModifier to verify it matches displayed value
    if (process.env.NODE_ENV === 'development') {
      console.debug('[FishingTaskForm] Submitting task:', {
        skillModifier,
        toolModifier,
        helperModifier,
        baitModifier,
        leaderFishingSkill,
        helperIds,
        selectedToolIds,
      });
    }

    onSubmit({
      leaderId,
      helperIds,
      activityData,
    });
  };

  // Check if form is valid
  const isFormValid = leaderId && spotId && (isRandomCatch || speciesId);

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

      {/* Fishing Method Selection */}
      <div className="form-group mb-4">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Fishing Method <span className="text-red-400">*</span>
        </label>
        <div className="flex flex-wrap gap-3">
          {Object.entries(FISHING_METHODS).map(([key, config]) => (
            <label
              key={key}
              className={`flex items-center gap-2 px-3 py-2 rounded border cursor-pointer transition-colors ${
                method === key
                  ? 'bg-blue-900/50 border-blue-500 text-blue-200'
                  : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700'
              }`}
            >
              <input
                type="radio"
                name="method"
                value={key}
                checked={method === key}
                onChange={() => handleMethodChange(key as FishingMethod)}
                className="sr-only"
              />
              <span className="text-sm font-medium">{config.label}</span>
            </label>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-1">{methodConfig?.description}</p>
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
        {spots.length === 0 ? (
          <p className="text-sm text-yellow-400 italic" data-testid="no-spots-message">
            No fishing spots at current location
          </p>
        ) : spots.length === 1 ? (
          <div
            className="w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded text-gray-100"
            data-testid="spot-select"
          >
            {spots[0].name} <span className="text-xs text-gray-400">— current location</span>
          </div>
        ) : (
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
        )}
      </div>

      {/* Targeted vs Random Catch - Only for methods that can target */}
      {canTarget && (
        <div className="form-group mb-4 bg-gray-900/50 border border-gray-700 rounded p-3">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Fishing Intent
          </label>
          <div className="flex gap-4">
            <label
              className={`flex items-center gap-2 px-3 py-2 rounded border cursor-pointer transition-colors ${
                isRandomCatch
                  ? 'bg-green-900/50 border-green-500 text-green-200'
                  : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700'
              }`}
            >
              <input
                type="radio"
                name="intent"
                checked={isRandomCatch}
                onChange={() => {
                  setIsRandomCatch(true);
                  setSpeciesId('');
                }}
                className="sr-only"
              />
              <Shuffle className="w-4 h-4" />
              <span className="text-sm">Random Catch</span>
            </label>
            <label
              className={`flex items-center gap-2 px-3 py-2 rounded border cursor-pointer transition-colors ${
                !isRandomCatch
                  ? 'bg-purple-900/50 border-purple-500 text-purple-200'
                  : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700'
              }`}
            >
              <input
                type="radio"
                name="intent"
                checked={!isRandomCatch}
                onChange={() => setIsRandomCatch(false)}
                className="sr-only"
              />
              <Target className="w-4 h-4" />
              <span className="text-sm">Target Species</span>
            </label>
          </div>
        </div>
      )}

      {/* Species Selection - Only when targeting AND spot is selected */}
      {canTarget && !isRandomCatch && (
        <div className="form-group mb-4">
          <label htmlFor="species-select" className="block text-sm font-medium text-gray-300 mb-1">
            Target Species <span className="text-red-400">*</span>
          </label>
          {!spotId ? (
            <p className="text-sm text-yellow-400 italic">Select a fishing spot first to see available species</p>
          ) : availableSpecies.length === 0 ? (
            <p className="text-sm text-yellow-400 italic">No targetable species at this location</p>
          ) : (
            <select
              id="species-select"
              value={speciesId}
              onChange={(e) => setSpeciesId(e.target.value)}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
              data-testid="species-select"
            >
              <option value="">Select species...</option>
              {availableSpecies.map((s) => {
                const tags = (s as any).tags;
                const isLarge = Array.isArray(tags) && tags.includes('LargeFish');
                return (
                  <option key={s.id} value={s.id}>
                    {s.name} {isLarge ? '(Large - penalty)' : ''}
                  </option>
                );
              })}
            </select>
          )}
          {isLargeFish && (
            <p className="text-xs text-orange-400 mt-1">
              ⚠ Large fish: -2 targeting penalty, requires struggle to land
            </p>
          )}
        </div>
      )}

      {/* Bait Selection - Primarily for Line fishing */}
      <div className="form-group mb-4">
        <label htmlFor="bait-select" className="block text-sm font-medium text-gray-300 mb-1">
          Bait (optional)
        </label>
        <select
          id="bait-select"
          value={baitId || ''}
          onChange={(e) => setBaitId(e.target.value || null)}
          className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          data-testid="bait-select"
        >
          <option value="">No bait</option>
          {bait.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} ({b.quantity ?? 0} available)
            </option>
          ))}
        </select>
        {baitStatus.correct && (
          <p className="text-xs text-green-400 mt-1">✓ Correct bait for target (+1 to Fishing)</p>
        )}
        {baitStatus.inappropriate && (
          <p className="text-xs text-red-400 mt-1">✗ Wrong bait for target (-2 to Fishing)</p>
        )}
        {method === 'Net' && selectedBait && (
          <p className="text-xs text-yellow-400 mt-1">Note: Bait has limited effect with net fishing</p>
        )}
      </div>

      {/* Tool Selection */}
      <div className="form-group mb-4">
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Equipment (optional)
        </label>
        {availableTools.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No tools available for {methodConfig?.label}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {availableTools.map((tool) => {
              const isReserved = reservedToolIds.has(tool.id);
              const isSelected = selectedToolIds.includes(tool.id);
              const skillBonus = (tool as any).skillBonus;
              const bonuses = (tool as any).bonuses;
              const displayBonus = skillBonus || bonuses?.find((b: any) => b.type === 'skill_bonus')?.value;

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
                  {displayBonus > 0 && (
                    <span className="text-xs text-green-400">(+{displayBonus})</span>
                  )}
                  {isReserved && (
                    <span className="text-xs text-gray-500">(in use)</span>
                  )}
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Skill Summary */}
      <div className="bg-gray-900/50 border border-gray-700 rounded p-3 mb-4">
        {/* Leader's base skill */}
        {selectedLeader && (
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-300">
              {selectedLeader.name}'s {method === 'Spear' ? 'Spear/Fishing' : 'Fishing'} Skill:
            </span>
            <span className="text-sm font-medium text-blue-400">{leaderFishingSkill}</span>
          </div>
        )}

        {/* Modifier breakdown */}
        <div className="border-t border-gray-700 pt-2 space-y-1">
          {toolModifier !== 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Equipment:</span>
              <span className={toolModifier >= 0 ? 'text-green-400' : 'text-red-400'}>
                {toolModifier >= 0 ? '+' : ''}{toolModifier}
              </span>
            </div>
          )}
          {helperModifier > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Helpers ({helperIds.length}):</span>
              <span className="text-green-400">+{helperModifier}</span>
            </div>
          )}
          {baitModifier !== 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Bait:</span>
              <span className={baitModifier >= 0 ? 'text-green-400' : 'text-red-400'}>
                {baitModifier >= 0 ? '+' : ''}{baitModifier}
              </span>
            </div>
          )}
          {leaderFatiguePenalty !== 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Fatigue ({leaderFatigueStatus}):</span>
              <span className="text-red-400">{leaderFatiguePenalty}</span>
            </div>
          )}
          {environmentMod !== 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Environment ({selectedSpot?.name}):</span>
              <span className={environmentMod >= 0 ? 'text-green-400' : 'text-red-400'}>
                {environmentMod >= 0 ? '+' : ''}{environmentMod}
              </span>
            </div>
          )}
        </div>

        {/* Total effective skill */}
        {selectedLeader && (
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-600">
            <span className="text-sm text-gray-200 font-medium">Effective Skill:</span>
            <span className="text-sm font-bold text-green-400">
              {(leaderFishingSkill ?? 10) + skillModifier + baitModifier + leaderFatiguePenalty + environmentMod}
            </span>
          </div>
        )}

        <p className="text-xs text-gray-500 mt-2">
          Large fish penalty (-2) and retry penalties applied during resolution
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
