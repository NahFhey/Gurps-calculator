import type { PrimaryAttributes, PrimaryAttributePoints } from '../../types/characterSheet';

interface AttributesSectionProps {
  attributes: PrimaryAttributes;
  attributePoints: PrimaryAttributePoints;
  editMode: boolean;
  onChange: (attrs: PrimaryAttributes, points: PrimaryAttributePoints) => void;
}

const ATTRIBUTE_COSTS: Record<keyof PrimaryAttributes, number> = {
  ST: 10,
  DX: 20,
  IQ: 20,
  HT: 10,
};

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
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-gray-100 mb-3">Primary Attributes</h3>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(Object.keys(attributes) as Array<keyof PrimaryAttributes>).map((attr) => (
          <div key={attr} className="bg-gray-700 rounded p-3">
            <div className="text-xs text-gray-400 mb-1">{ATTRIBUTE_LABELS[attr]}</div>
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-bold text-gray-300">{attr}</span>
              {editMode ? (
                <input
                  type="number"
                  value={attributes[attr]}
                  onChange={(e) => handleAttributeChange(attr, parseInt(e.target.value) || 0)}
                  className="w-16 text-2xl font-bold bg-gray-600 border border-gray-500 rounded px-2 py-1 text-gray-100 text-center"
                  min={1}
                  max={20}
                />
              ) : (
                <span className="text-2xl font-bold text-gray-100">{attributes[attr]}</span>
              )}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              [{attributePoints[attr] >= 0 ? '+' : ''}{attributePoints[attr]}]
            </div>
          </div>
        ))}
      </div>

      {/* Point Cost Reference */}
      <div className="mt-3 text-xs text-gray-500">
        Cost: ST/HT = 10 pts/level | DX/IQ = 20 pts/level (base 10)
      </div>
    </div>
  );
}
