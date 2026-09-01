/**
 * Mining Resolution Panel
 *
 * Manual dice rolling UI for resolving mining tasks step-by-step.
 *
 * Surface Prospecting flow:
 * 1. Locate Roll (3d6) - determines success and MoS → resource + deposit size
 * 2. Deposit Capacity Roll - rolled once for the new site
 * 3. Extraction Roll (3d6) - determines yield multiplier
 * 4. Yield Roll - determines units extracted
 * 5. Finalize
 *
 * Deep Mining (extraction from mapped site) flow:
 * 1. Extraction Roll (3d6) - determines yield multiplier
 * 2. Yield Roll - determines units extracted
 * 3. Event Check (if triggered by danger mode) - 3d6 → event severity → 2d6 event
 * 4. Finalize
 */

import { useState, useMemo, useCallback } from 'react';
import { X, Dices, RotateCcw, HardHat } from 'lucide-react';
import { useDowntimeContext } from '../DowntimeContext';
import { useCampaignStore } from '../../../state/campaignStore';
import {
  isCriticalSuccess,
  isCriticalFailure,
  parseDiceFormula,
} from '../../../utils/gathering';
import {
  MINING_SKILL_LABELS,
  MINERALS,
  MINERALS_BY_ID,
  MINERALS_BY_RARITY,
  DEPOSIT_CAPACITY,
  SPECIFIC_RESOURCE_PENALTIES,
  EXTRACTION_YIELD_MULTIPLIERS,
  LOCATE_MODIFIERS,
  EXTRACTION_MODIFIERS,
  determineLocateOutcome,
  checkEventTrigger,
  selectEvent,
  getTeamBonus,
  type MineralDef,
  type ExtractionOutcome,
} from '../../../constants/mining';
import { selectCharacterFatigueStatus, getFatiguePenalty } from '../../../state/downtime/downtimeSelectors';
import type { DowntimeTask, InventoryDelta, MiningData, MiningSite, TaskResults } from '../../../types/downtime';
import type { Character } from '../../../types/campaign';

// ============================================================================
// TYPES
// ============================================================================

