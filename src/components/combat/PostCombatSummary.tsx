/**
 * PostCombatSummary Component (Phase 11c)
 *
 * Shown after combat ends. Displays:
 * - Summary of all participants (HP/FP changes, status, conditions)
 * - Auto-syncs party character HP/FP back to campaign store
 * - Healing time estimates based on GURPS recovery rules
 * - Transitions to LootDistribution on "Continue"
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Heart, Shield, Clock, AlertTriangle, Skull, Users,
  ChevronDown, ChevronUp, Check, ArrowRight
} from 'lucide-react';
import { useCombatStore } from '../../hooks/useCombatStore';
import { hasCondition } from '../../utils/conditionsEngine';
import { estimateHealing } from '../../utils/recovery';
import { buildCharacterStatus } from '../../utils/injuryPersistence';
import { ConditionId } from '../../constants/conditions';
import type { Character } from '../../types/campaign';
import type { CombatState, Participant, ConditionInstance } from '../../types/combatTracker';
import type { CombatSummaryData, ParticipantSummary, HealingEstimate } from '../../types/combatTracker';

// ============================================================================
// HELPERS
// ============================================================================

/** Extract numeric HP from participant (handles both number and HPValue modes) */
function getNumericHP(p: Participant): { current: number; max: number } {
  const max = p.maxHP ?? (typeof p.hp === 'number' ? p.hp : (p.hp?.max ?? 10));
  const current = p.currentHP ?? (typeof p.hp === 'number' ? p.hp : (p.hp?.current ?? max));
  return { current, max };
}

/** Extract numeric FP from participant */
function getNumericFP(p: Participant): { current: number; max: number } {
  const max = p.maxFP ?? (typeof p.fp === 'number' ? p.fp : (p.fp?.max ?? 10));
  const current = p.currentFP ?? (typeof p.fp === 'number' ? p.fp : (p.fp?.current ?? max));
  return { current, max };
}

/**
 * Build summary data from a completed combat state.
 * Called when combat ends — captures the final state of all participants.
 */
export function buildCombatSummary(combat: CombatState): CombatSummaryData {
  const participants: ParticipantSummary[] = combat.participants.map(p => {
    const hp = getNumericHP(p);
    const fp = getNumericFP(p);

    return {
      instanceId: p.instanceId,
      name: p.name,
      category: p.category || 'enemy',
      isFromParty: p.isFromParty ?? false,
      partyCharacterId: p.partyCharacterId,
      startHP: hp.max, // Approximate — we don't track start HP separately
      maxHP: hp.max,
      endHP: hp.current,
      startFP: fp.max,
      maxFP: fp.max,
      endFP: fp.current,
      isStunned: hasCondition(p, ConditionId.STUNNED),
      isUnconscious: hasCondition(p, ConditionId.UNCONSCIOUS),
      isDead: p.isDead ?? false,
      conditions: (p.conditions || []) as ConditionInstance[],
      crippled: p.crippled || [],
      bleeding: p.bleeding ?? null
    };
  });

  const healingEstimates: Record<string, HealingEstimate> = {};
  for (const ps of participants) {
    if (ps.isFromParty && ps.partyCharacterId) {
      healingEstimates[ps.partyCharacterId] = estimateHealing(
        ps.maxHP - ps.endHP,
        ps.maxFP - ps.endFP,
      );
    }
  }

  return {
    combatId: combat.id,
    combatName: combat.name,
    rounds: combat.currentRound,
    durationMs: (combat.endTime ?? Date.now()) - combat.startTime,
    participants,
    healingEstimates
  };
}

// ============================================================================
// COMPONENTS
// ============================================================================

interface PostCombatSummaryProps {
  /** The completed combat state (with endTime set) */
  combat: CombatState;
  /** Called when the user finishes the post-combat flow */
  onComplete: () => void;
  /** Called to transition to loot distribution */
  onProceedToLoot: () => void;
}

function HPBar({ current, max, label }: { current: number; max: number; label: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
  const color = pct > 66 ? 'bg-green-500' : pct > 33 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-6 text-gray-400">{label}</span>
      <div className="flex-1 bg-gray-700 rounded-full h-2.5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-16 text-right tabular-nums">
        {current}/{max}
      </span>
    </div>
  );
}

function StatusBadge({ label, variant }: { label: string; variant: 'danger' | 'warning' | 'info' }) {
  const colors = {
    danger: 'bg-red-900/50 text-red-300 border-red-700/50',
    warning: 'bg-yellow-900/50 text-yellow-300 border-yellow-700/50',
    info: 'bg-blue-900/50 text-blue-300 border-blue-700/50'
  };

  return (
    <span className={`text-xs px-1.5 py-0.5 rounded border ${colors[variant]}`}>
      {label}
    </span>
  );
}

