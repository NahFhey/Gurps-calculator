import { useState, useEffect, ChangeEvent } from 'react';
import { Dices, Zap } from 'lucide-react';
import HitLocationPicker from './HitLocationPicker';
import EffectsPanel from './EffectsPanel';
import ModifierStack from './ModifierStack';
import { DAMAGE_MODIFIERS, sumModifiers } from '../../utils/modifiers';
import { rollDamage, resolveDamageExpression } from '../../utils/damage';
import { resolveInjury, createInjuryBreakdown, createHitLocationLog, applyInjuryToHP } from '../../utils/injuryEngine';
import { generateEffectsPrompts } from '../../utils/effectsEngine';
import { getDamageTypeOptions, DAMAGE_TYPES } from '../../utils/wounding';

interface Modifier {
  label: string;
  value: number;
}

interface HitLocation {
  key: string;
  label: string;
  drKey?: string;
  toHitPenalty: number;
}

interface LocationRoll {
  dice: number[];
  total: number;
}

interface Target {
  instanceId: string;
  name: string;
  hp: number;
  currentHP: number;
  hitLocationProfileId?: string;
  st?: number;
  drByLocation?: Record<string, number>;
  dr?: number;
}

interface Attacker {
  st: number;
  name?: string;
}

interface RollResult {
  valid: boolean;
  total: number;
  dice: number[];
  modifier: number;
  error?: string;
}

interface InjuryResult {
  rawDamage: number;
  locationDR: number;
  penetrating: number;
  woundingMultiplier: number;
  injury: number;
}

interface ResolvedEffect {
  type: string;
  autoApplied?: boolean;
  value?: number;
  success?: boolean;
  outcome?: string;
  locationKey?: string;
  locationLabel?: string;
}


interface HitLocationLog {
  profileId: string;
  locationKey: string;
  locationLabel: string;
  roll?: LocationRoll;
  rolled?: { dice: number[]; total: number } | null;
}

interface DamageBreakdown {
  rawDamage: number;
  locationDR: number;
  penetrating: number;
  woundingMultiplier: number;
  injury: number;
}

interface InjuryData {
  hitLocation: HitLocationLog;
  damageBreakdown: DamageBreakdown;
  effects: ResolvedEffect[];
  newHP: number;
  targetInstanceId: string;
  damageType: string;
  expression: string;
  modifiers: Modifier[];
  injectedModifiers: Modifier[];
}

type StepValue = 'location' | 'damage' | 'effects';

interface InjuryResolutionPanelProps {
  attacker?: Attacker | null;
  target: Target;
  damageExpression?: string;
  injectedDamageModifiers?: Modifier[];
  initialLocation?: HitLocation | null;
  initialLocationRoll?: LocationRoll | null;
  combatRulesPreset?: string;
  onComplete: (data: InjuryData) => void;
  onCancel: () => void;
}

/**
 * InjuryResolutionPanel Component (Phase 4)
 * Complete injury pipeline: hit location → DR → wounding → injury → effects
 */
