/**
 * Foraging Task Form
 *
 * Form component for creating new foraging tasks.
 * Handles leader/helper selection, biome, node, table, and tool selection
 * with validation for character assignment and tool availability.
 */

import { useState, useMemo, useEffect } from 'react';
import { X } from 'lucide-react';
import {
  selectAvailableCharacterIdsForSlot,
  selectReservedToolIdsForSlot,
} from '../../../state/downtime';
import { characterHasAnySkill, getCharacterSkills, ACTIVITY_SKILL_REQUIREMENTS } from '../../../types/characterSheet';
import { selectCharacterFatigueStatus, getFatiguePenalty } from '../../../state/downtime/downtimeSelectors';
import type { DowntimeState, ForagingData } from '../../../types/downtime';
import type { Character, GatheringSpecies, GatheringTool, GatheringEnvironment, GatheringTable } from '../../../types/campaign';

// ============================================================================
// TYPES
// ============================================================================

interface ForagingTaskFormProps {
  /** Available characters to assign */
  characters: Character[];
  /** Available foraging biomes */
  biomes: GatheringEnvironment[];
  /** Available foraging nodes */
  nodes: GatheringSpecies[];
  /** Available gathering tables */
  tables: GatheringTable[];
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
    activityData: ForagingData;
  }) => void;
  /** Called when form is cancelled */
  onCancel: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ForagingTaskForm({
  characters,
  biomes,
  nodes,
  tables,
  tools,
  state,
  currentDayKey,
  currentSlot,
  onSubmit,
  onCancel,
}: ForagingTaskFormProps) {
  // Form state
  const [leaderId, setLeaderId] = useState('');
  const [helperIds, setHelperIds] = useState<string[]>([]);
  const [biomeId, setBiomeId] = useState('');
  const [nodeId, setNodeId] = useState('');
  const [tableId, setTableId] = useState('');
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>([]);

  // Auto-select biome when only one is available
  useEffect(() => {
    if (biomes.length === 1 && !biomeId) {
      setBiomeId(biomes[0].id);
    }
  }, [biomes, biomeId]);

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

  // Filter leaders to only characters with a relevant foraging skill
  const availableCharacters = useMemo(
    () => availableUnassigned.filter((c) => characterHasAnySkill(c, ACTIVITY_SKILL_REQUIREMENTS.foraging)),
    [availableUnassigned]
  );

  // Helpers can be anyone available (no skill requirement), excluding selected leader
  const availableHelpers = useMemo(
    () => availableUnassigned.filter((c) => c.id !== leaderId),
    [availableUnassigned, leaderId]
  );

  // Filter nodes by selected biome (if biome has species list)
  const availableNodes = useMemo(() => {
    if (!biomeId) return nodes;
    const selectedBiome = biomes.find((b) => b.id === biomeId);
    if (!selectedBiome?.species?.length) return nodes;
    return nodes.filter((n) => selectedBiome.species.includes(n.id));
  }, [nodes, biomeId, biomes]);

  // Extract the leader's base foraging skill (Survival, Naturalist, or Herb Lore)
  const leaderForagingSkill = useMemo(() => {
    if (!leaderId) return 10;
    const leader = characters.find((c) => c.id === leaderId);
    if (!leader) return 10;
    const allSkills = getCharacterSkills(leader);
    return allSkills.survival ?? allSkills.naturalist ?? allSkills.herbLore ?? 10;
  }, [leaderId, characters]);

  // Get leader's fatigue status and penalty
  const { fatigueStatus: leaderFatigueStatus, fatiguePenalty: leaderFatiguePenalty } = useMemo(() => {
    if (!leaderId) return { fatigueStatus: 'rested' as const, fatiguePenalty: 0 };
    const status = selectCharacterFatigueStatus(state, leaderId, currentDayKey, currentSlot);
    return { fatigueStatus: status, fatiguePenalty: getFatiguePenalty(status) };
  }, [state, leaderId, currentDayKey, currentSlot]);

  // Calculate additional skill modifier from tools and helpers (excludes base skill)
  const skillModifier = useMemo(() => {
    let modifier = 0;

    // Add tool bonuses
    for (const toolId of selectedToolIds) {
      const tool = tools.find((t) => t.id === toolId);
      // Check direct skillBonus property
      if ((tool as any)?.skillBonus) {
        modifier += (tool as any).skillBonus;
      }
      // Also check bonuses array (matching fishing pattern)
      const bonuses = (tool as any)?.bonuses;
      if (Array.isArray(bonuses)) {
        const bonus = bonuses.find((b: any) => b.type === 'skill_bonus');
        if (bonus?.value) modifier += bonus.value;
      }
    }

    // Add helper bonus (+1 per helper)
    modifier += helperIds.length;

    return modifier;
  }, [helperIds, selectedToolIds, tools]);

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

    if (!leaderId || !biomeId || !nodeId) {
      return; // Required fields not filled
    }

    const activityData: ForagingData = {
      type: 'foraging',
      biomeId,
      nodeId,
      tableId: tableId || '',
      toolIds: selectedToolIds,
      leaderSkill: leaderForagingSkill,
      skillModifier,
    };

    onSubmit({
      leaderId,
      helperIds,
      activityData,
    });
  };

  // Check if form is valid
  const isFormValid = leaderId && biomeId && nodeId;

  return (
    <form
      onSubmit={handleSubmit}
      className="foraging-task-form bg-gray-800/60 border border-gray-700 rounded-lg p-4 mb-4"
      data-testid="foraging-task-form"
    >
      {/* Form Header */}
      <div className="flex justify-between items-center mb-4">
        <h4 className="font-medium text-gray-100">New Foraging Task</h4>
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
          className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
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
                    ? 'bg-green-900/50 border-green-500 text-green-200'
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

      {/* Biome Selection */}
      <div className="form-group mb-4">
        <label htmlFor="biome-select" className="block text-sm font-medium text-gray-300 mb-1">
          Biome <span className="text-red-400">*</span>
        </label>
        {biomes.length === 0 ? (
          <p className="text-sm text-yellow-400 italic" data-testid="no-biomes-message">
            No foraging areas at current location
          </p>
        ) : biomes.length === 1 ? (
          <div
            className="w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded text-gray-100"
            data-testid="biome-select"
          >
            {biomes[0].name} <span className="text-xs text-gray-400">— current location</span>
          </div>
        ) : (
          <select
            id="biome-select"
            value={biomeId}
            onChange={(e) => {
              setBiomeId(e.target.value);
              setNodeId(''); // Reset node when biome changes
            }}
            className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
            required
            data-testid="biome-select"
          >
            <option value="">Select biome...</option>
            {biomes.map((biome) => (
              <option key={biome.id} value={biome.id}>
                {biome.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Node Selection */}
      <div className="form-group mb-4">
        <label htmlFor="node-select" className="block text-sm font-medium text-gray-300 mb-1">
          Target Node <span className="text-red-400">*</span>
        </label>
        <select
          id="node-select"
          value={nodeId}
          onChange={(e) => setNodeId(e.target.value)}
          className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
          required
          data-testid="node-select"
        >
          <option value="">Select node...</option>
          {availableNodes.map((node) => (
            <option key={node.id} value={node.id}>
              {node.name} ({node.category})
            </option>
          ))}
        </select>
      </div>

      {/* Table Selection (Optional) */}
      <div className="form-group mb-4">
        <label htmlFor="table-select" className="block text-sm font-medium text-gray-300 mb-1">
          Loot Table (optional)
        </label>
        <select
          id="table-select"
          value={tableId}
          onChange={(e) => setTableId(e.target.value)}
          className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
          data-testid="table-select"
        >
          <option value="">Default table</option>
          {tables.map((table) => (
            <option key={table.id} value={table.id}>
              {table.name}
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
          <p className="text-sm text-gray-500 italic">No foraging tools available</p>
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
                      ? 'bg-green-900/50 border-green-500 text-green-200 cursor-pointer'
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

      {/* Skill Modifier Summary */}
      <div className="bg-gray-900/50 border border-gray-700 rounded p-2 mb-4">
        <p className="text-sm text-gray-300">
          Total Skill Modifier:{' '}
          <span className={`font-medium ${(skillModifier + leaderFatiguePenalty) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {(skillModifier + leaderFatiguePenalty) >= 0 ? '+' : ''}{skillModifier + leaderFatiguePenalty}
          </span>
        </p>
        {leaderFatiguePenalty !== 0 && (
          <p className="text-xs text-red-400 mt-1">
            Fatigue ({leaderFatigueStatus}): {leaderFatiguePenalty}
          </p>
        )}
      </div>

      {/* Form Actions */}
      <div className="form-actions flex gap-2">
        <button
          type="submit"
          disabled={!isFormValid}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed"
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
