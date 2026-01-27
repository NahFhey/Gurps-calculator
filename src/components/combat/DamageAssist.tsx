import { useState, ChangeEvent } from 'react';
import { Zap, Dices } from 'lucide-react';
import ModifierStack from './ModifierStack';
import { DAMAGE_MODIFIERS } from '../../utils/modifiers';
import { rollDamage, applyDR, resolveDamageExpression } from '../../utils/damage';

interface Modifier {
  label: string;
  value: number;
}

interface DRGeneral {
  mode: string;
  value?: number;
  min?: number;
}

interface TargetDR {
  general?: DRGeneral;
}

interface Target {
  instanceId: string;
  name?: string;
  currentHP: number;
  dr?: number | TargetDR;
}

interface Attacker {
  id?: string;
  name?: string;
  st: number;
}

interface RollResult {
  valid: boolean;
  error?: string;
  dice: number[];
  modifier: number;
  total: number;
}

interface DamageResult {
  raw: number;
  dr: number;
  penetrating: number;
}

interface DamageData {
  expression: string;
  rolledDamage: number;
  generalDRUsed: number;
  penetrating: number;
  hpDelta: number;
  modifiers: Modifier[];
}

interface DamageAssistProps {
  attacker?: Attacker | null;
  target: Target;
  damageExpression?: string;
  onComplete: (data: { damage: DamageData; targetInstanceId: string; newHP: number }) => void;
  onCancel: () => void;
}

/**
 * DamageAssist Component
 * Handles damage rolling, DR application, and HP change calculation
 * Returns damage data for logging and state update
 */
