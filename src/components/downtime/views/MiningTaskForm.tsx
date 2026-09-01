/**
 * Mining Task Form
 *
 * Two-method mining form:
 * - Surface Prospecting: fast, low yield, 1 slot (locate + harvest combined)
 * - Deep Mining: requires mapped site, higher yield, higher danger
 */

import { useState, useMemo, useCallback } from 'react';
import { HardHat, Mountain, Shovel, X } from 'lucide-react';
import type { DowntimeState, MiningData, MiningMethod, MiningSkill, MiningSite } from '../../../types/downtime';
import type { Character, GatheringTool } from '../../../types/campaign';
import {
  MINING_SKILL_LABELS,
  LOCATE_SKILLS,
  EXTRACTION_SKILLS,
  MINERALS,
  SPECIFIC_RESOURCE_PENALTIES,
  getTeamBonus,
  type MineralDef,
} from '../../../constants/mining';
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

interface MiningTaskFormProps {
  characters: Character[];
  tools: GatheringTool[];
  miningSites: MiningSite[];
  state: DowntimeState;
  currentDayKey: number;
  currentSlot: number;
  onSubmit: (data: {
    leaderId: string;
    helperIds: string[];
    activityData: MiningData;
  }) => void;
  onSubmitBatch?: (payloads: CreateTaskPayload[]) => ValidationResult[];
  onCancel: () => void;
}

// ============================================================================
// SKILL EXTRACTION HELPERS
// ============================================================================

const MINING_SKILL_NAMES: Record<MiningSkill, string[]> = {
  prospecting: ['Prospecting'],
  geology: ['Geology'],
  engineerMining: ['Engineer (Mining)', 'Engineer/Mining'],
  mining: ['Mining'],
};

