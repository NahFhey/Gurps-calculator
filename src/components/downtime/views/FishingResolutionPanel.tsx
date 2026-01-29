/**
 * Fishing Resolution Panel
 *
 * Manual dice rolling UI for resolving fishing tasks step-by-step.
 * Allows the user to roll each die individually and see results before finalizing.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { X, Dices } from 'lucide-react';
import { useCampaignStore } from '../../../state/campaignStore';
import {
  evaluateFishingRoll,
  calculateEffectiveFishingSkill,
  rollNetCatch,
  rollOnCatchTable,
  resolveLargeFishStruggle,
} from '../../../utils/gathering';
import {
  FISHING_METHODS,
  DEFAULT_FISH_ST,
} from '../../../constants';
import type { DowntimeTask, FishingData, TaskResults } from '../../../types/downtime';
import type { GatheringSpecies, GatheringEnvironment, GatheringTable, GatheringBait, Character, Food, Material } from '../../../types/campaign';

// ============================================================================
// TYPES
// ============================================================================

interface FishingResolutionPanelProps {
  task: DowntimeTask;
  leader: Character | undefined;
  species: GatheringSpecies[];
  spots: GatheringEnvironment[];
  bait: GatheringBait[];
  gatheringTables: GatheringTable[];
  onFinalize: (results: TaskResults) => void;
  onCancel: () => void;
}

interface DiceRoll {
  dice: number[];
  total: number;
  rolled: boolean;
}

interface ResolutionStep {
  id: string;
  label: string;
  targetSkill?: number;
  diceCount: number;
  roll: DiceRoll;
  result?: 'success' | 'failure' | 'crit_success' | 'crit_failure';
  message?: string;
  visible: boolean;
  required: boolean;
}

// Dice colors for display
const DICE_COLORS = ['bg-red-500', 'bg-green-500', 'bg-blue-500'];

// ============================================================================
// DICE DISPLAY COMPONENT
// ============================================================================

interface DiceDisplayProps {
  dice: number[];
  total: number;
  rolled: boolean;
}

function DiceDisplay({ dice, total, rolled }: DiceDisplayProps) {
  if (!rolled) {
    return (
      <div className="flex items-center gap-2">
        {dice.map((_, i) => (
          <div
            key={i}
            className={`w-8 h-8 ${DICE_COLORS[i % DICE_COLORS.length]} rounded flex items-center justify-center text-white font-bold opacity-30`}
          >
            ?
          </div>
        ))}
        <span className="text-gray-500">=</span>
        <div className="px-3 py-1 bg-gray-700 rounded text-gray-400">
          —
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {dice.map((value, i) => (
        <div
          key={i}
          className={`w-8 h-8 ${DICE_COLORS[i % DICE_COLORS.length]} rounded flex items-center justify-center text-white font-bold`}
        >
          {value}
        </div>
      ))}
      <span className="text-gray-400">=</span>
      <div className="px-3 py-1 bg-gray-700 rounded text-gray-100 font-medium min-w-[3rem] text-center">
        {total}
      </div>
    </div>
  );
}

// ============================================================================
// ROLL STEP COMPONENT
// ============================================================================

interface RollStepProps {
  step: ResolutionStep;
  onRoll: () => void;
  disabled?: boolean;
}

function RollStep({ step, onRoll, disabled }: RollStepProps) {
  if (!step.visible) return null;

  const getResultColor = () => {
    switch (step.result) {
      case 'crit_success': return 'text-green-400';
      case 'success': return 'text-green-400';
      case 'crit_failure': return 'text-red-400';
      case 'failure': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getResultText = () => {
    switch (step.result) {
      case 'crit_success': return 'Critical Success!';
      case 'success': return `Success (MoS: ${step.targetSkill! - step.roll.total})`;
      case 'crit_failure': return 'Critical Failure!';
      case 'failure': return `Failure (MoF: ${step.roll.total - step.targetSkill!})`;
      default: return '';
    }
  };

  return (
    <div className="roll-step bg-gray-800/50 border border-gray-700 rounded-lg p-3 mb-3">
      <div className="flex justify-between items-center mb-2">
        <span className="text-gray-200 font-medium">
          {step.label}
          {step.targetSkill !== undefined && (
            <span className="text-gray-400 ml-2">vs {step.targetSkill}</span>
          )}
        </span>
        <button
          type="button"
          onClick={onRoll}
          disabled={disabled || step.roll.rolled}
          className={`flex items-center gap-1 px-3 py-1 rounded text-sm font-medium transition-colors ${
            step.roll.rolled
              ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
              : disabled
              ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
              : 'bg-purple-600 text-white hover:bg-purple-700'
          }`}
        >
          <Dices className="w-4 h-4" />
          Roll {step.diceCount}d6
        </button>
      </div>

      <DiceDisplay
        dice={step.roll.dice}
        total={step.roll.total}
        rolled={step.roll.rolled}
      />

      {step.roll.rolled && step.result && (
        <div className={`mt-2 text-sm font-medium ${getResultColor()}`}>
          {getResultText()}
        </div>
      )}

      {step.message && (
        <div className="mt-2 text-sm text-gray-400">
          {step.message}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// YIELD ROLL COMPONENT
// ============================================================================

interface YieldRollProps {
  label: string;
  formula: string;
  roll: DiceRoll;
  onRoll: () => void;
  disabled?: boolean;
}

function YieldRoll({ label, formula, roll, onRoll, disabled }: YieldRollProps) {
  return (
    <div className="yield-roll bg-gray-800/50 border border-gray-700 rounded-lg p-3 mb-2">
      <div className="flex justify-between items-center mb-2">
        <span className="text-gray-200 font-medium">
          {label}
          <span className="text-gray-400 ml-2">({formula})</span>
        </span>
        <button
          type="button"
          onClick={onRoll}
          disabled={disabled || roll.rolled}
          className={`flex items-center gap-1 px-3 py-1 rounded text-sm font-medium transition-colors ${
            roll.rolled
              ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
              : disabled
              ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
              : 'bg-purple-600 text-white hover:bg-purple-700'
          }`}
        >
          <Dices className="w-4 h-4" />
          Roll
        </button>
      </div>

      <DiceDisplay
        dice={roll.dice}
        total={roll.total}
        rolled={roll.rolled}
      />

      {roll.rolled && (
        <div className="mt-2 text-sm text-green-400">
          +{roll.total} units
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function FishingResolutionPanel({
  task,
  leader,
  species,
  spots,
  bait,
  gatheringTables,
  onFinalize,
  onCancel,
}: FishingResolutionPanelProps) {
  const { actions: campaignActions } = useCampaignStore();
  const data = task.activityData as FishingData;
  const method = data.method || 'Line';
  const methodConfig = FISHING_METHODS[method];
  const isRandomCatch = data.isRandomCatch ?? true;
  const isSpear = method === 'Spear';

  // Get target species and spot
  const targetSpecies = !isRandomCatch && data.speciesId
    ? species.find(s => s.id === data.speciesId)
    : null;
  const spot = spots.find(s => s.id === data.spotId);

  // Get bait
  const baitItem = data.baitId ? bait.find(b => b.id === data.baitId) : null;

  // Calculate skills
  const leaderSkills = (leader as any)?.skills ?? {};
  const baseSkill = isSpear
    ? (leaderSkills.spear ?? leaderSkills.fishing ?? 10)
    : (leaderSkills.fishing ?? 10);
  const stealthSkill = leaderSkills.stealth ?? leaderSkills.survival ?? 10;
  const leaderST = (leader as any)?.st ?? 10;

  // Check bait compatibility
  const hasCorrectBait = baitItem && targetSpecies && !isRandomCatch
    ? ((baitItem as any).attractsSpeciesIds?.includes(data.speciesId) ?? false)
    : false;
  const hasInappropriateBait = baitItem && targetSpecies && !isRandomCatch && !hasCorrectBait;

  // Check if targeting large fish
  const targetIsLarge = targetSpecies
    ? ((targetSpecies as any).tags?.includes('LargeFish') ?? false)
    : false;

  // State for resolution steps
  const [stealthRoll, setStealthRoll] = useState<DiceRoll>({ dice: [0, 0, 0], total: 0, rolled: false });
  const [fishingRoll, setFishingRoll] = useState<DiceRoll>({ dice: [0, 0, 0], total: 0, rolled: false });
  const [struggleRoll, setStruggleRoll] = useState<DiceRoll>({ dice: [0, 0, 0], total: 0, rolled: false });
  const [fishStruggleRoll, setFishStruggleRoll] = useState<DiceRoll>({ dice: [0, 0, 0], total: 0, rolled: false });
  const [speciesRoll, setSpeciesRoll] = useState<DiceRoll>({ dice: [0, 0], total: 0, rolled: false });
  const [meatYieldRoll, setMeatYieldRoll] = useState<DiceRoll>({ dice: [], total: 0, rolled: false });
  const [secondaryYieldRoll, setSecondaryYieldRoll] = useState<DiceRoll>({ dice: [], total: 0, rolled: false });

  // Derived state
  const [stealthPenalty, setStealthPenalty] = useState(0);
  const [caughtSpecies, setCaughtSpecies] = useState<GatheringSpecies | null>(null);
  const [fishCount, setFishCount] = useState(0);
  const [struggleWon, setStruggleWon] = useState(true);
  const [fishingSuccess, setFishingSuccess] = useState<boolean | null>(null);
  const [fishingCritSuccess, setFishingCritSuccess] = useState(false);

  // Calculate effective skill (after stealth roll if applicable)
  const effectiveSkill = useMemo(() => {
    const result = calculateEffectiveFishingSkill({
      baseFishingSkill: baseSkill,
      toolBonus: data.skillModifier + stealthPenalty,
      hasCorrectBait,
      hasInappropriateBait: hasInappropriateBait ?? false,
      targetingLargeFish: !isRandomCatch && targetIsLarge,
      retryPenalty: -(data.retryAttempt ?? 0),
      environmentMod: spot?.skillMod ?? 0,
    });
    return typeof result === 'number' ? result : result.effectiveSkill;
  }, [baseSkill, data.skillModifier, stealthPenalty, hasCorrectBait, hasInappropriateBait, isRandomCatch, targetIsLarge, data.retryAttempt, spot?.skillMod]);

  // Roll functions
  const rollDice = (count: number): { dice: number[]; total: number } => {
    const dice = Array.from({ length: count }, () => Math.floor(Math.random() * 6) + 1);
    const total = dice.reduce((sum, d) => sum + d, 0);
    return { dice, total };
  };

  const handleStealthRoll = useCallback(() => {
    const result = rollDice(3);
    setStealthRoll({ ...result, rolled: true });
    if (result.total > stealthSkill) {
      setStealthPenalty(-2);
    }
  }, [stealthSkill]);

  const handleFishingRoll = useCallback(() => {
    const result = rollDice(3);
    setFishingRoll({ ...result, rolled: true });

    const rollResult = evaluateFishingRoll(result.total, effectiveSkill, method);
    setFishingSuccess(rollResult.success);
    setFishingCritSuccess(rollResult.critSuccess);

    if (rollResult.success) {
      let count = rollResult.fish;
      if (method === 'Net' && rollResult.critSuccess && count < 2) {
        count = 2;
      }
      setFishCount(count);

      // For targeted fishing, set the caught species immediately
      if (!isRandomCatch && targetSpecies) {
        setCaughtSpecies(targetSpecies);
      }
    }
  }, [effectiveSkill, method, isRandomCatch, targetSpecies]);

  const handleSpeciesRoll = useCallback(() => {
    const result = rollDice(2);
    setSpeciesRoll({ ...result, rolled: true });

    // Get catch table for spot
    const spotDefaults = spot?.defaultsByMode?.Fishing ?? (spot as any)?.defaultTables;
    const catchTableId = spotDefaults?.randomCatchTableId;
    const catchTable = catchTableId
      ? gatheringTables.find(t => t.id === catchTableId)
      : null;

    if (!catchTable) {
      // No catch table configured - fall back to first species in list
      if (species.length > 0) {
        setCaughtSpecies(species[0]);
      }
      return;
    }

    try {
      // For Net fishing, need to reroll if large fish
      if (method === 'Net') {
        const tableEntry = rollNetCatch(catchTable as any, species as any);
        if (tableEntry.resultType === 'species' && tableEntry.speciesId) {
          const caught = species.find(s => s.id === tableEntry.speciesId);
          if (caught) {
            setCaughtSpecies(caught);
          }
        }
      } else {
        // For Line/Spear: use the displayed roll to look up table entry
        const baitRollBonus = baitItem ? ((baitItem as any).rollBonus ?? 0) : 0;
        const modifiedRoll = Math.min(12, result.total + baitRollBonus);

        // Find matching entry in table
        const entries = (catchTable as any).entries || [];
        const entry = entries.find((e: any) => e.rollValue === modifiedRoll);

        if (entry && entry.resultType === 'species' && entry.speciesId) {
          const caught = species.find(s => s.id === entry.speciesId);
          if (caught) {
            setCaughtSpecies(caught);
          }
        } else if (entries.length > 0) {
          // Fallback: find closest entry or first species entry
          const speciesEntry = entries.find((e: any) => e.resultType === 'species' && e.speciesId);
          if (speciesEntry) {
            const caught = species.find(s => s.id === speciesEntry.speciesId);
            if (caught) {
              setCaughtSpecies(caught);
            }
          }
        }
      }
    } catch (error) {
      // Table error - fall back to first species
      if (species.length > 0) {
        setCaughtSpecies(species[0]);
      }
    }
  }, [spot, gatheringTables, method, species, baitItem]);

  const handleStruggleRoll = useCallback(() => {
    const result = rollDice(3);
    setStruggleRoll({ ...result, rolled: true });
  }, []);

  const handleFishStruggleRoll = useCallback(() => {
    const result = rollDice(3);
    setFishStruggleRoll({ ...result, rolled: true });

    // Determine winner
    const fishST = (caughtSpecies as any)?.st ?? DEFAULT_FISH_ST;
    const playerMargin = leaderST - struggleRoll.total;
    const fishMargin = fishST - result.total;

    if (playerMargin > fishMargin) {
      setStruggleWon(true);
    } else if (fishMargin > playerMargin) {
      setStruggleWon(false);
    } else {
      // Tie goes to higher ST
      setStruggleWon(leaderST >= fishST);
    }
  }, [caughtSpecies, leaderST, struggleRoll.total]);

  // Parse dice formula like "2d+1" or "1d-2"
  const parseDiceFormula = (formula: string): { diceCount: number; modifier: number } => {
    const match = formula.match(/(\d+)d([+-]\d+)?/);
    if (match) {
      const diceCount = parseInt(match[1], 10);
      const modifier = match[2] ? parseInt(match[2], 10) : 0;
      return { diceCount, modifier };
    }
    return { diceCount: 1, modifier: 0 };
  };

  const handleMeatYieldRoll = useCallback(() => {
    const formula = (caughtSpecies as any)?.yieldMeatFormula ?? '1d';
    const { diceCount, modifier } = parseDiceFormula(formula);
    const result = rollDice(diceCount);
    setMeatYieldRoll({
      dice: result.dice,
      total: Math.max(0, result.total + modifier),
      rolled: true,
    });
  }, [caughtSpecies]);

  const handleSecondaryYieldRoll = useCallback(() => {
    const formula = (caughtSpecies as any)?.yieldSecondaryFormula ?? '1d-2';
    const { diceCount, modifier } = parseDiceFormula(formula);
    const result = rollDice(diceCount);
    setSecondaryYieldRoll({
      dice: result.dice,
      total: Math.max(0, result.total + modifier),
      rolled: true,
    });
  }, [caughtSpecies]);

  // Determine which steps are visible and required
  const needsStealthRoll = isSpear;
  const needsSpeciesRoll = fishingSuccess && isRandomCatch;
  const needsStruggleRoll = fishingSuccess && caughtSpecies &&
    ((caughtSpecies as any)?.tags?.includes('LargeFish') ?? false) &&
    method !== 'Net';
  const needsYieldRolls = fishingSuccess && caughtSpecies &&
    (!needsStruggleRoll || (struggleRoll.rolled && fishStruggleRoll.rolled && struggleWon));

  // Check if all required rolls are complete
  const allRollsComplete = useMemo(() => {
    if (needsStealthRoll && !stealthRoll.rolled) return false;
    if (!fishingRoll.rolled) return false;
    if (!fishingSuccess) return true; // Failed, no more rolls needed
    if (needsSpeciesRoll && !speciesRoll.rolled) return false;
    if (needsStruggleRoll && (!struggleRoll.rolled || !fishStruggleRoll.rolled)) return false;
    if (needsYieldRolls && (!meatYieldRoll.rolled || !secondaryYieldRoll.rolled)) return false;
    return true;
  }, [
    needsStealthRoll, stealthRoll.rolled,
    fishingRoll.rolled, fishingSuccess,
    needsSpeciesRoll, speciesRoll.rolled,
    needsStruggleRoll, struggleRoll.rolled, fishStruggleRoll.rolled,
    needsYieldRolls, meatYieldRoll.rolled, secondaryYieldRoll.rolled,
  ]);

  // Handle finalize
  const handleFinalize = useCallback(() => {
    // Build result message
    let message = '';

    if (isSpear) {
      if (stealthPenalty < 0) {
        message += `Stealth failed (${stealthRoll.total} vs ${stealthSkill}), -2 penalty. `;
      } else {
        message += `Good approach (${stealthRoll.total} vs ${stealthSkill}). `;
      }
    }

    if (fishingCritSuccess) {
      message += `Critical Success! (Rolled ${fishingRoll.total} vs ${effectiveSkill})`;
    } else if (fishingSuccess) {
      message += `Success! (Rolled ${fishingRoll.total} vs ${effectiveSkill}, MoS: ${effectiveSkill - fishingRoll.total})`;
    } else {
      message += `Failure (Rolled ${fishingRoll.total} vs ${effectiveSkill})`;
    }

    if (fishingSuccess && caughtSpecies) {
      message += ` Caught: ${caughtSpecies.name}.`;

      if (needsStruggleRoll) {
        if (struggleWon) {
          message += ` Won the struggle!`;
        } else {
          message += ` The fish escaped during the struggle.`;
        }
      }
    }

    // Prepare inventory changes and save to campaign
    const inventoryChanges: Array<{ itemId: string; quantity: number; itemName: string }> = [];

    if (fishingSuccess && caughtSpecies && (!needsStruggleRoll || struggleWon)) {
      const meatUnits = meatYieldRoll.total;
      const secondaryUnits = secondaryYieldRoll.total;
      const secondaryType = (caughtSpecies as any)?.secondaryMaterialType ?? 'scales';

      // Add to foods
      if (meatUnits > 0) {
        const foodId = `fish-${caughtSpecies.id}-${Date.now()}`;
        const foodName = `${caughtSpecies.name} Meat`;

        campaignActions.addFood({
          id: foodId,
          name: foodName,
          type: 'fish',
          quantity: meatUnits,
          source: `Fishing at ${spot?.name ?? 'unknown'}`,
        } as Food);

        inventoryChanges.push({
          itemId: foodId,
          quantity: meatUnits,
          itemName: foodName,
        });
      }

      // Add to materials
      if (secondaryUnits > 0) {
        const materialId = `material-${caughtSpecies.id}-${secondaryType}-${Date.now()}`;
        const materialName = `${caughtSpecies.name} ${secondaryType.charAt(0).toUpperCase() + secondaryType.slice(1)}`;

        campaignActions.addMaterial({
          id: materialId,
          name: materialName,
          type: secondaryType,
          quantity: secondaryUnits,
          source: `Fishing at ${spot?.name ?? 'unknown'}`,
        } as Material);

        inventoryChanges.push({
          itemId: materialId,
          quantity: secondaryUnits,
          itemName: materialName,
        });
      }
    }

    const results: TaskResults = {
      success: fishingSuccess ?? false,
      message,
      inventoryChanges,
    };

    onFinalize(results);
  }, [
    isSpear, stealthPenalty, stealthRoll.total, stealthSkill,
    fishingCritSuccess, fishingSuccess, fishingRoll.total, effectiveSkill,
    caughtSpecies, needsStruggleRoll, struggleWon,
    meatYieldRoll.total, secondaryYieldRoll.total,
    campaignActions, spot, onFinalize,
  ]);

  // Get yield formulas for display
  const meatFormula = (caughtSpecies as any)?.yieldMeatFormula ?? '1d';
  const secondaryFormula = (caughtSpecies as any)?.yieldSecondaryFormula ?? '1d-2';
  const secondaryType = (caughtSpecies as any)?.secondaryMaterialType ?? 'scales';

  return (
    <div className="fishing-resolution-panel bg-gray-900 border border-gray-700 rounded-lg p-4 max-w-md">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-100">Manual Resolution</h3>
        <button
          type="button"
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-200"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Stealth Roll (Spear only) */}
      {needsStealthRoll && (
        <RollStep
          step={{
            id: 'stealth',
            label: 'Stealth Approach',
            targetSkill: stealthSkill,
            diceCount: 3,
            roll: stealthRoll,
            result: stealthRoll.rolled
              ? stealthRoll.total <= stealthSkill ? 'success' : 'failure'
              : undefined,
            message: stealthRoll.rolled && stealthRoll.total > stealthSkill
              ? '-2 penalty to strike'
              : undefined,
            visible: true,
            required: true,
          }}
          onRoll={handleStealthRoll}
        />
      )}

      {/* Fishing Roll */}
      <RollStep
        step={{
          id: 'fishing',
          label: isSpear ? 'Spear Strike' : 'Fishing Skill',
          targetSkill: effectiveSkill,
          diceCount: 3,
          roll: fishingRoll,
          result: fishingRoll.rolled
            ? fishingCritSuccess
              ? 'crit_success'
              : fishingSuccess
              ? 'success'
              : fishingRoll.total >= 17
              ? 'crit_failure'
              : 'failure'
            : undefined,
          visible: true,
          required: true,
        }}
        onRoll={handleFishingRoll}
        disabled={needsStealthRoll && !stealthRoll.rolled}
      />

      {/* Targeted Catch - Show species immediately after fishing success */}
      {fishingSuccess && !isRandomCatch && caughtSpecies && (
        <div className="targeted-catch bg-green-900/30 border border-green-700 rounded-lg p-3 mb-3">
          <div className="text-sm text-green-400 font-medium">
            Targeted Catch: {caughtSpecies.name}
          </div>
        </div>
      )}

      {/* Species Roll (Random catch only) */}
      {fishingSuccess && isRandomCatch && (
        <div className="species-roll bg-gray-800/50 border border-gray-700 rounded-lg p-3 mb-3">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-200 font-medium">Random Catch (2d6)</span>
            <button
              type="button"
              onClick={handleSpeciesRoll}
              disabled={speciesRoll.rolled}
              className={`flex items-center gap-1 px-3 py-1 rounded text-sm font-medium transition-colors ${
                speciesRoll.rolled
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-purple-600 text-white hover:bg-purple-700'
              }`}
            >
              <Dices className="w-4 h-4" />
              Roll 2d6
            </button>
          </div>
          <DiceDisplay dice={speciesRoll.dice} total={speciesRoll.total} rolled={speciesRoll.rolled} />
          {speciesRoll.rolled && caughtSpecies && (
            <div className="mt-2 text-sm text-green-400">
              Caught: {caughtSpecies.name}
            </div>
          )}
          {speciesRoll.rolled && !caughtSpecies && (
            <div className="mt-2 text-sm text-yellow-400">
              No catch - try again or check catch table configuration
            </div>
          )}
        </div>
      )}

      {/* Large Fish Struggle */}
      {needsStruggleRoll && (
        <div className="struggle-section border-l-2 border-orange-500 pl-3 mb-3">
          <div className="text-sm text-orange-400 mb-2 font-medium">Large Fish Struggle!</div>

          {/* Player Struggle Roll */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 mb-2">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-200 font-medium">
                Your ST vs {leaderST}
              </span>
              <button
                type="button"
                onClick={handleStruggleRoll}
                disabled={struggleRoll.rolled}
                className={`flex items-center gap-1 px-3 py-1 rounded text-sm font-medium transition-colors ${
                  struggleRoll.rolled
                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    : 'bg-purple-600 text-white hover:bg-purple-700'
                }`}
              >
                <Dices className="w-4 h-4" />
                Roll 3d6
              </button>
            </div>
            <DiceDisplay dice={struggleRoll.dice} total={struggleRoll.total} rolled={struggleRoll.rolled} />
          </div>

          {/* Fish Struggle Roll */}
          {struggleRoll.rolled && (
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 mb-2">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-200 font-medium">
                  Fish ST vs {(caughtSpecies as any)?.st ?? DEFAULT_FISH_ST}
                </span>
                <button
                  type="button"
                  onClick={handleFishStruggleRoll}
                  disabled={fishStruggleRoll.rolled}
                  className={`flex items-center gap-1 px-3 py-1 rounded text-sm font-medium transition-colors ${
                    fishStruggleRoll.rolled
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      : 'bg-purple-600 text-white hover:bg-purple-700'
                  }`}
                >
                  <Dices className="w-4 h-4" />
                  Roll 3d6
                </button>
              </div>
              <DiceDisplay dice={fishStruggleRoll.dice} total={fishStruggleRoll.total} rolled={fishStruggleRoll.rolled} />
              {fishStruggleRoll.rolled && (
                <div className={`mt-2 text-sm font-medium ${struggleWon ? 'text-green-400' : 'text-red-400'}`}>
                  {struggleWon ? 'You landed the fish!' : 'The fish escaped!'}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Yield Rolls */}
      {needsYieldRolls && (
        <div className="yield-section border-l-2 border-green-500 pl-3 mb-3">
          <div className="text-sm text-green-400 mb-2 font-medium">Calculate Yields</div>

          <YieldRoll
            label={`${caughtSpecies?.name} Meat`}
            formula={meatFormula}
            roll={meatYieldRoll}
            onRoll={handleMeatYieldRoll}
          />

          <YieldRoll
            label={`${caughtSpecies?.name} ${secondaryType.charAt(0).toUpperCase() + secondaryType.slice(1)}`}
            formula={secondaryFormula}
            roll={secondaryYieldRoll}
            onRoll={handleSecondaryYieldRoll}
          />
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 mt-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleFinalize}
          disabled={!allRollsComplete}
          className={`flex-1 px-4 py-2 rounded font-medium transition-colors ${
            allRollsComplete
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          Finalize Task
        </button>
      </div>
    </div>
  );
}
