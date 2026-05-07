/**
 * useActionResolution — processes completed combat actions.
 *
 * Extracted from CombatTracker (Phase 11a decomposition).
 * Handles injury effect application (shock, stun, unconscious, death,
 * bleeding, crippling), HP updates, reveal state auto-updates,
 * and non-injury action logging (attack, defense, damage, note).
 */

import { useCallback } from 'react';
import { useCombatStore } from './useCombatStore';
import {
  createActionLogEntry,
  createInjuryLogEntry,
  createEffectLogEntry,
  createNoteLogEntry,
} from '../utils/combatHelpers';
import {
  createSetResourceAction,
  createAddLogEntryAction,
} from '../utils/combatActions';
import { applyEffect } from '../utils/effectsEngine';
import {
  revealDefenseForInstance,
  revealHPAtZero,
  revealNameForInstance,
} from '../utils/combatReveal';
import type {
  Participant,
  CombatState,
  RevealState,
  LogEntry,
  ActionCompleteData,
} from '../types/combatTracker';

interface ActionResolutionDeps {
  combat: CombatState;
  reveal: RevealState | null;
  currentActorInstanceId: string;
  currentActorName: string;
  selectedManeuver: string | null;
  /** Record an action for undo/redo history */
  recordAction: (action: unknown) => void;
}

export interface ActionResolutionHandlers {
  handleActionComplete: (actionData: ActionCompleteData) => void;
}

/**
 * Compares two reveal states for a single instance and returns a diff
 * if they differ, or null if identical.
 */
function buildRevealUpdate(
  previousReveal: RevealState | null,
  nextReveal: RevealState | null,
  instanceId: string | null,
) {
  if (!previousReveal || !nextReveal || !instanceId) return null;
  const previousEntry = previousReveal.byInstanceId?.[instanceId];
  const nextEntry = nextReveal.byInstanceId?.[instanceId];
  if (JSON.stringify(previousEntry) === JSON.stringify(nextEntry)) return null;
  return { set: { [instanceId]: nextEntry } };
}

