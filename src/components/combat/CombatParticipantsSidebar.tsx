/**
 * CombatParticipantsSidebar — replaces the Party column during map combat.
 *
 * Shows participants in turn order with HP status, current-actor highlight,
 * and click-to-select for map token sync.
 */

import { useCombatContext } from './CombatContext';
import { calculateHPStatus } from '../../utils/combatHelpers';
import { getActiveConditions } from '../../utils/conditionsEngine';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Participant } from '../../types/combatTracker';

const HP_COLORS: Record<string, string> = {
  healthy: 'border-success-500',
  injured: 'border-yellow-500',
  critical: 'border-danger-500',
  dead: 'border-edge-bright',
};

const HP_BG: Record<string, string> = {
  healthy: 'bg-success-500/20',
  injured: 'bg-yellow-500/20',
  critical: 'bg-danger-500/20',
  dead: 'bg-surface-4/20',
};

const CATEGORY_BADGE: Record<string, { label: string; className: string }> = {
  ally: { label: 'Ally', className: 'bg-accent-600 text-accent-100' },
  enemy: { label: 'Enemy', className: 'bg-danger-600 text-danger-100' },
  npc: { label: 'NPC', className: 'bg-purple-600 text-purple-100' },
  object: { label: 'Obj', className: 'bg-surface-3 text-fg-bright' },
};

export function CombatParticipantsSidebar() {
  const {
    combat,
    participants,
    turnOrder,
    currentActorInstanceId,
    selectedParticipantId,
    setSelectedParticipantId,
    handleNextTurn,
    handlePrevTurn,
  } = useCombatContext();

  // Order participants by turnOrder
  const orderedParticipants = turnOrder
    .map((id) => participants.find((p) => p.instanceId === id))
    .filter(Boolean) as Participant[];

  // Also include any participants NOT in turnOrder (e.g. objects)
  const nonTurnParticipants = participants.filter(
    (p) => !turnOrder.includes(p.instanceId),
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div>
          <h2 className="text-sm uppercase tracking-wide text-fg-muted">Combat</h2>
          <div className="text-xs text-fg-faint">
            Round {combat.currentRound} · Turn{' '}
            {combat.currentTurnIndex + 1}/{turnOrder.length}
          </div>
        </div>
      </div>

      {/* Participant list */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 px-0.5">
        {orderedParticipants.map((p) => (
          <ParticipantCard
            key={p.instanceId}
            participant={p}
            isCurrent={p.instanceId === currentActorInstanceId}
            isSelected={p.instanceId === selectedParticipantId}
            onClick={() =>
              setSelectedParticipantId(
                p.instanceId === selectedParticipantId ? null : p.instanceId,
              )
            }
          />
        ))}
        {nonTurnParticipants.length > 0 && (
          <>
            <div className="text-[10px] text-fg-disabled uppercase tracking-wider mt-2 mb-1">
              Objects
            </div>
            {nonTurnParticipants.map((p) => (
              <ParticipantCard
                key={p.instanceId}
                participant={p}
                isCurrent={false}
                isSelected={p.instanceId === selectedParticipantId}
                onClick={() =>
                  setSelectedParticipantId(
                    p.instanceId === selectedParticipantId ? null : p.instanceId,
                  )
                }
              />
            ))}
          </>
        )}
      </div>

      {/* Turn nav */}
      <div className="flex items-center gap-2 mt-3 pt-2 border-t border-edge">
        <button
          onClick={handlePrevTurn}
          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs rounded bg-surface-2 hover:bg-surface-3 transition-colors"
        >
          <ChevronLeft className="h-3 w-3" /> Prev
        </button>
        <button
          onClick={handleNextTurn}
          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs rounded bg-success-700 hover:bg-success-600 text-white font-medium transition-colors"
        >
          Next <ChevronRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ParticipantCard
// ---------------------------------------------------------------------------

function ParticipantCard({
  participant,
  isCurrent,
  isSelected,
  onClick,
}: {
  participant: Participant;
  isCurrent: boolean;
  isSelected: boolean;
  onClick: () => void;
}) {
  const p = participant;
  const currentHP = typeof p.currentHP === 'number' ? p.currentHP : (typeof p.hp === 'number' ? p.hp : (p.hp as any)?.current ?? 0);
  const maxHP = typeof p.hp === 'number' ? p.hp : (p.hp as any)?.max ?? 0;
  const hpStatus = calculateHPStatus(currentHP, maxHP);
  const borderColor = HP_COLORS[hpStatus] ?? 'border-edge-strong';
  const bgColor = isCurrent
    ? 'bg-accent-900/40'
    : HP_BG[hpStatus] ?? 'bg-surface-1/50';
  const badge = CATEGORY_BADGE[p.category] ?? CATEGORY_BADGE.npc;

  const conditions = getActiveConditions?.(p) ?? [];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        w-full text-left rounded-lg border-l-4 px-2 py-1.5 transition-all text-xs
        ${borderColor} ${bgColor}
        ${isSelected ? 'ring-1 ring-white/60' : ''}
        ${isCurrent ? 'shadow-lg shadow-accent-500/20' : ''}
        hover:brightness-110 cursor-pointer
      `}
    >
      {/* Name + badge row */}
      <div className="flex items-center gap-1.5">
        {isCurrent && (
          <span className="text-accent-400 font-bold text-[10px]">▶</span>
        )}
        <span className="font-medium truncate flex-1 text-fg-bright">{p.name}</span>
        <span
          className={`text-[9px] px-1 py-0.5 rounded ${badge.className} leading-none`}
        >
          {badge.label}
        </span>
      </div>

      {/* HP bar */}
      <div className="mt-1 flex items-center gap-1.5">
        <div className="flex-1 h-1 bg-surface-2 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              hpStatus === 'healthy'
                ? 'bg-success-500'
                : hpStatus === 'injured'
                  ? 'bg-yellow-500'
                  : hpStatus === 'critical'
                    ? 'bg-danger-500'
                    : 'bg-surface-4'
            }`}
            style={{
              width: `${Math.max(0, Math.min(100, (currentHP / maxHP) * 100))}%`,
            }}
          />
        </div>
        <span className="text-[10px] text-fg-muted tabular-nums w-12 text-right">
          {currentHP}/{maxHP}
        </span>
      </div>

      {/* Conditions */}
      {conditions.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-0.5">
          {conditions.slice(0, 3).map((c: any, i: number) => (
            <span
              key={c.instanceId || i}
              className="text-[9px] px-1 py-0.5 rounded bg-surface-2 text-fg-secondary leading-none"
            >
              {c.label || c.conditionId}
            </span>
          ))}
          {conditions.length > 3 && (
            <span className="text-[9px] text-fg-faint">+{conditions.length - 3}</span>
          )}
        </div>
      )}
    </button>
  );
}
