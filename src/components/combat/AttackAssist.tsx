import { useState, useEffect, ChangeEvent } from 'react';
import { Swords, Dices } from 'lucide-react';
import ModifierStack from './ModifierStack';
import HitLocationPicker from './HitLocationPicker';
import { ATTACK_MODIFIERS, calculateEffective, sumModifiers } from '../../utils/modifiers';
import { rollVsTarget } from '../../utils/dice';
import { getProfileLocations } from '../../utils/hitLocations';

interface Modifier {
  label: string;
  value: number;
}

interface Attack {
  name: string;
  skill: number;
  damage?: string;
  notes?: string;
  _hidden?: boolean;
}

interface HitLocation {
  key: string;
  label: string;
  toHitPenalty: number;
}

interface LocationRoll {
  dice: number[];
  total: number;
}

interface RollResult {
  total: number;
  target: number;
  margin: number;
  success: boolean;
}

interface Target {
  instanceId: string;
  name: string;
  hitLocationProfileId?: string;
}

interface Actor {
  id?: string;
  name?: string;
  attacks?: Attack[];
}

interface AttackData {
  name: string;
  baseSkill: number;
  modifiers: Modifier[];
  injectedModifiers: Modifier[];
  effectiveSkill: number;
  rollTotal: number | null;
  margin: number | null;
  success: boolean | null;
  damage?: string;
  notes?: string;
  hitLocation: HitLocation | null;
  hitLocationRoll: LocationRoll | null;
}

interface AttackAssistProps {
  actor: Actor;
  targets?: Target[];
  injectedModifiers?: Modifier[];
  onComplete: (data: { targetInstanceId: string | null; attack: AttackData }) => void;
  onCancel: () => void;
}

interface CustomAttack {
  name: string;
  skill: string;
  damage: string;
  notes: string;
}

/**
 * AttackAssist Component
 * Handles attack selection, modifier calculation, and optional roll
 * Returns attack data for logging
 */
