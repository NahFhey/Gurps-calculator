import { Briefcase, AlertTriangle, AlertOctagon, Skull } from 'lucide-react';
import { getConditionIcon } from '../../../constants/conditions';
import { getLocationByKey } from '../../../utils/hitLocations';
import type { CharacterStatus } from '../../../types/campaign';
import type { CharacterSlotSummary } from '../../../state/downtime/downtimeSelectors';

interface CharacterStatusBadgeProps {
  summary: CharacterSlotSummary;
  status?: CharacterStatus;
}

/**
 * Displays status badges for a character in the party sidebar.
 * Shows assignment status and fatigue level with appropriate icons.
 */
export function CharacterStatusBadge({ summary, status }: CharacterStatusBadgeProps) {
  const { isAssigned, activityDisplayName, fatigueStatus } = summary;
  const unconscious = status?.conditions?.some(condition => condition.conditionId === 'unconscious') === true;
  const otherConditions = status?.conditions?.filter(condition => condition.conditionId !== 'unconscious') ?? [];
  const conditionTitle = otherConditions.map(condition => condition.label).join(', ');
  const crippledCount = status?.crippled?.length ?? 0;
  const crippledTitle = status?.crippled?.map(
    locationKey => getLocationByKey('humanoid', locationKey)?.label ?? locationKey
  ).join(', ');

  return (
    <div className="flex gap-1" data-testid="character-status-badges">
      {isAssigned && (
        <span
          className="bg-success-500 text-white px-1 rounded text-xs"
          title={`Assigned to: ${activityDisplayName}`}
        >
          <Briefcase className="w-3 h-3 inline" />
        </span>
      )}
      {fatigueStatus === 'tired' && (
        <span
          className="bg-yellow-500 text-black px-1 rounded text-xs"
          title="Tired - needs rest"
        >
          <AlertTriangle className="w-3 h-3 inline" />
        </span>
      )}
      {fatigueStatus === 'exhausted' && (
        <span
          className="bg-danger-500 text-white px-1 rounded text-xs"
          title="Exhausted - worked without rest"
        >
          <AlertOctagon className="w-3 h-3 inline" />
        </span>
      )}
      {status?.dead ? (
        <span
          className="rounded bg-danger-700 px-1 text-xs text-white"
          title="Dead"
          data-testid="dead-status-badge"
        >
          <Skull className="mr-0.5 inline h-3 w-3" />Dead
        </span>
      ) : (
        <>
          {unconscious && (
            <span
              className="rounded bg-warning-600 px-1 text-xs text-black"
              title="Unconscious"
              data-testid="unconscious-status-badge"
            >
              KO
            </span>
          )}
          {otherConditions.length > 0 && (
            <span
              className="rounded bg-purple-700 px-1 text-xs text-white"
              title={conditionTitle}
              data-testid="condition-status-indicator"
            >
              {otherConditions.slice(0, 2).map(condition => (
                <span key={condition.instanceId}>{getConditionIcon(condition.conditionId)}</span>
              ))}
              {otherConditions.length > 2 && `+${otherConditions.length - 2}`}
            </span>
          )}
          {crippledCount > 0 && (
            <span
              className="rounded bg-orange-800 px-1 text-xs text-white"
              title={`Crippled: ${crippledTitle}`}
              data-testid="crippled-status-indicator"
            >
              🦴{crippledCount}
            </span>
          )}
        </>
      )}
    </div>
  );
}
