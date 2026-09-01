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
  selectReservedToolIdsForSlot,
} from '../../../state/downtime/downtimeSelectors';
import { ToolSelector } from './shared/ToolSelector';
import { ValidationError } from './shared/ValidationError';
import { useOptionalDowntimeContext } from '../DowntimeContext';
import type { CreateTaskPayload } from '../../../state/downtime/downtimeActions';
import type { ValidationResult } from '../../../state/downtime/downtimeErrors';

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
  onSubmitBatch?: (payloads: CreateTaskPayload[]) => ValidationResult[];
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
  onSubmitBatch,
  onCancel,
}: ForagingTaskFormProps) {
  const downtimeContext = useOptionalDowntimeContext();
  // Form state
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [batchLeaderIds, setBatchLeaderIds] = useState<string[]>([]);
  const [batchToolIds, setBatchToolIds] = useState<Record<string, string[]>>({});
  const [batchErrors, setBatchErrors] = useState<Record<string, ValidationResult>>({});
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
  const reservedToolIds = useMemo(
    () => selectReservedToolIdsForSlot(state, currentDayKey, currentSlot),
    [state, currentDayKey, currentSlot]
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
    if ((isBatchMode ? batchLeaderIds.length === 0 : !leaderId) || !zoneId) return false;
    if (mode === 'category' && !targetCategory) return false;
    if (mode === 'specific' && !targetItemId) return false;
    return true;
  }, [isBatchMode, batchLeaderIds, leaderId, zoneId, mode, targetCategory, targetItemId]);

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

    if (isBatchMode) {
      const payloads: CreateTaskPayload[] = batchLeaderIds.map((batchLeaderId) => {
        const character = characters.find((candidate) => candidate.id === batchLeaderId);
        const skills = character ? getCharacterForageSkills(character) : [];
        const rowSkillLevel = skills.find((entry) => entry.skill === skillUsed)?.level ?? 10;
        const toolIds = batchToolIds[batchLeaderId] ?? [];
        const rowToolBonus = toolIds.reduce((sum, toolId) => {
          const tool = tools.find((candidate) => candidate.id === toolId);
          return sum + (tool?.skillBonus ?? 0);
        }, 0);
        const fatigueStatus = selectCharacterFatigueStatus(state, batchLeaderId, currentDayKey, currentSlot);

        return {
          activityType: 'foraging',
          dayKey: currentDayKey,
          slot: currentSlot,
          leaderId: batchLeaderId,
          helperIds: [],
          activityData: {
            type: 'foraging',
            zoneId,
            mode,
            targetCategory: mode === 'category' && targetCategory !== '' ? targetCategory : undefined,
            targetItemId: mode === 'specific' ? targetItemId : undefined,
            skillUsed,
            toolIds,
            leaderSkill: rowSkillLevel,
            skillModifier: rowToolBonus + getFatiguePenalty(fatigueStatus),
            contextFlags: {
              hasMapOrGuide,
              isUnfamiliarOrHostile,
              isPeakSeason,
              isOffSeason,
              hasProperTools,
              isDenseOrDangerousTerrain,
            },
          },
        };
      });
      const results = onSubmitBatch?.(payloads)
        ?? downtimeContext?.createDowntimeTasksBatch(payloads)
        ?? payloads.map(() => ({ valid: false, message: 'Batch submission is unavailable' }));
      const nextErrors: Record<string, ValidationResult> = {};
      results.forEach((result, index) => {
        const rowId = batchLeaderIds[index];
        if (!result.valid && rowId) nextErrors[rowId] = result;
      });
      setBatchErrors(nextErrors);
      if (results.every((result) => result.valid)) onCancel();
      return;
    }

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
    isBatchMode, batchLeaderIds, batchToolIds, characters, tools, state,
    currentDayKey, currentSlot, onSubmitBatch, downtimeContext, onCancel,
  ]);

  // Toggle helper
  const toggleHelper = useCallback((helperId: string) => {
    setHelperIds((prev) =>
      prev.includes(helperId)
        ? prev.filter((id) => id !== helperId)
        : [...prev, helperId]
    );
  }, []);

  // Get target item for penalty display
  const targetItem = useMemo(
    () => (targetItemId ? forageItems.find((i) => i.id === targetItemId) : undefined),
    [targetItemId, forageItems]
  );

  return (
    <div className="foraging-task-form bg-surface-1/60 border border-edge rounded-lg p-4 mb-4" data-testid="foraging-task-form">
      <div className="flex justify-between items-center mb-3">
        <h4 className="font-medium text-fg-bright flex items-center gap-2">
          <Leaf className="w-4 h-4 text-success-400" />
          New Foraging Task
        </h4>
        <button type="button" onClick={onCancel} className="text-fg-muted hover:text-fg-primary">
          <X className="w-5 h-5" />
        </button>
      </div>

      <label className="mb-4 flex items-center gap-2 text-sm text-fg-secondary">
        <input
          type="checkbox"
          checked={isBatchMode}
          onChange={(event) => {
            setIsBatchMode(event.target.checked);
            setBatchErrors({});
          }}
          data-testid="batch-assign-toggle"
          className="rounded border-edge-strong bg-surface-0 text-success-600 focus:ring-success-500"
        />
        Batch assign
      </label>

      {/* Mode Selector */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-fg-secondary mb-1">Mode</label>
        <div className="flex gap-1" data-testid="mode-selector">
          <button
            type="button"
            onClick={() => handleModeChange('general')}
            className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-l-lg border transition-colors ${
              mode === 'general'
                ? 'bg-success-600 text-white border-success-600'
                : 'bg-surface-1 text-fg-secondary border-edge-strong hover:bg-surface-2'
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
                ? 'bg-success-600 text-white border-success-600'
                : 'bg-surface-1 text-fg-secondary border-edge-strong hover:bg-surface-2'
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
                ? 'bg-success-600 text-white border-success-600'
                : 'bg-surface-1 text-fg-secondary border-edge-strong hover:bg-surface-2'
            }`}
            data-testid="mode-specific"
          >
            <Crosshair className="w-3.5 h-3.5" />
            Specific
          </button>
        </div>
        <p className="text-xs text-fg-muted mt-1">
          {mode === 'general' && 'Gather whatever the zone provides. No targeting penalty.'}
          {mode === 'category' && 'Target a specific category of items (e.g., Mushrooms, Herbs).'}
          {mode === 'specific' && 'Target a specific item. Rarity penalty applies.'}
        </p>
      </div>

      {/* Leader Selection */}
      {!isBatchMode ? <div className="mb-3">
        <label htmlFor="leader-select" className="block text-sm font-medium text-fg-secondary mb-1">
          Leader
        </label>
        <select
          id="leader-select"
          value={leaderId}
          onChange={(e) => {
            setLeaderId(e.target.value);
            setHelperIds([]);
          }}
          className="w-full px-3 py-2 bg-surface-0 border border-edge-strong rounded text-fg-bright text-sm focus:outline-none focus:ring-2 focus:ring-success-500 focus:border-success-500"
          data-testid="leader-select"
        >
          <option value="">Select a leader...</option>
          {availableCharacters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div> : (
        <div className="mb-3">
          <label htmlFor="foraging-batch-leaders" className="block text-sm font-medium text-fg-secondary mb-1">Leaders</label>
          <select
            id="foraging-batch-leaders"
            multiple
            value={batchLeaderIds}
            onChange={(event) => {
              const nextIds = Array.from(event.currentTarget.selectedOptions, (option) => option.value);
              setBatchLeaderIds(nextIds);
              setBatchToolIds((current) => Object.fromEntries(
                Object.entries(current).filter(([characterId]) => nextIds.includes(characterId))
              ));
              setBatchErrors({});
            }}
            data-testid="batch-leader-select"
            className="w-full min-h-24 px-3 py-2 bg-surface-0 border border-edge-strong rounded text-fg-bright text-sm"
          >
            {availableCharacters.map((character) => (
              <option key={character.id} value={character.id}>{character.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Skill Selection */}
      {(leaderId || isBatchMode) && (
        <div className="mb-3">
          <label htmlFor="skill-select" className="block text-sm font-medium text-fg-secondary mb-1">
            Skill
          </label>
          <select
            id="skill-select"
            value={skillUsed}
            onChange={(e) => setSkillUsed(e.target.value as ForageSkill)}
            className="w-full px-3 py-2 bg-surface-0 border border-edge-strong rounded text-fg-bright text-sm focus:outline-none focus:ring-2 focus:ring-success-500 focus:border-success-500"
            data-testid="skill-select"
          >
            {isBatchMode ? (
              <>
                <option value="survival">{FORAGE_SKILL_LABELS.survival}</option>
                <option value="naturalist">{FORAGE_SKILL_LABELS.naturalist}</option>
                <option value="herbLore">{FORAGE_SKILL_LABELS.herbLore}</option>
              </>
            ) : leaderSkills.map((s) => (
              <option key={s.skill} value={s.skill}>
                {FORAGE_SKILL_LABELS[s.skill]} — Level {s.level}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Helpers */}
      {!isBatchMode && leaderId && availableHelpers.length > 0 && (
        <div className="mb-3">
          <label className="block text-sm font-medium text-fg-secondary mb-1">
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
                    ? 'bg-success-900/50 border-success-500 text-success-200'
                    : 'bg-surface-1 border-edge-strong text-fg-secondary hover:bg-surface-2'
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
        <label htmlFor="zone-select" className="block text-sm font-medium text-fg-secondary mb-1">
          Zone
        </label>
        {zones.length > 0 ? (
          <select
            id="zone-select"
            value={zoneId}
            onChange={(e) => setZoneId(e.target.value)}
            className="w-full px-3 py-2 bg-surface-0 border border-edge-strong rounded text-fg-bright text-sm focus:outline-none focus:ring-2 focus:ring-success-500 focus:border-success-500"
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
          <label htmlFor="category-select" className="block text-sm font-medium text-fg-secondary mb-1">
            Category
          </label>
          <select
            id="category-select"
            value={targetCategory}
            onChange={(e) => {
              setTargetCategory(e.target.value as ForageCategoryId);
              setTargetItemId('');
            }}
            className="w-full px-3 py-2 bg-surface-0 border border-edge-strong rounded text-fg-bright text-sm focus:outline-none focus:ring-2 focus:ring-success-500 focus:border-success-500"
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
          <label htmlFor="item-select" className="block text-sm font-medium text-fg-secondary mb-1">
            Target Item
          </label>
          {filteredItems.length > 0 ? (
            <select
              id="item-select"
              value={targetItemId}
              onChange={(e) => setTargetItemId(e.target.value)}
              className="w-full px-3 py-2 bg-surface-0 border border-edge-strong rounded text-fg-bright text-sm focus:outline-none focus:ring-2 focus:ring-success-500 focus:border-success-500"
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
            <p className="text-xs text-fg-muted mt-1">
              Targeting penalty: {FORAGE_SPECIFIC_PENALTIES[targetItem.tier]} (tier: {targetItem.tier})
            </p>
          )}
        </div>
      )}

      {/* Tools */}
      {!isBatchMode && tools.length > 0 && (
        <ToolSelector
          label="Tools"
          value={selectedToolIds}
          onChange={setSelectedToolIds}
          tools={tools}
          reservedToolIds={reservedToolIds}
          className="mb-3"
        />
      )}

      {isBatchMode && (
        <div className="space-y-3 mb-3" data-testid="batch-tool-rows">
          {batchLeaderIds.map((characterId) => {
            const character = characters.find((candidate) => candidate.id === characterId);
            const otherDraftTools = batchLeaderIds.flatMap((otherId) =>
              otherId === characterId ? [] : (batchToolIds[otherId] ?? [])
            );
            const error = batchErrors[characterId];
            return (
              <div key={characterId} className="rounded border border-edge bg-surface-0/40 p-3" data-testid={`batch-row-${characterId}`}>
                <p className="mb-2 text-sm font-medium text-fg-primary">{character?.name ?? characterId}</p>
                <ToolSelector
                  label={`${character?.name ?? characterId} tools`}
                  value={batchToolIds[characterId] ?? []}
                  onChange={(toolIds) => {
                    setBatchToolIds((current) => ({ ...current, [characterId]: toolIds }));
                    setBatchErrors((current) => {
                      const next = { ...current };
                      delete next[characterId];
                      return next;
                    });
                  }}
                  tools={tools}
                  reservedToolIds={new Set([...reservedToolIds, ...otherDraftTools])}
                />
                {error && (
                  <ValidationError
                    code={error.code ?? 'UNKNOWN_ERROR'}
                    message={error.message ?? 'Validation failed'}
                    meta={error.meta}
                    className="mt-2"
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Context Flags */}
      <div className="mb-3">
        <label className="block text-sm font-medium text-fg-secondary mb-1">Context Modifiers</label>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex items-center gap-1.5 text-xs text-fg-secondary">
            <input
              type="checkbox"
              checked={hasMapOrGuide}
              onChange={(e) => setHasMapOrGuide(e.target.checked)}
              className="rounded"
            />
            Map/Local Guide (+1)
          </label>
          <label className="flex items-center gap-1.5 text-xs text-fg-secondary">
            <input
              type="checkbox"
              checked={isUnfamiliarOrHostile}
              onChange={(e) => setIsUnfamiliarOrHostile(e.target.checked)}
              className="rounded"
            />
            Unfamiliar/Hostile (-2)
          </label>
          <label className="flex items-center gap-1.5 text-xs text-fg-secondary">
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
          <label className="flex items-center gap-1.5 text-xs text-fg-secondary">
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
          <label className="flex items-center gap-1.5 text-xs text-fg-secondary">
            <input
              type="checkbox"
              checked={hasProperTools}
              onChange={(e) => setHasProperTools(e.target.checked)}
              className="rounded"
            />
            Proper Tools (+2)
          </label>
          <label className="flex items-center gap-1.5 text-xs text-fg-secondary">
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
      {!isBatchMode && leaderId && (
        <div className="mb-4 bg-surface-0/50 border border-edge rounded p-3 text-sm">
          <p className="text-fg-primary">
            <span className="font-medium">Base Skill:</span> {selectedSkillLevel}
            {toolBonus !== 0 && (
              <span className={toolBonus >= 0 ? 'text-success-400' : 'text-danger-400'}>
                {' '}| Tools: {toolBonus >= 0 ? '+' : ''}{toolBonus}
              </span>
            )}
            {fatiguePenalty !== 0 && (
              <span className="text-danger-400">
                {' '}| Fatigue: {fatiguePenalty}
              </span>
            )}
          </p>
          <p className="text-fg-muted">
            Total Modifier: <span className={totalSkillModifier >= 0 ? 'text-success-400' : 'text-danger-400'}>
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
              ? 'bg-success-600 text-white hover:bg-success-700'
              : 'bg-surface-2 text-fg-faint cursor-not-allowed'
          }`}
          data-testid="submit-button"
        >
          Create Task
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm rounded border border-edge-strong text-fg-secondary hover:bg-surface-2 transition-colors"
          data-testid="cancel-button"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