function getCharacterMiningSkills(character: Character): { skill: MiningSkill; level: number }[] {
  const skills: { skill: MiningSkill; level: number }[] = [];
  const charSkills = (character as any).skills ?? (character as any).characterSheet?.skills ?? [];

  for (const [skillKey, skillNames] of Object.entries(MINING_SKILL_NAMES) as [MiningSkill, string[]][]) {
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

  if (skills.length === 0) {
    skills.push({ skill: 'prospecting', level: 10 });
  }

  return skills;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function MiningTaskForm({
  characters,
  tools,
  miningSites,
  state,
  currentDayKey,
  currentSlot,
  onSubmit,
  onSubmitBatch,
  onCancel,
}: MiningTaskFormProps) {
  const downtimeContext = useOptionalDowntimeContext();
  // Form state
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [batchLeaderIds, setBatchLeaderIds] = useState<string[]>([]);
  const [batchToolIds, setBatchToolIds] = useState<Record<string, string[]>>({});
  const [batchErrors, setBatchErrors] = useState<Record<string, ValidationResult>>({});
  const [method, setMethod] = useState<MiningMethod>('Surface Prospecting');
  const [leaderId, setLeaderId] = useState('');
  const [helperIds, setHelperIds] = useState<string[]>([]);
  const [locateSkill, setLocateSkill] = useState<MiningSkill>('prospecting');
  const [extractionSkill, setExtractionSkill] = useState<MiningSkill>('prospecting');
  const [siteId, setSiteId] = useState('');
  const [targetResourceId, setTargetResourceId] = useState('');
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>([]);
  const [dangerMode, setDangerMode] = useState<'full' | 'lite'>('lite');

  // Context flags
  const [hasDetailedMaps, setHasDetailedMaps] = useState(false);
  const [knownRichDeposit, setKnownRichDeposit] = useState(false);
  const [randomUnexplored, setRandomUnexplored] = useState(false);
  const [hasSupervisor, setHasSupervisor] = useState(false);
  const [hasProperTools, setHasProperTools] = useState(false);
  const [isImprovisedTools, setIsImprovisedTools] = useState(false);

  // Available characters
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
    () => (leaderCharacter ? getCharacterMiningSkills(leaderCharacter) : []),
    [leaderCharacter]
  );

  const locateSkillLevel = useMemo(() => {
    const found = leaderSkills.find((s) => s.skill === locateSkill);
    return found?.level ?? 10;
  }, [leaderSkills, locateSkill]);

  const extractionSkillLevel = useMemo(() => {
    const found = leaderSkills.find((s) => s.skill === extractionSkill);
    return found?.level ?? 10;
  }, [leaderSkills, extractionSkill]);

  // Fatigue penalty
  const fatiguePenalty = useMemo(() => {
    if (!leaderId) return 0;
    const fatigueStatus = selectCharacterFatigueStatus(state, leaderId, currentDayKey, currentSlot);
    return getFatiguePenalty(fatigueStatus);
  }, [state, leaderId, currentDayKey, currentSlot]);

  // Available helpers
  const availableHelpers = useMemo(
    () => availableCharacters.filter((c) => c.id !== leaderId),
    [availableCharacters, leaderId]
  );

  // Available mapped sites (not depleted)
  const availableSites = useMemo(
    () => miningSites.filter((s) => s.mapped && !s.depleted),
    [miningSites]
  );

  // Tool bonus calculation
  const toolBonus = useMemo(() => {
    return selectedToolIds.reduce((sum, toolId) => {
      const tool = tools.find((t) => t.id === toolId);
      if (!tool) return sum;
      return sum + (tool.skillBonus ?? 0);
    }, 0);
  }, [selectedToolIds, tools]);

  const teamBonus = getTeamBonus(helperIds.length);
  const totalSkillModifier = toolBonus + fatiguePenalty + teamBonus;

  // Target resource for penalty display
  const targetMineral: MineralDef | undefined = useMemo(
    () => (targetResourceId ? MINERALS.find((m) => m.id === targetResourceId) : undefined),
    [targetResourceId]
  );

  // Form validation
  const isFormValid = useMemo(() => {
    if (isBatchMode ? batchLeaderIds.length === 0 : !leaderId) return false;
    if (method === 'Deep Mining' && !siteId) return false;
    return true;
  }, [isBatchMode, batchLeaderIds, leaderId, method, siteId]);

  // Handle submit
  const handleSubmit = useCallback(() => {
    if (!isFormValid) return;

    if (isBatchMode) {
      const payloads: CreateTaskPayload[] = batchLeaderIds.map((batchLeaderId) => {
        const character = characters.find((candidate) => candidate.id === batchLeaderId);
        const skills = character ? getCharacterMiningSkills(character) : [];
        const rowLocateSkill = skills.find((entry) => entry.skill === locateSkill)?.level ?? 10;
        const rowExtractionSkill = skills.find((entry) => entry.skill === extractionSkill)?.level ?? 10;
        const toolIds = batchToolIds[batchLeaderId] ?? [];
        const rowToolBonus = toolIds.reduce((sum, toolId) => {
          const tool = tools.find((candidate) => candidate.id === toolId);
          return sum + (tool?.skillBonus ?? 0);
        }, 0);
        const fatigueStatus = selectCharacterFatigueStatus(state, batchLeaderId, currentDayKey, currentSlot);

        return {
          activityType: 'mining',
          dayKey: currentDayKey,
          slot: currentSlot,
          leaderId: batchLeaderId,
          helperIds: [],
          activityData: {
            type: 'mining',
            method,
            zoneId: siteId ? (availableSites.find((site) => site.id === siteId)?.zoneId ?? '') : '',
            siteId: method === 'Deep Mining' ? siteId : undefined,
            targetResourceId: targetResourceId || undefined,
            locateSkill,
            extractionSkill,
            leaderLocateSkill: rowLocateSkill,
            leaderExtractionSkill: rowExtractionSkill,
            toolIds,
            skillModifier: rowToolBonus + getFatiguePenalty(fatigueStatus),
            dangerMode,
            contextFlags: {
              hasDetailedMaps,
              knownRichDeposit,
              randomUnexplored,
              hasSupervisor,
              hasProperTools,
              isImprovisedTools,
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

    const activityData: MiningData = {
      type: 'mining',
      method,
      zoneId: siteId ? (availableSites.find((s) => s.id === siteId)?.zoneId ?? '') : '',
      siteId: method === 'Deep Mining' ? siteId : undefined,
      targetResourceId: targetResourceId || undefined,
      locateSkill,
      extractionSkill,
      leaderLocateSkill: locateSkillLevel,
      leaderExtractionSkill: extractionSkillLevel,
      toolIds: selectedToolIds,
      skillModifier: totalSkillModifier,
      dangerMode,
      contextFlags: {
        hasDetailedMaps,
        knownRichDeposit,
        randomUnexplored,
        hasSupervisor,
        hasProperTools,
        isImprovisedTools,
      },
    };

    onSubmit({
      leaderId,
      helperIds,
      activityData,
    });
  }, [
    isFormValid, method, siteId, availableSites, targetResourceId,
    locateSkill, extractionSkill, locateSkillLevel, extractionSkillLevel,
    selectedToolIds, totalSkillModifier, dangerMode,
    hasDetailedMaps, knownRichDeposit, randomUnexplored, hasSupervisor,
    hasProperTools, isImprovisedTools, leaderId, helperIds, onSubmit,
    isBatchMode, batchLeaderIds, batchToolIds, characters, tools, state,
    currentDayKey, currentSlot, onSubmitBatch, downtimeContext, onCancel,
  ]);

  const toggleHelper = useCallback((helperId: string) => {
    setHelperIds((prev) =>
      prev.includes(helperId) ? prev.filter((id) => id !== helperId) : [...prev, helperId]
    );
  }, []);

  return (
    <div className="mining-task-form bg-surface-1/60 border border-edge rounded-lg p-4 mb-4" data-testid="mining-task-form">
      <div className="flex justify-between items-center mb-3">
        <h4 className="font-medium text-fg-bright flex items-center gap-2">
          <HardHat className="w-4 h-4 text-warning-400" />
          New Mining Task
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
          className="rounded border-edge-strong bg-surface-0 text-warning-600 focus:ring-warning-500"
        />
        Batch assign
      </label>

      {/* Method Selector */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-fg-secondary mb-1">Method</label>
        <div className="flex gap-1" data-testid="method-selector">
          <button
            type="button"
            onClick={() => { setMethod('Surface Prospecting'); setSiteId(''); }}
            className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-l-lg border transition-colors ${
              method === 'Surface Prospecting'
                ? 'bg-warning-600 text-white border-warning-600'
                : 'bg-surface-1 text-fg-secondary border-edge-strong hover:bg-surface-2'
            }`}
          >
            <Shovel className="w-3.5 h-3.5" />
            Surface Prospecting
          </button>
          <button
            type="button"
            onClick={() => setMethod('Deep Mining')}
            className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-r-lg border transition-colors ${
              method === 'Deep Mining'
                ? 'bg-warning-600 text-white border-warning-600'
                : 'bg-surface-1 text-fg-secondary border-edge-strong hover:bg-surface-2'
            }`}
          >
            <Mountain className="w-3.5 h-3.5" />
            Deep Mining
          </button>
        </div>
        <p className="text-xs text-fg-muted mt-1">
          {method === 'Surface Prospecting'
            ? 'Locate + harvest in 1 slot. Low yield, low danger.'
            : 'Extract from a mapped site. 1 slot per extraction. Higher yield, higher danger.'}
        </p>
      </div>

      {/* Leader Selection */}
      {!isBatchMode ? <div className="mb-3">
        <label htmlFor="mining-leader-select" className="block text-sm font-medium text-fg-secondary mb-1">
          Leader
        </label>
        <select
          id="mining-leader-select"
          value={leaderId}
          onChange={(e) => { setLeaderId(e.target.value); setHelperIds([]); }}
          className="w-full px-3 py-2 bg-surface-0 border border-edge-strong rounded text-fg-bright text-sm focus:outline-none focus:ring-2 focus:ring-warning-500 focus:border-warning-500"
        >
          <option value="">Select a leader...</option>
          {availableCharacters.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div> : (
        <div className="mb-3">
          <label htmlFor="mining-batch-leaders" className="block text-sm font-medium text-fg-secondary mb-1">Leaders</label>
          <select
            id="mining-batch-leaders"
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

      {/* Locate Skill Selection */}
      {(leaderId || isBatchMode) && (
        <div className="mb-3">
          <label htmlFor="locate-skill-select" className="block text-sm font-medium text-fg-secondary mb-1">
            Locate Skill
          </label>
          <select
            id="locate-skill-select"
            value={locateSkill}
            onChange={(e) => setLocateSkill(e.target.value as MiningSkill)}
            className="w-full px-3 py-2 bg-surface-0 border border-edge-strong rounded text-fg-bright text-sm focus:outline-none focus:ring-2 focus:ring-warning-500 focus:border-warning-500"
          >
            {isBatchMode ? LOCATE_SKILLS.map((skill) => (
              <option key={skill} value={skill}>{MINING_SKILL_LABELS[skill]}</option>
            )) : (
              <>
                {leaderSkills
                  .filter((s) => LOCATE_SKILLS.includes(s.skill))
                  .map((s) => (
                    <option key={s.skill} value={s.skill}>
                      {MINING_SKILL_LABELS[s.skill]} — Level {s.level}
                    </option>
                  ))}
                {leaderSkills.filter((s) => LOCATE_SKILLS.includes(s.skill)).length === 0 && (
                  <option value="prospecting">Prospecting (IQ) — Default 10</option>
                )}
              </>
            )}
          </select>
        </div>
      )}

      {/* Extraction Skill Selection */}
      {(leaderId || isBatchMode) && (
        <div className="mb-3">
          <label htmlFor="extraction-skill-select" className="block text-sm font-medium text-fg-secondary mb-1">
            Extraction Skill
          </label>
          <select
            id="extraction-skill-select"
            value={extractionSkill}
            onChange={(e) => setExtractionSkill(e.target.value as MiningSkill)}
            className="w-full px-3 py-2 bg-surface-0 border border-edge-strong rounded text-fg-bright text-sm focus:outline-none focus:ring-2 focus:ring-warning-500 focus:border-warning-500"
          >
            {isBatchMode ? EXTRACTION_SKILLS.map((skill) => (
              <option key={skill} value={skill}>{MINING_SKILL_LABELS[skill]}</option>
            )) : (
              <>
                {leaderSkills
                  .filter((s) => EXTRACTION_SKILLS.includes(s.skill))
                  .map((s) => (
                    <option key={s.skill} value={s.skill}>
                      {MINING_SKILL_LABELS[s.skill]} — Level {s.level}
                      {s.skill === 'prospecting' ? ' (−2 without proper mining skill)' : ''}
                    </option>
                  ))}
                {leaderSkills.filter((s) => EXTRACTION_SKILLS.includes(s.skill)).length === 0 && (
                  <option value="prospecting">Prospecting (IQ) — Default 10 (−2)</option>
                )}
              </>
            )}
          </select>
        </div>
      )}

      {/* Mapped Site Selection (Deep Mining only) */}
      {method === 'Deep Mining' && (
        <div className="mb-3">
          <label htmlFor="site-select" className="block text-sm font-medium text-fg-secondary mb-1">
            Mapped Site
          </label>
          {availableSites.length > 0 ? (
            <select
              id="site-select"
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
              className="w-full px-3 py-2 bg-surface-0 border border-edge-strong rounded text-fg-bright text-sm focus:outline-none focus:ring-2 focus:ring-warning-500 focus:border-warning-500"
            >
              <option value="">Select a site...</option>
              {availableSites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name} — {site.depositSize} ({site.remainingUnits}/{site.totalUnits} units)
                </option>
              ))}
            </select>
          ) : (
            <p className="text-sm text-yellow-400 italic">
              No mapped sites available. Use Surface Prospecting to discover sites first.
            </p>
          )}
        </div>
      )}

      {/* Target Resource (optional) */}
      {method === 'Surface Prospecting' && (
        <div className="mb-3">
          <label htmlFor="target-resource-select" className="block text-sm font-medium text-fg-secondary mb-1">
            Target Resource (optional)
          </label>
          <select
            id="target-resource-select"
            value={targetResourceId}
            onChange={(e) => setTargetResourceId(e.target.value)}
            className="w-full px-3 py-2 bg-surface-0 border border-edge-strong rounded text-fg-bright text-sm focus:outline-none focus:ring-2 focus:ring-warning-500 focus:border-warning-500"
          >
            <option value="">Any resource (no penalty)</option>
            {MINERALS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.rarity}) — Penalty: {SPECIFIC_RESOURCE_PENALTIES[m.rarity]}
              </option>
            ))}
          </select>
          {targetMineral && (
            <p className="text-xs text-fg-muted mt-1">
              Targeting penalty: {SPECIFIC_RESOURCE_PENALTIES[targetMineral.rarity]} (rarity: {targetMineral.rarity})
            </p>
          )}
        </div>
      )}

      {/* Helpers */}
      {!isBatchMode && leaderId && availableHelpers.length > 0 && (
        <div className="mb-3">
          <label className="block text-sm font-medium text-fg-secondary mb-1">
            Helpers ({helperIds.length}) {teamBonus > 0 && <span className="text-success-400 text-xs">+{teamBonus} team bonus</span>}
          </label>
          <div className="flex flex-wrap gap-1">
            {availableHelpers.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleHelper(c.id)}
                className={`px-2 py-1 text-xs rounded border transition-colors ${
                  helperIds.includes(c.id)
                    ? 'bg-warning-900/50 border-warning-500 text-warning-200'
                    : 'bg-surface-1 border-edge-strong text-fg-secondary hover:bg-surface-2'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
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

      {/* Context Modifiers */}
      <div className="mb-3">
        <label className="block text-sm font-medium text-fg-secondary mb-1">Context Modifiers</label>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex items-center gap-1.5 text-xs text-fg-secondary">
            <input type="checkbox" checked={hasDetailedMaps} onChange={(e) => setHasDetailedMaps(e.target.checked)} className="rounded" />
            Detailed Maps/Notes (+1)
          </label>
          <label className="flex items-center gap-1.5 text-xs text-fg-secondary">
            <input type="checkbox" checked={knownRichDeposit} onChange={(e) => setKnownRichDeposit(e.target.checked)} className="rounded" />
            Known Rich Deposit (+2)
          </label>
          <label className="flex items-center gap-1.5 text-xs text-fg-secondary">
            <input type="checkbox" checked={randomUnexplored} onChange={(e) => setRandomUnexplored(e.target.checked)} className="rounded" />
            Random Unexplored (-2)
          </label>
          <label className="flex items-center gap-1.5 text-xs text-fg-secondary">
            <input type="checkbox" checked={hasSupervisor} onChange={(e) => setHasSupervisor(e.target.checked)} className="rounded" />
            Supervisor 15+ (+5)
          </label>
          <label className="flex items-center gap-1.5 text-xs text-fg-secondary">
            <input
              type="checkbox"
              checked={hasProperTools}
              onChange={(e) => { setHasProperTools(e.target.checked); if (e.target.checked) setIsImprovisedTools(false); }}
              className="rounded"
            />
            Proper Tools (+2)
          </label>
          <label className="flex items-center gap-1.5 text-xs text-fg-secondary">
            <input
              type="checkbox"
              checked={isImprovisedTools}
              onChange={(e) => { setIsImprovisedTools(e.target.checked); if (e.target.checked) setHasProperTools(false); }}
              className="rounded"
            />
            Improvised/No Tools (-2)
          </label>
        </div>
      </div>

      {/* Danger Mode (Deep Mining only) */}
      {method === 'Deep Mining' && (
        <div className="mb-3">
          <label className="block text-sm font-medium text-fg-secondary mb-1">Danger Mode</label>
          <div className="flex gap-2">
            <label className="flex items-center gap-1.5 text-xs text-fg-secondary">
              <input
                type="radio"
                name="dangerMode"
                checked={dangerMode === 'lite'}
                onChange={() => setDangerMode('lite')}
              />
              Lite (events on failures + crits)
            </label>
            <label className="flex items-center gap-1.5 text-xs text-fg-secondary">
              <input
                type="radio"
                name="dangerMode"
                checked={dangerMode === 'full'}
                onChange={() => setDangerMode('full')}
              />
              Full (events every extraction)
            </label>
          </div>
        </div>
      )}

      {/* Skill Summary */}
      {!isBatchMode && leaderId && (
        <div className="mb-4 bg-surface-0/50 border border-edge rounded p-3 text-sm">
          <p className="text-fg-primary">
            <span className="font-medium">Locate Skill:</span> {locateSkillLevel}
            <span className="ml-2 font-medium">Extraction Skill:</span> {extractionSkillLevel}
          </p>
          <p className="text-fg-primary">
            {toolBonus !== 0 && (
              <span className={toolBonus >= 0 ? 'text-success-400' : 'text-danger-400'}>
                Tools: {toolBonus >= 0 ? '+' : ''}{toolBonus}
              </span>
            )}
            {teamBonus > 0 && (
              <span className="text-success-400 ml-2">Team: +{teamBonus}</span>
            )}
            {fatiguePenalty !== 0 && (
              <span className="text-danger-400 ml-2">Fatigue: {fatiguePenalty}</span>
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
              ? 'bg-warning-600 text-white hover:bg-warning-700'
              : 'bg-surface-2 text-fg-faint cursor-not-allowed'
          }`}
        >
          Create Task
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm rounded border border-edge-strong text-fg-secondary hover:bg-surface-2 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
