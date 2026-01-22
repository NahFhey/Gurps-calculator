import React, { useState } from 'react';
import { Dices, Zap } from 'lucide-react';
import HitLocationPicker from './HitLocationPicker';
import EffectsPanel from './EffectsPanel';
import ModifierStack from './ModifierStack';
import { DAMAGE_MODIFIERS } from '../../utils/modifiers';
import { rollDamage, resolveDamageExpression } from '../../utils/damage';
import { resolveInjury, createInjuryBreakdown, createHitLocationLog, applyInjuryToHP } from '../../utils/injuryEngine';
import { generateEffectsPrompts } from '../../utils/effectsEngine';
import { getDamageTypeOptions, DAMAGE_TYPES } from '../../utils/wounding';

/**
 * InjuryResolutionPanel Component (Phase 4)
 * Complete injury pipeline: hit location → DR → wounding → injury → effects
 */
export default function InjuryResolutionPanel({
  attacker = null,
  target,
  damageExpression = '',
  combatRulesPreset = 'standard',
  onComplete,
  onCancel
}) {
  const [step, setStep] = useState('location'); // 'location', 'damage', 'effects'

  // Hit location state
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [locationRoll, setLocationRoll] = useState(null);

  // Damage state
  const [expression, setExpression] = useState(damageExpression || '');
  const [manualDamage, setManualDamage] = useState('');
  const [useManual, setUseManual] = useState(false);
  const [damageType, setDamageType] = useState(DAMAGE_TYPES.CR);
  const [modifiers, setModifiers] = useState([]);
  const [rollResult, setRollResult] = useState(null);

  // Injury state
  const [injuryResult, setInjuryResult] = useState(null);

  // Effects state
  const [effectsPrompts, setEffectsPrompts] = useState([]);
  const [resolvedEffects, setResolvedEffects] = useState([]);

  const profileId = target.hitLocationProfileId || 'humanoid';

  // Step 1: Hit Location Selection
  const handleLocationSelected = (location, roll) => {
    setSelectedLocation(location);
    setLocationRoll(roll);
  };

  const handleLocationConfirm = () => {
    if (!selectedLocation) {
      alert('Please select a hit location');
      return;
    }
    setStep('damage');
  };

  // Step 2: Damage Rolling and Injury Calculation
  const handleRollDamage = () => {
    let finalExpression = expression;

    // Resolve sw/thr if needed
    if (attacker && (expression.includes('sw') || expression.includes('thr'))) {
      const resolved = resolveDamageExpression(expression, attacker.st);
      if (resolved.valid) {
        finalExpression = resolved.resolved;
      }
    }

    const result = rollDamage(finalExpression);

    if (!result.valid) {
      alert(`Invalid damage expression: ${result.error}`);
      return;
    }

    setRollResult(result);
    setUseManual(false);
  };

  const handleCalculateInjury = () => {
    let rawDamage;

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

    // Resolve injury through the pipeline
    const injury = resolveInjury({
      rawDamage,
      damageType,
      location: selectedLocation,
      target,
      combatRulesPreset
    });

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
    });

    setEffectsPrompts(prompts);

    // If no effects, skip to completion
    if (prompts.length === 0) {
      handleComplete();
    } else {
      setStep('effects');
    }
  };

  // Step 3: Effects Resolution
  const handleEffectResolved = (effect) => {
    setResolvedEffects(prev => [...prev, effect]);
  };

  const handleComplete = () => {
    if (!injuryResult) {
      alert('Please calculate injury first');
      return;
    }

    const newHP = applyInjuryToHP(target.currentHP, injuryResult.injury);

    // Build complete injury data
    const injuryData = {
      hitLocation: createHitLocationLog(profileId, selectedLocation, locationRoll),
      damageBreakdown: createInjuryBreakdown(injuryResult),
      effects: resolvedEffects,
      newHP,
      damageType,
      expression: useManual ? 'manual' : expression,
      modifiers: useManual ? [] : [...modifiers]
    };

    onComplete(injuryData);
  };

  return (
    <div className="space-y-4">
      {/* Step Indicator */}
      <div className="flex items-center gap-2 text-sm">
        <div className={`px-3 py-1 rounded ${step === 'location' ? 'bg-blue-600' : 'bg-gray-700'}`}>
          1. Location
        </div>
        <div className={`px-3 py-1 rounded ${step === 'damage' ? 'bg-blue-600' : 'bg-gray-700'}`}>
          2. Damage
        </div>
        <div className={`px-3 py-1 rounded ${step === 'effects' ? 'bg-blue-600' : 'bg-gray-700'}`}>
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
              className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded"
            >
              Cancel
            </button>
            <button
              onClick={handleLocationConfirm}
              disabled={!selectedLocation}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next: Damage
            </button>
          </div>
        </>
      )}

      {/* Step 2: Damage & Injury */}
      {step === 'damage' && (
        <>
          {/* Show selected location */}
          <div className="bg-gray-800 rounded p-3">
            <div className="text-sm text-gray-400">Hit Location:</div>
            <div className="text-lg font-semibold text-yellow-400">
              {selectedLocation.label}
            </div>
          </div>

          {/* Damage Type */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Damage Type</label>
            <select
              value={damageType}
              onChange={(e) => setDamageType(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 rounded"
            >
              {getDamageTypeOptions().map(option => (
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
                <label className="block text-sm text-gray-400 mb-1">Damage Expression</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={expression}
                    onChange={(e) => {
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
                  onChange={(e) => {
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
            <div className="bg-red-900/30 border border-red-600 rounded p-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">Raw Damage:</span>
                  <span className="font-semibold">{injuryResult.rawDamage}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Location DR:</span>
                  <span className="font-semibold">-{injuryResult.locationDR}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Penetrating:</span>
                  <span className="font-semibold">{injuryResult.penetrating}</span>
                </div>
                {injuryResult.woundingMultiplier !== 1 && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Wounding Multiplier:</span>
                    <span className="font-semibold">×{injuryResult.woundingMultiplier}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-red-700">
                  <span className="font-bold">Injury:</span>
                  <span className="font-bold text-xl text-red-400">{injuryResult.injury} HP</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Target HP after:</span>
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
            target={target}
            onEffectResolved={handleEffectResolved}
            onComplete={handleComplete}
          />

          <div className="flex gap-2">
            <button
              onClick={() => setStep('damage')}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded"
            >
              Back
            </button>
          </div>
        </>
      )}
    </div>
  );
}