function ParticipantSummaryCard({ summary, healingEstimate }: {
  summary: ParticipantSummary;
  healingEstimate?: HealingEstimate;
}) {
  const [expanded, setExpanded] = useState(false);
  const hpLost = summary.maxHP - summary.endHP;
  const fpLost = summary.maxFP - summary.endFP;
  const hasDamage = hpLost > 0 || fpLost > 0;
  const hasConditions = summary.conditions.length > 0 || summary.crippled.length > 0;

  const categoryColors: Record<string, string> = {
    player: 'border-purple-600/50',
    ally: 'border-green-600/50',
    enemy: 'border-red-600/50',
    object: 'border-gray-600/50'
  };

  return (
    <div className={`bg-gray-800 rounded-lg border ${categoryColors[summary.category] || 'border-gray-700'} overflow-hidden`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-3 hover:bg-gray-750 transition-colors text-left"
      >
        {/* Status icon */}
        <div className="flex-shrink-0">
          {summary.isDead ? (
            <Skull size={20} className="text-red-500" />
          ) : summary.isUnconscious ? (
            <AlertTriangle size={20} className="text-yellow-500" />
          ) : hasDamage ? (
            <Heart size={20} className="text-orange-400" />
          ) : (
            <Shield size={20} className="text-green-400" />
          )}
        </div>

        {/* Name and quick stats */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold truncate">{summary.name}</span>
            {summary.isFromParty && (
              <span className="text-xs px-1.5 py-0.5 bg-purple-600/30 text-purple-300 rounded">Party</span>
            )}
          </div>
          <div className="flex gap-2 mt-0.5">
            {summary.isDead && <StatusBadge label="Dead" variant="danger" />}
            {summary.isUnconscious && !summary.isDead && <StatusBadge label="Unconscious" variant="warning" />}
            {summary.isStunned && <StatusBadge label="Stunned" variant="warning" />}
            {summary.bleeding && <StatusBadge label={`Bleeding ${summary.bleeding.rate}/rd`} variant="danger" />}
            {summary.crippled.map(loc => (
              <StatusBadge key={loc} label={`Crippled: ${loc}`} variant="danger" />
            ))}
          </div>
        </div>

        {/* HP summary */}
        <div className="flex-shrink-0 text-right">
          <div className={`text-sm font-mono ${hpLost > 0 ? 'text-red-400' : 'text-green-400'}`}>
            {summary.endHP}/{summary.maxHP} HP
          </div>
          {hpLost > 0 && (
            <div className="text-xs text-red-400">-{hpLost}</div>
          )}
        </div>

        {/* Expand toggle */}
        <div className="flex-shrink-0 text-gray-500">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-gray-700/50">
          <div className="pt-2 space-y-2">
            <HPBar current={summary.endHP} max={summary.maxHP} label="HP" />
            <HPBar current={summary.endFP} max={summary.maxFP} label="FP" />
          </div>

          {/* Conditions */}
          {hasConditions && (
            <div>
              <div className="text-xs text-gray-400 mb-1">Conditions</div>
              <div className="flex flex-wrap gap-1">
                {summary.conditions.map(c => (
                  <StatusBadge key={c.instanceId} label={c.label} variant="info" />
                ))}
              </div>
            </div>
          )}

          {/* Healing estimate for party characters */}
          {healingEstimate && summary.isFromParty && hpLost > 0 && (
            <div className="bg-gray-900/50 rounded p-2 space-y-1">
              <div className="text-xs text-gray-400 flex items-center gap-1">
                <Clock size={12} /> Healing Estimate
              </div>
              <div className="text-sm space-y-0.5">
                <div>
                  Natural recovery: <span className="text-blue-300">{healingEstimate.daysToFullHP} day{healingEstimate.daysToFullHP !== 1 ? 's' : ''}</span> of rest
                </div>
                {healingEstimate.firstAidEstimate.max > 0 && (
                  <div>
                    First Aid: <span className="text-green-300">{healingEstimate.firstAidEstimate.min}–{healingEstimate.firstAidEstimate.max} HP</span> immediate
                  </div>
                )}
                {fpLost > 0 && (
                  <div>
                    FP recovery: <span className="text-blue-300">{fpLost * 10} min</span> rest
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PostCombatSummary({ combat, onComplete, onProceedToLoot }: PostCombatSummaryProps) {
  const { updatePartyCharacter, partyCharacters } = useCombatStore();
  const [syncComplete, setSyncComplete] = useState(false);

  const summary = useMemo(() => buildCombatSummary(combat), [combat]);

  // Auto-sync party character pools and persistent injury status back to campaign store
  useEffect(() => {
    if (syncComplete) return;

    const partyParticipants = summary.participants.filter(
      p => p.isFromParty && p.partyCharacterId
    );

    for (const ps of partyParticipants) {
      const partyCharacterId = ps.partyCharacterId;
      if (!partyCharacterId) continue;
      const partyChar = partyCharacters.find(c => c.id === partyCharacterId);
      const participant = combat.participants.find(p => p.instanceId === ps.instanceId);
      if (!partyChar || !participant) continue;

      const changes: Partial<Character> = {
        // Keep this key even when undefined: post-combat sync has replace semantics.
        status: buildCharacterStatus(participant),
      };

      if (partyChar.gcsData) {
        changes.gcsData = {
          ...partyChar.gcsData,
          pools: {
            ...partyChar.gcsData.pools,
            HP: {
              ...partyChar.gcsData.pools.HP,
              current: ps.endHP
            },
            FP: {
              ...partyChar.gcsData.pools.FP,
              current: ps.endFP
            }
          }
        };
      }

      updatePartyCharacter(partyCharacterId, changes);
    }

    setSyncComplete(true);
  }, [combat.participants, summary, partyCharacters, updatePartyCharacter, syncComplete]);

  // Separate party and non-party participants
  const partyParticipants = summary.participants.filter(p => p.isFromParty);
  const otherParticipants = summary.participants.filter(p => !p.isFromParty);

  // Summary stats
  const totalPartyDamage = partyParticipants.reduce((sum, p) => sum + (p.maxHP - p.endHP), 0);
  const partyDeaths = partyParticipants.filter(p => p.isDead).length;
  const enemiesDefeated = otherParticipants.filter(
    p => p.category === 'enemy' && (p.isDead || p.isUnconscious)
  ).length;
  const totalEnemies = otherParticipants.filter(p => p.category === 'enemy').length;

  const durationMin = Math.round(summary.durationMs / 60000);

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Combat Complete</h2>
        <div className="text-gray-400">{summary.combatName}</div>
        <div className="flex justify-center gap-6 text-sm text-gray-400">
          <span>{summary.rounds} round{summary.rounds !== 1 ? 's' : ''}</span>
          <span>{durationMin > 0 ? `${durationMin} min` : '< 1 min'}</span>
          <span>{enemiesDefeated}/{totalEnemies} enemies down</span>
        </div>
      </div>

      {/* Sync confirmation */}
      {syncComplete && partyParticipants.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-green-900/30 border border-green-700/50 rounded text-sm text-green-300">
          <Check size={16} />
          Party character HP/FP synced back to campaign
        </div>
      )}

      {/* Quick stats for party */}
      {partyParticipants.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-800 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-red-400">{totalPartyDamage}</div>
            <div className="text-xs text-gray-400">Total HP Lost</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-yellow-400">{partyDeaths}</div>
            <div className="text-xs text-gray-400">Deaths</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-green-400">
              {partyParticipants.filter(p => !p.isDead && !p.isUnconscious).length}
            </div>
            <div className="text-xs text-gray-400">Standing</div>
          </div>
        </div>
      )}

      {/* Party Characters */}
      {partyParticipants.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
            <Users size={18} className="text-purple-400" />
            Party
          </h3>
          <div className="space-y-2">
            {partyParticipants.map(p => (
              <ParticipantSummaryCard
                key={p.instanceId}
                summary={p}
                healingEstimate={p.partyCharacterId ? summary.healingEstimates[p.partyCharacterId] : undefined}
              />
            ))}
          </div>
        </div>
      )}

      {/* Enemies / Others */}
      {otherParticipants.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">
            Enemies & Others
          </h3>
          <div className="space-y-2">
            {otherParticipants.map(p => (
              <ParticipantSummaryCard
                key={p.instanceId}
                summary={p}
              />
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 justify-center pt-4 border-t border-gray-700">
        <button
          onClick={onProceedToLoot}
          className="flex items-center gap-2 px-6 py-3 bg-yellow-600 hover:bg-yellow-700 rounded-lg font-semibold transition-colors"
        >
          Distribute Loot
          <ArrowRight size={18} />
        </button>
        <button
          onClick={onComplete}
          className="px-6 py-3 bg-gray-600 hover:bg-gray-700 rounded-lg transition-colors"
        >
          Skip & Finish
        </button>
      </div>
    </div>
  );
}
