/**
 * CombatToken — renders a combat participant as a colored token on a map tile.
 */

import React, { memo } from 'react';

const CATEGORY_COLORS: Record<string, string> = {
  player: '#3b82f6',   // blue-500
  ally: '#22c55e',     // green-500
  enemy: '#ef4444',    // red-500
  object: '#6b7280',   // gray-500
};

interface CombatTokenProps {
  initial: string;
  category: 'player' | 'ally' | 'enemy' | 'object';
  isCurrentActor: boolean;
  isDead: boolean;
  isUnconscious: boolean;
  isSelected: boolean;
  tileSizePx: number;
  onClick?: (e: React.MouseEvent) => void;
  displayName: string;
}

export const CombatToken = memo(function CombatToken({
  initial,
  category,
  isCurrentActor,
  isDead,
  isUnconscious,
  isSelected,
  tileSizePx,
  onClick,
  displayName,
}: CombatTokenProps) {
  const circleSize = Math.round(tileSizePx * 0.7);
  const fontSize = Math.max(8, Math.round(tileSizePx * 0.3));
  const bgColor = CATEGORY_COLORS[category] ?? CATEGORY_COLORS.object;

  const opacity = isDead ? 0.4 : isUnconscious ? 0.5 : 1;

  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      title={`${displayName} (${category})`}
      onClick={onClick}
      style={{ cursor: 'pointer' }}
    >
      <div
        className={[
          'relative rounded-full flex items-center justify-center font-bold text-white',
          isCurrentActor ? 'ring-2 ring-yellow-400 animate-pulse' : '',
          isSelected ? 'ring-2 ring-white' : '',
        ].join(' ')}
        style={{
          width: circleSize,
          height: circleSize,
          backgroundColor: bgColor,
          opacity,
          fontSize,
          lineHeight: 1,
        }}
      >
        {initial}
        {isDead && (
          <div
            className="absolute inset-0 flex items-center justify-center text-red-200 font-bold"
            style={{ fontSize: Math.round(tileSizePx * 0.5) }}
          >
            X
          </div>
        )}
      </div>
    </div>
  );
});