interface MiningResolutionPanelProps {
  task: DowntimeTask;
  leader: Character | undefined;
  miningSites: MiningSite[];
  onFinalize: (results: TaskResults, newSite?: MiningSite, updatedSite?: MiningSite) => void;
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

function roll2d6(): DiceRoll {
  const dice = [rollDie(), rollDie()];
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

function selectMineralByRarity(rarity: string, targetResourceId?: string): MineralDef {
  if (targetResourceId && MINERALS_BY_ID[targetResourceId]) {
    return MINERALS_BY_ID[targetResourceId];
  }
  const pool = MINERALS_BY_RARITY[rarity as keyof typeof MINERALS_BY_RARITY] ?? MINERALS_BY_RARITY.common;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ============================================================================
// COMPONENT
// ============================================================================

export function MiningResolutionPanel({
  task,
  leader,
  miningSites,
  onFinalize,
  onCancel,
}: MiningResolutionPanelProps) {
  const ctx = useDowntimeContext();
  const { actions: campaignActions } = useCampaignStore();
  const data = task.activityData as MiningData;
  const isSurface = data.method === 'Surface Prospecting';

  // Roll states
  const [locateRoll, setLocateRoll] = useState<DiceRoll>({ dice: [0, 0, 0], total: 0, rolled: false });
  const [depositCapRoll, setDepositCapRoll] = useState<DiceRoll>({ dice: [], total: 0, rolled: false });
  const [extractionRoll, setExtractionRoll] = useState<DiceRoll>({ dice: [0, 0, 0], total: 0, rolled: false });
  const [yieldRoll, setYieldRoll] = useState<DiceRoll>({ dice: [], total: 0, rolled: false });
  const [bonusYieldRoll, setBonusYieldRoll] = useState<DiceRoll>({ dice: [], total: 0, rolled: false });
  const [eventCheckRoll, setEventCheckRoll] = useState<DiceRoll>({ dice: [0, 0, 0], total: 0, rolled: false });
  const [eventDetailRoll, setEventDetailRoll] = useState<DiceRoll>({ dice: [0, 0], total: 0, rolled: false });

  // Whether user chose quality upgrade on crit success (instead of +50% yield)
  const [critChoiceQuality, setCritChoiceQuality] = useState(false);

  // Computed values
  const leaderName = leader?.name ?? 'Worker';

  // Calculate effective locate skill
  const locateEffectiveSkill = useMemo(() => {
    let skill = data.leaderLocateSkill ?? 10;
    const flags = data.contextFlags;
    if (flags?.hasDetailedMaps) skill += LOCATE_MODIFIERS.detailedMaps;
    if (flags?.knownRichDeposit) skill += LOCATE_MODIFIERS.knownRichDeposit;
    if (flags?.randomUnexplored) skill += LOCATE_MODIFIERS.randomUnexplored;
    if (flags?.hasSupervisor) skill += LOCATE_MODIFIERS.supervisor15Plus;
    // fatigue
    const fatigueStatus = selectCharacterFatigueStatus(ctx.state, task.leaderId, task.dayKey, task.slot);
    skill += getFatiguePenalty(fatigueStatus);
    // team bonus for locate
    skill += getTeamBonus(task.helperIds.length);
    // tool bonus
    const toolIds = data.toolIds ?? [];
    for (const toolId of toolIds) {
      const tool = ctx.tools.find((t) => t.id === toolId);
      if (tool) skill += tool.skillBonus ?? 0;
    }
    // Specific resource penalty
    if (data.targetResourceId) {
      const mineral = MINERALS_BY_ID[data.targetResourceId];
      if (mineral) skill += SPECIFIC_RESOURCE_PENALTIES[mineral.rarity];
    }
    return skill;
  }, [ctx, task, data]);

  // Calculate effective extraction skill
  const extractionEffectiveSkill = useMemo(() => {
    let skill = data.leaderExtractionSkill ?? 10;
    const flags = data.contextFlags;
    if (flags?.hasProperTools) skill += EXTRACTION_MODIFIERS.properTools;
    if (flags?.isImprovisedTools) skill += EXTRACTION_MODIFIERS.improvisedTools;
    if (flags?.hasSupervisor) skill += EXTRACTION_MODIFIERS.supervisor15Plus;
    // Prospecting used for extraction penalty
    if (data.extractionSkill === 'prospecting' && !flags?.hasProperTools) {
      skill += EXTRACTION_MODIFIERS.prospectingExtractionPenalty;
    }
    // fatigue
    const fatigueStatus = selectCharacterFatigueStatus(ctx.state, task.leaderId, task.dayKey, task.slot);
    skill += getFatiguePenalty(fatigueStatus);
    // team bonus
    skill += getTeamBonus(task.helperIds.length);
    // tool bonus
    const toolIds = data.toolIds ?? [];
    for (const toolId of toolIds) {
      const tool = ctx.tools.find((t) => t.id === toolId);
      if (tool) skill += tool.skillBonus ?? 0;
    }
    return skill;
  }, [ctx, task, data]);

  // ── Locate results (Surface Prospecting) ──
  const locateMargin = locateRoll.rolled ? locateEffectiveSkill - locateRoll.total : 0;
  const locateSuccess = locateRoll.rolled && locateRoll.total <= locateEffectiveSkill && !isCriticalFailure(locateRoll.total, locateEffectiveSkill);
  const locateCritSuccess = locateRoll.rolled && isCriticalSuccess(locateRoll.total, locateEffectiveSkill);
  const locateCritFailure = locateRoll.rolled && isCriticalFailure(locateRoll.total, locateEffectiveSkill);

  const locateOutcome = useMemo(() => {
    if (!locateRoll.rolled || !locateSuccess) return null;
    return determineLocateOutcome(locateMargin, locateCritSuccess);
  }, [locateRoll.rolled, locateSuccess, locateMargin, locateCritSuccess]);

  const discoveredMineral = useMemo(() => {
    if (!locateOutcome) return null;
    return selectMineralByRarity(locateOutcome.rarity, data.targetResourceId);
  }, [locateOutcome, data.targetResourceId]);

  const depositCapFormula = useMemo(() => {
    if (!locateOutcome || !discoveredMineral) return '10d';
    return DEPOSIT_CAPACITY[discoveredMineral.category][locateOutcome.depositSize];
  }, [locateOutcome, discoveredMineral]);

  // ── Extraction results ──
  const extractionMargin = extractionRoll.rolled ? extractionEffectiveSkill - extractionRoll.total : 0;
  const extractionSuccess = extractionRoll.rolled && extractionRoll.total <= extractionEffectiveSkill && !isCriticalFailure(extractionRoll.total, extractionEffectiveSkill);
  const extractionCritSuccess = extractionRoll.rolled && isCriticalSuccess(extractionRoll.total, extractionEffectiveSkill);
  const extractionCritFailure = extractionRoll.rolled && isCriticalFailure(extractionRoll.total, extractionEffectiveSkill);

  const extractionOutcome: ExtractionOutcome = useMemo(() => {
    if (!extractionRoll.rolled) return 'failure';
    if (extractionCritSuccess) return 'criticalSuccess';
    if (extractionCritFailure) return 'criticalFailure';
    if (extractionSuccess) return 'success';
    return 'failure';
  }, [extractionRoll.rolled, extractionSuccess, extractionCritSuccess, extractionCritFailure]);

  // For Deep Mining, get the site's mineral
  const existingSite = data.siteId ? miningSites.find((s) => s.id === data.siteId) : undefined;
  const deepMiningMineral = useMemo(() => {
    if (!existingSite || existingSite.materials.length === 0) return MINERALS[0];
    return MINERALS_BY_ID[existingSite.materials[0]] ?? MINERALS[0];
  }, [existingSite]);

  // The active mineral (varies by method)
  const activeMineral = isSurface ? discoveredMineral : deepMiningMineral;

  // Yield formula
  const yieldFormula = activeMineral?.yieldFormula ?? '2d';

  // Skill 15+ bonus
  const needsSkill15Bonus = extractionEffectiveSkill >= 15;

  // Event trigger check (Deep Mining)
  const shouldCheckEvent = useMemo(() => {
    if (isSurface) return extractionCritSuccess || extractionCritFailure;
    if (data.dangerMode === 'full') return true;
    return !extractionSuccess || extractionCritSuccess || extractionCritFailure;
  }, [isSurface, data.dangerMode, extractionSuccess, extractionCritSuccess, extractionCritFailure]);

  const eventSeverity = eventCheckRoll.rolled ? checkEventTrigger(eventCheckRoll.total) : 'none';
  const eventResult = useMemo(() => {
    if (!eventDetailRoll.rolled || eventSeverity === 'none') return null;
    return selectEvent(eventSeverity as 'rare' | 'mild', eventDetailRoll.total);
  }, [eventDetailRoll.rolled, eventSeverity]);

  // Check all rolls complete
  const allRollsComplete = useMemo(() => {
    if (isSurface) {
      if (!locateRoll.rolled) return false;
      if (!locateSuccess) return true; // failed locate = done
      if (!depositCapRoll.rolled) return false;
      if (!extractionRoll.rolled) return false;
      if (extractionOutcome === 'criticalFailure') {
        // Check event rolls if needed
        if (shouldCheckEvent && !eventCheckRoll.rolled) return false;
        if (eventSeverity !== 'none' && !eventDetailRoll.rolled) return false;
        return true;
      }
      if (!yieldRoll.rolled) return false;
      if (needsSkill15Bonus && !bonusYieldRoll.rolled) return false;
      if (shouldCheckEvent && !eventCheckRoll.rolled) return false;
      if (eventSeverity !== 'none' && !eventDetailRoll.rolled) return false;
      return true;
    } else {
      // Deep Mining
      if (!extractionRoll.rolled) return false;
      if (extractionOutcome === 'criticalFailure') {
        if (shouldCheckEvent && !eventCheckRoll.rolled) return false;
        if (eventSeverity !== 'none' && !eventDetailRoll.rolled) return false;
        return true;
      }
      if (!yieldRoll.rolled) return false;
      if (needsSkill15Bonus && !bonusYieldRoll.rolled) return false;
      if (shouldCheckEvent && !eventCheckRoll.rolled) return false;
      if (eventSeverity !== 'none' && !eventDetailRoll.rolled) return false;
      return true;
    }
  }, [
    isSurface, locateRoll.rolled, locateSuccess, depositCapRoll.rolled,
    extractionRoll.rolled, extractionOutcome, yieldRoll.rolled,
    needsSkill15Bonus, bonusYieldRoll.rolled,
    shouldCheckEvent, eventCheckRoll.rolled, eventSeverity, eventDetailRoll.rolled,
  ]);

  // Handle finalize
  const handleFinalize = useCallback(() => {
    if (!allRollsComplete) return;

    const inventoryChanges: InventoryDelta[] = [];
    let message = '';
    let success = false;
    let newSite: MiningSite | undefined;
    let updatedSite: MiningSite | undefined;

    if (isSurface) {
      if (!locateSuccess) {
        message = `${leaderName} searched for a mining site but found nothing.`;
        if (locateCritFailure) {
          message += ' Critical failure — false lead or immediate hazard!';
        }
      } else if (locateOutcome && discoveredMineral) {
        // Site found
        const siteId = `mine-site-${Date.now()}`;
        newSite = {
          id: siteId,
          name: `${discoveredMineral.name} Deposit`,
          zoneId: data.zoneId,
          materials: [discoveredMineral.id],
          depositSize: locateOutcome.depositSize,
          totalUnits: depositCapRoll.total,
          remainingUnits: depositCapRoll.total,
          mapped: true,
          depleted: false,
          quality: 'normal',
          discoveredAt: Date.now(),
        };

        message = `${leaderName} discovered a ${locateOutcome.depositSize} ${discoveredMineral.name} deposit (${depositCapRoll.total} units).`;

        // Calculate extraction yield
        if (extractionOutcome !== 'criticalFailure') {
          let baseYield = yieldRoll.total;
          if (needsSkill15Bonus && bonusYieldRoll.rolled) baseYield += bonusYieldRoll.total;

          let multiplier = EXTRACTION_YIELD_MULTIPLIERS[extractionOutcome];
          if (extractionCritSuccess && critChoiceQuality) {
            multiplier = 1.0; // Quality upgrade instead of 1.5x
          }
          const finalYield = Math.max(0, Math.floor(baseYield * multiplier));

          if (finalYield > 0 && newSite) {
            newSite.remainingUnits = Math.max(0, newSite.remainingUnits - finalYield);
            if (newSite.remainingUnits <= 0) newSite.depleted = true;
            if (extractionCritSuccess && critChoiceQuality) {
              newSite.quality = 'high';
            }

            inventoryChanges.push({
              itemId: discoveredMineral.id,
              quantity: finalYield,
              itemName: discoveredMineral.name,
              kind: 'material',
            });

            // Add to inventory
            campaignActions.acquireItem({
              kind: 'material',
              id: `mine-${discoveredMineral.id}-${Date.now()}`,
              name: discoveredMineral.name,
              type: discoveredMineral.typeId,
              quantity: finalYield,
              source: `Mining at ${newSite.name}`,
            }, 'party', 'gathering');

            message += ` Extracted ${finalYield} units of ${discoveredMineral.name}.`;
            if (extractionCritSuccess && critChoiceQuality) {
              message += ' (High Quality!)';
            }
            success = true;
          }
        } else {
          message += ' Extraction failed critically — no yield and possible hazard!';
        }
      }
    } else {
      // Deep Mining
      if (!existingSite || !activeMineral) {
        message = `${leaderName} attempted to mine but no valid site was selected.`;
      } else if (extractionOutcome === 'criticalFailure') {
        message = `${leaderName} had a critical failure while mining ${existingSite.name}! No yield and possible hazard!`;
      } else {
        let baseYield = yieldRoll.total;
        if (needsSkill15Bonus && bonusYieldRoll.rolled) baseYield += bonusYieldRoll.total;

        let multiplier = EXTRACTION_YIELD_MULTIPLIERS[extractionOutcome];
        if (extractionCritSuccess && critChoiceQuality) {
          multiplier = 1.0;
        }
        const finalYield = Math.max(0, Math.floor(baseYield * multiplier));

        if (finalYield > 0) {
          // Deplete the site
          const newRemaining = Math.max(0, existingSite.remainingUnits - finalYield);
          updatedSite = {
            ...existingSite,
            remainingUnits: newRemaining,
            depleted: newRemaining <= 0,
          };

          inventoryChanges.push({
            itemId: activeMineral.id,
            quantity: finalYield,
            itemName: activeMineral.name,
            kind: 'material',
          });

          campaignActions.acquireItem({
            kind: 'material',
            id: `mine-${activeMineral.id}-${Date.now()}`,
            name: activeMineral.name,
            type: activeMineral.typeId,
            quantity: finalYield,
            source: `Mining at ${existingSite.name}`,
          }, 'party', 'gathering');

          message = `${leaderName} extracted ${finalYield} units of ${activeMineral.name} from ${existingSite.name}. ${newRemaining} units remaining.`;
          if (newRemaining <= 0) message += ' Deposit is now depleted!';
          if (extractionCritSuccess && critChoiceQuality) {
            message += ' (High Quality!)';
          }
          success = true;
        } else {
          message = `${leaderName} mined at ${existingSite.name} but extracted nothing useful.`;
        }
      }
    }

    // Add event info
    if (eventResult) {
      message += ` Event: ${eventResult.name} — ${eventResult.description}`;
    }

    const results: TaskResults = {
      success,
      message,
      inventoryChanges: inventoryChanges.length > 0 ? inventoryChanges : [],
      experienceGained: 0,
    };

    onFinalize(results, newSite, updatedSite);
  }, [
    allRollsComplete, isSurface, locateSuccess, locateCritFailure, locateOutcome,
    discoveredMineral, depositCapRoll, extractionOutcome, yieldRoll, bonusYieldRoll,
    needsSkill15Bonus, extractionCritSuccess, critChoiceQuality, leaderName,
    data, existingSite, activeMineral, eventResult, campaignActions, onFinalize,
  ]);

  // Reset all rolls
  const resetAll = () => {
    setLocateRoll({ dice: [0, 0, 0], total: 0, rolled: false });
    setDepositCapRoll({ dice: [], total: 0, rolled: false });
    setExtractionRoll({ dice: [0, 0, 0], total: 0, rolled: false });
    setYieldRoll({ dice: [], total: 0, rolled: false });
    setBonusYieldRoll({ dice: [], total: 0, rolled: false });
    setEventCheckRoll({ dice: [0, 0, 0], total: 0, rolled: false });
    setEventDetailRoll({ dice: [0, 0], total: 0, rolled: false });
    setCritChoiceQuality(false);
  };

  return (
    <div className="bg-surface-1 border border-warning-600 rounded-lg p-4 space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <HardHat className="w-5 h-5 text-warning-400" />
          <h4 className="font-semibold text-fg-bright">Manual Mining Resolution — {data.method}</h4>
        </div>
        <button type="button" onClick={onCancel} className="text-fg-muted hover:text-fg-primary" title="Cancel resolution">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Skill Info */}
      <div className="bg-surface-0/50 p-3 rounded text-sm space-y-1">
        <p className="text-fg-secondary"><span className="font-medium text-fg-primary">Leader:</span> {leaderName}</p>
        {isSurface && (
          <p className="text-fg-secondary">
            <span className="font-medium text-fg-primary">Locate Skill:</span>{' '}
            {MINING_SKILL_LABELS[data.locateSkill]} = <span className="text-warning-400 font-bold">{locateEffectiveSkill}</span>
          </p>
        )}
        <p className="text-fg-secondary">
          <span className="font-medium text-fg-primary">Extraction Skill:</span>{' '}
          {MINING_SKILL_LABELS[data.extractionSkill]} = <span className="text-warning-400 font-bold">{extractionEffectiveSkill}</span>
        </p>
        {existingSite && (
          <p className="text-fg-secondary">
            <span className="font-medium text-fg-primary">Site:</span> {existingSite.name} ({existingSite.remainingUnits}/{existingSite.totalUnits} units)
          </p>
        )}
      </div>

      {/* ── SURFACE PROSPECTING: Step 1 — Locate Roll ── */}
      {isSurface && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h5 className="text-sm font-medium text-fg-primary">Step 1: Locate Site (3d6 vs {locateEffectiveSkill})</h5>
            {!locateRoll.rolled ? (
              <button type="button" onClick={() => setLocateRoll(roll3d6())} className="flex items-center gap-1 px-3 py-1.5 bg-warning-600 text-white rounded hover:bg-warning-700 text-sm">
                <Dices className="w-3.5 h-3.5" /> Roll 3d6
              </button>
            ) : (
              <button type="button" onClick={resetAll} className="flex items-center gap-1 px-2 py-1 text-yellow-400 hover:text-yellow-300 text-xs">
                <RotateCcw className="w-3 h-3" /> Reroll All
              </button>
            )}
          </div>

          {locateRoll.rolled && (
            <div className="bg-surface-0/50 p-3 rounded">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex gap-1">
                  {locateRoll.dice.map((d, i) => (
                    <span key={i} className="w-8 h-8 bg-surface-2 border border-edge-strong rounded flex items-center justify-center font-bold text-lg">{d}</span>
                  ))}
                </div>
                <span className="text-fg-muted">=</span>
                <span className="font-bold text-xl">{locateRoll.total}</span>
                <span className="text-fg-muted">vs</span>
                <span className="font-bold text-xl text-warning-400">{locateEffectiveSkill}</span>
              </div>
              <div className="text-sm space-y-1">
                <p>
                  {locateCritSuccess ? (
                    <span className="text-yellow-400 font-bold">Critical Success!</span>
                  ) : locateCritFailure ? (
                    <span className="text-danger-400 font-bold">Critical Failure!</span>
                  ) : locateSuccess ? (
                    <span className="text-success-400">Success by {locateMargin}</span>
                  ) : (
                    <span className="text-danger-400">Failure by {Math.abs(locateMargin)}</span>
                  )}
                </p>
                {locateOutcome && discoveredMineral && (
                  <>
                    <p><span className="font-medium text-fg-primary">Resource:</span> <span className="text-warning-300">{discoveredMineral.name}</span> ({discoveredMineral.rarity})</p>
                    <p><span className="font-medium text-fg-primary">Deposit Size:</span> {locateOutcome.depositSize}</p>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── SURFACE: Step 2 — Deposit Capacity Roll ── */}
      {isSurface && locateRoll.rolled && locateSuccess && locateOutcome && discoveredMineral && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h5 className="text-sm font-medium text-fg-primary">Step 2: Deposit Capacity ({depositCapFormula})</h5>
            {!depositCapRoll.rolled ? (
              <button type="button" onClick={() => setDepositCapRoll(rollFormula(depositCapFormula))} className="flex items-center gap-1 px-3 py-1.5 bg-warning-600 text-white rounded hover:bg-warning-700 text-sm">
                <Dices className="w-3.5 h-3.5" /> Roll Capacity
              </button>
            ) : (
              <button type="button" onClick={() => { setDepositCapRoll({ dice: [], total: 0, rolled: false }); setExtractionRoll({ dice: [0,0,0], total: 0, rolled: false }); setYieldRoll({ dice: [], total: 0, rolled: false }); setBonusYieldRoll({ dice: [], total: 0, rolled: false }); }} className="flex items-center gap-1 px-2 py-1 text-yellow-400 hover:text-yellow-300 text-xs">
                <RotateCcw className="w-3 h-3" /> Reroll
              </button>
            )}
          </div>
          {depositCapRoll.rolled && (
            <div className="bg-surface-0/50 p-3 rounded text-sm">
              <span className="text-fg-secondary">Deposit has <span className="text-warning-400 font-bold">{depositCapRoll.total}</span> total units</span>
            </div>
          )}
        </div>
      )}

      {/* ── Extraction Roll (both methods) ── */}
      {((!isSurface) || (isSurface && depositCapRoll.rolled)) && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h5 className="text-sm font-medium text-fg-primary">
              {isSurface ? 'Step 3' : 'Step 1'}: Extraction Roll (3d6 vs {extractionEffectiveSkill})
            </h5>
            {!extractionRoll.rolled ? (
              <button type="button" onClick={() => setExtractionRoll(roll3d6())} className="flex items-center gap-1 px-3 py-1.5 bg-warning-600 text-white rounded hover:bg-warning-700 text-sm">
                <Dices className="w-3.5 h-3.5" /> Roll 3d6
              </button>
            ) : (
              <button type="button" onClick={() => { setExtractionRoll({ dice: [0,0,0], total: 0, rolled: false }); setYieldRoll({ dice: [], total: 0, rolled: false }); setBonusYieldRoll({ dice: [], total: 0, rolled: false }); setEventCheckRoll({ dice: [0,0,0], total: 0, rolled: false }); setEventDetailRoll({ dice: [0,0], total: 0, rolled: false }); setCritChoiceQuality(false); }} className="flex items-center gap-1 px-2 py-1 text-yellow-400 hover:text-yellow-300 text-xs">
                <RotateCcw className="w-3 h-3" /> Reroll
              </button>
            )}
          </div>

          {extractionRoll.rolled && (
            <div className="bg-surface-0/50 p-3 rounded">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex gap-1">
                  {extractionRoll.dice.map((d, i) => (
                    <span key={i} className="w-8 h-8 bg-surface-2 border border-edge-strong rounded flex items-center justify-center font-bold text-lg">{d}</span>
                  ))}
                </div>
                <span className="text-fg-muted">=</span>
                <span className="font-bold text-xl">{extractionRoll.total}</span>
                <span className="text-fg-muted">vs</span>
                <span className="font-bold text-xl text-warning-400">{extractionEffectiveSkill}</span>
              </div>
              <div className="text-sm">
                {extractionCritSuccess ? (
                  <span className="text-yellow-400 font-bold">Critical Success!</span>
                ) : extractionCritFailure ? (
                  <span className="text-danger-400 font-bold">Critical Failure! No yield + hazard.</span>
                ) : extractionSuccess ? (
                  <span className="text-success-400">Success by {extractionMargin} — full yield</span>
                ) : (
                  <span className="text-orange-400">Failure by {Math.abs(extractionMargin)} — half yield</span>
                )}
              </div>

              {/* Critical Success choice */}
              {extractionCritSuccess && (
                <div className="mt-2 p-2 bg-yellow-900/30 border border-yellow-700 rounded">
                  <p className="text-xs text-yellow-300 mb-1 font-medium">Critical Success — choose one:</p>
                  <div className="flex gap-2">
                    <label className="flex items-center gap-1 text-xs text-yellow-200">
                      <input type="radio" name="critChoice" checked={!critChoiceQuality} onChange={() => setCritChoiceQuality(false)} />
                      +50% yield
                    </label>
                    <label className="flex items-center gap-1 text-xs text-yellow-200">
                      <input type="radio" name="critChoice" checked={critChoiceQuality} onChange={() => setCritChoiceQuality(true)} />
                      Quality Upgrade (High Quality)
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Yield Roll ── */}
      {extractionRoll.rolled && extractionOutcome !== 'criticalFailure' && activeMineral && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h5 className="text-sm font-medium text-fg-primary">
              {isSurface ? 'Step 4' : 'Step 2'}: Yield Roll ({yieldFormula})
            </h5>
            {!yieldRoll.rolled ? (
              <button type="button" onClick={() => setYieldRoll(rollFormula(yieldFormula))} className="flex items-center gap-1 px-3 py-1.5 bg-warning-600 text-white rounded hover:bg-warning-700 text-sm">
                <Dices className="w-3.5 h-3.5" /> Roll Yield
              </button>
            ) : (
              <button type="button" onClick={() => { setYieldRoll({ dice: [], total: 0, rolled: false }); setBonusYieldRoll({ dice: [], total: 0, rolled: false }); }} className="flex items-center gap-1 px-2 py-1 text-yellow-400 hover:text-yellow-300 text-xs">
                <RotateCcw className="w-3 h-3" /> Reroll
              </button>
            )}
          </div>
          {yieldRoll.rolled && (
            <div className="bg-surface-0/50 p-3 rounded text-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-fg-secondary">Base yield:</span>
                <div className="flex gap-1">
                  {yieldRoll.dice.map((d, i) => (
                    <span key={i} className="w-6 h-6 bg-surface-2 border border-edge-strong rounded flex items-center justify-center font-medium text-sm">{d}</span>
                  ))}
                </div>
                <span className="text-fg-muted">= {yieldRoll.total}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Skill 15+ bonus ── */}
      {yieldRoll.rolled && needsSkill15Bonus && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h5 className="text-sm font-medium text-fg-primary">Bonus: Skill 15+ (1d6)</h5>
            {!bonusYieldRoll.rolled ? (
              <button type="button" onClick={() => setBonusYieldRoll(rollFormula('1d'))} className="flex items-center gap-1 px-3 py-1.5 bg-accent-600 text-white rounded hover:bg-accent-700 text-sm">
                <Dices className="w-3.5 h-3.5" /> Roll Bonus
              </button>
            ) : (
              <button type="button" onClick={() => setBonusYieldRoll({ dice: [], total: 0, rolled: false })} className="flex items-center gap-1 px-2 py-1 text-yellow-400 hover:text-yellow-300 text-xs">
                <RotateCcw className="w-3 h-3" /> Reroll
              </button>
            )}
          </div>
          {bonusYieldRoll.rolled && (
            <div className="bg-surface-0/50 p-3 rounded text-sm">
              <span className="text-fg-secondary">Bonus yield: +{bonusYieldRoll.total}</span>
            </div>
          )}
        </div>
      )}

      {/* ── Event Check (conditional) ── */}
      {extractionRoll.rolled && shouldCheckEvent && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h5 className="text-sm font-medium text-fg-primary">Event Check (3d6)</h5>
            {!eventCheckRoll.rolled ? (
              <button type="button" onClick={() => setEventCheckRoll(roll3d6())} className="flex items-center gap-1 px-3 py-1.5 bg-danger-600 text-white rounded hover:bg-danger-700 text-sm">
                <Dices className="w-3.5 h-3.5" /> Roll Event
              </button>
            ) : (
              <button type="button" onClick={() => { setEventCheckRoll({ dice: [0,0,0], total: 0, rolled: false }); setEventDetailRoll({ dice: [0,0], total: 0, rolled: false }); }} className="flex items-center gap-1 px-2 py-1 text-yellow-400 hover:text-yellow-300 text-xs">
                <RotateCcw className="w-3 h-3" /> Reroll
              </button>
            )}
          </div>
          {eventCheckRoll.rolled && (
            <div className="bg-surface-0/50 p-3 rounded text-sm">
              <div className="flex items-center gap-3 mb-1">
                <div className="flex gap-1">
                  {eventCheckRoll.dice.map((d, i) => (
                    <span key={i} className="w-6 h-6 bg-surface-2 border border-edge-strong rounded flex items-center justify-center font-medium text-sm">{d}</span>
                  ))}
                </div>
                <span className="text-fg-muted">= {eventCheckRoll.total}</span>
              </div>
              <p>
                {eventSeverity === 'rare' ? (
                  <span className="text-danger-400 font-bold">Rare Event! (3-6)</span>
                ) : eventSeverity === 'mild' ? (
                  <span className="text-yellow-400 font-bold">Mild Event (7-10)</span>
                ) : (
                  <span className="text-success-400">No Event (11-18)</span>
                )}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Event Detail Roll ── */}
      {eventCheckRoll.rolled && eventSeverity !== 'none' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h5 className="text-sm font-medium text-fg-primary">Event Detail (2d6)</h5>
            {!eventDetailRoll.rolled ? (
              <button type="button" onClick={() => setEventDetailRoll(roll2d6())} className="flex items-center gap-1 px-3 py-1.5 bg-danger-600 text-white rounded hover:bg-danger-700 text-sm">
                <Dices className="w-3.5 h-3.5" /> Roll Detail
              </button>
            ) : (
              <button type="button" onClick={() => setEventDetailRoll({ dice: [0,0], total: 0, rolled: false })} className="flex items-center gap-1 px-2 py-1 text-yellow-400 hover:text-yellow-300 text-xs">
                <RotateCcw className="w-3 h-3" /> Reroll
              </button>
            )}
          </div>
          {eventDetailRoll.rolled && eventResult && (
            <div className={`p-3 rounded text-sm ${eventSeverity === 'rare' ? 'bg-danger-900/30 border border-danger-700' : 'bg-yellow-900/30 border border-yellow-700'}`}>
              <p className="font-medium">{eventResult.name}</p>
              <p className="text-fg-secondary text-xs">{eventResult.description}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Yield Summary ── */}
      {extractionRoll.rolled && extractionOutcome !== 'criticalFailure' && yieldRoll.rolled && (!needsSkill15Bonus || bonusYieldRoll.rolled) && activeMineral && (
        <div className="bg-warning-900/20 border border-warning-700 p-3 rounded text-sm">
          <p className="font-medium text-warning-300 mb-1">Result Summary</p>
          {(() => {
            let baseYield = yieldRoll.total;
            if (needsSkill15Bonus && bonusYieldRoll.rolled) baseYield += bonusYieldRoll.total;
            let multiplier = EXTRACTION_YIELD_MULTIPLIERS[extractionOutcome];
            if (extractionCritSuccess && critChoiceQuality) multiplier = 1.0;
            const finalYield = Math.max(0, Math.floor(baseYield * multiplier));
            return (
              <div className="space-y-1 text-fg-secondary">
                <p>
                  Base: {yieldRoll.total}
                  {needsSkill15Bonus && bonusYieldRoll.rolled ? ` + ${bonusYieldRoll.total} (skill 15+)` : ''}
                  {multiplier !== 1.0 ? ` x ${multiplier} (${extractionOutcome})` : ''}
                </p>
                <p className="text-warning-400 font-bold">
                  {activeMineral.name}: {finalYield} units
                  {extractionCritSuccess && critChoiceQuality ? ' (High Quality!)' : ''}
                </p>
              </div>
            );
          })()}
        </div>
      )}

      {/* ── Failed locate message ── */}
      {isSurface && locateRoll.rolled && !locateSuccess && (
        <div className="bg-surface-0/50 p-3 rounded text-sm text-fg-muted italic">
          No mining site found this time.
        </div>
      )}

      {/* ── Critical failure message ── */}
      {extractionRoll.rolled && extractionOutcome === 'criticalFailure' && (
        <div className="bg-danger-900/30 border border-danger-700 p-3 rounded text-sm text-danger-300">
          Critical failure! No yield extracted. Check for hazards.
        </div>
      )}

      {/* ── Finalize / Cancel ── */}
      <div className="flex gap-2 pt-2 border-t border-edge">
        <button
          type="button"
          onClick={handleFinalize}
          disabled={!allRollsComplete}
          className={`flex-1 px-4 py-2 rounded font-medium text-sm ${
            allRollsComplete ? 'bg-warning-600 text-white hover:bg-warning-700' : 'bg-surface-2 text-fg-faint cursor-not-allowed'
          }`}
        >
          Finalize Task
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-danger-500/50 text-danger-400 rounded hover:bg-danger-900/30 text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
