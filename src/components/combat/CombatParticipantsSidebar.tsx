/**
 * CombatParticipantsSidebar — replaces the Party column during map combat.
 *
 * Shows participants in turn order with HP status, current-actor highlight,
 * and click-to-select for map token sync.
 */

import { useCombatContext } from './CombatContext';
import { calculateHPStatus } from '../../utils/combatHelpers';
import { getActiveConditions } from '../../utils/conditionsEngine';
import { useEffectiveRole } from '../../hooks/useEffectiveRole';
import { ChevronLeft, ChevronRight, Eye, EyeOff } from 'lucide-react';
import type { Participant, HPValue } from '../../types/combatTracker';

const HP_COLORS: Record<string, string> = {
  healthy: 'border-green-500',
  injured: 'border-yellow-500',
  critical: 'border-red-500',
  dead: 'border-gray-500',
};

const HP_BG: Record<string, string> = {
  healthy: 'bg-green-500/20',
  injured: 'bg-yellow-500/20',
  critical: 'bg-red-500/20',
  dead: 'bg-gray-500/20',
};

const CATEGORY_BADGE: Record<string, { label: string; className: string }> = {
  ally: { label: 'Ally', className: 'bg-blue-600 text-blue-100' },
  enemy: { label: 'Enemy', className: 'bg-red-600 text-red-100' },
  npc: { label: 'NPC', className: 'bg-purple-600 text-purple-100' },
  object: { label: 'Obj', className: 'bg-gray-600 text-gray-100' },
};

export function CombatParticipantsSidebar() {
  const { isGM: effectiveIsGM, canEdit } = useEffectiveRole();
  const {
    combat,
    participants,
    turnOrder,
    currentActorInstanceId,
    selectedParticipantId,
    setSelectedParticipantId,
    handleNextTurn,
    handlePrevTurn,
    gmMode,
    setGmMode,
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
          <h2 className="text-sm uppercase tracking-wide text-gray-400">Combat</h2>
          <div className="text-xs text-gray-500">
            Round {combat.currentRound} · Turn{' '}
            {combat.currentTurnIndex + 1}/{turnOrder.length}
          </div>
        </div>
        {effectiveIsGM && (
          <button
            onClick={() => setGmMode(!gmMode)}
            className={`p-1 rounded transition-colors ${
              gmMode
                ? 'bg-yellow-600/30 text-yellow-300 hover:bg-yellow-600/40'
                : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
            }`}
            title={gmMode ? 'GM Mode (click to switch to Player view)' : 'Player View (click to switch to GM mode)'}
          >
            {gmMode ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          </button>
        )}
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
            <div className="text-[10px] text-gray-600 uppercase tracking-wider mt-2 mb-1">
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

      {/* Turn nav (GM only) */}
      {canEdit && (
        <div className="flex items-center gap-2 mt-3 pt-2 border-t border-gray-700">
          <button
            onClick={handlePrevTurn}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs rounded bg-gray-700 hover:bg-gray-600 transition-colors"
          >
            <ChevronLeft className="h-3 w-3" /> Prev
          </button>
          <button
            onClick={handleNextTurn}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs rounded bg-green-700 hover:bg-green-600 text-white font-medium transition-colors"
          >
            Next <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      )}
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

  // Extract numeric HP values (handles both truth state and filtered object state)
  const hpCurrent: number = (typeof p.hp === 'object' && p.hp !== null)
    ? (p.hp as HPValue).current ?? 0
    : (p.currentHP ?? (p.hp as number));
  const hpMax: number = (typeof p.hp === 'object' && p.hp !== null)
    ? (p.hp as HPValue).max ?? 0
    : ((p.hp as number) || (p.maxHP ?? 0));

  const hpStatus = calculateHPStatus(hpCurrent, hpMax);
  const borderColor = HP_COLORS[hpStatus] ?? 'border-gray-600';
  const bgColor = isCurrent
    ? 'bg-blue-900/40'
    : HP_BG[hpStatus] ?? 'bg-gray-800/50';
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
        ${isCurrent ? 'shadow-lg shadow-blue-500/20' : ''}
        hover:brightness-110 cursor-pointer
      `}
    >
      {/* Name + badge row */}
      <div className="flex items-center gap-1.5">
        {isCurrent && (
          <span className="text-blue-400 font-bold text-[10px]">▶</span>
        )}
        <span className="font-medium truncate flex-1 text-gray-100">{p.name}</span>
        <span
          className={`text-[9px] px-1 py-0.5 rounded ${badge.className} leading-none`}
        >
          {badge.label}
        </span>
      </div>

      {/* HP bar */}
      <div className="mt-1 flex items-center gap-1.5">
        <div className="flex-1 h-1 bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              hpStatus === 'healthy'
                ? 'bg-green-500'
                : hpStatus === 'injured'
                  ? 'bg-yellow-500'
                  : hpStatus === 'critical'
                    ? 'bg-red-500'
                    : 'bg-gray-500'
            }`}
            style={{
              width: `${Math.max(0, Math.min(100, (hpCurrent / hpMax) * 100))}%`,
            }}
          />
        </div>
        <span className="text-[10px] text-gray-400 tabular-nums w-12 text-right">
          {hpCurrent}/{hpMax}
        </span>
      </div>

      {/* Conditions */}
      {conditions.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-0.5">
          {conditions.slice(0, 3).map((c: any, i: number) => (
            <span
              key={c.instanceId || i}
              className="text-[9px] px-1 py-0.5 rounded bg-gray-700 text-gray-300 leading-none"
            >
              {c.label || c.conditionId}
            </span>
          ))}
          {conditions.length > 3 && (
            <span className="text-[9px] text-gray-500">+{conditions.length - 3}</span>
          )}
        </div>
      )}
    </button>
  );
}
