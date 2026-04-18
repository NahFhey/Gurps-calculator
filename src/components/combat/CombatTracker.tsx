import { useState, useEffect, useCallback } from 'react';
import { useCombatStore } from '../../hooks/useCombatStore';
import { useCombatHistory } from '../../hooks/useCombatHistory';
import { useCombatTurn } from '../../hooks/useCombatTurn';
import { ConfirmDialog, useConfirmDialog, useToast } from '../ui';
import { exportCombatLog, createNoteLogEntry, createRollLogEntry, createActionLogEntry, createInjuryLogEntry, createEffectLogEntry, createManeuverLogEntry, createReinforcementLogEntry, generateId, exportActiveCombat, parseImportedCombat, exportCombatPlayerView, exportCombatGMLocked, importCombatWithGMLock } from '../../utils/combatHelpers';
import { MAX_COMBAT_HISTORY } from '../../constants';
import { roll, rollVsTarget } from '../../utils/dice';
import type { RollResult as RollResultHelper } from '../../utils/combatHelpers';
import { createSetResourceAction, createAddLogEntryAction, createAddReinforcementsAction } from '../../utils/combatActions';
import { createHistoryState } from '../../utils/combatHistory';
import { validateCombatState, validateCombatExport, validateCombatImport } from '../../utils/combatValidation';
import { applyEffect } from '../../utils/effectsEngine';
import { getCombatView, ViewMode } from '../../utils/combatViewFilter';
import {
  createDefaultRevealForInstance,
  createInitialRevealState,
  revealDefenseForInstance,
  revealHPAtZero,
  revealNameForInstance,
  syncRevealStateForParticipants
} from '../../utils/combatReveal';
import { filterLogForPlayerView } from '../../utils/combatLogFilter';
import { ManeuverCatalog } from '../../constants/maneuvers';
import { deriveTurnContext } from '../../utils/turnContext';
import { filterManeuvers } from '../../utils/maneuverFilter';
import ActionPanel from './ActionPanel';
import ViewModeToggle from './ViewModeToggle';
import RevealPanel from './RevealPanel';
import ManeuverSelector from './ManeuverSelector';
import ReinforcementsModal from './ReinforcementsModal';
import {
  CombatHeaderView,
  TurnControlsView,
  DicePanelView,
  ParticipantListView,
  CombatLogView
} from './views';
import type {
  Participant,
  LogEntry,
  RollData,
  CombatState,
  TurnDecision,
  HistoryState,
  RevealState,
  RevealEntry,
  Maneuver,
  TurnContext,
  ReinforcementData,
  ActionCompleteData
} from '../../types/combatTracker';

// ============================================================================
// CombatTracker Component
// ============================================================================

/**
 * Combat Tracker Component - Phase 3
 * Active combat management with turn tracking, resource management, logging, dice tools, undo/redo, and action assist
 */
