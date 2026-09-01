import { useMemo, useState, ChangeEvent } from 'react';
import { Dices } from 'lucide-react';
import ModifierStack from './ModifierStack';
import { DEFENSE_MODIFIERS, calculateEffective } from '../../utils/modifiers';
import { rollVsTarget } from '../../utils/dice';
import { getDefenderDefenseBase, getPublicDefenseLabel } from '../../utils/combatViewSelectors';
import type { CombatState, RevealState } from '../../types/combatTracker';
import { ViewMode } from '../../utils/combatViewFilter';

interface Modifier {
  label: string;
  value: number;
}

interface DefenseValue {
  mode?: string;
  value?: number;
}

interface Defender {
  instanceId?: string;
  defenses?: {
    dodge?: number | DefenseValue;
    parry?: number | DefenseValue;
    block?: number | DefenseValue;
  };
  dodge?: number | DefenseValue;
  parry?: number | DefenseValue;
  block?: number | DefenseValue;
}

interface RollResult {
  total: number;
  target: number;
  margin: number;
  success: boolean;
}

interface DefenseData {
  type: string;
  baseDefense: number;
  modifiers: Modifier[];
  injectedModifiers: Modifier[];
  effectiveDefense: number;
  rollTotal: number | null;
  margin: number | null;
  success: boolean | null;
}

interface DefenseAssistProps {
  defender: Defender | null;
  defenderId?: string | null;
  combatState?: CombatState | null;
  revealState?: RevealState | null;
  viewMode?: string;
  injectedModifiers?: Modifier[];
  onComplete: (data: { defense: DefenseData }) => void;
  onCancel: () => void;
}

type DefenseType = 'dodge' | 'parry' | 'block' | 'custom';

/**
 * DefenseAssist Component
 * Handles defense selection, modifier calculation, and optional roll
 * Returns defense data for logging
 */
