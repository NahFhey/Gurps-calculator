import { useCampaignStore } from '../../state/campaignStore';
import { isMealBuffActive } from '../../utils/mealBuff';

interface MealBuffWidgetProps {
  compact?: boolean;
}

export function MealBuffWidget({ compact = false }: MealBuffWidgetProps) {
  const { state } = useCampaignStore();
  const buff = state.mealBuff;

  if (!isMealBuffActive(buff, state.time.day) || !buff) return null;

  const skills = buff.skills.map(skill => `+1 ${skill}`).join(', ');
  const abstainerNames = (buff.excludedCharacterIds ?? [])
    .map(characterId => state.entities.characters[characterId]?.name)
    .filter((name): name is string => Boolean(name));
  const abstainerClause = abstainerNames.length > 0
    ? `(${abstainerNames.join(', ')} ${abstainerNames.length === 1 ? 'abstains' : 'abstain'})`
    : '';
  const tooltip = `${buff.recipeName} — ${skills}${abstainerClause ? ` ${abstainerClause}` : ''}`;

  if (compact) {
    return (
      <div
        className="flex items-center gap-2 rounded border border-amber-600/60 bg-amber-900/30 px-3 py-1.5"
        title={tooltip}
        data-testid="meal-buff-widget-compact"
      >
        <span className="text-lg" aria-hidden="true">🍲</span>
        <span className="text-sm text-amber-100">
          {buff.recipeName} — {skills}
        </span>
        {abstainerClause && (
          <span className="text-xs text-amber-200/60">{abstainerClause}</span>
        )}
      </div>
    );
  }

  return (
    <div
      className="rounded border border-amber-600/60 bg-amber-900/30 px-4 py-2"
      title={tooltip}
      data-testid="meal-buff-widget"
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl" aria-hidden="true">🍲</span>
        <div className="min-w-0">
          <div className="text-sm font-medium text-amber-100">{buff.recipeName}</div>
          <div className="text-xs text-amber-200/80">
            {skills}
            {abstainerClause && (
              <span className="ml-2 text-amber-200/60">{abstainerClause}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MealBuffWidget;
