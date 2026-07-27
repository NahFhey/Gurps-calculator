/**
 * Foraging Task Form (Revamped)
 *
 * Three-mode foraging form:
 * - General: No target needed, system selects from zone weights
 * - Category: Target a specific category (e.g., Mushrooms, Herbs)
 * - Specific: Target a specific item with rarity penalties
 */

import { useState, useMemo, useCallback } from 'react';
import { Leaf, Search, Target, Crosshair, X } from 'lucide-react';
import type { DowntimeState, ForagingData } from '../../../types/downtime';
import type { Character, GatheringTool } from '../../../types/campaign';
import type { ForageZoneProfile, ForageItem, ForagingConfig, ForageMode, ForageCategoryId, ForageSkill } from '../../../types/foraging';
import { FORAGE_CATEGORY_META, FORAGE_CATEGORY_IDS, FORAGE_SKILL_LABELS, FORAGE_SPECIFIC_PENALTIES } from '../../../constants/foraging';
import {
  selectCharacterFatigueStatus,
  getFatiguePenalty,
  selectAvailableCharacterIdsForSlot,
} from '../../../state/downtime/downtimeSelectors';

// ============================================================================
// TYPES
// ============================================================================

interface ForagingTaskFormProps {
  characters: Character[];
  zones: ForageZoneProfile[];
  forageItems: ForageItem[];
  tools: GatheringTool[];
  foragingConfig: ForagingConfig;
  state: DowntimeState;
  currentDayKey: number;
  currentSlot: number;
  onSubmit: (data: {
    leaderId: string;
    helperIds: string[];
    activityData: ForagingData;
  }) => void;
  onCancel: () => void;
}

// ============================================================================
// SKILL EXTRACTION HELPERS
// ============================================================================

const FORAGE_SKILL_NAMES: Record<ForageSkill, string[]> = {
  survival: ['Survival'],
  naturalist: ['Naturalist'],
  herbLore: ['Herb Lore'],
};