export function useActionResolution(
  deps: ActionResolutionDeps,
): ActionResolutionHandlers {
  const { saveCombatActive, saveCombatReveal } = useCombatStore();

  const {
    combat,
    reveal,
    currentActorInstanceId,
    currentActorName,
    selectedManeuver,
    recordAction,
  } = deps;

  const handleActionComplete = useCallback(
    (actionData: ActionCompleteData) => {
      const {
        maneuver,
        kind,
        attack,
        defense,
        injury,
        note,
        targetInstanceId,
        newHP,
      } = actionData;

      const target = targetInstanceId
        ? combat.participants.find((p) => p.instanceId === targetInstanceId)
        : null;

      // ----------------------------------------------------------------
      // Injury workflow (Phase 4)
      // ----------------------------------------------------------------
      if (kind === 'injury' && injury && targetInstanceId) {
        const injuryLogEntry = createInjuryLogEntry({
          round: combat.currentRound,
          turn: combat.currentTurnIndex,
          targetInstanceId,
          targetName: (target?.name ?? 'Unknown') as string,
          hitLocation: injury.hitLocation as any,
          damageBreakdown: injury.damageBreakdown as any,
          effects: null,
          currentHP: target?.currentHP ?? null,
          newHP,
        });

        let updatedParticipants = [...combat.participants];
        const logEntries: LogEntry[] = [injuryLogEntry];

        // Apply HP change
        updatedParticipants = updatedParticipants.map((p) =>
          p.instanceId === targetInstanceId
            ? { ...p, currentHP: newHP }
            : p,
        );

        // Apply effects to target
        if (injury.effects && injury.effects.length > 0) {
          for (const effect of injury.effects) {
            if (effect.type === 'shock' && effect.autoApplied) {
              updatedParticipants = updatedParticipants.map((p) =>
                p.instanceId === targetInstanceId
                  ? (applyEffect(p, 'shock', { value: effect.value }) as Participant)
                  : p,
              );
              logEntries.push(
                createEffectLogEntry({
                  round: combat.currentRound,
                  turn: combat.currentTurnIndex,
                  targetInstanceId,
                  targetName: (target?.name ?? 'Unknown') as string,
                  effectType: 'shock',
                  effectData: { value: effect.value },
                  text: `${target?.name ?? 'Unknown'}: Shock penalty ${effect.value} until next turn`,
                }),
              );
            }

            if (effect.type === 'knockdownStun' && effect.success === false) {
              updatedParticipants = updatedParticipants.map((p) =>
                p.instanceId === targetInstanceId
                  ? (applyEffect(p, 'stunned', { stunned: true }) as Participant)
                  : p,
              );
              logEntries.push(
                createEffectLogEntry({
                  round: combat.currentRound,
                  turn: combat.currentTurnIndex,
                  targetInstanceId,
                  targetName: (target?.name ?? 'Unknown') as string,
                  effectType: 'stunned',
                  effectData: { stunned: true },
                  text: `${target?.name ?? 'Unknown'}: Stunned!`,
                }),
              );
            }

            if (
              effect.type === 'consciousnessCheck' &&
              effect.success === false
            ) {
              updatedParticipants = updatedParticipants.map((p) =>
                p.instanceId === targetInstanceId
                  ? (applyEffect(p, 'unconscious', { unconscious: true }) as Participant)
                  : p,
              );
              logEntries.push(
                createEffectLogEntry({
                  round: combat.currentRound,
                  turn: combat.currentTurnIndex,
                  targetInstanceId,
                  targetName: (target?.name ?? 'Unknown') as string,
                  effectType: 'unconscious',
                  effectData: { unconscious: true },
                  text: `${target?.name ?? 'Unknown'}: Unconscious!`,
                }),
              );
            }

            if (
              (effect.type === 'deathCheck' && effect.success === false) ||
              effect.type === 'autoDeath'
            ) {
              updatedParticipants = updatedParticipants.map((p) =>
                p.instanceId === targetInstanceId
                  ? (applyEffect(p, 'dead', { dead: true }) as Participant)
                  : p,
              );
              logEntries.push(
                createEffectLogEntry({
                  round: combat.currentRound,
                  turn: combat.currentTurnIndex,
                  targetInstanceId,
                  targetName: (target?.name ?? 'Unknown') as string,
                  effectType: 'dead',
                  effectData: { dead: true },
                  text: `${target?.name ?? 'Unknown'}: Dead!`,
                }),
              );
            }

            if (effect.type === 'bleeding' && effect.outcome === 'yes') {
              updatedParticipants = updatedParticipants.map((p) =>
                p.instanceId === targetInstanceId
                  ? (applyEffect(p, 'bleeding', {
                      bleeding: true,
                      rate: 1,
                      round: combat.currentRound,
                    }) as Participant)
                  : p,
              );
              logEntries.push(
                createEffectLogEntry({
                  round: combat.currentRound,
                  turn: combat.currentTurnIndex,
                  targetInstanceId,
                  targetName: (target?.name ?? 'Unknown') as string,
                  effectType: 'bleeding',
                  effectData: { rate: 1 },
                  text: `${target?.name ?? 'Unknown'}: Bleeding (1 HP/turn)`,
                }),
              );
            }

            if (effect.type === 'crippling' && effect.autoApplied) {
              updatedParticipants = updatedParticipants.map((p) =>
                p.instanceId === targetInstanceId
                  ? (applyEffect(p, 'crippling', {
                      locationKey: effect.locationKey,
                    }) as Participant)
                  : p,
              );
              logEntries.push(
                createEffectLogEntry({
                  round: combat.currentRound,
                  turn: combat.currentTurnIndex,
                  targetInstanceId,
                  targetName: (target?.name ?? 'Unknown') as string,
                  effectType: 'crippling',
                  effectData: {
                    locationKey: effect.locationKey as any,
                    locationLabel: effect.locationLabel as any,
                  },
                  text: `${target?.name ?? 'Unknown'}: ${(effect.locationLabel as any) ?? 'unknown location'} crippled!`,
                }),
              );
            }
          }
        }

        // Update state
        const newCombat: CombatState = {
          ...combat,
          participants: updatedParticipants,
          log: [...combat.log, ...logEntries],
        };

        saveCombatActive(newCombat);

        // Update reveal state
        let updatedRevealState = reveal;
        if (reveal) {
          updatedRevealState = revealNameForInstance(
            updatedRevealState,
            targetInstanceId,
          ) as RevealState;
          if (newHP !== undefined && newHP <= 0) {
            updatedRevealState = revealHPAtZero(
              updatedRevealState,
              targetInstanceId,
            ) as RevealState;
          }
        }
        const revealUpdate = buildRevealUpdate(
          reveal,
          updatedRevealState,
          targetInstanceId,
        );
        if (revealUpdate) {
          saveCombatReveal(updatedRevealState);
        }

        // Record undo/redo actions
        if (target) {
          const resourceAction = createSetResourceAction(
            targetInstanceId,
            'HP',
            target.currentHP ?? 0,
            newHP ?? 0,
          ) as { type: string; revealUpdate?: unknown };
          if (revealUpdate) {
            resourceAction.revealUpdate = revealUpdate;
          }
          recordAction(resourceAction);
        }
        logEntries.forEach((entry) => {
          recordAction(createAddLogEntryAction(entry));
        });

        return;
      }

      // ----------------------------------------------------------------
      // Note action
      // ----------------------------------------------------------------
      if (kind === 'note' && note) {
        const noteEntry = createNoteLogEntry(
          combat.currentRound,
          combat.currentTurnIndex,
          currentActorInstanceId,
          currentActorName,
          maneuver ? `[${maneuver}] ${note}` : note,
        );

        const newCombat: CombatState = {
          ...combat,
          log: [...combat.log, noteEntry],
        };

        saveCombatActive(newCombat);
        recordAction(createAddLogEntryAction(noteEntry));
        return;
      }

      // ----------------------------------------------------------------
      // Non-injury action (attack, defense, damage)
      // ----------------------------------------------------------------
      const logEntry = createActionLogEntry({
        round: combat.currentRound,
        turn: combat.currentTurnIndex,
        actorInstanceId: currentActorInstanceId,
        actorName: currentActorName,
        targetInstanceId,
        targetName: target?.name ?? undefined,
        maneuver,
        action: { kind, attack: attack as any, defense },
      });

      let newCombat: CombatState = {
        ...combat,
        log: [...combat.log, logEntry],
      };

      // Legacy Phase 3 damage support
      if (
        kind === 'damage' &&
        targetInstanceId &&
        newHP !== undefined &&
        target
      ) {
        const updatedParticipants = combat.participants.map((p) =>
          p.instanceId === targetInstanceId
            ? { ...p, currentHP: newHP }
            : p,
        );
        newCombat = { ...newCombat, participants: updatedParticipants };

        const resourceAction = createSetResourceAction(
          targetInstanceId,
          'HP',
          target.currentHP ?? 0,
          newHP ?? 0,
        );
        recordAction(resourceAction);
      }

      // Reveal state updates for defense and damage
      let updatedRevealState = reveal;
      let revealUpdate = null;

      if (kind === 'defense' && defense?.success && targetInstanceId) {
        const defenseType = defense.type;
        if (
          defenseType === 'dodge' ||
          defenseType === 'parry' ||
          defenseType === 'block'
        ) {
          updatedRevealState = revealDefenseForInstance(
            updatedRevealState,
            targetInstanceId,
            defenseType,
          ) as RevealState;
        }
      }

      if (kind === 'damage' && targetInstanceId && newHP !== undefined) {
        updatedRevealState = revealNameForInstance(
          updatedRevealState,
          targetInstanceId,
        ) as RevealState;
        if (newHP <= 0) {
          updatedRevealState = revealHPAtZero(
            updatedRevealState,
            targetInstanceId,
          ) as RevealState;
        }
      }

      revealUpdate = buildRevealUpdate(
        reveal,
        updatedRevealState,
        targetInstanceId || null,
      );
      if (revealUpdate) {
        saveCombatReveal(updatedRevealState);
      }

      saveCombatActive(newCombat);
      const logAction = createAddLogEntryAction(logEntry) as {
        type: string;
        revealUpdate?: unknown;
      };
      if (revealUpdate) {
        logAction.revealUpdate = revealUpdate;
      }
      recordAction(logAction);
    },
    [
      combat,
      reveal,
      currentActorInstanceId,
      currentActorName,
      selectedManeuver,
      recordAction,
      saveCombatActive,
      saveCombatReveal,
    ],
  );

  return { handleActionComplete };
}
