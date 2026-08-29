import type { PrimaryAttributes, SecondaryAttributes } from '../../types/characterSheet';
import { calculateDerivedAttributes } from '../../types/characterSheet';
import { SECONDARY_COSTS } from '../../utils/characterPoints';

interface SecondaryAttributesSectionProps {
  primaryAttributes: PrimaryAttributes;
  secondaryAttributes: SecondaryAttributes;
  editMode: boolean;
  onChange: (secondary: SecondaryAttributes) => void;
}

interface SecondaryAttrConfig {
  key: keyof SecondaryAttributes;
  label: string;
  baseAttr: keyof PrimaryAttributes | 'derived';
  costPerPoint: number;
}

const SECONDARY_ATTRS: SecondaryAttrConfig[] = [
  { key: 'will', label: 'Will', baseAttr: 'IQ', costPerPoint: SECONDARY_COSTS.will },
  { key: 'frightCheck', label: 'Fright Check', baseAttr: 'IQ', costPerPoint: SECONDARY_COSTS.frightCheck },
  { key: 'per', label: 'Perception', baseAttr: 'IQ', costPerPoint: SECONDARY_COSTS.per },
  { key: 'vision', label: 'Vision', baseAttr: 'IQ', costPerPoint: SECONDARY_COSTS.vision },
  { key: 'hearing', label: 'Hearing', baseAttr: 'IQ', costPerPoint: SECONDARY_COSTS.hearing },
  { key: 'tasteSmell', label: 'Taste & Smell', baseAttr: 'IQ', costPerPoint: SECONDARY_COSTS.tasteSmell },
  { key: 'touch', label: 'Touch', baseAttr: 'IQ', costPerPoint: SECONDARY_COSTS.touch },
  { key: 'basicSpeed', label: 'Basic Speed', baseAttr: 'derived', costPerPoint: SECONDARY_COSTS.basicSpeed },
  { key: 'basicMove', label: 'Basic Move', baseAttr: 'derived', costPerPoint: SECONDARY_COSTS.basicMove },
];

export function SecondaryAttributesSection({
  primaryAttributes,
  secondaryAttributes,
  editMode,
  onChange,
}: SecondaryAttributesSectionProps) {
  const derived = calculateDerivedAttributes(primaryAttributes);

  const getBaseValue = (config: SecondaryAttrConfig): number => {
    if (config.baseAttr === 'derived') {
      if (config.key === 'basicSpeed') return derived.basicSpeed;
      if (config.key === 'basicMove') return derived.basicMove;
    }
    // For sense-based attributes, base is Per value
    if (['vision', 'hearing', 'tasteSmell', 'touch'].includes(config.key)) {
      return secondaryAttributes.per.value;
    }
    // Will, Per, Fright Check base on IQ
    if (config.key === 'frightCheck') return secondaryAttributes.will.value;
    return primaryAttributes[config.baseAttr as keyof PrimaryAttributes];
  };

  const handleChange = (key: keyof SecondaryAttributes, value: number, config: SecondaryAttrConfig) => {
    const baseValue = getBaseValue(config);
    const diff = value - baseValue;
    const points = Math.round(diff * config.costPerPoint);

    onChange({
      ...secondaryAttributes,
      [key]: { value, points },
    });
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-gray-100 mb-3">Secondary Characteristics</h3>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {SECONDARY_ATTRS.map((config) => {
          const attr = secondaryAttributes[config.key];

          return (
            <div key={config.key} className="bg-gray-700 rounded p-2">
              <div className="text-xs text-gray-400 mb-1 truncate" title={config.label}>
                {config.label}
              </div>
              <div className="flex items-center gap-1">
                {editMode ? (
                  <input
                    type="number"
                    value={attr.value}
                    onChange={(e) => handleChange(config.key, parseFloat(e.target.value) || 0, config)}
                    className="w-14 text-lg font-bold bg-gray-600 border border-gray-500 rounded px-1 py-0.5 text-gray-100 text-center"
                    step={config.key === 'basicSpeed' ? 0.25 : 1}
                  />
                ) : (
                  <span className="text-lg font-bold text-gray-100">
                    {config.key === 'basicSpeed' ? attr.value.toFixed(2) : attr.value}
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                [{attr.points >= 0 ? '+' : ''}{attr.points}]
              </div>
            </div>
          );
        })}

        {/* Derived: Dodge */}
        <div className="bg-gray-700 rounded p-2">
          <div className="text-xs text-gray-400 mb-1">Dodge</div>
          <div className="text-lg font-bold text-gray-100">{derived.dodge}</div>
          <div className="text-xs text-gray-500 mt-1">(auto)</div>
        </div>
      </div>

      {/* Derived Stats Row */}
      <div className="mt-3 pt-3 border-t border-gray-700">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div className="text-gray-400">
            Basic Lift: <span className="text-gray-200 font-medium">{derived.basicLift.toFixed(1)} lb</span>
          </div>
          <div className="text-gray-400">
            Thrust: <span className="text-gray-200 font-medium">{derived.thrustDamage}</span>
          </div>
          <div className="text-gray-400">
            Swing: <span className="text-gray-200 font-medium">{derived.swingDamage}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
