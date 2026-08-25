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
      <span className="w-32 text-sm text-gray-400">{label}</span>
      <div className="flex flex-1 flex-wrap items-center gap-2">
        {foodTypes.map(foodType => (
          <span
            key={foodType}
            className="inline-flex items-center gap-1 rounded-full bg-gray-700 px-2.5 py-1 text-xs text-gray-200"
          >
            {foodType}
            {editMode && (
              <button
                type="button"
                onClick={() => onChange(foodTypes.filter(configuredType => configuredType !== foodType))}
                className="rounded-full text-gray-400 hover:text-red-300"
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
              className="rounded border border-gray-600 bg-gray-700 px-2 py-1 text-xs text-gray-100"
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
              className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Add
            </button>
          </div>
        )}
        {foodTypes.length === 0 && !editMode && (
          <span className="text-sm italic text-gray-500">None</span>
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
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Utensils size={20} className="text-blue-400" />
        <h3 className="text-lg font-semibold text-gray-100">Dietary Restrictions</h3>
      </div>

      {!hasConfiguredDiet && !editMode ? (
        showNudge ? (
          <div className="text-xs italic text-amber-300/70">
            Has a diet-related trait — configure dietary restrictions?
          </div>
        ) : (
          <div className="text-sm italic text-gray-500">No dietary restrictions</div>
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
        <div className="mt-2 text-xs italic text-amber-300/70">
          Has a diet-related trait — configure dietary restrictions?
        </div>
      )}
    </div>
  );
}
