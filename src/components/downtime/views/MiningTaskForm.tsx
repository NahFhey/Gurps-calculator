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
} from '../../../state/downtime/downtimeSelectors';

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
  onCancel,
}: MiningTaskFormProps) {
  // Form state
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
    if (!leaderId) return false;
    if (method === 'Deep Mining' && !siteId) return false;
    return true;
  }, [leaderId, method, siteId]);

  // Handle submit
  const handleSubmit = useCallback(() => {
    if (!isFormValid) return;

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
  ]);

  const toggleHelper = useCallback((helperId: string) => {
    setHelperIds((prev) =>
      prev.includes(helperId) ? prev.filter((id) => id !== helperId) : [...prev, helperId]
    );
  }, []);

  const toggleTool = useCallback((toolId: string) => {
    setSelectedToolIds((prev) =>
      prev.includes(toolId) ? prev.filter((id) => id !== toolId) : [...prev, toolId]
    );
  }, []);

  return (
    <div className="mining-task-form bg-gray-800/60 border border-gray-700 rounded-lg p-4 mb-4" data-testid="mining-task-form">
      <div className="flex justify-between items-center mb-3">
        <h4 className="font-medium text-gray-100 flex items-center gap-2">
          <HardHat className="w-4 h-4 text-amber-400" />
          New Mining Task
        </h4>
        <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-200">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Method Selector */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-300 mb-1">Method</label>
        <div className="flex gap-1" data-testid="method-selector">
          <button
            type="button"
            onClick={() => { setMethod('Surface Prospecting'); setSiteId(''); }}
            className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-l-lg border transition-colors ${
              method === 'Surface Prospecting'
                ? 'bg-amber-600 text-white border-amber-600'
                : 'bg-gray-800 text-gray-300 border-gray-600 hover:bg-gray-700'
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
                ? 'bg-amber-600 text-white border-amber-600'
                : 'bg-gray-800 text-gray-300 border-gray-600 hover:bg-gray-700'
            }`}
          >
            <Mountain className="w-3.5 h-3.5" />
            Deep Mining
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          {method === 'Surface Prospecting'
            ? 'Locate + harvest in 1 slot. Low yield, low danger.'
            : 'Extract from a mapped site. 1 slot per extraction. Higher yield, higher danger.'}
        </p>
      </div>

      {/* Leader Selection */}
      <div className="mb-3">
        <label htmlFor="mining-leader-select" className="block text-sm font-medium text-gray-300 mb-1">
          Leader
        </label>
        <select
          id="mining-leader-select"
          value={leaderId}
          onChange={(e) => { setLeaderId(e.target.value); setHelperIds([]); }}
          className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
        >
          <option value="">Select a leader...</option>
          {availableCharacters.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Locate Skill Selection */}
      {leaderId && (
        <div className="mb-3">
          <label htmlFor="locate-skill-select" className="block text-sm font-medium text-gray-300 mb-1">
            Locate Skill
          </label>
          <select
            id="locate-skill-select"
            value={locateSkill}
            onChange={(e) => setLocateSkill(e.target.value as MiningSkill)}
            className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
          >
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
          </select>
        </div>
      )}

      {/* Extraction Skill Selection */}
      {leaderId && (
        <div className="mb-3">
          <label htmlFor="extraction-skill-select" className="block text-sm font-medium text-gray-300 mb-1">
            Extraction Skill
          </label>
          <select
            id="extraction-skill-select"
            value={extractionSkill}
            onChange={(e) => setExtractionSkill(e.target.value as MiningSkill)}
            className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
          >
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
          </select>
        </div>
      )}

      {/* Mapped Site Selection (Deep Mining only) */}
      {method === 'Deep Mining' && (
        <div className="mb-3">
          <label htmlFor="site-select" className="block text-sm font-medium text-gray-300 mb-1">
            Mapped Site
          </label>
          {availableSites.length > 0 ? (
            <select
              id="site-select"
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
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
          <label htmlFor="target-resource-select" className="block text-sm font-medium text-gray-300 mb-1">
            Target Resource (optional)
          </label>
          <select
            id="target-resource-select"
            value={targetResourceId}
            onChange={(e) => setTargetResourceId(e.target.value)}
            className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
          >
            <option value="">Any resource (no penalty)</option>
            {MINERALS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.rarity}) — Penalty: {SPECIFIC_RESOURCE_PENALTIES[m.rarity]}
              </option>
            ))}
          </select>
          {targetMineral && (
            <p className="text-xs text-gray-400 mt-1">
              Targeting penalty: {SPECIFIC_RESOURCE_PENALTIES[targetMineral.rarity]} (rarity: {targetMineral.rarity})
            </p>
          )}
        </div>
      )}

      {/* Helpers */}
      {leaderId && availableHelpers.length > 0 && (
        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Helpers ({helperIds.length}) {teamBonus > 0 && <span className="text-green-400 text-xs">+{teamBonus} team bonus</span>}
          </label>
          <div className="flex flex-wrap gap-1">
            {availableHelpers.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleHelper(c.id)}
                className={`px-2 py-1 text-xs rounded border transition-colors ${
                  helperIds.includes(c.id)
                    ? 'bg-amber-900/50 border-amber-500 text-amber-200'
                    : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tools */}
      {tools.length > 0 && (
        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-300 mb-1">Tools</label>
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

      {/* Context Modifiers */}
      <div className="mb-3">
        <label className="block text-sm font-medium text-gray-300 mb-1">Context Modifiers</label>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex items-center gap-1.5 text-xs text-gray-300">
            <input type="checkbox" checked={hasDetailedMaps} onChange={(e) => setHasDetailedMaps(e.target.checked)} className="rounded" />
            Detailed Maps/Notes (+1)
          </label>
          <label className="flex items-center gap-1.5 text-xs text-gray-300">
            <input type="checkbox" checked={knownRichDeposit} onChange={(e) => setKnownRichDeposit(e.target.checked)} className="rounded" />
            Known Rich Deposit (+2)
          </label>
          <label className="flex items-center gap-1.5 text-xs text-gray-300">
            <input type="checkbox" checked={randomUnexplored} onChange={(e) => setRandomUnexplored(e.target.checked)} className="rounded" />
            Random Unexplored (-2)
          </label>
          <label className="flex items-center gap-1.5 text-xs text-gray-300">
            <input type="checkbox" checked={hasSupervisor} onChange={(e) => setHasSupervisor(e.target.checked)} className="rounded" />
            Supervisor 15+ (+5)
          </label>
          <label className="flex items-center gap-1.5 text-xs text-gray-300">
            <input
              type="checkbox"
              checked={hasProperTools}
              onChange={(e) => { setHasProperTools(e.target.checked); if (e.target.checked) setIsImprovisedTools(false); }}
              className="rounded"
            />
            Proper Tools (+2)
          </label>
          <label className="flex items-center gap-1.5 text-xs text-gray-300">
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
          <label className="block text-sm font-medium text-gray-300 mb-1">Danger Mode</label>
          <div className="flex gap-2">
            <label className="flex items-center gap-1.5 text-xs text-gray-300">
              <input
                type="radio"
                name="dangerMode"
                checked={dangerMode === 'lite'}
                onChange={() => setDangerMode('lite')}
              />
              Lite (events on failures + crits)
            </label>
            <label className="flex items-center gap-1.5 text-xs text-gray-300">
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
      {leaderId && (
        <div className="mb-4 bg-gray-900/50 border border-gray-700 rounded p-3 text-sm">
          <p className="text-gray-200">
            <span className="font-medium">Locate Skill:</span> {locateSkillLevel}
            <span className="ml-2 font-medium">Extraction Skill:</span> {extractionSkillLevel}
          </p>
          <p className="text-gray-200">
            {toolBonus !== 0 && (
              <span className={toolBonus >= 0 ? 'text-green-400' : 'text-red-400'}>
                Tools: {toolBonus >= 0 ? '+' : ''}{toolBonus}
              </span>
            )}
            {teamBonus > 0 && (
              <span className="text-green-400 ml-2">Team: +{teamBonus}</span>
            )}
            {fatiguePenalty !== 0 && (
              <span className="text-red-400 ml-2">Fatigue: {fatiguePenalty}</span>
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
              ? 'bg-amber-600 text-white hover:bg-amber-700'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          Create Task
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm rounded border border-gray-600 text-gray-300 hover:bg-gray-700 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
