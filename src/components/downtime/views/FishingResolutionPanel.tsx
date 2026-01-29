/**
 * Fishing Resolution Panel
 *
 * Manual dice rolling UI for resolving fishing tasks step-by-step.
 * Allows the user to roll each die individually and see results before finalizing.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { X, Dices, RotateCcw, Edit2 } from 'lucide-react';
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
  gmMode?: boolean;
  onEdit?: (newDice: number[], newTotal: number) => void;
}

function DiceDisplay({ dice, total, rolled, gmMode, onEdit }: DiceDisplayProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editDice, setEditDice] = useState<number[]>([]);

  const startEditing = () => {
    setEditDice([...dice]);
    setIsEditing(true);
  };

  const handleDiceChange = (index: number, value: string) => {
    const newValue = Math.max(1, Math.min(6, parseInt(value) || 1));
    const newDice = [...editDice];
    newDice[index] = newValue;
    setEditDice(newDice);
  };

  const applyEdit = () => {
    const newTotal = editDice.reduce((sum, d) => sum + d, 0);
    onEdit?.(editDice, newTotal);
    setIsEditing(false);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditDice([]);
  };

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

  if (isEditing && gmMode) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          {editDice.map((value, i) => (
            <input
              key={i}
              type="number"
              min="1"
              max="6"
              value={value}
              onChange={(e) => handleDiceChange(i, e.target.value)}
              className={`w-8 h-8 ${DICE_COLORS[i % DICE_COLORS.length]} rounded text-center text-white font-bold border-2 border-yellow-400`}
            />
          ))}
          <span className="text-gray-400">=</span>
          <div className="px-3 py-1 bg-gray-700 rounded text-gray-100 font-medium min-w-[3rem] text-center">
            {editDice.reduce((sum, d) => sum + d, 0)}
          </div>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={applyEdit}
            className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={cancelEdit}
            className="px-2 py-1 text-xs bg-gray-600 text-gray-200 rounded hover:bg-gray-500"
          >
            Cancel
          </button>
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
      {gmMode && onEdit && (
        <button
          type="button"
          onClick={startEditing}
          className="p-1 text-yellow-400 hover:text-yellow-300"
          title="GM: Edit dice"
        >
          <Edit2 className="w-4 h-4" />
        </button>
      )}
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
  gmMode?: boolean;
  onReroll?: () => void;
  onEdit?: (newDice: number[], newTotal: number) => void;
}

function RollStep({ step, onRoll, disabled, gmMode, onReroll, onEdit }: RollStepProps) {
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
        <div className="flex gap-1">
          {gmMode && step.roll.rolled && onReroll && (
            <button
              type="button"
              onClick={onReroll}
              className="flex items-center gap-1 px-2 py-1 rounded text-sm font-medium bg-yellow-600 text-white hover:bg-yellow-700"
              title="GM: Reroll"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
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
      </div>

      <DiceDisplay
        dice={step.roll.dice}
        total={step.roll.total}
        rolled={step.roll.rolled}
        gmMode={gmMode}
        onEdit={onEdit}
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
  gmMode?: boolean;
  onReroll?: () => void;
  onEdit?: (newDice: number[], newTotal: number) => void;
}

function YieldRoll({ label, formula, roll, onRoll, disabled, gmMode, onReroll, onEdit }: YieldRollProps) {
  return (
    <div className="yield-roll bg-gray-800/50 border border-gray-700 rounded-lg p-3 mb-2">
      <div className="flex justify-between items-center mb-2">
        <span className="text-gray-200 font-medium">
          {label}
          <span className="text-gray-400 ml-2">({formula})</span>
        </span>
        <div className="flex gap-1">
          {gmMode && roll.rolled && onReroll && (
            <button
              type="button"
              onClick={onReroll}
              className="flex items-center gap-1 px-2 py-1 rounded text-sm font-medium bg-yellow-600 text-white hover:bg-yellow-700"
              title="GM: Reroll"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
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
      </div>

      <DiceDisplay
        dice={roll.dice}
        total={roll.total}
        rolled={roll.rolled}
        gmMode={gmMode}
        onEdit={onEdit}
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
  const { state: campaignState, actions: campaignActions } = useCampaignStore();
  const gmMode = campaignState?.ui?.gmModeEnabled ?? false;
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

  // GM Mode edit handlers - allows modifying dice after rolled
  const handleEditFishingRoll = useCallback((newDice: number[], newTotal: number) => {
    setFishingRoll({ dice: newDice, total: newTotal, rolled: true });
    // Re-evaluate the result with new dice
    const rollResult = evaluateFishingRoll(newTotal, effectiveSkill, method);
    setFishingSuccess(rollResult.success);
    setFishingCritSuccess(rollResult.critSuccess);
    if (rollResult.success) {
      let count = rollResult.fish;
      if (method === 'Net' && rollResult.critSuccess && count < 2) {
        count = 2;
      }
      setFishCount(count);
      if (!isRandomCatch && targetSpecies) {
        setCaughtSpecies(targetSpecies);
      }
    } else {
      setFishCount(0);
      if (!isRandomCatch) {
        setCaughtSpecies(null);
      }
    }
  }, [effectiveSkill, method, isRandomCatch, targetSpecies]);

  const handleEditStealthRoll = useCallback((newDice: number[], newTotal: number) => {
    setStealthRoll({ dice: newDice, total: newTotal, rolled: true });
    if (newTotal > stealthSkill) {
      setStealthPenalty(-2);
    } else {
      setStealthPenalty(0);
    }
  }, [stealthSkill]);

  const handleEditStruggleRoll = useCallback((newDice: number[], newTotal: number) => {
    setStruggleRoll({ dice: newDice, total: newTotal, rolled: true });
    // Re-evaluate struggle if fish has also rolled
    if (fishStruggleRoll.rolled) {
      const playerMoS = leaderST - newTotal;
      const fishMoS = ((caughtSpecies as any)?.st ?? DEFAULT_FISH_ST) - fishStruggleRoll.total;
      setStruggleWon(playerMoS >= fishMoS);
    }
  }, [leaderST, fishStruggleRoll, caughtSpecies]);

  const handleEditFishStruggleRoll = useCallback((newDice: number[], newTotal: number) => {
    setFishStruggleRoll({ dice: newDice, total: newTotal, rolled: true });
    // Re-evaluate struggle
    if (struggleRoll.rolled) {
      const playerMoS = leaderST - struggleRoll.total;
      const fishMoS = ((caughtSpecies as any)?.st ?? DEFAULT_FISH_ST) - newTotal;
      setStruggleWon(playerMoS >= fishMoS);
    }
  }, [leaderST, struggleRoll, caughtSpecies]);

  const handleEditMeatYield = useCallback((newDice: number[], newTotal: number) => {
    const formula = (caughtSpecies as any)?.yieldMeatFormula ?? '1d';
    const { modifier } = parseDiceFormula(formula);
    setMeatYieldRoll({
      dice: newDice,
      total: Math.max(0, newTotal + modifier),
      rolled: true,
    });
  }, [caughtSpecies]);

  const handleEditSecondaryYield = useCallback((newDice: number[], newTotal: number) => {
    const formula = (caughtSpecies as any)?.yieldSecondaryFormula ?? '1d-2';
    const { modifier } = parseDiceFormula(formula);
    setSecondaryYieldRoll({
      dice: newDice,
      total: Math.max(0, newTotal + modifier),
      rolled: true,
    });
  }, [caughtSpecies]);

  const handleEditSpeciesRoll = useCallback((newDice: number[], newTotal: number) => {
    setSpeciesRoll({ dice: newDice, total: newTotal, rolled: true });

    // Re-lookup species based on new roll
    const spotDefaults = spot?.defaultsByMode?.Fishing ?? (spot as any)?.defaultTables;
    const catchTableId = spotDefaults?.randomCatchTableId;
    const catchTable = catchTableId
      ? gatheringTables.find(t => t.id === catchTableId)
      : null;

    if (!catchTable) {
      if (species.length > 0) {
        setCaughtSpecies(species[0]);
      }
      return;
    }

    const baitRollBonus = baitItem ? ((baitItem as any).rollBonus ?? 0) : 0;
    const modifiedRoll = Math.min(12, newTotal + baitRollBonus);
    const entries = (catchTable as any).entries || [];
    const entry = entries.find((e: any) => e.rollValue === modifiedRoll);

    if (entry && entry.resultType === 'species' && entry.speciesId) {
      const caught = species.find(s => s.id === entry.speciesId);
      if (caught) {
        setCaughtSpecies(caught);
      }
    } else if (entries.length > 0) {
      const speciesEntry = entries.find((e: any) => e.resultType === 'species' && e.speciesId);
      if (speciesEntry) {
        const caught = species.find(s => s.id === speciesEntry.speciesId);
        if (caught) {
          setCaughtSpecies(caught);
        }
      }
    }
  }, [spot, gatheringTables, species, baitItem]);

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
    if (needsYieldRolls) {
      if (!meatYieldRoll.rolled) return false;
      // Only require secondary roll if species has secondary material
      const hasSecondary = (caughtSpecies as any)?.secondaryMaterialType &&
        (caughtSpecies as any)?.secondaryMaterialType !== 'None' &&
        (caughtSpecies as any)?.secondaryMaterialType !== '';
      if (hasSecondary && !secondaryYieldRoll.rolled) return false;
    }
    return true;
  }, [
    needsStealthRoll, stealthRoll.rolled,
    fishingRoll.rolled, fishingSuccess,
    needsSpeciesRoll, speciesRoll.rolled,
    needsStruggleRoll, struggleRoll.rolled, fishStruggleRoll.rolled,
    needsYieldRolls, meatYieldRoll.rolled, secondaryYieldRoll.rolled, caughtSpecies,
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
        // Use the species' foodType instead of hardcoded 'fish'
        const foodType = (caughtSpecies as any).foodType ?? 'fish';

        campaignActions.addFood({
          id: foodId,
          name: foodName,
          type: foodType,
          quantity: meatUnits,
          source: `Fishing at ${spot?.name ?? 'unknown'}`,
        } as Food);

        inventoryChanges.push({
          itemId: foodId,
          quantity: meatUnits,
          itemName: foodName,
        });
      }

      // Add to materials (only if species has secondary material)
      const hasSecondary = secondaryType &&
        secondaryType !== 'None' &&
        secondaryType !== '' &&
        secondaryUnits > 0;
      if (hasSecondary) {
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
  const secondaryMaterialType = (caughtSpecies as any)?.secondaryMaterialType;
  const hasSecondaryMaterial = secondaryMaterialType && secondaryMaterialType !== 'None' && secondaryMaterialType !== '';
  const secondaryFormula = hasSecondaryMaterial ? ((caughtSpecies as any)?.yieldSecondaryFormula ?? '1d-2') : '';
  const secondaryType = hasSecondaryMaterial ? secondaryMaterialType : '';

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
          gmMode={gmMode}
          onReroll={handleStealthRoll}
          onEdit={handleEditStealthRoll}
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
        gmMode={gmMode}
        onReroll={handleFishingRoll}
        onEdit={handleEditFishingRoll}
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
            <div className="flex gap-1">
              {gmMode && speciesRoll.rolled && (
                <button
                  type="button"
                  onClick={handleSpeciesRoll}
                  className="flex items-center gap-1 px-2 py-1 rounded text-sm font-medium bg-yellow-600 text-white hover:bg-yellow-700"
                  title="GM: Reroll"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}
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
          </div>
          <DiceDisplay
            dice={speciesRoll.dice}
            total={speciesRoll.total}
            rolled={speciesRoll.rolled}
            gmMode={gmMode}
            onEdit={handleEditSpeciesRoll}
          />
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
              <div className="flex gap-1">
                {gmMode && struggleRoll.rolled && (
                  <button
                    type="button"
                    onClick={handleStruggleRoll}
                    className="flex items-center gap-1 px-2 py-1 rounded text-sm font-medium bg-yellow-600 text-white hover:bg-yellow-700"
                    title="GM: Reroll"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                )}
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
            </div>
            <DiceDisplay
              dice={struggleRoll.dice}
              total={struggleRoll.total}
              rolled={struggleRoll.rolled}
              gmMode={gmMode}
              onEdit={handleEditStruggleRoll}
            />
          </div>

          {/* Fish Struggle Roll */}
          {struggleRoll.rolled && (
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 mb-2">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-200 font-medium">
                  Fish ST vs {(caughtSpecies as any)?.st ?? DEFAULT_FISH_ST}
                </span>
                <div className="flex gap-1">
                  {gmMode && fishStruggleRoll.rolled && (
                    <button
                      type="button"
                      onClick={handleFishStruggleRoll}
                      className="flex items-center gap-1 px-2 py-1 rounded text-sm font-medium bg-yellow-600 text-white hover:bg-yellow-700"
                      title="GM: Reroll"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
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
              </div>
              <DiceDisplay
                dice={fishStruggleRoll.dice}
                total={fishStruggleRoll.total}
                rolled={fishStruggleRoll.rolled}
                gmMode={gmMode}
                onEdit={handleEditFishStruggleRoll}
              />
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
            gmMode={gmMode}
            onReroll={handleMeatYieldRoll}
            onEdit={handleEditMeatYield}
          />

          {hasSecondaryMaterial && (
            <YieldRoll
              label={`${caughtSpecies?.name} ${secondaryType.charAt(0).toUpperCase() + secondaryType.slice(1)}`}
              formula={secondaryFormula}
              roll={secondaryYieldRoll}
              onRoll={handleSecondaryYieldRoll}
              gmMode={gmMode}
              onReroll={handleSecondaryYieldRoll}
              onEdit={handleEditSecondaryYield}
            />
          )}
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
