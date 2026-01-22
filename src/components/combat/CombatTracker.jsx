import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, Download, Plus, Undo, Redo, Save, Upload, Dices } from 'lucide-react';
import { useCombat } from '../../contexts/CombatContext';
import { calculateHPStatus, exportCombatLog, createResourceLogEntry, createTurnLogEntry, createNoteLogEntry, createRollLogEntry, createActionLogEntry, createInjuryLogEntry, createEffectLogEntry, exportActiveCombat, parseImportedCombat, exportCombatPlayerView, exportCombatGMLocked, importCombatWithGMLock } from '../../utils/combatHelpers';
import { MAX_COMBAT_HISTORY } from '../../constants';
import { roll, rollVsTarget, formatRoll } from '../../utils/dice';
import { createTurnAdvanceAction, createSetResourceAction, createAddLogEntryAction } from '../../utils/combatActions';
import { addAction, canUndo, canRedo, getUndoCount, getRedoCount, undo, redo, createHistoryState, createSnapshot } from '../../utils/combatHistory';
import { validateCombatState, validateCombatExport, validateCombatImport } from '../../utils/combatValidation';
import { clearShock, applyEffect, getActiveEffects } from '../../utils/effectsEngine';
import { getCombatView, ViewMode } from '../../utils/combatViewFilter';
import { createInitialRevealState } from '../../utils/combatReveal';
import { filterLogForPlayerView } from '../../utils/combatLogFilter';
import ActionPanel from './ActionPanel';
import ViewModeToggle from './ViewModeToggle';
import RevealPanel from './RevealPanel';

/**
 * Combat Tracker Component - Phase 3
 * Active combat management with turn tracking, resource management, logging, dice tools, undo/redo, and action assist
 */
