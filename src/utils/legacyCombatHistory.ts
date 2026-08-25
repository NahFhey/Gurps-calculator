/**
 * Legacy combat-history upgrade (schema 1.5.3).
 *
 * Before the combat tracker rewrite, ended combats were archived as
 * CombatSession records (characterId/team participants, startDate strings).
 * The rewritten tracker archives canonical CombatState snapshots, so
 * persisted history can hold either shape depending on save age. This module
 * upgrades legacy entries to CombatState so `entities.combatHistory` only
 * ever holds one shape at runtime.
 *
 * Used by both migration paths so they stay in lockstep: the flat
 * legacy-key handler migrateTo1_5_3() in src/utils/dataMigrations.ts and
 * the hydrate-time ensureCombatHistoryShape() in
 * src/persistence/dataMigration.ts.
 */

import type { CombatSession } from '../types/campaign';
import type { CombatState, LogEntry, Participant } from '../types/combatTracker';

/**
 * Modern entries always carry the tracker's numeric `startTime`; legacy
 * records instead stored a `startDate` string.
 */
export function isLegacyCombatSession(entry: unknown): entry is CombatSession {
  if (!entry || typeof entry !== 'object') return false;
  const record = entry as Record<string, unknown>;
  return typeof record.startTime !== 'number' && typeof record.startDate === 'string';
}

const parseDate = (value: string | undefined): number | undefined => {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
};

/**
 * Upgrade one legacy CombatSession to a frozen CombatState snapshot.
 *
 * Legacy records only stored the library character id per participant, so it
 * doubles as instanceId/libraryId/name (CharacterLibrary's tombstone
 * reference check matches on libraryId/id). Attributes the old shape never
 * captured (ST/DX/IQ/HT, speed, move) get GURPS baselines — history is a
 * frozen display record, nothing recomputes from these.
 */
export function legacyCombatSessionToCombatState(session: CombatSession): CombatState {
  const participants: Participant[] = (session.participants ?? []).map((p) => ({
    instanceId: p.characterId,
    id: p.characterId,
    libraryId: p.characterId,
    name: p.characterId,
    category: p.team,
    st: 10,
    dx: 10,
    iq: 10,
    ht: 10,
    hp: p.currentHP,
    fp: p.currentFP ?? 0,
    mp: 0,
    currentHP: p.currentHP,
    currentFP: p.currentFP,
    basicSpeed: 5,
    basicMove: 5,
    isDead: p.status === 'dead',
  }));

  const startTime = parseDate(session.startDate) ?? 0;
  const endTime = parseDate(session.endDate);

  const log: LogEntry[] = (session.log ?? []).map((entry) => ({
    timestamp: entry.timestamp,
    round: entry.round,
    turn: entry.turn,
    entryType: 'note',
    text: entry.action,
    message: entry.action,
  }));

  if (session.outcome) {
    const outcomeText = `Outcome: ${session.outcome}`;
    log.push({
      timestamp: endTime ?? startTime,
      entryType: 'note',
      text: outcomeText,
      message: outcomeText,
    });
  }

  return {
    id: session.id,
    name: session.name,
    startTime,
    endTime,
    participants,
    turnOrder: participants.map((p) => p.instanceId),
    currentTurnIndex: session.currentTurn ?? 0,
    currentRound: session.currentRound ?? 1,
    turnDecisions: {},
    log,
  };
}

/**
 * Upgrade a persisted history array. Modern CombatState entries pass through
 * untouched (idempotent); non-object garbage is dropped.
 */
export function upgradeCombatHistory(history: unknown): CombatState[] {
  if (!Array.isArray(history)) return [];
  return (history as unknown[])
    .filter((entry) => !!entry && typeof entry === 'object')
    .map((entry) =>
      isLegacyCombatSession(entry) ? legacyCombatSessionToCombatState(entry) : (entry as CombatState)
    );
}
