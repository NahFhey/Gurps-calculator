import React, { useState } from 'react';
import { Swords, Dices } from 'lucide-react';
import ModifierStack from './ModifierStack';
import { ATTACK_MODIFIERS, calculateEffective } from '../../utils/modifiers';
import { rollVsTarget } from '../../utils/dice';

/**
 * AttackAssist Component
 * Handles attack selection, modifier calculation, and optional roll
 * Returns attack data for logging
 */
export default function AttackAssist({
  actor,
  targets = [],
  onComplete,
  onCancel
}) {
  const [selectedAttack, setSelectedAttack] = useState(null);
  const [customAttack, setCustomAttack] = useState({ name: '', skill: '', damage: '', notes: '' });
  const [showCustomAttack, setShowCustomAttack] = useState(false);
  const [modifiers, setModifiers] = useState([]);
  const [selectedTargetId, setSelectedTargetId] = useState(targets.length === 1 ? targets[0].instanceId : null);
  const [rollResult, setRollResult] = useState(null);

  // Get attacks from actor (if they have any)
  const attacks = actor.attacks || [];

  const handleSelectAttack = (attack) => {
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

    const effectiveSkill = calculateEffective(baseSkill, modifiers);

    const result = rollVsTarget('3d6', effectiveSkill);
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
    const effectiveSkill = calculateEffective(baseSkill, modifiers);

    const attackData = {
      name: attack.name,
      baseSkill,
      modifiers: [...modifiers],
      effectiveSkill,
      rollTotal: rollResult ? rollResult.total : null,
      margin: rollResult ? rollResult.margin : null,
      success: rollResult ? rollResult.success : null,
      damage: attack.damage,
      notes: attack.notes
    };

    onComplete({
      targetInstanceId: selectedTargetId,
      attack: attackData
    });
  };

  const isValid = () => {
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
              onChange={(e) => setCustomAttack({ ...customAttack, name: e.target.value })}
              placeholder="Attack name"
              className="w-full px-3 py-2 bg-gray-700 rounded"
            />
            <input
              type="number"
              value={customAttack.skill}
              onChange={(e) => setCustomAttack({ ...customAttack, skill: e.target.value })}
              placeholder="Base skill"
              className="w-full px-3 py-2 bg-gray-700 rounded"
            />
            <input
              type="text"
              value={customAttack.damage}
              onChange={(e) => setCustomAttack({ ...customAttack, damage: e.target.value })}
              placeholder="Damage (e.g., 2d+1)"
              className="w-full px-3 py-2 bg-gray-700 rounded"
            />
            <input
              type="text"
              value={customAttack.notes}
              onChange={(e) => setCustomAttack({ ...customAttack, notes: e.target.value })}
              placeholder="Notes (optional)"
              className="w-full px-3 py-2 bg-gray-700 rounded"
            />
          </div>
        )}
      </div>

      {/* Target Selection */}
      {targets.length > 0 && (
        <div>
          <h4 className="font-semibold mb-2">Target</h4>
          <select
            value={selectedTargetId || ''}
            onChange={(e) => setSelectedTargetId(e.target.value || null)}
            className="w-full px-3 py-2 bg-gray-700 rounded"
          >
            <option value="">No target selected</option>
            {targets.map((target) => (
              <option key={target.instanceId} value={target.instanceId}>
                {target.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Modifier Stack */}
      {isValid() && (
        <div>
          <h4 className="font-semibold mb-2">Attack Modifiers</h4>
          <ModifierStack
            baseValue={selectedAttack ? selectedAttack.skill : parseInt(customAttack.skill) || 0}
            baseLabel="Base Skill"
            modifiers={modifiers}
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
