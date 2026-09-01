import type { PrimaryAttributes, PrimaryAttributePoints } from '../../types/characterSheet';
import { ATTRIBUTE_COSTS } from '../../utils/characterPoints';

interface AttributesSectionProps {
  attributes: PrimaryAttributes;
  attributePoints: PrimaryAttributePoints;
  editMode: boolean;
  onChange: (attrs: PrimaryAttributes, points: PrimaryAttributePoints) => void;
}

const ATTRIBUTE_LABELS: Record<keyof PrimaryAttributes, string> = {
  ST: 'Strength',
  DX: 'Dexterity',
  IQ: 'Intelligence',
  HT: 'Health',
};

export function AttributesSection({
  attributes,
  attributePoints,
  editMode,
  onChange,
}: AttributesSectionProps) {
  const handleAttributeChange = (attr: keyof PrimaryAttributes, value: number) => {
    const baseCost = ATTRIBUTE_COSTS[attr];
    const diff = value - 10; // Difference from base 10
    const points = diff * baseCost;

    onChange(
      { ...attributes, [attr]: value },
      { ...attributePoints, [attr]: points }
    );
  };

  return (
    <div className="bg-surface-1 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-fg-bright mb-3">Primary Attributes</h3>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(Object.keys(attributes) as Array<keyof PrimaryAttributes>).map((attr) => (
          <div key={attr} className="bg-surface-2 rounded p-3">
            <div className="text-xs text-fg-muted mb-1">{ATTRIBUTE_LABELS[attr]}</div>
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-bold text-fg-secondary">{attr}</span>
              {editMode ? (
                <input
                  type="number"
                  value={attributes[attr]}
                  onChange={(e) => handleAttributeChange(attr, parseInt(e.target.value) || 0)}
                  className="w-16 text-2xl font-bold bg-surface-3 border border-edge-bright rounded px-2 py-1 text-fg-bright text-center"
                  min={1}
                  max={20}
                />
              ) : (
                <span className="text-2xl font-bold text-fg-bright">{attributes[attr]}</span>
              )}
            </div>
            <div className="text-xs text-fg-muted mt-1">
              [{attributePoints[attr] >= 0 ? '+' : ''}{attributePoints[attr]}]
            </div>
          </div>
        ))}
      </div>

      {/* Point Cost Reference */}
      <div className="mt-3 text-xs text-fg-faint">
        Cost: ST/HT = 10 pts/level | DX/IQ = 20 pts/level (base 10)
      </div>
    </div>
  );
}