export default function AttackAssist({
  actor,
  targets = [],
  injectedModifiers = [],
  onComplete,
  onCancel
}: AttackAssistProps) {
  const [selectedAttack, setSelectedAttack] = useState<Attack | null>(null);
  const [customAttack, setCustomAttack] = useState<CustomAttack>({ name: '', skill: '', damage: '', notes: '' });
  const [showCustomAttack, setShowCustomAttack] = useState(false);
  const [modifiers, setModifiers] = useState<Modifier[]>([]);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(targets.length === 1 ? targets[0].instanceId : null);
  const [rollResult, setRollResult] = useState<RollResult | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<HitLocation | null>(null);
  const [locationRoll, setLocationRoll] = useState<LocationRoll | null>(null);

  // Get attacks from actor (if they have any)
  const attacks = actor.attacks || [];
  const selectedTarget = targets.find(target => target.instanceId === selectedTargetId) || null;
  const profileId = selectedTarget?.hitLocationProfileId || 'humanoid';

  useEffect(() => {
    const locations = getProfileLocations(profileId) as HitLocation[];
    if (!locations.length) return;
    const defaultLocation = locations.find(location => location.key === 'torso') || locations[0];
    const selectedIsValid = selectedLocation && locations.some(location => location.key === selectedLocation.key);
    if (!selectedIsValid) {
      setSelectedLocation(defaultLocation);
      setLocationRoll(null);
    }
  }, [profileId, selectedLocation]);

  const locationModifierValue = selectedLocation?.toHitPenalty || 0;
  const locationModifiers: Modifier[] = locationModifierValue !== 0
    ? [{ label: `Hit Location (${selectedLocation?.label})`, value: locationModifierValue }]
    : [];
  const lockedModifiers = [...injectedModifiers, ...locationModifiers];
  const injectedTotal = sumModifiers(lockedModifiers);

  const handleSelectAttack = (attack: Attack) => {
    setSelectedAttack(attack);
    setShowCustomAttack(false);
    setRollResult(null);
  };

  const handleUseCustomAttack = () => {
    setShowCustomAttack(true);
    setSelectedAttack(null);
    setRollResult(null);
  };

  const handleRoll = () => {
    const baseSkill = selectedAttack
      ? selectedAttack.skill
      : parseInt(customAttack.skill) || 0;

    const effectiveSkill = calculateEffective(baseSkill, [...injectedModifiers, ...locationModifiers, ...modifiers]);

    const result = rollVsTarget('3d6', effectiveSkill) as RollResult;
    setRollResult(result);
  };

  const handleComplete = () => {
    const attack = selectedAttack || {
      name: customAttack.name,
      skill: parseInt(customAttack.skill) || 0,
      damage: customAttack.damage,
      notes: customAttack.notes
    };

    const baseSkill = selectedAttack ? selectedAttack.skill : parseInt(customAttack.skill) || 0;
    const effectiveSkill = calculateEffective(baseSkill, [...injectedModifiers, ...locationModifiers, ...modifiers]);

    const attackData: AttackData = {
      name: attack.name,
      baseSkill,
      modifiers: [...modifiers],
      injectedModifiers: [...injectedModifiers, ...locationModifiers],
      effectiveSkill,
      rollTotal: rollResult ? rollResult.total : null,
      margin: rollResult ? rollResult.margin : null,
      success: rollResult ? rollResult.success : null,
      damage: attack.damage,
      notes: attack.notes,
      hitLocation: selectedLocation,
      hitLocationRoll: locationRoll
    };

    onComplete({
      targetInstanceId: selectedTargetId,
      attack: attackData
    });
  };

  const isValid = (): boolean => {
    if (selectedAttack) return true;
    if (showCustomAttack && customAttack.name && customAttack.skill) return true;
    return false;
  };

  return (
    <div className="space-y-4">
      {/* Attack Selection */}
      <div>
        <h4 className="font-semibold mb-2">Choose Attack</h4>

        {attacks.length > 0 ? (
          <div className="space-y-2">
            {attacks.map((attack, index) => (
              <button
                key={index}
                onClick={() => handleSelectAttack(attack)}
                className={`w-full text-left p-3 rounded border-2 ${
                  selectedAttack === attack
                    ? 'border-blue-500 bg-blue-900/30'
                    : 'border-gray-600 bg-gray-800 hover:bg-gray-700'
                }`}
                disabled={attack._hidden}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold">{attack.name}</div>
                    {attack._hidden ? (
                      <div className="text-sm text-gray-500 italic">
                        Stats unknown (use Custom Attack to specify)
                      </div>
                    ) : (
                      <>
                        <div className="text-sm text-gray-400">
                          Skill: {attack.skill}
                          {attack.damage && ` | Damage: ${attack.damage}`}
                        </div>
                        {attack.notes && (
                          <div className="text-xs text-gray-500 mt-1">{attack.notes}</div>
                        )}
                      </>
                    )}
                  </div>
                  {selectedAttack === attack && !attack._hidden && (
                    <Swords size={20} className="text-blue-400" />
                  )}
                </div>
              </button>
            ))}

            <button
              onClick={handleUseCustomAttack}
              className={`w-full p-3 rounded border-2 ${
                showCustomAttack
                  ? 'border-blue-500 bg-blue-900/30'
                  : 'border-gray-600 bg-gray-800 hover:bg-gray-700'
              }`}
            >
              + Custom Attack
            </button>
          </div>
        ) : (
          <div className="text-sm text-gray-400 mb-2">No attacks configured. Use custom attack.</div>
        )}

        {/* Custom Attack Form */}
        {(showCustomAttack || attacks.length === 0) && (
          <div className="bg-gray-800 rounded p-3 space-y-2 mt-2">
            <input
              type="text"
              value={customAttack.name}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setCustomAttack({ ...customAttack, name: e.target.value })}
              placeholder="Attack name"
              className="w-full px-3 py-2 bg-gray-700 rounded"
            />
            <input
              type="number"
              value={customAttack.skill}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setCustomAttack({ ...customAttack, skill: e.target.value })}
              placeholder="Base skill"
              className="w-full px-3 py-2 bg-gray-700 rounded"
            />
            <input
              type="text"
              value={customAttack.damage}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setCustomAttack({ ...customAttack, damage: e.target.value })}
              placeholder="Damage (e.g., 2d+1)"
              className="w-full px-3 py-2 bg-gray-700 rounded"
            />
            <input
              type="text"
              value={customAttack.notes}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setCustomAttack({ ...customAttack, notes: e.target.value })}
              placeholder="Notes (optional)"
              className="w-full px-3 py-2 bg-gray-700 rounded"
            />
          </div>
        )}
      </div>

      {/* Target Selection */}
      {(targets.length > 0 || !selectedTargetId) && (
        <div className="space-y-3">
          <div>
            <h4 className="font-semibold mb-2">Target</h4>
            {targets.length > 0 ? (
              <select
                value={selectedTargetId || ''}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedTargetId(e.target.value || null)}
                className="w-full px-3 py-2 bg-gray-700 rounded"
              >
                <option value="">No target selected</option>
                {targets.map((target) => (
                  <option key={target.instanceId} value={target.instanceId}>
                    {target.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="text-sm text-gray-400">No valid targets available</div>
            )}
          </div>

          <div>
            <HitLocationPicker
              profileId={profileId}
              selectedLocation={selectedLocation}
              onLocationSelected={(location, roll) => {
                setSelectedLocation(location);
                setLocationRoll(roll);
              }}
            />
            {selectedLocation && (
              <div className="text-xs text-gray-400 mt-2">
                Called-shot modifier:{' '}
                <span className={locationModifierValue >= 0 ? 'text-green-400' : 'text-red-400'}>
                  {locationModifierValue >= 0 ? '+' : ''}{locationModifierValue}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modifier Stack */}
      {isValid() && (
        <div>
          <h4 className="font-semibold mb-2">Attack Modifiers</h4>
          {lockedModifiers.length > 0 && (
            <div className="mb-3">
              <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">Injected Modifiers</div>
              <div className="flex flex-wrap gap-2">
                {lockedModifiers.map((modifier, index) => (
                  <span
                    key={`${modifier.label}-${index}`}
                    className="px-2 py-1 bg-gray-900/80 border border-gray-700 rounded text-xs"
                  >
                    {modifier.label} {modifier.value >= 0 ? '+' : ''}{modifier.value}
                  </span>
                ))}
              </div>
              {injectedTotal !== 0 && (
                <div className="text-xs text-gray-400 mt-1">
                  Injected total: {injectedTotal >= 0 ? '+' : ''}{injectedTotal}
                </div>
              )}
            </div>
          )}
          <ModifierStack
            baseValue={selectedAttack ? selectedAttack.skill : parseInt(customAttack.skill) || 0}
            baseLabel="Base Skill"
            modifiers={modifiers}
            lockedModifiers={lockedModifiers}
            onModifiersChange={setModifiers}
            presets={ATTACK_MODIFIERS}
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
          Roll Attack
        </button>
      )}

      {/* Roll Result */}
      {rollResult && (
        <div className={`p-4 rounded ${rollResult.success ? 'bg-green-900/30 border border-green-600' : 'bg-red-900/30 border border-red-600'}`}>
          <div className="text-center">
            <div className="text-2xl font-bold">
              {rollResult.total} vs {rollResult.target}
            </div>
            <div className="text-lg mt-1">
              Margin: <span className={rollResult.margin >= 0 ? 'text-green-400' : 'text-red-400'}>
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
          className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded"
        >
          Cancel
        </button>
        <button
          onClick={handleComplete}
          disabled={!isValid()}
          className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {rollResult ? 'Confirm & Log' : 'Log (No Roll)'}
        </button>
      </div>
    </div>
  );
}