export default function InjuryResolutionPanel({
  attacker = null,
  target,
  damageExpression = '',
  injectedDamageModifiers = [],
  initialLocation = null,
  initialLocationRoll = null,
  combatRulesPreset = 'standard',
  onComplete,
  onCancel
}: InjuryResolutionPanelProps) {
  const [step, setStep] = useState<StepValue>(initialLocation ? 'damage' : 'location');

  // Hit location state
  const [selectedLocation, setSelectedLocation] = useState<HitLocation | null>(initialLocation);
  const [locationRoll, setLocationRoll] = useState<LocationRoll | null>(initialLocationRoll);

  // Damage state
  const [expression, setExpression] = useState(damageExpression || '');
  const [manualDamage, setManualDamage] = useState('');
  const [useManual, setUseManual] = useState(false);
  const [damageType, setDamageType] = useState(DAMAGE_TYPES.CR);
  const [modifiers, setModifiers] = useState<Modifier[]>([]);
  const [rollResult, setRollResult] = useState<RollResult | null>(null);

  // Injury state
  const [injuryResult, setInjuryResult] = useState<InjuryResult | null>(null);

  // Effects state
  const [effectsPrompts, setEffectsPrompts] = useState<any[]>([]);
  const [resolvedEffects, setResolvedEffects] = useState<ResolvedEffect[]>([]);

  const profileId = target.hitLocationProfileId || 'humanoid';

  useEffect(() => {
    if (initialLocation) {
      setSelectedLocation(initialLocation);
      setLocationRoll(initialLocationRoll);
      setStep('damage');
    }
  }, [initialLocation, initialLocationRoll]);

  useEffect(() => {
    if (damageExpression) {
      setExpression(damageExpression);
      setUseManual(false);
      setRollResult(null);
    }
  }, [damageExpression]);

  // Step 1: Hit Location Selection
  const handleLocationSelected = (location: HitLocation, roll: LocationRoll | null) => {
    setSelectedLocation(location);
    setLocationRoll(roll);
  };

  const handleLocationConfirm = () => {
    if (!selectedLocation) {
      alert('Please select a hit location');
      return;
    }
    // Ensure HitLocation has required fields
    if (!selectedLocation.key || !selectedLocation.label) {
      alert('Invalid hit location');
      return;
    }
    setStep('damage');
  };

  // Step 2: Damage Rolling and Injury Calculation
  const handleRollDamage = () => {
    let finalExpression = expression;

    // Resolve sw/thr if needed
    if (attacker && (expression.includes('sw') || expression.includes('thr'))) {
      const resolved = resolveDamageExpression(expression, attacker.st) as { valid: boolean; resolved: string };
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

  const handleCalculateInjury = () => {
    let rawDamage: number;

    if (useManual) {
      rawDamage = parseInt(manualDamage) || 0;
    } else if (rollResult) {
      // Apply damage modifiers to roll result
      const modifierTotal = sumModifiers([...injectedDamageModifiers, ...modifiers]);
      rawDamage = rollResult.total + modifierTotal;
    } else {
      alert('Please roll damage or enter manual damage first');
      return;
    }

    if (useManual && injectedDamageModifiers.length > 0) {
      rawDamage += sumModifiers(injectedDamageModifiers);
    }

    // Resolve injury through the pipeline
    const injury = resolveInjury({
      rawDamage,
      damageType,
      location: selectedLocation,
      target,
      combatRulesPreset
    }) as InjuryResult;

    setInjuryResult(injury);

    // Generate effects prompts
    const newHP = applyInjuryToHP(target.currentHP, injury.injury);
    const prompts = generateEffectsPrompts({
      injury: injury.injury,
      injuryResult: injury,
      currentHP: target.currentHP,
      newHP,
      maxHP: target.hp,
      combatRulesPreset,
      target
    }) as any[];

    setEffectsPrompts(prompts);

    // If no effects, skip to completion
    if (prompts.length === 0) {
      handleComplete();
    } else {
      setStep('effects');
    }
  };

  // Step 3: Effects Resolution
  const handleEffectResolved = (effect: ResolvedEffect) => {
    setResolvedEffects(prev => [...prev, effect]);
  };

  const handleComplete = () => {
    if (!injuryResult || !selectedLocation) {
      alert('Please calculate injury first');
      return;
    }

    const newHP = applyInjuryToHP(target.currentHP, injuryResult.injury);

    // Build complete injury data
    const injuryData: InjuryData = {
      hitLocation: createHitLocationLog(profileId, selectedLocation, locationRoll || undefined) as HitLocationLog,
      damageBreakdown: createInjuryBreakdown(injuryResult as unknown as ReturnType<typeof resolveInjury>) as unknown as DamageBreakdown,
      effects: resolvedEffects,
      newHP,
      targetInstanceId: target.instanceId,
      damageType,
      expression: useManual ? 'manual' : expression,
      modifiers: useManual ? [] : [...modifiers],
      injectedModifiers: [...injectedDamageModifiers]
    };

    onComplete(injuryData);
  };

  return (
    <div className="space-y-4">
      {/* Step Indicator */}
      <div className="flex items-center gap-2 text-sm">
        <div className={`px-3 py-1 rounded ${step === 'location' ? 'bg-accent-600' : 'bg-surface-2'}`}>
          1. Location
        </div>
        <div className={`px-3 py-1 rounded ${step === 'damage' ? 'bg-accent-600' : 'bg-surface-2'}`}>
          2. Damage
        </div>
        <div className={`px-3 py-1 rounded ${step === 'effects' ? 'bg-accent-600' : 'bg-surface-2'}`}>
          3. Effects
        </div>
      </div>

      {/* Step 1: Hit Location */}
      {step === 'location' && (
        <>
          <HitLocationPicker
            profileId={profileId}
            selectedLocation={selectedLocation}
            onLocationSelected={handleLocationSelected}
          />
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2 bg-surface-3 hover:bg-surface-4 rounded"
            >
              Cancel
            </button>
            <button
              onClick={handleLocationConfirm}
              disabled={!selectedLocation}
              className="flex-1 px-4 py-2 bg-accent-600 hover:bg-accent-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next: Damage
            </button>
          </div>
        </>
      )}

      {/* Step 2: Damage & Injury */}
      {step === 'damage' && selectedLocation && (
        <>
          {/* Show selected location */}
          <div className="bg-surface-1 rounded p-3">
            <div className="text-sm text-fg-muted">Hit Location:</div>
            <div className="text-lg font-semibold text-yellow-400">
              {selectedLocation.label}
            </div>
            <button
              onClick={() => setStep('location')}
              className="mt-2 text-xs text-accent-300 hover:text-accent-200"
              type="button"
            >
              Change Hit Location
            </button>
          </div>

          {/* Damage Type */}
          <div>
            <label className="block text-sm text-fg-muted mb-1">Damage Type</label>
            <select
              value={damageType}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setDamageType(e.target.value as any)}
              className="w-full px-3 py-2 bg-surface-2 rounded"
            >
              {getDamageTypeOptions().map((option: { value: string; label: string }) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Damage Input */}
          <div>
            <h4 className="font-semibold mb-2">Damage</h4>

            <div className="space-y-2">
              {/* Expression Input */}
              <div>
                <label className="block text-sm text-fg-muted mb-1">Damage Expression</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={expression}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      setExpression(e.target.value);
                      setUseManual(false);
                    }}
                    placeholder="e.g., 2d+1, sw+2, 1d6-1"
                    className="flex-1 px-3 py-2 bg-surface-2 rounded"
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
                  <div className="text-xs text-fg-muted mt-1">
                    Will resolve based on attacker ST {attacker.st}
                  </div>
                )}
              </div>

              {/* OR Manual Input */}
              <div className="text-center text-fg-faint text-sm">OR</div>

              <div>
                <label className="block text-sm text-fg-muted mb-1">Manual Damage</label>
                <input
                  type="number"
                  value={manualDamage}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    setManualDamage(e.target.value);
                    setUseManual(true);
                    setRollResult(null);
                  }}
                  placeholder="Enter damage number"
                  className="w-full px-3 py-2 bg-surface-2 rounded"
                />
              </div>
            </div>
          </div>

          {/* Roll Result */}
          {rollResult && !useManual && (
            <div className="bg-surface-1 rounded p-3">
              <div className="text-sm text-fg-muted mb-1">Rolled</div>
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
                lockedModifiers={injectedDamageModifiers}
                onModifiersChange={setModifiers}
                presets={DAMAGE_MODIFIERS}
              />
            </div>
          )}

          {/* Calculate Button */}
          {(rollResult || useManual) && (
            <button
              onClick={handleCalculateInjury}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-orange-600 hover:bg-orange-700 rounded"
            >
              <Zap size={20} />
              Calculate Injury
            </button>
          )}

          {/* Injury Result */}
          {injuryResult && (
            <div className="bg-danger-900/30 border border-danger-600 rounded p-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-fg-muted">Raw Damage:</span>
                  <span className="font-semibold">{injuryResult.rawDamage}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-fg-muted">Location DR:</span>
                  <span className="font-semibold">-{injuryResult.locationDR}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-fg-muted">Penetrating:</span>
                  <span className="font-semibold">{injuryResult.penetrating}</span>
                </div>
                {injuryResult.woundingMultiplier !== 1 && (
                  <div className="flex justify-between">
                    <span className="text-fg-muted">Wounding Multiplier:</span>
                    <span className="font-semibold">×{injuryResult.woundingMultiplier}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-danger-700">
                  <span className="font-bold">Injury:</span>
                  <span className="font-bold text-xl text-danger-400">{injuryResult.injury} HP</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-fg-muted">Target HP after:</span>
                  <span className="font-semibold">
                    {target.currentHP} → {target.currentHP - injuryResult.injury}
                  </span>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Step 3: Effects */}
      {step === 'effects' && (
        <>
          <EffectsPanel
            prompts={effectsPrompts}
            target={{ ...target, id: target.instanceId }}
            onEffectResolved={handleEffectResolved}
            onComplete={handleComplete}
          />

          <div className="flex gap-2">
            <button
              onClick={() => setStep('damage')}
              className="px-4 py-2 bg-surface-3 hover:bg-surface-4 rounded"
            >
              Back
            </button>
          </div>
        </>
      )}
    </div>
  );
}
