import { memo, useRef, useEffect, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Skull, Shield, Swords, GripVertical } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { calculateHPStatus } from '../../../utils/combatHelpers';
import { hasCondition, getActiveConditions } from '../../../utils/conditionsEngine';
import { ConditionId, getConditionIcon } from '../../../constants/conditions';
import { sortConditionsByUrgency } from '../ConditionBadge';
import ConditionOverflowPill from '../ConditionOverflowPill';
import type { Participant, ConditionInstance } from '../../../types/combatTracker';

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
  onReorderTurnOrder?: (newTurnOrder: string[]) => void;
  /** GM-only (Phase 12a.6): opens the condition popover for a participant at a screen point. */
  onOpenConditions?: (instanceId: string, anchor: { x: number; y: number }) => void;
}

/** Phase 12a.6 density cap: max condition icons per timeline token. */
const TIMELINE_CONDITION_CAP = 3;

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
    case 'healthy':  return 'ring-success-500';
    case 'injured':  return 'ring-yellow-500';
    case 'critical': return 'ring-orange-500';
    case 'dead':     return 'ring-danger-600';
    default:         return 'ring-edge-bright';
  }
}

/** Background color by category. */
function categoryBg(category: string): string {
  switch (category) {
    case 'player':  return 'bg-accent-800';
    case 'ally':    return 'bg-teal-800';
    case 'enemy':   return 'bg-danger-900';
    case 'neutral': return 'bg-surface-2';
    default:        return 'bg-surface-2';
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
  currentRound?: number;
  onClick?: () => void;
  isDragging?: boolean;
  dragHandleProps?: Record<string, unknown>;
  canDrag?: boolean;
  onOpenConditions?: (instanceId: string, anchor: { x: number; y: number }) => void;
}

function TokenBase({ participant, isCurrent, isPast, currentRound = 0, onClick, isDragging, dragHandleProps, canDrag, onOpenConditions }: TokenProps) {
  const isDead = participant.isDead;
  const isUnconscious = hasCondition(participant, ConditionId.UNCONSCIOUS);

  const ringColor = isDead ? 'ring-danger-600' : hpRingColor(participant);
  const bg = categoryBg(participant.category);

  return (
    <div
      className={`
        relative flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg
        transition-all duration-200 min-w-[4.5rem] max-w-[5.5rem]
        ${isCurrent
          ? `${bg} ring-2 ${ringColor} shadow-lg shadow-accent-500/30 scale-110 z-10`
          : isPast
            ? `${bg}/50 ring-1 ring-edge-strong opacity-60`
            : `${bg}/70 ring-1 ring-edge-strong hover:ring-edge-bright`
        }
        ${isDead ? 'opacity-40 line-through' : ''}
        ${isDragging ? 'opacity-40' : ''}
        ${onClick ? 'cursor-pointer' : 'cursor-default'}
      `}
      onClick={onClick}
      title={`${participant.name} — Speed ${participant.basicSpeed} | ${
        isDead ? 'Dead' : isUnconscious ? 'Unconscious' : `HP ${participant.currentHP ?? '?'}/${(typeof participant.hp === 'number' ? participant.hp : participant.maxHP) ?? '?'}`
      }`}
    >
      {/* Drag handle */}
      {canDrag && (
        <div
          {...dragHandleProps}
          className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center
            bg-surface-3 rounded-full opacity-50 hover:opacity-100
            cursor-grab active:cursor-grabbing transition-opacity z-20"
          title="Drag to reorder"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="w-3 h-3 text-fg-secondary" />
        </div>
      )}

      {/* Avatar circle — show token image if available */}
      {participant.tokenImage && !isDead ? (
        <img
          src={participant.tokenImage}
          alt={participant.name}
          className={`
            w-8 h-8 rounded-full object-cover
            ${isUnconscious ? 'opacity-50 grayscale' : ''}
          `}
        />
      ) : (
        <div
          className={`
            w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
            ${isCurrent ? 'bg-accent-600 text-white' : 'bg-surface-3 text-fg-primary'}
            ${isDead ? 'bg-danger-900 text-danger-400' : ''}
            ${isUnconscious && !isDead ? 'bg-yellow-900 text-yellow-400' : ''}
          `}
        >
          {isDead ? (
            <Skull className="w-4 h-4" />
          ) : (
            nameInitials(participant.name)
          )}
        </div>
      )}

      {/* Name */}
      <span className="text-[0.65rem] leading-tight text-center truncate w-full">
        {participant.name}
      </span>

      {/* Category icon + speed */}
      <div className="flex items-center gap-0.5 text-[0.6rem] text-fg-muted">
        <CategoryIcon category={participant.category} />
        <span>{participant.basicSpeed}</span>
      </div>

      {/* Phase 12a.6: condition icons, urgency-sorted, capped at 3 + "+N" pill */}
      {(() => {
        const conditions = getActiveConditions(participant) as ConditionInstance[];
        if (conditions.length === 0) return null;
        const sorted = sortConditionsByUrgency(conditions, currentRound);
        const visible = sorted.slice(0, TIMELINE_CONDITION_CAP);
        const overflow = sorted.length - visible.length;
        return (
          <div className="flex items-center gap-0.5 text-[0.65rem] leading-none">
            {visible.map((condition) => (
              <span
                key={condition.instanceId}
                title={condition.label}
                aria-label={condition.label}
              >
                {condition.placeholder ? '❓' : getConditionIcon(condition.conditionId)}
              </span>
            ))}
            {overflow > 0 && (
              <ConditionOverflowPill
                count={overflow}
                compact
                onClick={
                  onOpenConditions
                    ? (e) => {
                        e.stopPropagation();
                        onOpenConditions(participant.instanceId, {
                          x: e.clientX,
                          y: e.clientY,
                        });
                      }
                    : undefined
                }
              />
            )}
          </div>
        );
      })()}

      {/* Current turn indicator arrow */}
      {isCurrent && (
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0
          border-l-[5px] border-l-transparent
          border-r-[5px] border-r-transparent
          border-t-[5px] border-t-accent-500"
        />
      )}
    </div>
  );
}

const Token = memo(TokenBase);

// ============================================================================
// Sortable token wrapper (dnd-kit)
// ============================================================================

interface SortableTokenProps {
  id: string;
  participant: Participant;
  isCurrent: boolean;
  isPast: boolean;
  currentRound: number;
  onClick?: () => void;
  canDrag: boolean;
  onOpenConditions?: (instanceId: string, anchor: { x: number; y: number }) => void;
}

function SortableToken({ id, participant, isCurrent, isPast, currentRound, onClick, canDrag, onOpenConditions }: SortableTokenProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !canDrag });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex-none group/token">
      <Token
        participant={participant}
        isCurrent={isCurrent}
        isPast={isPast}
        currentRound={currentRound}
        onClick={isDragging ? undefined : onClick}
        isDragging={isDragging}
        dragHandleProps={canDrag ? { ...attributes, ...listeners } : undefined}
        canDrag={canDrag}
        onOpenConditions={onOpenConditions}
      />
    </div>
  );
}

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
  onReorderTurnOrder,
  onOpenConditions,
}: InitiativeTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentTokenRef = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Build participant lookup
  const participantMap = new Map(participants.map((p) => [p.instanceId, p]));

  // Use unique sortable IDs: instanceId-index (handles duplicate instanceIds in turn order)
  const sortableIds = turnOrder.map((instanceId, index) => `${instanceId}::${index}`);

  // Sensors with activation distance to distinguish clicks from drags
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const canDrag = Boolean(onReorderTurnOrder);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id || !onReorderTurnOrder) return;

    const oldIndex = sortableIds.indexOf(String(active.id));
    const newIndex = sortableIds.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;

    // Build new turn order by moving the item from oldIndex to newIndex
    const newTurnOrder = [...turnOrder];
    const [moved] = newTurnOrder.splice(oldIndex, 1);
    newTurnOrder.splice(newIndex, 0, moved);

    onReorderTurnOrder(newTurnOrder);
  }, [sortableIds, turnOrder, onReorderTurnOrder]);

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  // Resolve the dragged participant for the overlay
  const activeParticipant = activeId
    ? participantMap.get(activeId.split('::')[0]) ?? null
    : null;

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
    <div className="bg-gradient-to-r from-accent-900/80 to-surface-1/80 rounded-lg border border-accent-500/50 overflow-hidden">
      {/* Top bar: round counter */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-black/20 border-b border-edge/50">
        <span className="text-xs font-semibold text-accent-300">
          Round {currentRound}
        </span>
        <span className="text-xs text-fg-muted">
          Turn {currentTurnIndex + 1} of {turnOrder.length}
          {canDrag && <span className="ml-2 text-fg-faint">(drag to reorder)</span>}
        </span>
      </div>

      {/* Timeline row */}
      <div className="flex items-center gap-1 p-2">
        {/* Prev button */}
        <button
          onClick={onPrevTurn}
          className="flex-none p-1.5 bg-surface-2 hover:bg-surface-3 rounded transition-colors"
          title="Previous turn"
          aria-label="Previous turn"
        >
          <ChevronLeft size={18} />
        </button>

        {/* Scrollable token strip with DnD */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <SortableContext items={sortableIds} strategy={horizontalListSortingStrategy}>
            <div
              ref={scrollRef}
              className="flex-1 flex items-center gap-1.5 overflow-x-auto py-1 px-1
            scrollbar-thin scrollbar-thumb-surface-3 scrollbar-track-transparent"
            >
              {turnOrder.map((instanceId, index) => {
                const participant = participantMap.get(instanceId);
                if (!participant) return null;

                const isCurrent = index === currentTurnIndex;
                const isPast = index < currentTurnIndex;
                const sortableId = sortableIds[index];

                return (
                  <div
                    key={sortableId}
                    ref={isCurrent ? currentTokenRef : undefined}
                  >
                    <SortableToken
                      id={sortableId}
                      participant={participant}
                      isCurrent={isCurrent}
                      isPast={isPast}
                      currentRound={currentRound}
                      onClick={onJumpToTurn ? () => onJumpToTurn(index) : undefined}
                      canDrag={canDrag}
                      onOpenConditions={onOpenConditions}
                    />
                  </div>
                );
              })}
            </div>
          </SortableContext>

          {/* Drag overlay — renders the floating token while dragging */}
          <DragOverlay>
            {activeParticipant ? (
              <Token
                participant={activeParticipant}
                isCurrent={false}
                isPast={false}
                currentRound={currentRound}
              />
            ) : null}
          </DragOverlay>
        </DndContext>

        {/* Next button */}
        <button
          onClick={onNextTurn}
          className="flex-none p-2 bg-success-600 hover:bg-success-700 rounded transition-colors"
          title="Next turn"
          aria-label="Next turn"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}

export const InitiativeTimeline = memo(InitiativeTimelineBase);
