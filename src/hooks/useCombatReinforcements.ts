/**
 * useCombatReinforcements — handles adding reinforcements mid-combat.
 *
 * Extracted from CombatTracker (Phase 11a decomposition).
 * Manages turn order insertion, reveal state for new combatants,
 * and reinforcement logging.
 */

import { useCallback } from 'react';
import { useCombatStore } from './useCombatStore';
import {
  createReinforcementLogEntry,
  generateId,
} from '../utils/combatHelpers';
import { createAddReinforcementsAction } from '../utils/combatActions';
import {
  createDefaultRevealForInstance,
  syncRevealStateForParticipants,
} from '../utils/combatReveal';
import type {
  Participant,
  CombatState,
  RevealState,
  RevealEntry,
  ReinforcementData,
  Character,
} from '../types/combatTracker';

interface ReinforcementDeps {
  combat: CombatState;
  reveal: RevealState | null;
  recordAction: (action: unknown) => void;
}

export interface ReinforcementHandlers {
  handleAddReinforcements: (data: ReinforcementData) => void;
}

function buildAutoTurnOrder(participants: Participant[]): string[] {
  const activeCombatants = participants.filter((p) => p.category !== 'object');
  const sorted = [...activeCombatants].sort((a, b) => {
    if (b.basicSpeed !== a.basicSpeed) return b.basicSpeed - a.basicSpeed;
    if (b.dx !== a.dx) return b.dx - a.dx;
    return a.name.localeCompare(b.name);
  });
  return sorted.map((p) => p.instanceId);
}

function insertAfterIndex(
  order: string[],
  index: number,
  newIds: string[],
): string[] {
  const nextIndex = Math.min(order.length, index + 1);
  return [...order.slice(0, nextIndex), ...newIds, ...order.slice(nextIndex)];
}

export function useCombatReinforcements(
  deps: ReinforcementDeps,
): ReinforcementHandlers {
  const { combatCharacters, saveCombatActive, saveCombatReveal } =
    useCombatStore();
  const { combat, reveal, recordAction } = deps;

  const handleAddReinforcements = useCallback(
    (data: ReinforcementData) => {
      const character = (combatCharacters as unknown as Character[]).find(
        (c) => c.id === data.characterId,
      );
      if (!character) return;

      const nameList = data.previewNames || [];
      const newCombatants: Participant[] = nameList.map((name) => {
        const instanceId = generateId();
        return {
          ...character,
          id: instanceId,
          instanceId,
          libraryId: character.id,
          name,
          category: data.category,
          currentHP: character.hp,
          currentFP: character.fp || 0,
          currentMP: character.mp || 0,
          shockPenalty: 0,
          isStunned: false,
          isUnconscious: false,
          isDead: false,
          bleeding: null,
          crippled: [],
          conditions: [],
        } as any;
      });

      if (newCombatants.length === 0) return;

      const newIds = newCombatants.map((c) => c.instanceId);
      const turnOrderBefore = combat.turnOrder;
      let turnOrderAfter = turnOrderBefore;

      if (data.category !== 'object') {
        switch (data.insertionMode) {
          case 'next_turn':
            turnOrderAfter = insertAfterIndex(
              turnOrderBefore,
              combat.currentTurnIndex,
              newIds,
            );
            break;
          case 'end_of_round':
            turnOrderAfter = [...turnOrderBefore, ...newIds];
            break;
          case 'auto':
            turnOrderAfter = buildAutoTurnOrder([
              ...combat.participants,
              ...newCombatants,
            ]);
            break;
          case 'manual':
            if (Array.isArray(data.manualOrder)) {
              turnOrderAfter = data.manualOrder.map((entry) => {
                if (entry.startsWith('new-')) {
                  const index = Number(entry.replace('new-', ''));
                  return newIds[index];
                }
                return entry;
              });
            }
            break;
          default:
            break;
        }
      }

      const logEntry = createReinforcementLogEntry({
        round: combat.currentRound,
        turn: combat.currentTurnIndex,
        category: data.category,
        displayName: nameList[0] || character.name,
        quantity: newCombatants.length,
        insertionMode: data.insertionMode,
      });

      const revealAdd: Record<string, RevealEntry> = {};
      newCombatants.forEach((combatant) => {
        revealAdd[combatant.instanceId] = createDefaultRevealForInstance(
          combatant.instanceId,
          combatant.category,
          combatant,
        ) as RevealEntry;
      });

      const newCombat: CombatState = {
        ...combat,
        participants: [...combat.participants, ...newCombatants],
        turnOrder: turnOrderAfter,
        log: [...combat.log, logEntry],
      };

      const newReveal = reveal
        ? (syncRevealStateForParticipants(
            {
              ...reveal,
              byInstanceId: { ...reveal.byInstanceId, ...revealAdd },
            },
            newCombat.participants,
          ) as RevealState)
        : reveal;

      saveCombatActive(newCombat);
      if (newReveal) {
        saveCombatReveal(newReveal);
      }

      const action = createAddReinforcementsAction({
        addedCombatants: newCombatants,
        addedInstanceIds: newIds,
        turnOrderBefore,
        turnOrderAfter,
        logEntry,
        revealUpdate: { add: revealAdd },
      });

      recordAction(action);
    },
    [combat, reveal, combatCharacters, recordAction, saveCombatActive, saveCombatReveal],
  );

  return { handleAddReinforcements };
}
