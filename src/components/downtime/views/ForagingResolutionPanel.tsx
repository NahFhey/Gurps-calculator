/**
 * Foraging Resolution Panel
 *
 * Manual dice rolling UI for resolving foraging tasks step-by-step.
 * Allows the user to roll each die individually and see results before finalizing.
 *
 * Steps:
 * 1. Skill Roll (3d6) - determines success/failure and margin
 * 2. Tier/Category/Item display - auto-calculated from margin
 * 3. Yield Roll - determines quantity of items found
 * 4. Finalize - commits results to task and inventory
 */

import { useState, useMemo, useCallback } from 'react';
import { X, Dices, RotateCcw, Leaf } from 'lucide-react';
import { useDowntimeContext } from '../DowntimeContext';
import { useCampaignStore } from '../../../state/campaignStore';
import {
  calculateForageEffectiveSkill,
  determineTierOutcome,
  selectCategory,
  selectItem,
  selectItemFromZoneProfile,
  buildForageLogText,
} from '../../../utils/foraging';
import {
  isCriticalSuccess,
  isCriticalFailure,
  parseDiceFormula,
} from '../../../utils/gathering';
import { FORAGE_CATEGORY_META, FORAGE_TIER_MULTIPLIERS } from '../../../constants/foraging';
import { selectCharacterFatigueStatus, getFatiguePenalty } from '../../../state/downtime/downtimeSelectors';
import type { DowntimeTask, ForagingData, TaskResults } from '../../../types/downtime';
import type { Character } from '../../../types/campaign';
import type {
  ForageActionInput,
  ForageContextFlags,
  ForageTier,
  FoundStack,
  TierOutcome,
} from '../../../types/foraging';

// ============================================================================
// TYPES
// ============================================================================

interface ForagingResolutionPanelProps {
  task: DowntimeTask;
  leader: Character | undefined;
  onFinalize: (results: TaskResults) => void;
  onCancel: () => void;
}

interface DiceRoll {
  dice: number[];
  total: number;
  rolled: boolean;
}

// ============================================================================
// HELPERS
// ============================================================================

function rollDie(sides: number = 6): number {
  return Math.floor(Math.random() * sides) + 1;
}

function roll3d6(): DiceRoll {
  const dice = [rollDie(), rollDie(), rollDie()];
  return { dice, total: dice.reduce((a, b) => a + b, 0), rolled: true };
}

