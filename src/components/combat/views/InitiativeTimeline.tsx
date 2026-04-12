import { memo, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Skull, Shield, Swords } from 'lucide-react';
import { calculateHPStatus } from '../../../utils/combatHelpers';
import type { Participant } from '../../../types/combatTracker';

// ============================================================================
// Types
// ============================================================================

export interface InitiativeTimelineProps {
  participants: Participant[];
  turnOrder: string[];
  currentTurnIndex: number;
  currentRound: number;
  onPrevTurn: () => void;
  onNextTurn: () => void;
  onJumpToTurn?: (turnIndex: number) => void;
}

// ============================================================================
// Helpers
// ============================================================================

/** Derive a 1-2 letter abbreviation from a name. */
function nameInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

/** HP-based ring color for the token. */
function hpRingColor(participant: Participant): string {
  const hp = participant.currentHP ?? 0;
  const maxHP = (typeof participant.hp === 'number' ? participant.hp : participant.maxHP) ?? 1;
  const status = calculateHPStatus(hp, maxHP) as string;
  switch (status) {
    case 'healthy':  return 'ring-green-500';
    case 'injured':  return 'ring-yellow-500';
    case 'critical': return 'ring-orange-500';
    case 'dead':     return 'ring-red-600';
    default:         return 'ring-gray-500';
  }
}

/** Background color by category. */
function categoryBg(category: string): string {
  switch (category) {
    case 'player':  return 'bg-blue-800';
    case 'ally':    return 'bg-teal-800';
    case 'enemy':   return 'bg-red-900';
    case 'neutral': return 'bg-gray-700';
    default:        return 'bg-gray-700';
  }
}

/** Small icon by category. */
function CategoryIcon({ category }: { category: string }) {
  const cls = 'w-3 h-3';
  switch (category) {
    case 'player':  return <Shield className={cls} />;
    case 'ally':    return <Shield className={cls} />;
    case 'enemy':   return <Swords className={cls} />;
    default:        return null;
  }
}

// ============================================================================
// Token component (one participant in the timeline)
// ============================================================================

interface TokenProps {
  participant: Participant;
  isCurrent: boolean;
  isPast: boolean;
  onClick?: () => void;
}

function TokenBase({ participant, isCurrent, isPast, onClick }: TokenProps) {
  const isDead = participant.isDead;
  const isUnconscious = participant.isUnconscious;

  const ringColor = isDead ? 'ring-red-600' : hpRingColor(participant);
  const bg = categoryBg(participant.category);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        relative flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg
        transition-all duration-200 min-w-[4.5rem] max-w-[5.5rem]
        ${isCurrent
          ? `${bg} ring-2 ${ringColor} shadow-lg shadow-blue-500/30 scale-110 z-10`
          : isPast
            ? `${bg}/50 ring-1 ring-gray-600 opacity-60`
            : `${bg}/70 ring-1 ring-gray-600 hover:ring-gray-400`
        }
        ${isDead ? 'opacity-40 line-through' : ''}
        ${onClick ? 'cursor-pointer' : 'cursor-default'}
      `}
      title={`${participant.name} — Speed ${participant.basicSpeed} | ${
        isDead ? 'Dead' : isUnconscious ? 'Unconscious' : `HP ${participant.currentHP ?? '?'}/${(typeof participant.hp === 'number' ? participant.hp : participant.maxHP) ?? '?'}`
      }`}
    >
      {/* Avatar circle */}
      <div
        className={`
          w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
          ${isCurrent ? 'bg-blue-600 text-white' : 'bg-gray-600 text-gray-200'}
          ${isDead ? 'bg-red-900 text-red-400' : ''}
          ${isUnconscious && !isDead ? 'bg-yellow-900 text-yellow-400' : ''}
        `}
      >
        {isDead ? (
          <Skull className="w-4 h-4" />
        ) : (
          nameInitials(participant.name)
        )}
      </div>

      {/* Name */}
      <span className="text-[0.65rem] leading-tight text-center truncate w-full">
        {participant.name}
      </span>

      {/* Category icon + speed */}
      <div className="flex items-center gap-0.5 text-[0.6rem] text-gray-400">
        <CategoryIcon category={participant.category} />
        <span>{participant.basicSpeed}</span>
      </div>

      {/* Current turn indicator arrow */}
      {isCurrent && (
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0
          border-l-[5px] border-l-transparent
          border-r-[5px] border-r-transparent
          border-t-[5px] border-t-blue-500"
        />
      )}
    </button>
  );
}

const Token = memo(TokenBase);

// ============================================================================
// Main timeline component
// ============================================================================

function InitiativeTimelineBase({
  participants,
  turnOrder,
  currentTurnIndex,
  currentRound,
  onPrevTurn,
  onNextTurn,
  onJumpToTurn,
}: InitiativeTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentTokenRef = useRef<HTMLDivElement>(null);

  // Build participant lookup
  const participantMap = new Map(participants.map((p) => [p.instanceId, p]));

  // Auto-scroll to keep the current actor visible
  useEffect(() => {
    if (currentTokenRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const token = currentTokenRef.current;
      const tokenLeft = token.offsetLeft;
      const tokenWidth = token.offsetWidth;
      const containerWidth = container.clientWidth;
      const scrollLeft = container.scrollLeft;

      // If the token is outside the visible area, scroll to center it
      if (
        tokenLeft < scrollLeft ||
        tokenLeft + tokenWidth > scrollLeft + containerWidth
      ) {
        container.scrollTo({
          left: tokenLeft - containerWidth / 2 + tokenWidth / 2,
          behavior: 'smooth',
        });
      }
    }
  }, [currentTurnIndex]);

  return (
    <div className="bg-gradient-to-r from-blue-900/80 to-gray-800/80 rounded-lg border border-blue-500/50 overflow-hidden">
      {/* Top bar: round counter */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-black/20 border-b border-gray-700/50">
        <span className="text-xs font-semibold text-blue-300">
          Round {currentRound}
        </span>
        <span className="text-xs text-gray-400">
          Turn {currentTurnIndex + 1} of {turnOrder.length}
        </span>
      </div>

      {/* Timeline row */}
      <div className="flex items-center gap-1 p-2">
        {/* Prev button */}
        <button
          onClick={onPrevTurn}
          className="flex-none p-1.5 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
          title="Previous turn"
        >
          <ChevronLeft size={18} />
        </button>

        {/* Scrollable token strip */}
        <div
          ref={scrollRef}
          className="flex-1 flex items-center gap-1.5 overflow-x-auto py-1 px-1
            scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent"
        >
          {turnOrder.map((instanceId, index) => {
            const participant = participantMap.get(instanceId);
            if (!participant) return null;

            const isCurrent = index === currentTurnIndex;
            const isPast = index < currentTurnIndex;

            return (
              <div
                key={`${instanceId}-${index}`}
                ref={isCurrent ? currentTokenRef : undefined}
                className="flex-none"
              >
                <Token
                  participant={participant}
                  isCurrent={isCurrent}
                  isPast={isPast}
                  onClick={onJumpToTurn ? () => onJumpToTurn(index) : undefined}
                />
              </div>
            );
          })}
        </div>

        {/* Next button */}
        <button
          onClick={onNextTurn}
          className="flex-none p-2 bg-green-600 hover:bg-green-700 rounded transition-colors"
          title="Next turn"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}

export const InitiativeTimeline = memo(InitiativeTimelineBase);