export default function DefenseAssist({
  defender,
  defenderId,
  combatState,
  revealState,
  viewMode = ViewMode.GM,
  injectedModifiers = [],
  onComplete,
  onCancel
}: DefenseAssistProps) {
  const [defenseType, setDefenseType] = useState<DefenseType>('dodge');
  const [customBaseDefense, setCustomBaseDefense] = useState('');
  const [modifiers, setModifiers] = useState<Modifier[]>([]);
  const [rollResult, setRollResult] = useState<RollResult | null>(null);

  const resolvedDefenderId = defenderId || defender?.instanceId || null;

  const coerceDefenseValue = (defenseField: number | DefenseValue | undefined | null): number | null => {
    if (!defenseField) return null;
    if (typeof defenseField === 'object' && defenseField.mode) {
      if (defenseField.mode === 'exact' || defenseField.mode === 'approx') {
        return defenseField.value ?? null;
      }
      return null;
    }
    return defenseField as number;
  };

  const baseDefenses = useMemo(() => {
    if (!combatState || !resolvedDefenderId) {
      return {
        dodge: coerceDefenseValue(defender?.defenses?.dodge ?? defender?.dodge ?? null),
        parry: coerceDefenseValue(defender?.defenses?.parry ?? defender?.parry ?? null),
        block: coerceDefenseValue(defender?.defenses?.block ?? defender?.block ?? null)
      };
    }

    return {
      dodge: getDefenderDefenseBase(combatState, resolvedDefenderId, 'dodge'),
      parry: getDefenderDefenseBase(combatState, resolvedDefenderId, 'parry'),
      block: getDefenderDefenseBase(combatState, resolvedDefenderId, 'block')
    };
  }, [combatState, defender, resolvedDefenderId]);

  // Get base defense value
  const getBaseDefense = (): number => {
    if (defenseType === 'custom') {
      return parseInt(customBaseDefense) || 0;
    }

    return baseDefenses[defenseType] ?? 0;
  };

  const baseDefense = getBaseDefense();
  const effectiveDefense = calculateEffective(baseDefense, [...injectedModifiers, ...modifiers]);

  const handleRoll = () => {
    const result = rollVsTarget('3d6', effectiveDefense) as RollResult;
    setRollResult(result);
  };

  const handleComplete = () => {
    const defenseData: DefenseData = {
      type: defenseType === 'custom' ? customBaseDefense : defenseType,
      baseDefense,
      modifiers: [...modifiers],
      injectedModifiers: [...injectedModifiers],
      effectiveDefense,
      rollTotal: rollResult ? rollResult.total : null,
      margin: rollResult ? rollResult.margin : null,
      success: rollResult ? rollResult.success : null
    };

    onComplete({
      defense: defenseData
    });
  };

  const isValid = (): boolean => {
    if (defenseType === 'custom') {
      return !!customBaseDefense && !isNaN(parseInt(customBaseDefense));
    }
    return baseDefense !== null && baseDefense !== undefined;
  };

  // Phase 5: Get display values for defense buttons
  const dodgeLabel = useMemo(() => {
    if (!resolvedDefenderId || !combatState) {
      return baseDefenses.dodge !== null && baseDefenses.dodge !== undefined
        ? `Base: ${baseDefenses.dodge}`
        : 'Not set';
    }
    if (viewMode === ViewMode.GM) {
      return baseDefenses.dodge !== null && baseDefenses.dodge !== undefined
        ? `Base: ${baseDefenses.dodge}`
        : 'Not set';
    }
    return getPublicDefenseLabel(combatState, revealState, resolvedDefenderId, 'dodge');
  }, [baseDefenses.dodge, combatState, revealState, resolvedDefenderId, viewMode]);

  const parryLabel = useMemo(() => {
    if (!resolvedDefenderId || !combatState) {
      return baseDefenses.parry !== null && baseDefenses.parry !== undefined
        ? `Base: ${baseDefenses.parry}`
        : 'Not set';
    }
    if (viewMode === ViewMode.GM) {
      return baseDefenses.parry !== null && baseDefenses.parry !== undefined
        ? `Base: ${baseDefenses.parry}`
        : 'Not set';
    }
    return getPublicDefenseLabel(combatState, revealState, resolvedDefenderId, 'parry');
  }, [baseDefenses.parry, combatState, revealState, resolvedDefenderId, viewMode]);

  const blockLabel = useMemo(() => {
    if (!resolvedDefenderId || !combatState) {
      return baseDefenses.block !== null && baseDefenses.block !== undefined
        ? `Base: ${baseDefenses.block}`
        : 'Not set';
    }
    if (viewMode === ViewMode.GM) {
      return baseDefenses.block !== null && baseDefenses.block !== undefined
        ? `Base: ${baseDefenses.block}`
        : 'Not set';
    }
    return getPublicDefenseLabel(combatState, revealState, resolvedDefenderId, 'block');
  }, [baseDefenses.block, combatState, revealState, resolvedDefenderId, viewMode]);

  return (
    <div className="space-y-4">
      {/* Defense Type Selection */}
      <div>
        <h4 className="font-semibold mb-2">Defense Type</h4>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setDefenseType('dodge')}
            className={`p-3 rounded border-2 ${
              defenseType === 'dodge'
                ? 'border-accent-500 bg-accent-900/30'
                : 'border-edge-strong bg-surface-1 hover:bg-surface-2'
            }`}
          >
            <div className="font-semibold">Dodge</div>
            <div className="text-sm text-fg-muted">
              {dodgeLabel}
            </div>
          </button>

          <button
            onClick={() => setDefenseType('parry')}
            className={`p-3 rounded border-2 ${
              defenseType === 'parry'
                ? 'border-accent-500 bg-accent-900/30'
                : 'border-edge-strong bg-surface-1 hover:bg-surface-2'
            }`}
          >
            <div className="font-semibold">Parry</div>
            <div className="text-sm text-fg-muted">
              {parryLabel}
            </div>
          </button>

          <button
            onClick={() => setDefenseType('block')}
            className={`p-3 rounded border-2 ${
              defenseType === 'block'
                ? 'border-accent-500 bg-accent-900/30'
                : 'border-edge-strong bg-surface-1 hover:bg-surface-2'
            }`}
          >
            <div className="font-semibold">Block</div>
            <div className="text-sm text-fg-muted">
              {blockLabel}
            </div>
          </button>

          <button
            onClick={() => setDefenseType('custom')}
            className={`p-3 rounded border-2 ${
              defenseType === 'custom'
                ? 'border-accent-500 bg-accent-900/30'
                : 'border-edge-strong bg-surface-1 hover:bg-surface-2'
            }`}
          >
            <div className="font-semibold">Custom</div>
            <div className="text-sm text-fg-muted">Enter value</div>
          </button>
        </div>

        {/* Custom Defense Input */}
        {defenseType === 'custom' && (
          <div className="mt-2">
            <input
              type="number"
              value={customBaseDefense}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setCustomBaseDefense(e.target.value)}
              placeholder="Enter base defense value"
              className="w-full px-3 py-2 bg-surface-2 rounded"
            />
          </div>
        )}
      </div>

      {/* Modifier Stack */}
      {isValid() && (
        <div>
          <h4 className="font-semibold mb-2">Defense Modifiers</h4>
          <ModifierStack
            baseValue={baseDefense}
            baseLabel={`Base ${defenseType === 'custom' ? 'Defense' : defenseType.charAt(0).toUpperCase() + defenseType.slice(1)}`}
            modifiers={modifiers}
            lockedModifiers={injectedModifiers}
            onModifiersChange={setModifiers}
            presets={DEFENSE_MODIFIERS}
          />
        </div>
      )}

      {/* Roll Button */}
      {isValid() && (
        <button
          onClick={handleRoll}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 rounded"
        >
          <Dices size={20} />
          Roll Defense
        </button>
      )}

      {/* Roll Result */}
      {rollResult && (
        <div className={`p-4 rounded ${rollResult.success ? 'bg-success-900/30 border border-success-600' : 'bg-danger-900/30 border border-danger-600'}`}>
          <div className="text-center">
            <div className="text-2xl font-bold">
              {rollResult.total} vs {rollResult.target}
            </div>
            <div className="text-lg mt-1">
              Margin: <span className={rollResult.margin >= 0 ? 'text-success-400' : 'text-danger-400'}>
                {rollResult.margin >= 0 ? '+' : ''}{rollResult.margin}
              </span>
            </div>
            <div className="text-xl font-bold mt-2">
              {rollResult.success ? '✓ SUCCESS' : '✗ FAILURE'}
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 pt-2">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-2 bg-surface-3 hover:bg-surface-4 rounded"
        >
          Cancel
        </button>
        <button
          onClick={handleComplete}
          disabled={!isValid()}
          className="flex-1 px-4 py-2 bg-success-600 hover:bg-success-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {rollResult ? 'Confirm & Log' : 'Log (No Roll)'}
        </button>
      </div>
    </div>
  );
}