export default function DamageAssist({
  attacker = null,
  target,
  damageExpression = '',
  onComplete,
  onCancel
}: DamageAssistProps) {
  // Phase 5: Extract DR value from filtered structure
  const getInitialDR = (): string => {
    if (!target.dr) return '0';

    // Phase 5 filtered structure
    if (typeof target.dr === 'object' && target.dr.general) {
      if (target.dr.general.mode === 'exact' && target.dr.general.value !== undefined) {
        return target.dr.general.value.toString();
      }
      if (target.dr.general.mode === 'minKnown' && target.dr.general.min !== undefined) {
        return target.dr.general.min.toString(); // Use minimum known value
      }
      return '0'; // Unknown
    }

    // Legacy: simple number
    return target.dr.toString();
  };

  const [expression, setExpression] = useState(damageExpression || '');
  const [manualDamage, setManualDamage] = useState('');
  const [useManual, setUseManual] = useState(false);
  const [modifiers, setModifiers] = useState<Modifier[]>([]);
  const [rollResult, setRollResult] = useState<RollResult | null>(null);
  const [drValue, setDrValue] = useState(getInitialDR());
  const [damageResult, setDamageResult] = useState<DamageResult | null>(null);

  const handleRollDamage = () => {
    let finalExpression = expression;

    // Resolve sw/thr if needed
    if (attacker && (expression.includes('sw') || expression.includes('thr'))) {
      const resolved = resolveDamageExpression(expression, attacker.st);
      if (resolved.valid) {
        finalExpression = resolved.resolved;
      }
    }

    const result = rollDamage(finalExpression) as RollResult;

    if (!result.valid) {
      alert(`Invalid damage expression: ${result.error}`);
      return;
    }

    setRollResult(result);
    setUseManual(false);
  };

  const handleApplyDamage = () => {
    let rawDamage: number;

    if (useManual) {
      rawDamage = parseInt(manualDamage) || 0;
    } else if (rollResult) {
      // Apply damage modifiers to roll result
      const modifierTotal = modifiers.reduce((sum, mod) => sum + mod.value, 0);
      rawDamage = rollResult.total + modifierTotal;
    } else {
      alert('Please roll damage or enter manual damage first');
      return;
    }

    const dr = parseInt(drValue) || 0;
    const result = applyDR(rawDamage, dr) as DamageResult;

    setDamageResult(result);
  };

  const handleComplete = () => {
    if (!damageResult) {
      alert('Please calculate damage first');
      return;
    }

    const damageData: DamageData = {
      expression: useManual ? 'manual' : expression,
      rolledDamage: damageResult.raw,
      generalDRUsed: damageResult.dr,
      penetrating: damageResult.penetrating,
      hpDelta: -damageResult.penetrating, // Negative for damage
      modifiers: useManual ? [] : [...modifiers]
    };

    onComplete({
      damage: damageData,
      targetInstanceId: target.instanceId,
      newHP: target.currentHP - damageResult.penetrating
    });
  };

  return (
    <div className="space-y-4">
      {/* Damage Input */}
      <div>
        <h4 className="font-semibold mb-2">Damage</h4>

        <div className="space-y-2">
          {/* Expression Input */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Damage Expression</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={expression}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  setExpression(e.target.value);
                  setUseManual(false);
                }}
                placeholder="e.g., 2d+1, sw+2, 1d6-1"
                className="flex-1 px-3 py-2 bg-gray-700 rounded"
              />
              <button
                onClick={handleRollDamage}
                disabled={!expression.trim()}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Dices size={16} />
              </button>
            </div>
            {attacker && (expression.includes('sw') || expression.includes('thr')) && (
              <div className="text-xs text-gray-400 mt-1">
                Will resolve based on attacker ST {attacker.st}
              </div>
            )}
          </div>

          {/* OR Manual Input */}
          <div className="text-center text-gray-500 text-sm">OR</div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Manual Damage</label>
            <input
              type="number"
              value={manualDamage}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                setManualDamage(e.target.value);
                setUseManual(true);
                setRollResult(null);
              }}
              placeholder="Enter damage number"
              className="w-full px-3 py-2 bg-gray-700 rounded"
            />
          </div>
        </div>
      </div>

      {/* Roll Result */}
      {rollResult && !useManual && (
        <div className="bg-gray-800 rounded p-3">
          <div className="text-sm text-gray-400 mb-1">Rolled</div>
          <div className="text-xl font-bold">
            {rollResult.dice.join(' + ')}
            {rollResult.modifier !== 0 && ` ${rollResult.modifier > 0 ? '+' : ''}${rollResult.modifier}`}
            {' = '}
            {rollResult.total}
          </div>
        </div>
      )}

      {/* Damage Modifiers */}
      {rollResult && !useManual && (
        <div>
          <h4 className="font-semibold mb-2">Damage Modifiers (optional)</h4>
          <ModifierStack
            baseValue={rollResult.total}
            baseLabel="Base Damage"
            modifiers={modifiers}
            onModifiersChange={setModifiers}
            presets={DAMAGE_MODIFIERS}
          />
        </div>
      )}

      {/* DR Input */}
      <div>
        <h4 className="font-semibold mb-2">Target DR</h4>
        <input
          type="number"
          value={drValue}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setDrValue(e.target.value)}
          placeholder="Damage Resistance"
          className="w-full px-3 py-2 bg-gray-700 rounded"
        />
        <div className="text-xs text-gray-400 mt-1">
          General DR only (no hit location or damage type effects in Phase 3)
        </div>
      </div>

      {/* Calculate Button */}
      {(rollResult || useManual) && (
        <button
          onClick={handleApplyDamage}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-orange-600 hover:bg-orange-700 rounded"
        >
          <Zap size={20} />
          Calculate Damage
        </button>
      )}

      {/* Damage Result */}
      {damageResult && (
        <div className="bg-red-900/30 border border-red-600 rounded p-4">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">Raw Damage:</span>
              <span className="font-semibold">{damageResult.raw}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">DR:</span>
              <span className="font-semibold">-{damageResult.dr}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-red-700">
              <span className="font-bold">Penetrating:</span>
              <span className="font-bold text-xl text-red-400">{damageResult.penetrating} HP</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Target HP after:</span>
              <span className="font-semibold">
                {target.currentHP} → {target.currentHP - damageResult.penetrating}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 pt-2">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded"
        >
          Cancel
        </button>
        <button
          onClick={handleComplete}
          disabled={!damageResult}
          className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Apply Damage
        </button>
      </div>
    </div>
  );
}
