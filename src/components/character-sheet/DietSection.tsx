import { Utensils, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useCampaignStore } from '../../state/campaignStore';
import type { Character } from '../../types/campaign';
import { hasDietTraitHint } from '../../utils/dietaryRestrictions';
import { selectAllFoods } from '../../state/selectors/inventorySelectors';

interface DietSectionProps {
  character: Character;
  excludedFoodTypes: string[];
  requiredFoodTypes: string[];
  editMode: boolean;
  onExcludedFoodTypesChange: (foodTypes: string[]) => void;
  onRequiredFoodTypesChange: (foodTypes: string[]) => void;
}

interface DietRowProps {
  label: string;
  foodTypes: string[];
  vocabulary: string[];
  editMode: boolean;
  onChange: (foodTypes: string[]) => void;
}

function DietRow({ label, foodTypes, vocabulary, editMode, onChange }: DietRowProps) {
  const availableFoodTypes = vocabulary.filter(foodType => !foodTypes.includes(foodType));
  const [selectedFoodType, setSelectedFoodType] = useState('');

  const addSelectedFoodType = () => {
    if (!selectedFoodType) return;
    onChange([...foodTypes, selectedFoodType]);
    setSelectedFoodType('');
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-32 text-sm text-fg-muted">{label}</span>
      <div className="flex flex-1 flex-wrap items-center gap-2">
        {foodTypes.map(foodType => (
          <span
            key={foodType}
            className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-xs text-fg-primary"
          >
            {foodType}
            {editMode && (
              <button
                type="button"
                onClick={() => onChange(foodTypes.filter(configuredType => configuredType !== foodType))}
                className="rounded-full text-fg-muted hover:text-danger-300"
                aria-label={`Remove ${foodType} from ${label}`}
              >
                <X size={12} />
              </button>
            )}
          </span>
        ))}
        {editMode && availableFoodTypes.length > 0 && (
          <div className="flex items-center gap-1">
            <select
              value={selectedFoodType}
              onChange={event => setSelectedFoodType(event.target.value)}
              aria-label={`Add food type to ${label}`}
              className="rounded border border-edge-strong bg-surface-2 px-2 py-1 text-xs text-fg-bright"
            >
              <option value="">Select food type…</option>
              {availableFoodTypes.map(foodType => (
                <option key={foodType} value={foodType}>{foodType}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={addSelectedFoodType}
              disabled={!selectedFoodType}
              className="rounded bg-accent-600 px-2 py-1 text-xs text-white hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Add
            </button>
          </div>
        )}
        {foodTypes.length === 0 && !editMode && (
          <span className="text-sm italic text-fg-faint">None</span>
        )}
      </div>
    </div>
  );
}

export function DietSection({
  character,
  excludedFoodTypes,
  requiredFoodTypes,
  editMode,
  onExcludedFoodTypesChange,
  onRequiredFoodTypesChange,
}: DietSectionProps) {
  const { state } = useCampaignStore();
  const vocabulary = useMemo(() => {
    const foodTypes = new Set<string>();
    for (const food of selectAllFoods(state)) {
      for (const foodType of food.types ?? []) foodTypes.add(foodType);
    }
    for (const foodType of [...excludedFoodTypes, ...requiredFoodTypes]) foodTypes.add(foodType);
    return [...foodTypes].sort((left, right) => left.localeCompare(right));
  }, [state, excludedFoodTypes, requiredFoodTypes]);

  const hasConfiguredDiet = excludedFoodTypes.length > 0 || requiredFoodTypes.length > 0;
  const showNudge = !hasConfiguredDiet && hasDietTraitHint(character);

  return (
    <div className="bg-surface-1 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Utensils size={20} className="text-accent-400" />
        <h3 className="text-lg font-semibold text-fg-bright">Dietary Restrictions</h3>
      </div>

      {!hasConfiguredDiet && !editMode ? (
        showNudge ? (
          <div className="text-xs italic text-warning-300/70">
            Has a diet-related trait — configure dietary restrictions?
          </div>
        ) : (
          <div className="text-sm italic text-fg-faint">No dietary restrictions</div>
        )
      ) : (
        <div className="space-y-3">
          <DietRow
            label="Won't/can't eat"
            foodTypes={excludedFoodTypes}
            vocabulary={vocabulary}
            editMode={editMode}
            onChange={onExcludedFoodTypesChange}
          />
          <DietRow
            label="Requires"
            foodTypes={requiredFoodTypes}
            vocabulary={vocabulary}
            editMode={editMode}
            onChange={onRequiredFoodTypesChange}
          />
        </div>
      )}

      {showNudge && editMode && (
        <div className="mt-2 text-xs italic text-warning-300/70">
          Has a diet-related trait — configure dietary restrictions?
        </div>
      )}
    </div>
  );
}