function rollFormula(formula: string): DiceRoll {
  const parsed = parseDiceFormula(formula);
  if (!parsed) return { dice: [1], total: 1, rolled: true };

  const dice: number[] = [];
  for (let i = 0; i < parsed.count; i++) {
    dice.push(rollDie(parsed.sides || 6));
  }
  const total = Math.max(1, dice.reduce((a, b) => a + b, 0) + (parsed.modifier || 0));
  return { dice, total, rolled: true };
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ForagingResolutionPanel({
  task,
  leader,
  onFinalize,
  onCancel,
}: ForagingResolutionPanelProps) {
  const ctx = useDowntimeContext();
  const { actions: campaignActions } = useCampaignStore();
  const data = task.activityData as ForagingData;

  // State for dice rolls
  const [skillRoll, setSkillRoll] = useState<DiceRoll>({ dice: [0, 0, 0], total: 0, rolled: false });
  const [yieldRoll, setYieldRoll] = useState<DiceRoll>({ dice: [], total: 0, rolled: false });
  const [bonusYieldRoll, setBonusYieldRoll] = useState<DiceRoll>({ dice: [], total: 0, rolled: false });

  // Build action input (same as ForagingActivity does)
  const actionInput = useMemo(() => {
    // Fatigue penalty
    const fatigueStatus = selectCharacterFatigueStatus(ctx.state, task.leaderId, task.dayKey, task.slot);
    const fatiguePenalty = getFatiguePenalty(fatigueStatus);

    // Tool bonuses
    let toolSkillBonus = 0;
    let toolYieldBonus = 0;
    const toolIds = data.toolIds ?? [];
    for (const toolId of toolIds) {
      const tool = ctx.tools.find((t) => t.id === toolId);
      if (!tool) continue;
      toolSkillBonus += tool.skillBonus ?? 0;
      toolYieldBonus += tool.yieldBonus ?? 0;
    }

    // Supervisor check
    let supervisorSkill15Plus = false;
    for (const helperId of task.helperIds) {
      const helper = ctx.characters.find((c) => c.id === helperId);
      if (helper) {
        const helperSkills = (helper as any).skills ?? (helper as any).characterSheet?.skills ?? [];
        const found = helperSkills.find?.((s: any) => {
          const name = typeof s === 'string' ? s : (s.name ?? '');
          return name.toLowerCase().includes('survival') ||
                 name.toLowerCase().includes('naturalist') ||
                 name.toLowerCase().includes('herb lore');
        });
        if (found) {
          const level = typeof found === 'string' ? 10 : (found.level ?? found.points ?? 10);
          if (level >= 15) { supervisorSkill15Plus = true; break; }
        }
      }
    }

    const flags: ForageContextFlags = data.contextFlags ?? {
      hasMapOrGuide: false, isUnfamiliarOrHostile: false,
      isPeakSeason: false, isOffSeason: false,
      hasProperTools: false, isDenseOrDangerousTerrain: false,
    };

    const input: ForageActionInput = {
      actorId: task.leaderId,
      zoneId: data.zoneId,
      mode: data.mode ?? 'general',
      targetCategory: data.targetCategory as any,
      targetItemId: data.targetItemId,
      skillUsed: (data.skillUsed as any) ?? 'survival',
      baseSkillLevel: data.leaderSkill ?? 10,
      contextFlags: flags,
      toolIds,
      helperCount: task.helperIds.length,
      supervisorSkill15Plus,
      toolSkillBonus: toolSkillBonus + fatiguePenalty,
      toolYieldBonus,
      weatherModifier: 0,
    };

    return input;
  }, [ctx, task, data]);

  // Computed from action input
  const zone = ctx.forageZones.find((z) => z.id === data.zoneId);
  const allItems = ctx.forageItems;
  const config = ctx.foragingConfig;
  const leaderName = leader?.name ?? 'Worker';

  const targetItem = useMemo(() =>
    actionInput.mode === 'specific' && actionInput.targetItemId
      ? allItems.find((i) => i.id === actionInput.targetItemId)
      : undefined,
    [actionInput, allItems]
  );

  const { effectiveSkill, modifiers } = useMemo(
    () => calculateForageEffectiveSkill(actionInput, targetItem),
    [actionInput, targetItem]
  );

  const skillLabel = data.skillUsed === 'herbLore' ? 'Herb Lore'
    : data.skillUsed === 'naturalist' ? 'Naturalist' : 'Survival';

  // Derived from the skill roll
  const margin = skillRoll.rolled ? effectiveSkill - skillRoll.total : 0;
  const success = skillRoll.rolled && skillRoll.total <= effectiveSkill && !isCriticalFailure(skillRoll.total, effectiveSkill);
  const critSuccess = skillRoll.rolled && isCriticalSuccess(skillRoll.total, effectiveSkill);
  const critFailure = skillRoll.rolled && isCriticalFailure(skillRoll.total, effectiveSkill);

  const tierOutcome: TierOutcome = skillRoll.rolled
    ? determineTierOutcome(margin, success, critSuccess, critFailure, config)
    : 'nothing';

  const effectiveTier: ForageTier = tierOutcome === 'scraps' ? 'common' : (tierOutcome as ForageTier);

  // Category and item selection (deterministic after skill roll)
  const selectedCategory = useMemo(() => {
    if (!skillRoll.rolled || tierOutcome === 'nothing') return null;
    if (actionInput.mode === 'specific' && targetItem) return targetItem.categoryId;
    if (!zone) return null;
    return selectCategory(actionInput, effectiveTier, zone, targetItem);
  }, [skillRoll.rolled, tierOutcome, actionInput, effectiveTier, zone, targetItem]);

  const selectedItem = useMemo(() => {
    if (!selectedCategory || !zone) return null;
    // Try per-item zone profile selection first
    const gItem = selectItemFromZoneProfile(zone, effectiveTier, selectedCategory, ctx.gatheringItems);
    if (gItem) return { name: gItem.name, id: gItem.id, inventoryKind: gItem.inventoryKind, typeId: gItem.typeId, yieldFormula: gItem.yieldFormula, fromZoneProfile: true };
    // Fall back to ForageItem pool
    const fItem = selectItem(allItems, effectiveTier, selectedCategory, zone.id, zone.tags, zone.currentSeason);
    if (fItem) return { name: fItem.name, id: fItem.id, inventoryKind: fItem.inventoryKind, typeId: fItem.typeId, yieldFormula: fItem.yieldFormula, fromZoneProfile: false };
    // Generic
    const catMeta = FORAGE_CATEGORY_META[selectedCategory];
    if (catMeta) return { name: catMeta.label, id: `generic-${selectedCategory}`, inventoryKind: catMeta.inventoryKind, typeId: catMeta.label, yieldFormula: catMeta.defaultYieldFormula, fromZoneProfile: false };
    return null;
  }, [selectedCategory, zone, effectiveTier, allItems, ctx.gatheringItems]);

  // Yield formula to use
  const yieldFormula = useMemo(() => {
    if (actionInput.mode === 'specific' && targetItem) return targetItem.yieldFormula;
    if (selectedItem) return selectedItem.yieldFormula;
    return '1d';
  }, [actionInput, targetItem, selectedItem]);

  const needsSkill15Bonus = effectiveSkill >= 15;

  // Check if all rolls are complete
  const allRollsComplete = skillRoll.rolled &&
    (tierOutcome === 'nothing' || (yieldRoll.rolled && (!needsSkill15Bonus || bonusYieldRoll.rolled)));

  // Handle finalize
  const handleFinalize = useCallback(() => {
    if (!allRollsComplete) return;

    const foundStacks: FoundStack[] = [];

    if (tierOutcome !== 'nothing' && selectedCategory && selectedItem) {
      // Calculate total yield
      let baseYield = yieldRoll.total;
      if (needsSkill15Bonus && bonusYieldRoll.rolled) {
        baseYield += bonusYieldRoll.total;
      }
      baseYield += actionInput.toolYieldBonus;
      const multiplier = FORAGE_TIER_MULTIPLIERS[tierOutcome] ?? 1.0;
      const qty = Math.max(1, Math.floor(baseYield * multiplier));

      foundStacks.push({
        itemId: selectedItem.id,
        itemName: selectedItem.name,
        categoryId: selectedCategory,
        quantity: qty,
        quality: critSuccess ? 'high' : 'normal',
        inventoryKind: selectedItem.inventoryKind as 'food' | 'material',
        typeId: selectedItem.typeId,
      });
    }

    // Add items to inventory
    const zoneName = zone?.name ?? 'unknown zone';
    for (const stack of foundStacks) {
      const itemId = `forage-${stack.itemId}-${Date.now()}`;
      if (stack.inventoryKind === 'food') {
        campaignActions.acquireItem({
          kind: 'food',
          id: itemId,
          name: stack.itemName,
          types: [stack.typeId],
          quantity: stack.quantity,
          source: `Foraging at ${zoneName}`,
        }, 'party', 'gathering');
      } else {
        campaignActions.acquireItem({
          kind: 'material',
          id: itemId,
          name: stack.itemName,
          type: stack.typeId,
          quantity: stack.quantity,
          source: `Foraging at ${zoneName}`,
        }, 'party', 'gathering');
      }
    }

    // Build log text
    const logText = buildForageLogText(
      leaderName, skillLabel, zone?.name ?? 'unknown zone',
      skillRoll.total, effectiveSkill, margin,
      success, critSuccess, critFailure,
      tierOutcome, foundStacks
    );

    const inventoryChanges = foundStacks.map((s) => ({
      itemId: s.itemId,
      quantity: s.quantity,
      itemName: s.itemName,
    }));

    const results: TaskResults = {
      success: foundStacks.length > 0,
      message: logText,
      inventoryChanges,
      experienceGained: 0,
    };

    onFinalize(results);
  }, [
    allRollsComplete, tierOutcome, selectedCategory, selectedItem,
    yieldRoll, bonusYieldRoll, needsSkill15Bonus, actionInput,
    critSuccess, zone, campaignActions, leaderName, skillLabel,
    skillRoll, effectiveSkill, margin, success, critFailure, onFinalize
  ]);

  const catMeta = selectedCategory ? FORAGE_CATEGORY_META[selectedCategory] : null;

  return (
    <div className="bg-gray-800 border border-green-600 rounded-lg p-4 space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Leaf className="w-5 h-5 text-green-400" />
          <h4 className="font-semibold text-gray-100">Manual Foraging Resolution</h4>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-200"
          title="Cancel resolution"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Skill Info */}
      <div className="bg-gray-900/50 p-3 rounded text-sm space-y-1">
        <p className="text-gray-300">
          <span className="font-medium text-gray-200">Leader:</span> {leaderName}
        </p>
        <p className="text-gray-300">
          <span className="font-medium text-gray-200">Skill:</span> {skillLabel}
        </p>
        <p className="text-gray-300">
          <span className="font-medium text-gray-200">Effective Skill:</span>{' '}
          <span className="text-green-400 font-bold">{effectiveSkill}</span>
        </p>
        {modifiers.length > 0 && (
          <div className="text-xs text-gray-400">
            Modifiers: {modifiers.map((m) => `${m.label} ${m.value >= 0 ? '+' : ''}${m.value}`).join(', ')}
          </div>
        )}
        <p className="text-gray-300">
          <span className="font-medium text-gray-200">Zone:</span> {zone?.name ?? 'Unknown'}
        </p>
      </div>

      {/* Step 1: Skill Roll */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h5 className="text-sm font-medium text-gray-200">Step 1: Skill Roll (3d6)</h5>
          {!skillRoll.rolled ? (
            <button
              type="button"
              onClick={() => setSkillRoll(roll3d6())}
              className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
            >
              <Dices className="w-3.5 h-3.5" />
              Roll 3d6
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setSkillRoll({ dice: [0, 0, 0], total: 0, rolled: false });
                setYieldRoll({ dice: [], total: 0, rolled: false });
                setBonusYieldRoll({ dice: [], total: 0, rolled: false });
              }}
              className="flex items-center gap-1 px-2 py-1 text-yellow-400 hover:text-yellow-300 text-xs"
              title="Reroll"
            >
              <RotateCcw className="w-3 h-3" />
              Reroll
            </button>
          )}
        </div>

        {skillRoll.rolled && (
          <div className="bg-gray-900/50 p-3 rounded">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex gap-1">
                {skillRoll.dice.map((d, i) => (
                  <span key={i} className="w-8 h-8 bg-gray-700 border border-gray-600 rounded flex items-center justify-center font-bold text-lg">
                    {d}
                  </span>
                ))}
              </div>
              <span className="text-gray-400">=</span>
              <span className="font-bold text-xl">{skillRoll.total}</span>
              <span className="text-gray-400">vs</span>
              <span className="font-bold text-xl text-green-400">{effectiveSkill}</span>
            </div>

            <div className="text-sm space-y-1">
              <p>
                {critSuccess ? (
                  <span className="text-yellow-400 font-bold">Critical Success!</span>
                ) : critFailure ? (
                  <span className="text-red-400 font-bold">Critical Failure!</span>
                ) : success ? (
                  <span className="text-green-400">Success by {margin}</span>
                ) : (
                  <span className="text-red-400">Failure by {Math.abs(margin)}</span>
                )}
              </p>
              <p>
                <span className="font-medium text-gray-200">Tier:</span>{' '}
                <span className={
                  tierOutcome === 'rare' ? 'text-purple-400 font-bold' :
                  tierOutcome === 'uncommon' ? 'text-blue-400 font-bold' :
                  tierOutcome === 'common' ? 'text-green-400' :
                  tierOutcome === 'scraps' ? 'text-yellow-400' :
                  'text-red-400'
                }>
                  {tierOutcome.charAt(0).toUpperCase() + tierOutcome.slice(1)}
                </span>
              </p>
              {selectedCategory && catMeta && (
                <p>
                  <span className="font-medium text-gray-200">Category:</span>{' '}
                  <span className="text-gray-100">{catMeta.label}</span>
                </p>
              )}
              {selectedItem && (
                <p>
                  <span className="font-medium text-gray-200">Item:</span>{' '}
                  <span className="text-gray-100">{selectedItem.name}</span>
                  <span className="text-xs text-gray-500 ml-1">
                    ({selectedItem.inventoryKind}: {selectedItem.typeId})
                  </span>
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Step 2: Yield Roll */}
      {skillRoll.rolled && tierOutcome !== 'nothing' && selectedItem && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h5 className="text-sm font-medium text-gray-200">
              Step 2: Yield Roll ({yieldFormula})
            </h5>
            {!yieldRoll.rolled ? (
              <button
                type="button"
                onClick={() => setYieldRoll(rollFormula(yieldFormula))}
                className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
              >
                <Dices className="w-3.5 h-3.5" />
                Roll Yield
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setYieldRoll({ dice: [], total: 0, rolled: false });
                  setBonusYieldRoll({ dice: [], total: 0, rolled: false });
                }}
                className="flex items-center gap-1 px-2 py-1 text-yellow-400 hover:text-yellow-300 text-xs"
                title="Reroll"
              >
                <RotateCcw className="w-3 h-3" />
                Reroll
              </button>
            )}
          </div>

          {yieldRoll.rolled && (
            <div className="bg-gray-900/50 p-3 rounded text-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-gray-300">Base yield:</span>
                <div className="flex gap-1">
                  {yieldRoll.dice.map((d, i) => (
                    <span key={i} className="w-6 h-6 bg-gray-700 border border-gray-600 rounded flex items-center justify-center font-medium text-sm">
                      {d}
                    </span>
                  ))}
                </div>
                <span className="text-gray-400">= {yieldRoll.total}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 2b: Skill 15+ bonus yield roll */}
      {yieldRoll.rolled && needsSkill15Bonus && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h5 className="text-sm font-medium text-gray-200">
              Bonus: Skill 15+ (1d6)
            </h5>
            {!bonusYieldRoll.rolled ? (
              <button
                type="button"
                onClick={() => setBonusYieldRoll(rollFormula('1d'))}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
              >
                <Dices className="w-3.5 h-3.5" />
                Roll Bonus
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setBonusYieldRoll({ dice: [], total: 0, rolled: false })}
                className="flex items-center gap-1 px-2 py-1 text-yellow-400 hover:text-yellow-300 text-xs"
                title="Reroll"
              >
                <RotateCcw className="w-3 h-3" />
                Reroll
              </button>
            )}
          </div>

          {bonusYieldRoll.rolled && (
            <div className="bg-gray-900/50 p-3 rounded text-sm">
              <span className="text-gray-300">Bonus yield: +{bonusYieldRoll.total}</span>
            </div>
          )}
        </div>
      )}

      {/* Yield Summary */}
      {yieldRoll.rolled && (!needsSkill15Bonus || bonusYieldRoll.rolled) && selectedItem && (
        <div className="bg-green-900/20 border border-green-700 p-3 rounded text-sm">
          <p className="font-medium text-green-300 mb-1">Result Summary</p>
          {(() => {
            let baseYield = yieldRoll.total;
            if (needsSkill15Bonus && bonusYieldRoll.rolled) baseYield += bonusYieldRoll.total;
            baseYield += actionInput.toolYieldBonus;
            const multiplier = FORAGE_TIER_MULTIPLIERS[tierOutcome] ?? 1.0;
            const finalQty = Math.max(1, Math.floor(baseYield * multiplier));
            return (
              <div className="space-y-1 text-gray-300">
                <p>Base: {yieldRoll.total}
                  {needsSkill15Bonus && bonusYieldRoll.rolled ? ` + ${bonusYieldRoll.total} (skill 15+)` : ''}
                  {actionInput.toolYieldBonus > 0 ? ` + ${actionInput.toolYieldBonus} (tools)` : ''}
                  {multiplier !== 1.0 ? ` × ${multiplier} (${tierOutcome})` : ''}
                </p>
                <p className="text-green-400 font-bold">
                  {selectedItem.name}: {finalQty} units ({selectedItem.inventoryKind})
                </p>
              </div>
            );
          })()}
        </div>
      )}

      {/* Nothing found message */}
      {skillRoll.rolled && tierOutcome === 'nothing' && (
        <div className="bg-gray-900/50 p-3 rounded text-sm text-gray-400 italic">
          Nothing harvestable found this time.
        </div>
      )}

      {/* Finalize / Cancel */}
      <div className="flex gap-2 pt-2 border-t border-gray-700">
        <button
          type="button"
          onClick={handleFinalize}
          disabled={!allRollsComplete}
          className={`flex-1 px-4 py-2 rounded font-medium text-sm ${
            allRollsComplete
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          Finalize Task
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-red-500/50 text-red-400 rounded hover:bg-red-900/30 text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