function getCharacterForageSkills(character: Character): { skill: ForageSkill; level: number }[] {
  const skills: { skill: ForageSkill; level: number }[] = [];
  const charSkills = (character as any).skills ?? (character as any).characterSheet?.skills ?? [];

  for (const [skillKey, skillNames] of Object.entries(FORAGE_SKILL_NAMES) as [ForageSkill, string[]][]) {
    for (const name of skillNames) {
      const found = charSkills.find?.((s: any) =>
        typeof s === 'string'
          ? s.toLowerCase().includes(name.toLowerCase())
          : (s.name ?? '').toLowerCase().includes(name.toLowerCase())
      );
      if (found) {
        const level = typeof found === 'string' ? 10 : (found.level ?? found.points ?? 10);
        skills.push({ skill: skillKey, level });
      }
    }
  }

  // If no matching skills found, provide a default
  if (skills.length === 0) {
    skills.push({ skill: 'survival', level: 10 });
  }

  return skills;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ForagingTaskForm({
  characters,
  zones,
  forageItems,
  tools,
  foragingConfig: _foragingConfig,
  state,
  currentDayKey,
  currentSlot,
  onSubmit,
  onCancel,
}: ForagingTaskFormProps) {
  // Form state
  const [mode, setMode] = useState<ForageMode>('general');
  const [leaderId, setLeaderId] = useState('');
  const [helperIds, setHelperIds] = useState<string[]>([]);
  const [zoneId, setZoneId] = useState(zones.length > 0 ? zones[0].id : '');
  const [skillUsed, setSkillUsed] = useState<ForageSkill>('survival');
  const [targetCategory, setTargetCategory] = useState<ForageCategoryId | ''>('');
  const [targetItemId, setTargetItemId] = useState('');
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>([]);

  // Context flags
  const [hasMapOrGuide, setHasMapOrGuide] = useState(false);
  const [isUnfamiliarOrHostile, setIsUnfamiliarOrHostile] = useState(false);
  const [isPeakSeason, setIsPeakSeason] = useState(false);
  const [isOffSeason, setIsOffSeason] = useState(false);
  const [hasProperTools, setHasProperTools] = useState(false);
  const [isDenseOrDangerousTerrain, setIsDenseOrDangerousTerrain] = useState(false);

  // Available characters (not assigned to other tasks in this slot)
  const allCharacterIds = useMemo(() => characters.map((c) => c.id), [characters]);
  const availableIds = useMemo(
    () => selectAvailableCharacterIdsForSlot(state, currentDayKey, currentSlot, allCharacterIds),
    [state, currentDayKey, currentSlot, allCharacterIds]
  );
  const availableCharacters = useMemo(
    () => characters.filter((c) => availableIds.includes(c.id)),
    [characters, availableIds]
  );

  // Leader's skills
  const leaderCharacter = useMemo(
    () => characters.find((c) => c.id === leaderId),
    [characters, leaderId]
  );
  const leaderSkills = useMemo(
    () => (leaderCharacter ? getCharacterForageSkills(leaderCharacter) : []),
    [leaderCharacter]
  );
  const selectedSkillLevel = useMemo(() => {
    const found = leaderSkills.find((s) => s.skill === skillUsed);
    return found?.level ?? 10;
  }, [leaderSkills, skillUsed]);

  // Fatigue penalty for leader
  const fatiguePenalty = useMemo(() => {
    if (!leaderId) return 0;
    const fatigueStatus = selectCharacterFatigueStatus(state, leaderId, currentDayKey, currentSlot);
    return getFatiguePenalty(fatigueStatus);
  }, [state, leaderId, currentDayKey, currentSlot]);

  // Available helpers (all available minus leader)
  const availableHelpers = useMemo(
    () => availableCharacters.filter((c) => c.id !== leaderId),
    [availableCharacters, leaderId]
  );

  // Items filtered for specific mode
  const filteredItems = useMemo(() => {
    let items = forageItems;
    if (targetCategory) {
      items = items.filter((i) => i.categoryId === targetCategory);
    }
    if (zoneId) {
      items = items.filter((i) => {
        if (!i.zoneRestrictions || i.zoneRestrictions.length === 0) return true;
        return i.zoneRestrictions.includes(zoneId);
      });
    }
    return items;
  }, [forageItems, targetCategory, zoneId]);

  // Calculate total skill modifier (tools + fatigue)
  const toolBonus = useMemo(() => {
    return selectedToolIds.reduce((sum, toolId) => {
      const tool = tools.find((t) => t.id === toolId);
      if (!tool) return sum;
      return sum + (tool.skillBonus ?? 0);
    }, 0);
  }, [selectedToolIds, tools]);

  const totalSkillModifier = toolBonus + fatiguePenalty;

  // Form validation
  const isFormValid = useMemo(() => {
    if (!leaderId || !zoneId) return false;
    if (mode === 'category' && !targetCategory) return false;
    if (mode === 'specific' && !targetItemId) return false;
    return true;
  }, [leaderId, zoneId, mode, targetCategory, targetItemId]);

  // Handle mode change
  const handleModeChange = useCallback((newMode: ForageMode) => {
    setMode(newMode);
    // Reset target fields when switching modes
    setTargetCategory('');
    setTargetItemId('');
  }, []);

  // Handle submit
  const handleSubmit = useCallback(() => {
    if (!isFormValid) return;

    const activityData: ForagingData = {
      type: 'foraging',
      zoneId,
      mode,
      targetCategory: mode === 'category' && targetCategory !== '' ? targetCategory : undefined,
      targetItemId: mode === 'specific' ? targetItemId : undefined,
      skillUsed,
      toolIds: selectedToolIds,
      leaderSkill: selectedSkillLevel,
      skillModifier: totalSkillModifier,
      contextFlags: {
        hasMapOrGuide,
        isUnfamiliarOrHostile,
        isPeakSeason,
        isOffSeason,
        hasProperTools,
        isDenseOrDangerousTerrain,
      },
    };

    onSubmit({
      leaderId,
      helperIds,
      activityData,
    });
  }, [
    isFormValid, zoneId, mode, targetCategory, targetItemId, skillUsed,
    selectedToolIds, selectedSkillLevel, totalSkillModifier,
    hasMapOrGuide, isUnfamiliarOrHostile, isPeakSeason, isOffSeason,
    hasProperTools, isDenseOrDangerousTerrain, leaderId, helperIds, onSubmit,
  ]);

  // Toggle helper
  const toggleHelper = useCallback((helperId: string) => {
    setHelperIds((prev) =>
      prev.includes(helperId)
        ? prev.filter((id) => id !== helperId)
        : [...prev, helperId]
    );
  }, []);

  // Toggle tool
  const toggleTool = useCallback((toolId: string) => {
    setSelectedToolIds((prev) =>
      prev.includes(toolId)
        ? prev.filter((id) => id !== toolId)
        : [...prev, toolId]
    );
  }, []);

  // Get target item for penalty display
  const targetItem = useMemo(
    () => (targetItemId ? forageItems.find((i) => i.id === targetItemId) : undefined),
    [targetItemId, forageItems]
  );

  return (
    <div className="foraging-task-form bg-gray-800/60 border border-gray-700 rounded-lg p-4 mb-4" data-testid="foraging-task-form">
      <div className="flex justify-between items-center mb-3">
        <h4 className="font-medium text-gray-100 flex items-center gap-2">
          <Leaf className="w-4 h-4 text-green-400" />
          New Foraging Task
        </h4>
        <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-200">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Mode Selector */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-300 mb-1">Mode</label>
        <div className="flex gap-1" data-testid="mode-selector">
          <button
            type="button"
            onClick={() => handleModeChange('general')}
            className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-l-lg border transition-colors ${
              mode === 'general'
                ? 'bg-green-600 text-white border-green-600'
                : 'bg-gray-800 text-gray-300 border-gray-600 hover:bg-gray-700'
            }`}
            data-testid="mode-general"
          >
            <Search className="w-3.5 h-3.5" />
            General
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('category')}
            className={`flex items-center gap-1 px-3 py-1.5 text-sm border-y transition-colors ${
              mode === 'category'
                ? 'bg-green-600 text-white border-green-600'
                : 'bg-gray-800 text-gray-300 border-gray-600 hover:bg-gray-700'
            }`}
            data-testid="mode-category"
          >
            <Target className="w-3.5 h-3.5" />
            Category
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('specific')}
            className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-r-lg border transition-colors ${
              mode === 'specific'
                ? 'bg-green-600 text-white border-green-600'
                : 'bg-gray-800 text-gray-300 border-gray-600 hover:bg-gray-700'
            }`}
            data-testid="mode-specific"
          >
            <Crosshair className="w-3.5 h-3.5" />
            Specific
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          {mode === 'general' && 'Gather whatever the zone provides. No targeting penalty.'}
          {mode === 'category' && 'Target a specific category of items (e.g., Mushrooms, Herbs).'}
          {mode === 'specific' && 'Target a specific item. Rarity penalty applies.'}
        </p>
      </div>

      {/* Leader Selection */}
      <div className="mb-3">
        <label htmlFor="leader-select" className="block text-sm font-medium text-gray-300 mb-1">
          Leader
        </label>
        <select
          id="leader-select"
          value={leaderId}
          onChange={(e) => {
            setLeaderId(e.target.value);
            setHelperIds([]);
          }}
          className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
          data-testid="leader-select"
        >
          <option value="">Select a leader...</option>
          {availableCharacters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Skill Selection */}
      {leaderId && (
        <div className="mb-3">
          <label htmlFor="skill-select" className="block text-sm font-medium text-gray-300 mb-1">
            Skill
          </label>
          <select
            id="skill-select"
            value={skillUsed}
            onChange={(e) => setSkillUsed(e.target.value as ForageSkill)}
            className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
            data-testid="skill-select"
          >
            {leaderSkills.map((s) => (
              <option key={s.skill} value={s.skill}>
                {FORAGE_SKILL_LABELS[s.skill]} — Level {s.level}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Helpers */}
      {leaderId && availableHelpers.length > 0 && (
        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Helpers ({helperIds.length})
          </label>
          <div className="flex flex-wrap gap-1">
            {availableHelpers.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleHelper(c.id)}
                className={`px-2 py-1 text-xs rounded border transition-colors ${
                  helperIds.includes(c.id)
                    ? 'bg-green-900/50 border-green-500 text-green-200'
                    : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Zone Selection */}
      <div className="mb-3">
        <label htmlFor="zone-select" className="block text-sm font-medium text-gray-300 mb-1">
          Zone
        </label>
        {zones.length > 0 ? (
          <select
            id="zone-select"
            value={zoneId}
            onChange={(e) => setZoneId(e.target.value)}
            className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
            data-testid="zone-select"
          >
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </select>
        ) : (
          <p className="text-sm text-yellow-400 italic">
            No foraging zones at this location. Configure zone profiles in the Gathering Manager Environments tab.
          </p>
        )}
      </div>

      {/* Category Selection (Category and Specific modes) */}
      {(mode === 'category' || mode === 'specific') && (
        <div className="mb-3">
          <label htmlFor="category-select" className="block text-sm font-medium text-gray-300 mb-1">
            Category
          </label>
          <select
            id="category-select"
            value={targetCategory}
            onChange={(e) => {
              setTargetCategory(e.target.value as ForageCategoryId);
              setTargetItemId('');
            }}
            className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
            data-testid="category-select"
          >
            <option value="">Select a category...</option>
            {FORAGE_CATEGORY_IDS.map((catId) => (
              <option key={catId} value={catId}>
                {FORAGE_CATEGORY_META[catId].label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Item Selection (Specific mode only) */}
      {mode === 'specific' && targetCategory && (
        <div className="mb-3">
          <label htmlFor="item-select" className="block text-sm font-medium text-gray-300 mb-1">
            Target Item
          </label>
          {filteredItems.length > 0 ? (
            <select
              id="item-select"
              value={targetItemId}
              onChange={(e) => setTargetItemId(e.target.value)}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              data-testid="item-select"
            >
              <option value="">Select an item...</option>
              {filteredItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.tier}) — Penalty: {FORAGE_SPECIFIC_PENALTIES[item.tier]}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-sm text-yellow-400 italic">
              No items available for this category/zone combination.
            </p>
          )}
          {targetItem && (
            <p className="text-xs text-gray-400 mt-1">
              Targeting penalty: {FORAGE_SPECIFIC_PENALTIES[targetItem.tier]} (tier: {targetItem.tier})
            </p>
          )}
        </div>
      )}

      {/* Tools */}
      {tools.length > 0 && (
        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Tools
          </label>
          <div className="flex flex-wrap gap-1">
            {tools.map((tool) => (
              <button
                key={tool.id}
                type="button"
                onClick={() => toggleTool(tool.id)}
                className={`px-2 py-1 text-xs rounded border transition-colors ${
                  selectedToolIds.includes(tool.id)
                    ? 'bg-blue-900/50 border-blue-500 text-blue-200'
                    : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {tool.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Context Flags */}
      <div className="mb-3">
        <label className="block text-sm font-medium text-gray-300 mb-1">Context Modifiers</label>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex items-center gap-1.5 text-xs text-gray-300">
            <input
              type="checkbox"
              checked={hasMapOrGuide}
              onChange={(e) => setHasMapOrGuide(e.target.checked)}
              className="rounded"
            />
            Map/Local Guide (+1)
          </label>
          <label className="flex items-center gap-1.5 text-xs text-gray-300">
            <input
              type="checkbox"
              checked={isUnfamiliarOrHostile}
              onChange={(e) => setIsUnfamiliarOrHostile(e.target.checked)}
              className="rounded"
            />
            Unfamiliar/Hostile (-2)
          </label>
          <label className="flex items-center gap-1.5 text-xs text-gray-300">
            <input
              type="checkbox"
              checked={isPeakSeason}
              onChange={(e) => {
                setIsPeakSeason(e.target.checked);
                if (e.target.checked) setIsOffSeason(false);
              }}
              className="rounded"
            />
            Peak Season (+2)
          </label>
          <label className="flex items-center gap-1.5 text-xs text-gray-300">
            <input
              type="checkbox"
              checked={isOffSeason}
              onChange={(e) => {
                setIsOffSeason(e.target.checked);
                if (e.target.checked) setIsPeakSeason(false);
              }}
              className="rounded"
            />
            Off Season (-2)
          </label>
          <label className="flex items-center gap-1.5 text-xs text-gray-300">
            <input
              type="checkbox"
              checked={hasProperTools}
              onChange={(e) => setHasProperTools(e.target.checked)}
              className="rounded"
            />
            Proper Tools (+2)
          </label>
          <label className="flex items-center gap-1.5 text-xs text-gray-300">
            <input
              type="checkbox"
              checked={isDenseOrDangerousTerrain}
              onChange={(e) => setIsDenseOrDangerousTerrain(e.target.checked)}
              className="rounded"
            />
            Dense/Dangerous Terrain (-2)
          </label>
        </div>
      </div>

      {/* Skill Summary */}
      {leaderId && (
        <div className="mb-4 bg-gray-900/50 border border-gray-700 rounded p-3 text-sm">
          <p className="text-gray-200">
            <span className="font-medium">Base Skill:</span> {selectedSkillLevel}
            {toolBonus !== 0 && (
              <span className={toolBonus >= 0 ? 'text-green-400' : 'text-red-400'}>
                {' '}| Tools: {toolBonus >= 0 ? '+' : ''}{toolBonus}
              </span>
            )}
            {fatiguePenalty !== 0 && (
              <span className="text-red-400">
                {' '}| Fatigue: {fatiguePenalty}
              </span>
            )}
          </p>
          <p className="text-gray-400">
            Total Modifier: <span className={totalSkillModifier >= 0 ? 'text-green-400' : 'text-red-400'}>
              {totalSkillModifier >= 0 ? '+' : ''}{totalSkillModifier}
            </span>
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!isFormValid}
          className={`px-4 py-2 text-sm rounded font-medium transition-colors ${
            isFormValid
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
          data-testid="submit-button"
        >
          Create Task
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm rounded border border-gray-600 text-gray-300 hover:bg-gray-700 transition-colors"
          data-testid="cancel-button"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
