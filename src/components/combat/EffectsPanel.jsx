import React, { useState } from 'react';
import { Dices, AlertCircle, Skull, Heart, Droplet, Cross } from 'lucide-react';
import { performHTCheck } from '../../utils/effectsEngine';

/**
 * EffectsPanel Component
 * Displays and resolves injury effects (shock, major wound, stun, consciousness, death, bleeding, crippling)
 */
export default function EffectsPanel({
  prompts,
  target,
  onEffectResolved,
  onComplete
}) {
  const [resolvedEffects, setResolvedEffects] = useState({});
  const [rollResults, setRollResults] = useState({});

  const handleAutoApply = (prompt, index) => {
    const effect = {
      type: prompt.type,
      autoApplied: true,
      value: prompt.value,
      locationKey: prompt.locationKey,
      locationLabel: prompt.locationLabel
    };

    setResolvedEffects(prev => ({
      ...prev,
      [index]: effect
    }));

    onEffectResolved(effect);
  };

  const handleRoll = (prompt, index) => {
    const result = performHTCheck(prompt.target, prompt.penalty || 0);

    setRollResults(prev => ({
      ...prev,
      [index]: result
    }));

    const effect = {
      type: prompt.type,
      rolled: true,
      rollResult: result,
      success: result.success
    };

    setResolvedEffects(prev => ({
      ...prev,
      [index]: effect
    }));

    onEffectResolved(effect);
  };

  const handleSkip = (prompt, index) => {
    const effect = {
      type: prompt.type,
      skipped: true
    };

    setResolvedEffects(prev => ({
      ...prev,
      [index]: effect
    }));

    onEffectResolved(effect);
  };

  const handleManualResolve = (prompt, index, outcome) => {
    const effect = {
      type: prompt.type,
      manual: true,
      outcome
    };

    setResolvedEffects(prev => ({
      ...prev,
      [index]: effect
    }));

    onEffectResolved(effect);
  };

  const getEffectIcon = (type) => {
    switch (type) {
      case 'shock':
        return <AlertCircle size={20} className="text-yellow-400" />;
      case 'majorWound':
        return <Heart size={20} className="text-red-400" />;
      case 'knockdownStun':
        return <AlertCircle size={20} className="text-orange-400" />;
      case 'consciousnessCheck':
        return <Heart size={20} className="text-purple-400" />;
      case 'deathCheck':
        return <Skull size={20} className="text-red-600" />;
      case 'autoDeath':
        return <Skull size={20} className="text-red-900" />;
      case 'bleeding':
        return <Droplet size={20} className="text-red-400" />;
      case 'crippling':
        return <Cross size={20} className="text-orange-400" />;
      default:
        return <AlertCircle size={20} className="text-gray-400" />;
    }
  };

  const allResolved = prompts.length === Object.keys(resolvedEffects).length;

  return (
    <div className="space-y-3">
      <h4 className="font-semibold">Injury Effects</h4>

      {prompts.map((prompt, index) => {
        const resolved = resolvedEffects[index];
        const rollResult = rollResults[index];

        return (
          <div
            key={index}
            className={`bg-gray-800 rounded p-3 border-2 ${
              resolved ? 'border-green-600' : 'border-orange-600'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="mt-1">{getEffectIcon(prompt.type)}</div>
              <div className="flex-1">
                <div className="font-semibold">{prompt.description}</div>

                {/* Auto-apply prompts */}
                {prompt.autoApply && !resolved && (
                  <button
                    onClick={() => handleAutoApply(prompt, index)}
                    className="mt-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
                  >
                    Apply
                  </button>
                )}

                {/* Check prompts with roll option */}
                {prompt.checkType && !resolved && (
                  <div className="mt-2 space-y-2">
                    <div className="text-sm text-gray-400">
                      Target: {prompt.checkType} {prompt.target}
                      {prompt.penalty !== 0 && ` (${prompt.penalty >= 0 ? '+' : ''}${prompt.penalty})`}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRoll(prompt, index)}
                        className="flex items-center gap-1 px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-sm"
                      >
                        <Dices size={14} />
                        Roll
                      </button>
                      <button
                        onClick={() => handleManualResolve(prompt, index, 'success')}
                        className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm"
                      >
                        Success
                      </button>
                      <button
                        onClick={() => handleManualResolve(prompt, index, 'failure')}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
                      >
                        Failure
                      </button>
                      <button
                        onClick={() => handleSkip(prompt, index)}
                        className="px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded text-sm"
                      >
                        Skip
                      </button>
                    </div>
                  </div>
                )}

                {/* Optional prompts */}
                {prompt.optional && !resolved && (
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => handleManualResolve(prompt, index, 'yes')}
                      className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm"
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => handleManualResolve(prompt, index, 'no')}
                      className="px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded text-sm"
                    >
                      No
                    </button>
                  </div>
                )}

                {/* Display roll result */}
                {rollResult && (
                  <div className="mt-2 bg-gray-900 rounded p-2">
                    <div className="text-sm">
                      Roll: {rollResult.dice.join(', ')} = {rollResult.total} vs {rollResult.target}
                      {' ['}
                      <span className={rollResult.success ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
                        {rollResult.success ? 'SUCCESS' : 'FAILURE'}
                      </span>
                      {']'}
                    </div>
                  </div>
                )}

                {/* Display resolved status */}
                {resolved && (
                  <div className="mt-2 text-sm text-green-400">
                    ✓ Resolved
                    {resolved.autoApplied && ' (auto-applied)'}
                    {resolved.skipped && ' (skipped)'}
                    {resolved.manual && ` (manual: ${resolved.outcome})`}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Complete button */}
      {allResolved && (
        <button
          onClick={onComplete}
          className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 rounded font-semibold"
        >
          Complete Injury Resolution
        </button>
      )}

      {!allResolved && prompts.length > 0 && (
        <div className="text-sm text-gray-400 text-center">
          Resolve all effects to continue
        </div>
      )}
    </div>
  );
}