export default function CombatTracker() {
  const {
    combatActive,
    saveCombatActive,
    combatActiveHistory,
    saveCombatActiveHistory,
    combatHistory,
    saveCombatHistory,
    combatRulesPreset,
    combatReveal,
    saveCombatReveal,
    gmMode,
    setGmMode
  } = useCombat();

  const [noteText, setNoteText] = useState('');
  const [diceExpression, setDiceExpression] = useState('3d6');
  const [rollTarget, setRollTarget] = useState('');
  const [showDicePanel, setShowDicePanel] = useState(false);
  const [showActionPanel, setShowActionPanel] = useState(true);

  // Phase 5: View mode (session-only, defaults to Player View)
  const [viewMode, setViewMode] = useState(ViewMode.PLAYER);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Migrate Phase 1 combat on load if needed
  useEffect(() => {
    if (combatActive && !combatActive.version) {
      // Phase 1 detected, migrate
      const migrated = validateCombatState(combatActive);
      if (migrated.valid) {
        saveCombatActive(migrated.combat);

        // Create empty history if none exists
        if (!combatActiveHistory) {
          saveCombatActiveHistory(createHistoryState());
        }
      }
    }
  }, [combatActive]);

  // Phase 5: Force Player View when GM Mode locks
  useEffect(() => {
    if (!gmMode && viewMode === ViewMode.GM) {
      setViewMode(ViewMode.PLAYER);
    }
  }, [gmMode]);

  // Phase 5: Initialize reveal state if missing
  useEffect(() => {
    if (combatActive && !combatReveal) {
      const initialReveal = createInitialRevealState(
        combatActive.id,
        combatActive.participants
      );
      saveCombatReveal(initialReveal);
    }
  }, [combatActive, combatReveal]);

  if (!combatActive) {
    return <div className="text-center text-gray-400 py-8">No active combat</div>;
  }

  // Phase 5: Compute view model (filters based on reveal state + view mode)
  const combatView = getCombatView(combatActive, combatReveal, viewMode);

  // Phase 5: Filter log for Player View
  const displayLog = viewMode === ViewMode.PLAYER && combatReveal
    ? filterLogForPlayerView(combatActive.log, combatReveal, combatActive)
    : combatActive.log;

  // Ensure history exists
  const history = combatActiveHistory || createHistoryState();

  const currentActorInstanceId = combatActive.turnOrder[combatActive.currentTurnIndex];
  // Use combatView for display (respects reveal state)
  const currentActor = combatView.participants.find(p => p.instanceId === currentActorInstanceId);
  // Use combatActive for truth state (for actions/modifications)
  const currentActorTruth = combatActive.participants.find(p => p.instanceId === currentActorInstanceId);

  // Get base state (combat at start, before any actions)
  // Phase 5: Also get base reveal state
  const baseState = createSnapshot(combatActive); // For now, treat current as base (simplified)

  // ============================================================================
  // Action Helpers
  // ============================================================================

  /**
   * Record an action and update state
   * Phase 5: Also pass reveal state to create checkpoints with it
   */
  const recordAction = (action) => {
    const newHistory = addAction(history, action, combatActive, combatReveal);
    saveCombatActiveHistory(newHistory);
  };

  // ============================================================================
  // Undo/Redo Handlers
  // ============================================================================

  const handleUndo = () => {
    if (!canUndo(history)) return;

    // Phase 5: Pass and restore reveal state
    const result = undo(baseState, history, combatActive, combatReveal);
    saveCombatActive(result.newCombatState);
    saveCombatActiveHistory(result.newHistory);
    if (result.newRevealState) {
      saveCombatReveal(result.newRevealState);
    }
  };

  const handleRedo = () => {
    if (!canRedo(history)) return;

    // Phase 5: Pass and restore reveal state
    const result = redo(baseState, history, combatActive, combatReveal);
    saveCombatActive(result.newCombatState);
    saveCombatActiveHistory(result.newHistory);
    if (result.newRevealState) {
      saveCombatReveal(result.newRevealState);
    }
  };

  // ============================================================================
  // Turn Management
  // ============================================================================

  const handleNextTurn = () => {
    const fromRound = combatActive.currentRound;
    const fromTurnIndex = combatActive.currentTurnIndex;

    const nextIndex = combatActive.currentTurnIndex + 1;
    const isNewRound = nextIndex >= combatActive.turnOrder.length;

    const toTurnIndex = isNewRound ? 0 : nextIndex;
    const toRound = isNewRound ? combatActive.currentRound + 1 : combatActive.currentRound;

    // Create TURN_ADVANCE action
    const action = createTurnAdvanceAction(fromRound, fromTurnIndex, toRound, toTurnIndex);

    // Get next actor and clear shock penalty (Phase 4)
    const nextActorInstanceId = combatActive.turnOrder[toTurnIndex];
    const nextActor = combatActive.participants.find(p => p.instanceId === nextActorInstanceId);

    // Clear shock penalty on turn start
    const updatedParticipants = combatActive.participants.map(p =>
      p.instanceId === nextActorInstanceId ? clearShock(p) : p
    );

    // Apply to state immediately
    const newCombat = {
      ...combatActive,
      currentRound: toRound,
      currentTurnIndex: toTurnIndex,
      participants: updatedParticipants
    };

    saveCombatActive(newCombat);
    recordAction(action);

    // Add log entries for new round and new turn
    if (isNewRound) {
      const roundLogEntry = createTurnLogEntry(toRound, toTurnIndex, null, `=== Round ${toRound} ===`);
      const roundAction = createAddLogEntryAction(roundLogEntry);
      recordAction(roundAction);

      // Also add to state
      saveCombatActive({
        ...newCombat,
        log: [...newCombat.log, roundLogEntry]
      });
    }

    const turnLogEntry = createTurnLogEntry(toRound, toTurnIndex, nextActorInstanceId, nextActor?.name);
    const turnAction = createAddLogEntryAction(turnLogEntry);
    recordAction(turnAction);

    // Update state with new log
    saveCombatActive(prev => ({
      ...prev,
      log: [...prev.log, turnLogEntry]
    }));
  };

  const handlePrevTurn = () => {
    const fromRound = combatActive.currentRound;
    const fromTurnIndex = combatActive.currentTurnIndex;

    const prevIndex = combatActive.currentTurnIndex - 1;
    const isPrevRound = prevIndex < 0;

    const toTurnIndex = isPrevRound ? combatActive.turnOrder.length - 1 : prevIndex;
    const toRound = isPrevRound ? Math.max(1, combatActive.currentRound - 1) : combatActive.currentRound;

    // Create TURN_ADVANCE action
    const action = createTurnAdvanceAction(fromRound, fromTurnIndex, toRound, toTurnIndex);

    // Apply to state
    const newCombat = {
      ...combatActive,
      currentRound: toRound,
      currentTurnIndex: toTurnIndex
    };

    saveCombatActive(newCombat);
    recordAction(action);
  };

  // ============================================================================
  // Resource Management
  // ============================================================================

  const updateResource = (instanceId, resource, newValue) => {
    const participant = combatActive.participants.find(p => p.instanceId === instanceId);
    if (!participant) return;

    const oldValue = participant[`current${resource}`];
    if (oldValue === newValue) return;

    // Create SET_RESOURCE action
    const resourceAction = createSetResourceAction(instanceId, resource, oldValue, newValue);

    // Apply to state
    const updatedParticipants = combatActive.participants.map(p =>
      p.instanceId === instanceId
        ? { ...p, [`current${resource}`]: newValue }
        : p
    );

    const newCombat = {
      ...combatActive,
      participants: updatedParticipants
    };

    saveCombatActive(newCombat);
    recordAction(resourceAction);

    // Create log entry
    const logEntry = createResourceLogEntry(
      combatActive.currentRound,
      combatActive.currentTurnIndex,
      instanceId,
      participant.name,
      resource,
      oldValue,
      newValue
    );

    const logAction = createAddLogEntryAction(logEntry);

    // Update state with log
    saveCombatActive(prev => ({
      ...prev,
      log: [...prev.log, logEntry]
    }));

    recordAction(logAction);
  };

  // ============================================================================
  // Dice Rolling
  // ============================================================================

  const handleRoll = () => {
    if (!diceExpression.trim()) return;

    let rollResult;
    if (rollTarget && rollTarget.trim()) {
      const target = parseInt(rollTarget);
      if (isNaN(target)) {
        alert('Invalid target number');
        return;
      }
      rollResult = rollVsTarget(diceExpression, target);
    } else {
      rollResult = roll(diceExpression);
    }

    if (!rollResult.valid) {
      alert(`Roll error: ${rollResult.error}`);
      return;
    }

    // Create roll log entry
    const logEntry = createRollLogEntry(
      combatActive.currentRound,
      combatActive.currentTurnIndex,
      currentActorInstanceId,
      currentActor?.name || 'Unknown',
      rollResult
    );

    const action = createAddLogEntryAction(logEntry);

    // Update state
    saveCombatActive(prev => ({
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
      combatActive.currentRound,
      combatActive.currentTurnIndex,
      currentActorInstanceId,
      currentActor?.name,
      noteText
    );

    const action = createAddLogEntryAction(logEntry);

    // Update state
    saveCombatActive(prev => ({
      ...prev,
      log: [...prev.log, logEntry]
    }));

    recordAction(action);
    setNoteText('');
  };

  // ============================================================================
  // Phase 3: Action Panel Handlers
  // ============================================================================

  const handleActionComplete = (actionData) => {
    const { maneuver, kind, attack, defense, damage, injury, note, targetInstanceId, newHP } = actionData;

    // Get target if applicable
    const target = targetInstanceId
      ? combatActive.participants.find(p => p.instanceId === targetInstanceId)
      : null;

    // Handle Phase 4 injury workflow
    if (kind === 'injury' && injury && targetInstanceId) {
      // Create injury log entry
      const injuryLogEntry = createInjuryLogEntry({
        round: combatActive.currentRound,
        turn: combatActive.currentTurnIndex,
        targetInstanceId,
        targetName: target?.name,
        hitLocation: injury.hitLocation,
        damageBreakdown: injury.damageBreakdown,
        effects: null // Will add effect logs separately
      });

      let updatedParticipants = [...combatActive.participants];
      let logEntries = [injuryLogEntry];

      // Apply HP change
      updatedParticipants = updatedParticipants.map(p =>
        p.instanceId === targetInstanceId
          ? { ...p, currentHP: newHP }
          : p
      );

      // Apply effects to target
      if (injury.effects && injury.effects.length > 0) {
        injury.effects.forEach(effect => {
          // Apply shock
          if (effect.type === 'shock' && effect.autoApplied) {
            updatedParticipants = updatedParticipants.map(p =>
              p.instanceId === targetInstanceId
                ? applyEffect(p, 'shock', { value: effect.value })
                : p
            );

            logEntries.push(createEffectLogEntry({
              round: combatActive.currentRound,
              turn: combatActive.currentTurnIndex,
              targetInstanceId,
              targetName: target?.name,
              effectType: 'shock',
              effectData: { value: effect.value },
              text: `${target?.name}: Shock penalty ${effect.value} until next turn`
            }));
          }

          // Apply stun
          if (effect.type === 'knockdownStun' && effect.success === false) {
            updatedParticipants = updatedParticipants.map(p =>
              p.instanceId === targetInstanceId
                ? applyEffect(p, 'stunned', { stunned: true })
                : p
            );

            logEntries.push(createEffectLogEntry({
              round: combatActive.currentRound,
              turn: combatActive.currentTurnIndex,
              targetInstanceId,
              targetName: target?.name,
              effectType: 'stunned',
              effectData: { stunned: true },
              text: `${target?.name}: Stunned!`
            }));
          }

          // Apply unconsciousness
          if (effect.type === 'consciousnessCheck' && effect.success === false) {
            updatedParticipants = updatedParticipants.map(p =>
              p.instanceId === targetInstanceId
                ? applyEffect(p, 'unconscious', { unconscious: true })
                : p
            );

            logEntries.push(createEffectLogEntry({
              round: combatActive.currentRound,
              turn: combatActive.currentTurnIndex,
              targetInstanceId,
              targetName: target?.name,
              effectType: 'unconscious',
              effectData: { unconscious: true },
              text: `${target?.name}: Unconscious!`
            }));
          }

          // Apply death
          if ((effect.type === 'deathCheck' && effect.success === false) || effect.type === 'autoDeath') {
            updatedParticipants = updatedParticipants.map(p =>
              p.instanceId === targetInstanceId
                ? applyEffect(p, 'dead', { dead: true })
                : p
            );

            logEntries.push(createEffectLogEntry({
              round: combatActive.currentRound,
              turn: combatActive.currentTurnIndex,
              targetInstanceId,
              targetName: target?.name,
              effectType: 'dead',
              effectData: { dead: true },
              text: `${target?.name}: Dead!`
            }));
          }

          // Apply bleeding
          if (effect.type === 'bleeding' && effect.outcome === 'yes') {
            updatedParticipants = updatedParticipants.map(p =>
              p.instanceId === targetInstanceId
                ? applyEffect(p, 'bleeding', { bleeding: true, rate: 1, round: combatActive.currentRound })
                : p
            );

            logEntries.push(createEffectLogEntry({
              round: combatActive.currentRound,
              turn: combatActive.currentTurnIndex,
              targetInstanceId,
              targetName: target?.name,
              effectType: 'bleeding',
              effectData: { rate: 1 },
              text: `${target?.name}: Bleeding (1 HP/turn)`
            }));
          }

          // Apply crippling
          if (effect.type === 'crippling' && effect.autoApplied) {
            updatedParticipants = updatedParticipants.map(p =>
              p.instanceId === targetInstanceId
                ? applyEffect(p, 'crippling', { locationKey: effect.locationKey })
                : p
            );

            logEntries.push(createEffectLogEntry({
              round: combatActive.currentRound,
              turn: combatActive.currentTurnIndex,
              targetInstanceId,
              targetName: target?.name,
              effectType: 'crippling',
              effectData: { locationKey: effect.locationKey, locationLabel: effect.locationLabel },
              text: `${target?.name}: ${effect.locationLabel} crippled!`
            }));
          }
        });
      }

      // Update state
      const newCombat = {
        ...combatActive,
        participants: updatedParticipants,
        log: [...combatActive.log, ...logEntries]
      };

      saveCombatActive(newCombat);

      // Record resource change action
      if (target) {
        const resourceAction = createSetResourceAction(
          targetInstanceId,
          'HP',
          target.currentHP,
          newHP
        );
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
      round: combatActive.currentRound,
      turn: combatActive.currentTurnIndex,
      actorInstanceId: currentActorInstanceId,
      actorName: currentActor?.name,
      targetInstanceId,
      targetName: target?.name,
      maneuver,
      action: { kind, attack, defense, damage }
    });

    // Update state with log
    let newCombat = {
      ...combatActive,
      log: [...combatActive.log, logEntry]
    };

    // If damage was applied, also update target HP (legacy Phase 3 support)
    if (kind === 'damage' && targetInstanceId && newHP !== undefined) {
      const updatedParticipants = combatActive.participants.map(p =>
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
        target.currentHP,
        newHP
      );
      recordAction(resourceAction);
    }

    // If it's just a note action, create a simpler note entry instead
    if (kind === 'note' && note) {
      const noteEntry = createNoteLogEntry(
        combatActive.currentRound,
        combatActive.currentTurnIndex,
        currentActorInstanceId,
        currentActor?.name,
        maneuver ? `[${maneuver}] ${note}` : note
      );

      newCombat = {
        ...combatActive,
        log: [...combatActive.log, noteEntry]
      };

      const noteAction = createAddLogEntryAction(noteEntry);
      saveCombatActive(newCombat);
      recordAction(noteAction);
      return;
    }

    // Save state and record action
    saveCombatActive(newCombat);
    const logAction = createAddLogEntryAction(logEntry);
    recordAction(logAction);
  };

  // ============================================================================
  // Combat End
  // ============================================================================

  const handleEndCombat = () => {
    if (!confirm('End this combat session?')) return;

    const endLogEntry = createNoteLogEntry(
      combatActive.currentRound,
      combatActive.currentTurnIndex,
      null,
      null,
      'Combat ended'
    );

    const endedCombat = {
      ...combatActive,
      endTime: Date.now(),
      log: [...combatActive.log, endLogEntry]
    };

    // Add to history (cap at MAX_COMBAT_HISTORY)
    const newHistory = [endedCombat, ...combatHistory].slice(0, MAX_COMBAT_HISTORY);
    saveCombatHistory(newHistory);

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
      name: combatActive.name,
      date: combatActive.startTime
    });

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `combat-log-${combatActive.name}-${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Phase 5: Export Player View (unencrypted, filtered)
  const handleExportPlayerView = () => {
    if (!combatReveal) {
      alert('Reveal state not initialized. Cannot export player view.');
      return;
    }

    const json = exportCombatPlayerView(combatActive, combatReveal, history);

    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `combat-player-view-${combatActive.name}-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Phase 5: Export GM Locked (encrypted)
  const handleExportGMLocked = async () => {
    if (!combatReveal) {
      alert('Reveal state not initialized. Cannot export GM locked combat.');
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
      const json = await exportCombatGMLocked(combatActive, combatReveal, history, password);

      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `combat-gm-locked-${combatActive.name}-${Date.now()}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      alert(`Export failed: ${error.message}`);
    }
  };

  // Legacy: Export full combat (Phase 2 format, unencrypted)
  const handleSaveCombat = () => {
    const validation = validateCombatExport(combatActive, history);
    if (!validation.valid) {
      alert(`Cannot export: ${validation.errors.join(', ')}`);
      return;
    }

    const json = exportActiveCombat(combatActive, history);

    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `combat-save-${combatActive.name}-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleLoadCombat = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        const jsonString = event.target.result;

        // Try Phase 5 import first
        let parsed = await importCombatWithGMLock(jsonString);

        // Fallback to legacy import if Phase 5 fails
        if (!parsed.valid && !parsed.isLocked) {
          parsed = parseImportedCombat(jsonString);
          if (parsed.valid) {
            // Legacy format
            const validation = validateCombatImport(parsed.data);
            if (!validation.valid) {
              alert(`Validation error: ${validation.errors.join(', ')}`);
              return;
            }

            if (!confirm('Load this combat? Current combat will be replaced.')) {
              return;
            }

            saveCombatActive(validation.combatState);
            saveCombatActiveHistory(validation.historyState);
            return;
          }
        }

        if (!parsed.valid && !parsed.isLocked) {
          alert(`Import error: ${parsed.error}`);
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
            const unlocked = await importCombatWithGMLock(jsonString, password);

            if (!unlocked.valid) {
              alert(`Failed to unlock: ${unlocked.error}\n\nLoading player view instead.`);
              // Fall through to load player view
            } else {
              // Successfully unlocked
              if (!confirm('Load unlocked GM combat? Current combat will be replaced.')) {
                return;
              }

              saveCombatActive(unlocked.data.combatState);
              saveCombatActiveHistory(unlocked.data.history || null);
              saveCombatReveal(unlocked.data.revealState || null);
              return;
            }
          }

          // Load player view (locked or failed unlock)
          if (!confirm('Load player view (limited info)? Current combat will be replaced.')) {
            return;
          }

          saveCombatActive(parsed.data.combatState);
          saveCombatActiveHistory(null); // No history in player view
          saveCombatReveal(parsed.data.revealState || null);
          return;
        }

        // Phase 5 format, not locked
        if (!confirm('Load this combat? Current combat will be replaced.')) {
          return;
        }

        saveCombatActive(parsed.data.combatState);
        saveCombatActiveHistory(parsed.data.history || null);
        saveCombatReveal(parsed.data.revealState || null);
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">{combatActive.name}</h2>
          <p className="text-gray-400">Round {combatActive.currentRound}</p>
        </div>
        <div className="flex gap-2">
          {/* Undo/Redo */}
          <button
            onClick={handleUndo}
            disabled={!canUndo(history)}
            className="flex items-center gap-2 px-3 py-2 bg-gray-600 hover:bg-gray-500 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            title={`Undo (${getUndoCount(history)})`}
          >
            <Undo size={16} />
            Undo ({getUndoCount(history)})
          </button>
          <button
            onClick={handleRedo}
            disabled={!canRedo(history)}
            className="flex items-center gap-2 px-3 py-2 bg-gray-600 hover:bg-gray-500 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            title={`Redo (${getRedoCount(history)})`}
          >
            <Redo size={16} />
            Redo ({getRedoCount(history)})
          </button>

          {/* Phase 5: Export Menu */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded"
            >
              <Download size={16} />
              Export
            </button>
            {showExportMenu && (
              <div className="absolute top-full right-0 mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-50 min-w-64">
                <button
                  onClick={() => { handleExportPlayerView(); setShowExportMenu(false); }}
                  className="w-full text-left px-4 py-3 hover:bg-gray-700 border-b border-gray-700"
                >
                  <div className="font-medium text-blue-400">Export Player View</div>
                  <div className="text-xs text-gray-400">Filtered, safe to share with players</div>
                </button>
                <button
                  onClick={() => { handleExportGMLocked(); setShowExportMenu(false); }}
                  className="w-full text-left px-4 py-3 hover:bg-gray-700 border-b border-gray-700"
                >
                  <div className="font-medium text-purple-400">Export GM Locked</div>
                  <div className="text-xs text-gray-400">Password-encrypted full state</div>
                </button>
                <button
                  onClick={() => { handleSaveCombat(); setShowExportMenu(false); }}
                  className="w-full text-left px-4 py-3 hover:bg-gray-700 border-b border-gray-700"
                >
                  <div className="font-medium text-green-400">Export Full (Legacy)</div>
                  <div className="text-xs text-gray-400">Unencrypted, all data</div>
                </button>
                <button
                  onClick={() => { handleExportLog(); setShowExportMenu(false); }}
                  className="w-full text-left px-4 py-3 hover:bg-gray-700"
                >
                  <div className="font-medium text-gray-300">Export Log Only</div>
                  <div className="text-xs text-gray-400">Text file of combat log</div>
                </button>
              </div>
            )}
          </div>

          {/* Load */}
          <button
            onClick={handleLoadCombat}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded"
          >
            <Upload size={16} />
            Load
          </button>

          {/* End Combat */}
          <button
            onClick={handleEndCombat}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded"
          >
            <X size={16} />
            End Combat
          </button>
        </div>
      </div>

      {/* Phase 5: View Mode Toggle */}
      <ViewModeToggle
        viewMode={viewMode}
        setViewMode={setViewMode}
        gmMode={gmMode}
        setGmMode={setGmMode}
      />

      {/* Current Turn */}
      <div className="bg-gradient-to-r from-blue-900 to-gray-800 rounded-lg p-4 border-2 border-blue-500">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-gray-400">Current Turn</p>
            <h3 className="text-2xl font-bold">{currentActor?.name}</h3>
            <p className="text-sm text-gray-400">
              Speed: {currentActor?.basicSpeed} | Turn {combatActive.currentTurnIndex + 1} of {combatActive.turnOrder.length}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handlePrevTurn}
              className="p-3 bg-gray-700 hover:bg-gray-600 rounded"
              title="Previous turn"
            >
              <ChevronLeft size={24} />
            </button>
            <button
              onClick={handleNextTurn}
              className="p-3 bg-green-600 hover:bg-green-700 rounded"
              title="Next turn"
            >
              <ChevronRight size={24} />
            </button>
          </div>
        </div>
      </div>

      {/* Action Panel (Phase 3) */}
      <ActionPanel
        currentActor={currentActor}
        participants={combatView.participants}
        onActionComplete={handleActionComplete}
        combatRulesPreset={combatRulesPreset || 'standard'}
        expanded={showActionPanel}
        onToggleExpanded={() => setShowActionPanel(!showActionPanel)}
      />

      {/* Phase 5: Reveal Panel (GM View only) */}
      {viewMode === ViewMode.GM && (
        <RevealPanel
          combatActive={combatActive}
          combatReveal={combatReveal}
          saveCombatReveal={saveCombatReveal}
          viewMode={viewMode}
        />
      )}

      {/* Dice Panel */}
      <div className="bg-gray-800 rounded-lg p-4">
        <button
          onClick={() => setShowDicePanel(!showDicePanel)}
          className="flex items-center gap-2 w-full justify-between"
        >
          <div className="flex items-center gap-2">
            <Dices size={20} />
            <span className="font-semibold">Dice Tools</span>
          </div>
          <span className="text-gray-400">{showDicePanel ? '▲' : '▼'}</span>
        </button>

        {showDicePanel && (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Expression</label>
                <input
                  type="text"
                  value={diceExpression}
                  onChange={(e) => setDiceExpression(e.target.value)}
                  placeholder="e.g. 3d6, 2d+1"
                  className="w-full px-3 py-2 bg-gray-700 rounded"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Target (optional)</label>
                <input
                  type="number"
                  value={rollTarget}
                  onChange={(e) => setRollTarget(e.target.value)}
                  placeholder="e.g. 12"
                  className="w-full px-3 py-2 bg-gray-700 rounded"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleRoll}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded"
              >
                Roll
              </button>
              <button
                onClick={() => setDiceExpression('3d6')}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded"
              >
                3d6
              </button>
              <button
                onClick={() => setDiceExpression('1d')}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded"
              >
                1d
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Participants */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Participants</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {combatView.participants.map(p => (
              <ParticipantCard
                key={p.instanceId}
                participant={p}
                viewMode={viewMode}
                isCurrent={p.instanceId === currentActorInstanceId}
                onUpdateResource={updateResource}
              />
            ))}
          </div>
        </div>

        {/* Combat Log */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Combat Log</h3>
          <div className="bg-gray-800 rounded p-4 h-96 overflow-y-auto font-mono text-sm">
            {displayLog.map((entry, index) => {
              const formatted = formatLogEntry(entry);
              return (
                <div key={entry.id || index} className="mb-1">
                  {formatted}
                </div>
              );
            })}
          </div>

          {/* Add Note */}
          <div className="flex gap-2">
            <input
              type="text"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddNote()}
              placeholder="Add a note..."
              className="flex-1 px-3 py-2 bg-gray-700 rounded"
            />
            <button
              onClick={handleAddNote}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Participant Card Component - Phase 5 compatible
 * Shows participant status with editable resources
 * Handles both truth state (GM View) and filtered state (Player View)
 */
function ParticipantCard({ participant, isCurrent, onUpdateResource, viewMode }) {
  const [editing, setEditing] = useState(null); // 'HP', 'FP', or 'MP'
  const [editValue, setEditValue] = useState('');

  // Phase 5: Extract values based on data structure (truth vs filtered)
  const getHPValues = () => {
    if (participant.hp && typeof participant.hp === 'object') {
      // Filtered state
      return {
        mode: participant.hp.mode,
        current: participant.hp.current,
        max: participant.hp.max,
        band: participant.hp.band,
        bandText: participant.hp.bandText
      };
    }
    // Truth state (backward compat)
    return {
      mode: 'exact',
      current: participant.currentHP,
      max: participant.hp || participant.maxHP
    };
  };

  const getFPValues = () => {
    if (participant.fp && typeof participant.fp === 'object') {
      return {
        mode: participant.fp.mode,
        current: participant.fp.current,
        max: participant.fp.max
      };
    }
    return {
      mode: 'exact',
      current: participant.currentFP,
      max: participant.fp || participant.maxFP
    };
  };

  const getMPValues = () => {
    if (participant.mp && typeof participant.mp === 'object') {
      return {
        mode: participant.mp.mode,
        current: participant.mp.current,
        max: participant.mp.max
      };
    }
    return {
      mode: 'exact',
      current: participant.currentMP,
      max: participant.mp || participant.maxMP
    };
  };

  const hp = getHPValues();
  const fp = getFPValues();
  const mp = getMPValues();

  const hpStatus = hp.mode === 'exact'
    ? calculateHPStatus(hp.current, hp.max)
    : (hp.band || 'unknown');

  const getHPStatusColor = (status) => {
    switch (status) {
      case 'healthy': return 'text-green-400';
      case 'injured': return 'text-yellow-400';
      case 'critical': return 'text-orange-400';
      case 'dead': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const startEdit = (resource) => {
    // Only allow editing if we have exact values (not hidden/unknown)
    let currentValue;
    if (resource === 'HP' && hp.mode === 'exact') {
      currentValue = hp.current;
    } else if (resource === 'FP' && fp.mode === 'exact') {
      currentValue = fp.current;
    } else if (resource === 'MP' && mp.mode === 'exact') {
      currentValue = mp.current;
    } else {
      return; // Can't edit hidden/unknown values
    }

    setEditing(resource);
    setEditValue(currentValue.toString());
  };

  const saveEdit = () => {
    if (editing) {
      const newValue = parseInt(editValue) || 0;
      onUpdateResource(participant.instanceId, editing, newValue);
      setEditing(null);
    }
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditValue('');
  };

  return (
    <div className={`bg-gray-800 rounded p-3 ${isCurrent ? 'border-2 border-blue-500' : ''}`}>
      <div className="flex justify-between items-start mb-2">
        <div>
          <h4 className="font-semibold">{participant.name}</h4>
          <p className="text-xs text-gray-400">{participant.category}</p>
        </div>
        <span className={`text-xs font-semibold ${getHPStatusColor(hpStatus)}`}>
          {hpStatus.toUpperCase()}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-sm">
        {/* HP */}
        <div>
          <div className="text-xs text-gray-400">HP</div>
          {hp.mode === 'unknown' ? (
            <div className="text-gray-500 italic">Unknown</div>
          ) : hp.mode === 'band' ? (
            <div className="text-yellow-400">{hp.bandText}</div>
          ) : editing === 'HP' ? (
            <input
              type="number"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={saveEdit}
              onKeyPress={(e) => {
                if (e.key === 'Enter') saveEdit();
                if (e.key === 'Escape') cancelEdit();
              }}
              className="w-full px-1 py-0.5 bg-gray-600 rounded text-sm"
              autoFocus
            />
          ) : (
            <div
              onClick={() => startEdit('HP')}
              className="cursor-pointer hover:bg-gray-700 px-1 rounded"
            >
              {hp.current}/{hp.max}
            </div>
          )}
        </div>

        {/* FP */}
        <div>
          <div className="text-xs text-gray-400">FP</div>
          {fp.mode === 'unknown' ? (
            <div className="text-gray-500 italic">Unknown</div>
          ) : editing === 'FP' ? (
            <input
              type="number"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={saveEdit}
              onKeyPress={(e) => {
                if (e.key === 'Enter') saveEdit();
                if (e.key === 'Escape') cancelEdit();
              }}
              className="w-full px-1 py-0.5 bg-gray-600 rounded text-sm"
              autoFocus
            />
          ) : (
            <div
              onClick={() => startEdit('FP')}
              className="cursor-pointer hover:bg-gray-700 px-1 rounded"
            >
              {fp.current}/{fp.max}
            </div>
          )}
        </div>

        {/* MP */}
        {mp.max > 0 && (
          <div>
            <div className="text-xs text-gray-400">MP</div>
            {mp.mode === 'unknown' ? (
              <div className="text-gray-500 italic">Unknown</div>
            ) : editing === 'MP' ? (
              <input
                type="number"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={saveEdit}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') saveEdit();
                  if (e.key === 'Escape') cancelEdit();
                }}
                className="w-full px-1 py-0.5 bg-gray-600 rounded text-sm"
                autoFocus
              />
            ) : (
              <div
                onClick={() => startEdit('MP')}
                className="cursor-pointer hover:bg-gray-700 px-1 rounded"
              >
                {mp.current}/{mp.max}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Phase 4: Status Effects */}
      {(() => {
        const effects = getActiveEffects(participant);
        if (effects.length === 0) return null;
        return (
          <div className="mt-2 pt-2 border-t border-gray-700">
            <div className="text-xs text-gray-400 mb-1">Effects:</div>
            <div className="flex flex-wrap gap-1">
              {effects.map((effect, index) => (
                <span
                  key={index}
                  className="text-xs px-2 py-0.5 bg-red-900/50 text-red-300 rounded"
                >
                  {effect}
                </span>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

/**
 * Format log entry for display
 * Renders special components for roll entries with colored dice and action entries
 */
function formatLogEntry(entry) {
  const timestamp = new Date(entry.timestamp).toLocaleTimeString();

  // Phase 3 action entry with detailed breakdown
  if (entry.entryType === 'action' && entry.action) {
    return <ActionLogEntry timestamp={timestamp} entry={entry} />;
  }

  // Phase 2 structured format with roll data
  if (entry.entryType === 'roll' && entry.roll) {
    return <RollLogEntry timestamp={timestamp} entry={entry} />;
  }

  // Regular Phase 2 structured format
  if (entry.entryType) {
    return `[${timestamp}] ${entry.text}`;
  }

  // Fallback for Phase 1
  return `[${timestamp}] ${entry.message || 'Unknown event'}`;
}

/**
 * Roll Log Entry Component
 * Displays roll with colored individual dice
 */
function RollLogEntry({ timestamp, entry }) {
  const { roll } = entry;
  const actorName = entry.text.split(' rolled ')[0]; // Extract actor name from text

  // Colors for dice (cycling through a palette)
  const diceColors = [
    'text-red-400',
    'text-blue-400',
    'text-green-400',
    'text-yellow-400',
    'text-purple-400',
    'text-pink-400',
    'text-cyan-400',
    'text-orange-400'
  ];

  const getDiceColor = (index) => diceColors[index % diceColors.length];

  // Format: [timestamp] Name rolled 3d6 [3][4][5]: 12
  return (
    <span>
      [{timestamp}] {actorName} rolled {roll.expression}{' '}
      {roll.dice.map((die, index) => (
        <span key={index} className={`font-bold ${getDiceColor(index)}`}>
          [{die}]
        </span>
      ))}
      {roll.modifier !== 0 && (
        <span> {roll.modifier > 0 ? `+${roll.modifier}` : roll.modifier}</span>
      )}
      : {roll.total}
      {roll.target !== null && (
        <span>
          {' vs '}
          <span className="font-semibold">{roll.target}</span>
          {' ['}
          <span className={roll.margin >= 0 ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
            {roll.margin >= 0 ? `+${roll.margin}` : roll.margin}
          </span>
          {'] '}
          <span className={roll.success ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
            {roll.success ? 'SUCCESS' : 'FAILURE'}
          </span>
        </span>
      )}
    </span>
  );
}

/**
 * Action Log Entry Component (Phase 3)
 * Displays combat actions with detailed breakdown
 */
function ActionLogEntry({ timestamp, entry }) {
  const { action, maneuver } = entry;

  return (
    <div className="bg-gray-900 rounded p-2 my-1">
      <div className="text-xs text-gray-500">[{timestamp}]</div>
      <div className="font-semibold">{entry.text}</div>

      {/* Show modifier details if available */}
      {action.attack && action.attack.modifiers && action.attack.modifiers.length > 0 && (
        <div className="text-xs text-gray-400 mt-1">
          Modifiers: {action.attack.modifiers.map(m => `${m.label} ${m.value >= 0 ? '+' : ''}${m.value}`).join(', ')}
        </div>
      )}

      {action.defense && action.defense.modifiers && action.defense.modifiers.length > 0 && (
        <div className="text-xs text-gray-400 mt-1">
          Modifiers: {action.defense.modifiers.map(m => `${m.label} ${m.value >= 0 ? '+' : ''}${m.value}`).join(', ')}
        </div>
      )}

      {action.damage && (
        <div className="text-xs text-gray-400 mt-1">
          {action.damage.expression && action.damage.expression !== 'manual' && (
            <span>Damage: {action.damage.expression} → {action.damage.rolledDamage}</span>
          )}
          {action.damage.generalDRUsed > 0 && (
            <span> | DR: {action.damage.generalDRUsed}</span>
          )}
        </div>
      )}
    </div>
  );
}
