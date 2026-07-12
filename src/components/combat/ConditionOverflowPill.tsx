import { MouseEvent } from 'react';

/**
 * Phase 12a.6: "+N" overflow pill for density-capped condition rows
 * (4 icons in tracker cards, 3 in the initiative timeline).
 *
 * With an onClick (GM surfaces) it's a button that opens the condition
 * popover; without one (player view) it renders as a static count.
 */
export default function ConditionOverflowPill({
  count,
  onClick,
  compact = false,
}: {
  count: number;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  compact?: boolean;
}) {
  const label = `${count} more condition${count === 1 ? '' : 's'}`;
  const className = `
    inline-flex items-center rounded-full border border-gray-600 bg-gray-700/80
    text-gray-300 font-semibold
    ${onClick ? 'hover:bg-gray-600 hover:text-white transition-colors' : ''}
    ${compact ? 'px-1 text-[0.6rem] leading-4' : 'px-1.5 py-0.5 text-xs'}
  `;

  if (!onClick) {
    return (
      <span aria-label={label} title={label} className={className}>
        +{count}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={`${label} — click to manage`}
      className={className}
    >
      +{count}
    </button>
  );
}
