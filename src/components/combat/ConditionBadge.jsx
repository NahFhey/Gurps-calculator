import React from 'react';
import { formatConditionDuration, formatConditionTooltip } from '../../utils/conditionsEngine';
import { getConditionIcon } from '../../constants/conditions';

/**
 * Phase 6: Condition Badge Component
 *
 * Displays a condition icon/badge with tooltip.
 * Used in combatant cards to show active conditions.
 *
 * @param {object} props
 * @param {object} props.condition - Condition instance
 * @param {number} props.currentRound - Current combat round
 * @param {boolean} props.showDuration - Show duration text (default true)
 * @param {function} props.onClick - Click handler (optional)
 * @returns {JSX.Element}
 */
export default function ConditionBadge({
  condition,
  currentRound = 0,
  showDuration = true,
  onClick = null
}) {
  const icon = getConditionIcon(condition.conditionId);
  const tooltip = formatConditionTooltip(condition, currentRound);
  const duration = formatConditionDuration(condition, currentRound);

  const handleClick = (e) => {
    if (onClick) {
      e.stopPropagation();
      onClick(condition);
    }
  };

  return (
    <div
      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-purple-900/50 border border-purple-700 ${
        onClick ? 'cursor-pointer hover:bg-purple-800/50' : ''
      }`}
      title={tooltip}
      onClick={handleClick}
    >
      <span>{icon}</span>
      <span className="font-medium">{condition.label}</span>
      {showDuration && condition.expiresAt && (
        <span className="text-gray-400 text-xs">({duration})</span>
      )}
      {condition.severity != null && (
        <span className="text-yellow-400 font-bold">×{condition.severity}</span>
      )}
    </div>
  );
}
