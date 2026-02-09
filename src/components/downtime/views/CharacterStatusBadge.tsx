import { Briefcase, AlertTriangle, AlertOctagon } from 'lucide-react';
import type { CharacterSlotSummary } from '../../../state/downtime/downtimeSelectors';

interface CharacterStatusBadgeProps {
  summary: CharacterSlotSummary;
}

/**
 * Displays status badges for a character in the party sidebar.
 * Shows assignment status and fatigue level with appropriate icons.
 */
export function CharacterStatusBadge({ summary }: CharacterStatusBadgeProps) {
  const { isAssigned, activityDisplayName, fatigueStatus } = summary;

  return (
    <div className="flex gap-1">
      {isAssigned && (
        <span
          className="bg-green-500 text-white px-1 rounded text-xs"
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
          className="bg-red-500 text-white px-1 rounded text-xs"
          title="Exhausted - worked without rest"
        >
          <AlertOctagon className="w-3 h-3 inline" />
        </span>
      )}
    </div>
  );
}
