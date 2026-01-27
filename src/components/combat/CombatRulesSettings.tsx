import { Settings } from 'lucide-react';
import { COMBAT_RULES_PRESETS } from '../../utils/effectsEngine';

type CombatRulesPreset = typeof COMBAT_RULES_PRESETS[keyof typeof COMBAT_RULES_PRESETS];

interface PresetInfo {
  label: string;
  description: string;
  features: string[];
}

interface CombatRulesSettingsProps {
  preset?: CombatRulesPreset;
  onPresetChange: (preset: CombatRulesPreset) => void;
}

/**
 * CombatRulesSettings Component
 * Allows selection of combat rules preset (lite, standard, crunchy)
 */
export default function CombatRulesSettings({
  preset = 'standard',
  onPresetChange
}: CombatRulesSettingsProps) {
  const presetDescriptions: Record<CombatRulesPreset, PresetInfo> = {
    [COMBAT_RULES_PRESETS.LITE]: {
      label: 'Lite',
      description: 'Hit location DR + penetrating damage only. No wounding multipliers or effects tracking.',
      features: ['Location DR', 'Basic HP checks']
    },
    [COMBAT_RULES_PRESETS.STANDARD]: {
      label: 'Standard',
      description: 'Full GURPS combat: wounding multipliers + shock + major wounds + knockdown + consciousness.',
      features: ['All Lite features', 'Wounding multipliers', 'Shock', 'Major wounds', 'Knockdown/Stun', 'Consciousness/Death checks']
    },
    [COMBAT_RULES_PRESETS.CRUNCHY]: {
      label: 'Crunchy',
      description: 'Standard + bleeding + crippling + detailed tracking.',
      features: ['All Standard features', 'Bleeding', 'Crippling injuries', 'Detailed prompts']
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <Settings size={20} />
        <h3 className="text-lg font-semibold">Combat Rules Preset</h3>
      </div>

      <div className="space-y-3">
        {Object.values(COMBAT_RULES_PRESETS).map(presetValue => {
          const presetInfo = presetDescriptions[presetValue];
          const isSelected = preset === presetValue;

          return (
            <button
              key={presetValue}
              onClick={() => onPresetChange(presetValue)}
              className={`w-full text-left p-4 rounded border-2 transition-colors ${
                isSelected
                  ? 'bg-blue-900/50 border-blue-500'
                  : 'bg-gray-900 border-gray-700 hover:border-gray-600'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="font-semibold text-lg">{presetInfo.label}</div>
                  <div className="text-sm text-gray-400 mt-1">{presetInfo.description}</div>
                  <div className="mt-2 space-y-1">
                    {presetInfo.features.map((feature, index) => (
                      <div key={index} className="text-xs text-gray-500">
                        • {feature}
                      </div>
                    ))}
                  </div>
                </div>
                {isSelected && (
                  <div className="ml-4 text-blue-400 font-bold">✓</div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-4 p-3 bg-gray-900 rounded text-sm text-gray-400">
        <strong>Note:</strong> This preset affects injury resolution and effects tracking. You can change it at any time.
      </div>
    </div>
  );
}