export default function CombatTracker() {
  const {
    combatCharacters,
    combatActive,
    saveCombatActive,
    combatHistory,
    saveCombatHistory,
    combatRulesPreset,
    combatReveal,
    saveCombatReveal
  } = useCombatStore();

  // TODO: Remove these stubs after completing combat state migration
  // These are legacy variables that were removed but still referenced
  const combatActiveHistory: HistoryState | null = null;
  const saveCombatActiveHistory = useCallback((_history: HistoryState | null) => {
    console.warn('saveCombatActiveHistory: not implemented - history is managed internally');
  }, []);

  const [noteText, setNoteText] = useState('');
  const [diceExpression, setDiceExpression] = useState('3d6');
  const [rollTarget, setRollTarget] = useState('');
  const [showDicePanel, setShowDicePanel] = useState(false);
  const [showActionPanel, setShowActionPanel] = useState(true);
  const [showReinforcementsModal, setShowReinforcementsModal] = useState(false);

  // Phase 5: View mode and GM mode (session-only state)
  const [viewMode, setViewMode] = useState(ViewMode.PLAYER);
  const [gmMode, setGmMode] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Toast notifications
  const { error: showError } = useToast();

  // Confirm dialogs
  const endCombatDialog = useConfirmDialog({
    title: 'End Combat Session',
    message: 'Are you sure you want to end this combat session? The session will be saved to history.',
    confirmLabel: 'End Combat',
    variant: 'warning',
  });

  const loadCombatDialog = useConfirmDialog({
    title: 'Load Combat',
    message: 'Load this combat? Current combat will be replaced.',
    confirmLabel: 'Load',
    variant: 'warning',
  });

  const combat = combatActive as CombatState | null;
  const history: HistoryState = createHistoryState() as HistoryState;
  const reveal = combatReveal as RevealState | null;
  const currentActorInstanceId = combat?.turnOrder?.[combat.currentTurnIndex] || null;
  const currentActorTruth = combat?.participants.find(p => p.instanceId === currentActorInstanceId);

  // Migrate Phase 1 combat on load if needed
  useEffect(() => {
    if (combat && !combat.version) {
      // Phase 1 detected, migrate
      const migrated = validateCombatState(combat) as { valid: boolean; combat: CombatState };
      if (migrated.valid) {
        saveCombatActive(migrated.combat);

        // Create empty history if none exists
        if (!combatActiveHistory) {
          saveCombatActiveHistory(createHistoryState() as unknown as HistoryState);
        }
      }
    }
  }, [combat, combatActiveHistory, saveCombatActive, saveCombatActiveHistory]);

  // Phase 5: Force Player View when GM Mode locks
  useEffect(() => {
    if (!gmMode && viewMode === ViewMode.GM) {
      setViewMode(ViewMode.PLAYER);
    }
  }, [gmMode, viewMode]);

  // Phase 5: Initialize reveal state if missing
  useEffect(() => {
    if (combat && !reveal) {
      const initialReveal = createInitialRevealState(
        combat.id,
        combat.participants
      ) as RevealState | null;
      if (initialReveal) {
        saveCombatReveal(initialReveal);
      }
    }
  }, [combat, reveal, saveCombatReveal]);

  const {
    turnDecisionKey,
    turnDecisions,
    currentTurnDecision,
    recordAction,
    handleUndo,
    handleRedo,
    updateTurnDecisionState,
  } = useCombatHistory({
    combat,
    history,
    reveal,
    currentActorInstanceId,
    saveCombatActive,
    saveCombatActiveHistory,
    saveCombatReveal,
  });

  const {
    handleNextTurn,
    handlePrevTurn,
    updateResource,
    handleAddCondition,
    handleRemoveCondition,
    handleUpdateCondition,
  } = useCombatTurn({
    combat,
    currentActorTruth,
    recordAction,
    saveCombatActive,
  });

  if (!combat) {
    return <div className="text-center text-gray-400 py-8">No active combat</div>;
  }

  // Ensure combat has required properties
  if (!combat.participants || !combat.turnOrder) {
    return <div className="text-center text-gray-400 py-8">Invalid combat state - missing participants or turn order</div>;
  }
  // Use defensive fallback for log
  const combatLog = combat.log || [];

  // Phase 5: Compute view model (filters based on reveal state + view mode)
  const combatView = getCombatView(combat, (reveal || undefined) as any, viewMode) as { participants: Participant[] };

  // Phase 5: Filter log for Player View
  const displayLog = viewMode === ViewMode.PLAYER && reveal
    ? filterLogForPlayerView(combatLog, reveal as RevealState, combat) as LogEntry[]
    : combatLog;
  // Use combatView for display (respects reveal state)
  const currentActor = combatView.participants.find(p => p.instanceId === currentActorInstanceId);
  const turnContext = deriveTurnContext(currentActorTruth as any) as TurnContext;
  const availableManeuvers = filterManeuvers(ManeuverCatalog as Maneuver[], turnContext, (combatRulesPreset as string) || 'standard') as Maneuver[];
  const selectedManeuverId = currentTurnDecision?.maneuverId || null;
  const selectedManeuver = (ManeuverCatalog as Maneuver[]).find(m => m.id === selectedManeuverId) || null;
  const maneuverSelection = selectedManeuver
    ? { selectedId: selectedManeuverId, prompts: selectedManeuver.prompts || {}, workflow: selectedManeuver.workflow || {} }
    : { selectedId: null, prompts: {}, workflow: {} };

  const isEnemyInPlayerView = viewMode === ViewMode.PLAYER && currentActor?.category === 'enemy';

  // ============================================================================
  // Action Helpers
  // ============================================================================

  const buildRevealUpdate = (previousReveal: RevealState | null, nextReveal: RevealState | null, instanceId: string | null) => {
    if (!previousReveal || !nextReveal || !instanceId) return null;
    const previousEntry = previousReveal.byInstanceId?.[instanceId];
    const nextEntry = nextReveal.byInstanceId?.[instanceId];
    if (JSON.stringify(previousEntry) === JSON.stringify(nextEntry)) {
      return null;
    }
    return { set: { [instanceId]: nextEntry } };
  };

  const buildAutoTurnOrder = (participants: Participant[]): string[] => {
    const activeCombatants = participants.filter(p => p.category !== 'object');
    const sorted = [...activeCombatants].sort((a, b) => {
      if (b.basicSpeed !== a.basicSpeed) return b.basicSpeed - a.basicSpeed;
      if (b.dx !== a.dx) return b.dx - a.dx;
      return a.name.localeCompare(b.name);
    });
    return sorted.map(p => p.instanceId);
  };

  const insertAfterIndex = (order: string[], index: number, newIds: string[]): string[] => {
    const nextIndex = Math.min(order.length, index + 1);
    return [...order.slice(0, nextIndex), ...newIds, ...order.slice(nextIndex)];
  };

  // ============================================================================
  // Phase 7: Maneuver Selection
  // ============================================================================

  const handleSelectManeuver = (maneuverId: string | null) => {
    if (!currentActorTruth || !turnDecisionKey) return;

    const previousDecision = turnDecisions[turnDecisionKey] || null;
    const nextDecision: TurnDecision = {
      ...(previousDecision || {}),
      maneuverId: maneuverId || undefined
    };

    updateTurnDecisionState(previousDecision, nextDecision);

    if (!maneuverId) return;

    const maneuverLabel = (ManeuverCatalog as Maneuver[]).find(m => m.id === maneuverId)?.label || maneuverId;
    const logEntry = createManeuverLogEntry({
      round: combat.currentRound,
      turn: combat.currentTurnIndex,
      actorInstanceId: currentActorTruth.instanceId,
      actorName: currentActorTruth.name,
      maneuverId,
      maneuverLabel,
      aim: nextDecision.aim || null,
      wait: nextDecision.wait || null,
      constraints: {
        isStunned: turnContext.isStunned,
        isProne: turnContext.isProne,
        isGrappled: turnContext.isGrappled,
        isUnconscious: turnContext.isUnconscious,
        shockPenalty: turnContext.shockPenalty
      }
    });

    saveCombatActive((prev: CombatState) => ({
      ...prev,
      log: [...prev.log, logEntry]
    }));

    recordAction(createAddLogEntryAction(logEntry));
  };

  const handleManeuverWorkflowUpdate = (update: { type: string; targetInstanceId?: string; turnsAimed?: number; triggerText?: string }) => {
    if (!currentActorTruth || !turnDecisionKey) return;

    const previousDecision = turnDecisions[turnDecisionKey] || null;
    const nextDecision: TurnDecision = {
      ...(previousDecision || {})
    };

    if (update.type === 'aim') {
      nextDecision.aim = {
        ...(nextDecision.aim || {}),
        ...(update.targetInstanceId !== undefined ? { targetInstanceId: update.targetInstanceId } : {}),
        ...(update.turnsAimed !== undefined ? { turnsAimed: update.turnsAimed } : {})
      };
    }

    if (update.type === 'wait') {
      nextDecision.wait = {
        ...(nextDecision.wait || {}),
        ...(update.triggerText !== undefined ? { triggerText: update.triggerText } : {})
      };
    }

    updateTurnDecisionState(previousDecision, nextDecision);
  };

  // ============================================================================
  // Phase 8: Reinforcements
  // ============================================================================

  const handleAddReinforcements = (data: ReinforcementData) => {
    const character = combatCharacters.find((c: any) => c.id === data.characterId);
    if (!character) return;

    const nameList = data.previewNames || [];
    const newCombatants: Participant[] = nameList.map((name) => {
      const instanceId = generateId();
      return {
        instanceId,
        id: character.id,
        libraryId: character.id,
        name,
        category: data.category,
        st: character.st,
        dx: character.dx,
        iq: character.iq,
        ht: character.ht,
        hp: character.hp,
        fp: character.fp || 0,
        mp: 0, // CombatCharacter doesn't have mp, default to 0
        basicSpeed: 5, // Default value, could be calculated from HT and ST
        basicMove: 5, // Default value
        dodge: character.dodge,
        parry: character.parry,
        block: character.block,
        dr: character.dr,
        currentHP: character.hp,
        currentFP: character.fp || 0,
        currentMP: 0,
        shockPenalty: 0,
        isStunned: false,
        isUnconscious: false,
        isDead: false,
        bleeding: null,
        crippled: [],
        conditions: []
      };
    });

    if (newCombatants.length === 0) {
      return;
    }

    const newIds = newCombatants.map(c => c.instanceId);
    const turnOrderBefore = combat.turnOrder;
    let turnOrderAfter = turnOrderBefore;

    if (data.category !== 'object') {
      switch (data.insertionMode) {
        case 'next_turn':
          turnOrderAfter = insertAfterIndex(turnOrderBefore, combat.currentTurnIndex, newIds);
          break;
        case 'end_of_round':
          turnOrderAfter = [...turnOrderBefore, ...newIds];
          break;
        case 'auto':
          turnOrderAfter = buildAutoTurnOrder([...combat.participants, ...newCombatants]);
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
      insertionMode: data.insertionMode
    });

    const revealAdd: Record<string, RevealEntry> = {};
    newCombatants.forEach((combatant) => {
      revealAdd[combatant.instanceId] = createDefaultRevealForInstance(
        combatant.instanceId,
        combatant.category,
        combatant
      ) as RevealEntry;
    });

    const newCombat: CombatState = {
      ...combat,
      participants: [...combat.participants, ...newCombatants],
      turnOrder: turnOrderAfter,
      log: [...combat.log, logEntry]
    };

    const newReveal = reveal
      ? (syncRevealStateForParticipants(
        { ...reveal, byInstanceId: { ...reveal.byInstanceId, ...revealAdd } },
        newCombat.participants
      ) as RevealState)
      : null;

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
      revealUpdate: { add: revealAdd }
    });

    recordAction(action);
    setShowReinforcementsModal(false);
  };

  // ============================================================================
  // Dice Rolling
  // ============================================================================

  const handleRoll = () => {
    if (!diceExpression.trim()) return;

    let rollResult: RollData;
    if (rollTarget && rollTarget.trim()) {
      const target = parseInt(rollTarget);
      if (isNaN(target)) {
        alert('Invalid target number');
        return;
      }
      rollResult = rollVsTarget(diceExpression, target) as RollData;
    } else {
      rollResult = roll(diceExpression) as RollData;
    }

    if (!rollResult.valid) {
      alert(`Roll error: ${rollResult.error}`);
      return;
    }

    // Create roll log entry
    const logEntry = createRollLogEntry(
      combat.currentRound,
      combat.currentTurnIndex,
      currentActorInstanceId || 'unknown',
      currentActor?.name || 'Unknown',
      rollResult as RollResultHelper
    );

    const action = createAddLogEntryAction(logEntry);

    // Update state
    saveCombatActive((prev: CombatState) => ({
      ...prev,
      log: [...prev.log, logEntry]
    }));

    recordAction(action);
  };

  // ============================================================================
  // Notes
  // ============================================================================

  const handleAddNote = () => {
    if (!noteText.trim()) return;

    const logEntry = createNoteLogEntry(
      combat.currentRound,
      combat.currentTurnIndex,
      currentActorInstanceId || null,
      currentActor?.name || null,
      noteText
    );

    const action = createAddLogEntryAction(logEntry);

    // Update state
    saveCombatActive((prev: CombatState) => ({
      ...prev,
      log: [...prev.log, logEntry]
    }));

    recordAction(action);
    setNoteText('');
  };

  // ============================================================================
  // Phase 3: Action Panel Handlers
  // ============================================================================

  const handleActionComplete = (actionData: ActionCompleteData) => {
    const { maneuver, kind, attack, defense, injury, note, targetInstanceId, newHP } = actionData;

    // Get target if applicable
    const target = targetInstanceId
      ? combat.participants.find(p => p.instanceId === targetInstanceId)
      : null;

    // Handle Phase 4 injury workflow
    if (kind === 'injury' && injury && targetInstanceId) {
      // Create injury log entry
      const injuryLogEntry = createInjuryLogEntry({
        round: combat.currentRound,
        turn: combat.currentTurnIndex,
        targetInstanceId,
        targetName: target?.name || 'Unknown',
        hitLocation: (injury.hitLocation || null) as { locationLabel?: string; locationKey?: string } | null | undefined,
        damageBreakdown: (injury.damageBreakdown || { injuryApplied: 0 }) as any,
        effects: null, // Will add effect logs separately
        currentHP: target?.currentHP ?? null,
        newHP
      });

      let updatedParticipants = [...combat.participants];
      const logEntries: LogEntry[] = [injuryLogEntry];

      // Apply HP change
      updatedParticipants = updatedParticipants.map(p =>
        p.instanceId === targetInstanceId
          ? { ...p, currentHP: newHP }
          : p
      );

      // Apply effects to target
      if (injury.effects && injury.effects.length > 0) {
        injury.effects.forEach(effect => {
          const targetName = target?.name || 'Unknown';
          // Apply shock
          if (effect.type === 'shock' && effect.autoApplied) {
            updatedParticipants = updatedParticipants.map(p =>
              p.instanceId === targetInstanceId
                ? applyEffect(p, 'shock', { value: effect.value }) as Participant
                : p
            );

            logEntries.push(createEffectLogEntry({
              round: combat.currentRound,
              turn: combat.currentTurnIndex,
              targetInstanceId,
              targetName,
              effectType: 'shock',
              effectData: { value: effect.value || 0 },
              text: `${targetName}: Shock penalty ${effect.value || 0} until next turn`
            }));
          }

          // Apply stun
          if (effect.type === 'knockdownStun' && effect.success === false) {
            updatedParticipants = updatedParticipants.map(p =>
              p.instanceId === targetInstanceId
                ? applyEffect(p, 'stunned', { stunned: true }) as Participant
                : p
            );

            logEntries.push(createEffectLogEntry({
              round: combat.currentRound,
              turn: combat.currentTurnIndex,
              targetInstanceId,
              targetName,
              effectType: 'stunned',
              effectData: { stunned: true },
              text: `${targetName}: Stunned!`
            }));
          }

          // Apply unconsciousness
          if (effect.type === 'consciousnessCheck' && effect.success === false) {
            updatedParticipants = updatedParticipants.map(p =>
              p.instanceId === targetInstanceId
                ? applyEffect(p, 'unconscious', { unconscious: true }) as Participant
                : p
            );

            logEntries.push(createEffectLogEntry({
              round: combat.currentRound,
              turn: combat.currentTurnIndex,
              targetInstanceId,
              targetName,
              effectType: 'unconscious',
              effectData: { unconscious: true },
              text: `${targetName}: Unconscious!`
            }));
          }

          // Apply death
          if ((effect.type === 'deathCheck' && effect.success === false) || effect.type === 'autoDeath') {
            updatedParticipants = updatedParticipants.map(p =>
              p.instanceId === targetInstanceId
                ? applyEffect(p, 'dead', { dead: true }) as Participant
                : p
            );

            logEntries.push(createEffectLogEntry({
              round: combat.currentRound,
              turn: combat.currentTurnIndex,
              targetInstanceId,
              targetName,
              effectType: 'dead',
              effectData: { dead: true },
              text: `${targetName}: Dead!`
            }));
          }

          // Apply bleeding
          if (effect.type === 'bleeding' && effect.outcome === 'yes') {
            updatedParticipants = updatedParticipants.map(p =>
              p.instanceId === targetInstanceId
                ? applyEffect(p, 'bleeding', { bleeding: true, rate: 1, round: combat.currentRound }) as Participant
                : p
            );

            logEntries.push(createEffectLogEntry({
              round: combat.currentRound,
              turn: combat.currentTurnIndex,
              targetInstanceId,
              targetName,
              effectType: 'bleeding',
              effectData: { rate: 1 },
              text: `${targetName}: Bleeding (1 HP/turn)`
            }));
          }

          // Apply crippling
          if (effect.type === 'crippling' && effect.autoApplied) {
            updatedParticipants = updatedParticipants.map(p =>
              p.instanceId === targetInstanceId
                ? applyEffect(p, 'crippling', { locationKey: effect.locationKey }) as Participant
                : p
            );

            logEntries.push(createEffectLogEntry({
              round: combat.currentRound,
              turn: combat.currentTurnIndex,
              targetInstanceId,
              targetName,
              effectType: 'crippling',
              effectData: { locationKey: effect.locationKey || '', locationLabel: effect.locationLabel },
              text: `${targetName}: ${effect.locationLabel} crippled!`
            }));
          }
        });
      }

      // Update state
      const newCombat: CombatState = {
        ...combat,
        participants: updatedParticipants,
        log: [...combat.log, ...logEntries]
      };

      saveCombatActive(newCombat);

      let updatedRevealState = reveal;
      if (reveal) {
        updatedRevealState = revealNameForInstance(updatedRevealState, targetInstanceId) as RevealState;
        if (newHP !== undefined && newHP <= 0) {
          updatedRevealState = revealHPAtZero(updatedRevealState, targetInstanceId) as RevealState;
        }
      }
      const revealUpdate = buildRevealUpdate(reveal, updatedRevealState, targetInstanceId);
      if (revealUpdate) {
        saveCombatReveal(updatedRevealState);
      }

      // Record resource change action
      if (target) {
        const resourceAction = createSetResourceAction(
          targetInstanceId,
          'HP',
          target.currentHP || 0,
          newHP || 0
        ) as { type: string; revealUpdate?: unknown };
        if (revealUpdate) {
          resourceAction.revealUpdate = revealUpdate;
        }
        recordAction(resourceAction);
      }

      // Record log actions
      logEntries.forEach(entry => {
        recordAction(createAddLogEntryAction(entry));
      });

      return;
    }

    // Create action log entry (for non-injury actions)
    const logEntry = createActionLogEntry({
      round: combat.currentRound,
      turn: combat.currentTurnIndex,
      actorInstanceId: currentActorInstanceId || 'unknown',
      actorName: currentActor?.name || 'Unknown',
      targetInstanceId: targetInstanceId || null,
      targetName: target?.name || null,
      maneuver: maneuver || null,
      action: { kind, attack: attack as any, defense }
    });

    // Update state with log
    let newCombat: CombatState = {
      ...combat,
      log: [...combat.log, logEntry]
    };

    // If damage was applied, also update target HP (legacy Phase 3 support)
    if (kind === 'damage' && targetInstanceId && newHP !== undefined && target) {
      const updatedParticipants = combat.participants.map(p =>
        p.instanceId === targetInstanceId
          ? { ...p, currentHP: newHP }
          : p
      );

      newCombat = {
        ...newCombat,
        participants: updatedParticipants
      };

      // Record resource change action
      const resourceAction = createSetResourceAction(
        targetInstanceId,
        'HP',
        target.currentHP || 0,
        newHP || 0
      );
      recordAction(resourceAction);
    }

    // If it's just a note action, create a simpler note entry instead
    if (kind === 'note' && note) {
      const noteEntry = createNoteLogEntry(
        combat.currentRound,
        combat.currentTurnIndex,
        currentActorInstanceId || null,
        currentActor?.name || null,
        maneuver ? `[${maneuver}] ${note}` : note
      );

      newCombat = {
        ...combat,
        log: [...combat.log, noteEntry]
      };

      const noteAction = createAddLogEntryAction(noteEntry);
      saveCombatActive(newCombat);
      recordAction(noteAction);
      return;
    }

    let updatedRevealState = reveal;
    let revealUpdate = null;

    if (kind === 'defense' && defense?.success && targetInstanceId) {
      const defenseType = defense.type;
      if (defenseType === 'dodge' || defenseType === 'parry' || defenseType === 'block') {
        updatedRevealState = revealDefenseForInstance(updatedRevealState, targetInstanceId, defenseType) as RevealState;
      }
    }

    if (kind === 'damage' && targetInstanceId && newHP !== undefined) {
      updatedRevealState = revealNameForInstance(updatedRevealState, targetInstanceId) as RevealState;
      if (newHP <= 0) {
        updatedRevealState = revealHPAtZero(updatedRevealState, targetInstanceId) as RevealState;
      }
    }

    revealUpdate = buildRevealUpdate(reveal, updatedRevealState, targetInstanceId || null);
    if (revealUpdate) {
      saveCombatReveal(updatedRevealState);
    }

    // Save state and record action
    saveCombatActive(newCombat);
    const logAction = createAddLogEntryAction(logEntry) as { type: string; revealUpdate?: unknown };
    if (revealUpdate) {
      logAction.revealUpdate = revealUpdate;
    }
    recordAction(logAction);
  };

  // ============================================================================
  // Combat End
  // ============================================================================

  const handleEndCombat = async () => {
    const confirmed = await endCombatDialog.confirm();
    if (!confirmed) return;

    const endLogEntry = createNoteLogEntry(
      combat.currentRound,
      combat.currentTurnIndex,
      null,
      null,
      'Combat ended'
    );

    const endedCombat: CombatState = {
      ...combat,
      endTime: Date.now(),
      log: [...combat.log, endLogEntry]
    };

    // Add to history (cap at MAX_COMBAT_HISTORY)
    const newHistory = [endedCombat as unknown as any, ...(combatHistory || [])].slice(0, MAX_COMBAT_HISTORY);
    saveCombatHistory(newHistory as any);

    // Clear active combat
    saveCombatActive(null);
    saveCombatActiveHistory(null);
  };

  // ============================================================================
  // Export/Import
  // ============================================================================

  const handleExportLog = () => {
    // Phase 5: Export filtered log if in Player View
    const text = exportCombatLog(displayLog, {
      name: combat.name,
      date: combat.startTime
    });

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `combat-log-${combat.name}-${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Phase 5: Export Player View (unencrypted, filtered)
  const handleExportPlayerView = () => {
    if (!reveal) {
      showError('Reveal state not initialized. Cannot export player view.');
      return;
    }

    const json = exportCombatPlayerView(combat, reveal, history);

    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `combat-player-view-${combat.name}-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Phase 5: Export GM Locked (encrypted)
  const handleExportGMLocked = async () => {
    if (!reveal) {
      showError('Reveal state not initialized. Cannot export GM locked combat.');
      return;
    }

    const password = window.prompt(
      'Enter GM password to encrypt combat data:\n\n' +
      'This password will be required to unlock the full combat state.\n' +
      'Players can view the filtered version without the password.'
    );

    if (!password) {
      return; // User cancelled
    }

    try {
      const json = await exportCombatGMLocked(combat, reveal, history, password);

      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `combat-gm-locked-${combat.name}-${Date.now()}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      showError(`Export failed: ${(error as Error).message}`);
    }
  };

  // Legacy: Export full combat (Phase 2 format, unencrypted)
  const handleSaveCombat = () => {
    const validation = validateCombatExport(combat, history) as { valid: boolean; errors: string[] };
    if (!validation.valid) {
      showError(`Cannot export: ${validation.errors.join(', ')}`);
      return;
    }

    const json = exportActiveCombat(combat, history);

    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `combat-save-${combat.name}-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleLoadCombat = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        const jsonString = event.target?.result as string;

        // Try Phase 5 import first
        let parsed = await importCombatWithGMLock(jsonString) as {
          valid: boolean;
          isLocked?: boolean;
          error?: string;
          data?: { combatState: CombatState; history?: HistoryState; revealState?: RevealState };
        };

        // Fallback to legacy import if Phase 5 fails
        if (!parsed.valid && !parsed.isLocked) {
          parsed = parseImportedCombat(jsonString) as typeof parsed;
          if (parsed.valid && parsed.data) {
            // Legacy format
            const validation = validateCombatImport(parsed.data) as {
              valid: boolean;
              errors: string[];
              combatState: CombatState;
              historyState: HistoryState;
            };
            if (!validation.valid) {
              showError(`Validation error: ${validation.errors.join(', ')}`);
              return;
            }

            const confirmed = await loadCombatDialog.confirm();
            if (!confirmed) {
              return;
            }

            saveCombatActive(validation.combatState);
            saveCombatActiveHistory(validation.historyState);
            return;
          }
        }

        if (!parsed.valid && !parsed.isLocked) {
          showError(`Import error: ${parsed.error}`);
          return;
        }

        // Handle GM-locked import
        if (parsed.isLocked) {
          const password = window.prompt(
            'This combat is GM-locked. Enter password to unlock full state.\n\n' +
            '(Cancel to load player view only)'
          );

          if (password) {
            // Try unlocking
            const unlocked = await importCombatWithGMLock(jsonString, password) as typeof parsed;

            if (!unlocked.valid) {
              showError(`Failed to unlock: ${unlocked.error}. Loading player view instead.`);
              // Fall through to load player view
            } else if (unlocked.data) {
              // Successfully unlocked
              const confirmed = await loadCombatDialog.confirm();
              if (!confirmed) {
                return;
              }

              saveCombatActive(unlocked.data.combatState);
              saveCombatActiveHistory((unlocked.data.history as unknown as HistoryState) || null);
              saveCombatReveal(unlocked.data.revealState || null);
              return;
            }
          }

          // Load player view (locked or failed unlock)
          const confirmed = await loadCombatDialog.confirm();
          if (!confirmed) {
            return;
          }

          if (parsed.data) {
            saveCombatActive(parsed.data.combatState);
            saveCombatActiveHistory(null); // No history in player view
            saveCombatReveal(parsed.data.revealState || null);
          }
          return;
        }

        // Phase 5 format, not locked
        const confirmed = await loadCombatDialog.confirm();
        if (!confirmed) {
          return;
        }

        if (parsed.data) {
          saveCombatActive(parsed.data.combatState);
          saveCombatActiveHistory((parsed.data.history as unknown as HistoryState) || null);
          saveCombatReveal(parsed.data.revealState || null);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <CombatHeaderView
        combat={combat}
        history={history}
        viewMode={viewMode}
        gmMode={gmMode}
        showExportMenu={showExportMenu}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onShowReinforcements={() => setShowReinforcementsModal(true)}
        onToggleExportMenu={() => setShowExportMenu(!showExportMenu)}
        onExportPlayerView={handleExportPlayerView}
        onExportGMLocked={handleExportGMLocked}
        onSaveCombat={handleSaveCombat}
        onExportLog={handleExportLog}
        onLoadCombat={handleLoadCombat}
        onEndCombat={handleEndCombat}
      />

      {/* View Mode Toggle */}
      <ViewModeToggle
        viewMode={viewMode}
        setViewMode={setViewMode}
        gmMode={gmMode}
        setGmMode={setGmMode}
      />

      {/* Current Turn */}
      <TurnControlsView
        currentActor={currentActor}
        combat={combat}
        onPrevTurn={handlePrevTurn}
        onNextTurn={handleNextTurn}
      />

      {/* Maneuver Selection */}
      {!isEnemyInPlayerView ? (
        <ManeuverSelector
          maneuvers={availableManeuvers}
          selectedId={selectedManeuverId}
          onSelect={handleSelectManeuver}
          disabledReason={turnContext.isUnconscious ? 'Unconscious' : undefined}
        />
      ) : (
        <div className="bg-gray-800 rounded-lg p-4 text-sm text-gray-400">
          Enemy maneuver selection hidden in Player View.
        </div>
      )}

      {/* Action Panel */}
      <ActionPanel
        currentActor={currentActor as any}
        participants={combatView.participants as any}
        combatState={combat}
        revealState={reveal}
        viewMode={viewMode}
        onActionComplete={handleActionComplete as any}
        combatRulesPreset={(combatRulesPreset as string) || 'standard'}
        expanded={showActionPanel}
        onToggleExpanded={() => setShowActionPanel(!showActionPanel)}
        maneuverSelection={isEnemyInPlayerView ? { selectedId: null, prompts: {}, workflow: {} } : maneuverSelection as any}
        onManeuverWorkflow={handleManeuverWorkflowUpdate}
        turnDecision={isEnemyInPlayerView ? null : currentTurnDecision}
        currentRound={combat.currentRound}
        currentTurn={combat.currentTurnIndex}
        onAddCondition={handleAddCondition}
        onRemoveCondition={handleRemoveCondition}
        onUpdateCondition={handleUpdateCondition}
      />

      {/* Reinforcements Modal */}
      {showReinforcementsModal && (
        <ReinforcementsModal
          onClose={() => setShowReinforcementsModal(false)}
          onConfirm={handleAddReinforcements as any}
          combatCharacters={combatCharacters as any}
          participants={combat.participants}
          turnOrder={combat.turnOrder}
          currentActorInstanceId={currentActorInstanceId || null}
        />
      )}

      {/* Reveal Panel (GM View only) */}
      {viewMode === ViewMode.GM && (
        <RevealPanel
          combatActive={combat as any}
          combatReveal={reveal as any}
          saveCombatReveal={saveCombatReveal as any}
          viewMode={viewMode}
        />
      )}

      {/* Dice Panel */}
      <DicePanelView
        showDicePanel={showDicePanel}
        diceExpression={diceExpression}
        rollTarget={rollTarget}
        onToggleDicePanel={() => setShowDicePanel(!showDicePanel)}
        onSetDiceExpression={setDiceExpression}
        onSetRollTarget={setRollTarget}
        onRoll={handleRoll}
      />

      {/* Two-column layout for Participants and Combat Log */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Participants */}
        <ParticipantListView
          participants={combatView.participants}
          currentActorInstanceId={currentActorInstanceId || ''}
          viewMode={viewMode}
          onUpdateResource={updateResource as any}
        />

        {/* Combat Log */}
        <CombatLogView
          displayLog={displayLog}
          noteText={noteText}
          onSetNoteText={setNoteText}
          onAddNote={handleAddNote}
        />
      </div>

      {/* Confirm Dialogs */}
      <ConfirmDialog {...endCombatDialog.dialogProps} />
      <ConfirmDialog {...loadCombatDialog.dialogProps} />
    </div>
  );
}
