import { useState, useEffect, useCallback } from 'react';
import { Map as MapIcon } from 'lucide-react';
import { useCampaignStore } from '../../state/campaignStore';
import { useCombatStore } from '../../hooks/useCombatStore';
import { useCombatExport } from '../../hooks/useCombatExport';
import { useActionResolution } from '../../hooks/useActionResolution';
import { useCombatConditions } from '../../hooks/useCombatConditions';
import { useCombatReinforcements } from '../../hooks/useCombatReinforcements';
import { useCombatHistory } from '../../hooks/useCombatHistory';
import { ConfirmDialog, useConfirmDialog } from '../ui';
import PostCombatSummary from './PostCombatSummary';
import LootDistribution from './LootDistribution';
import {
  createResourceLogEntry,
  createTurnLogEntry,
  createNoteLogEntry,
  createRollLogEntry,
  createManeuverLogEntry,
} from '../../utils/combatHelpers';
import { MAX_COMBAT_HISTORY } from '../../constants';
import { roll, rollVsTarget } from '../../utils/dice';
import {
  createTurnAdvanceAction,
  createSetResourceAction,
  createAddLogEntryAction,
  createSetTurnDecisionAction,
  createReorderTurnOrderAction,
} from '../../utils/combatActions';
import {
  validateCombatState,
} from '../../utils/combatValidation';
import { clearShock } from '../../utils/effectsEngine';
import { getCombatView, ViewMode, type ViewModeType } from '../../utils/combatViewFilter';
import {
  createInitialRevealState,
} from '../../utils/combatReveal';
import { filterLogForPlayerView } from '../../utils/combatLogFilter';
import { tickConditionsTurn, tickConditionsRound } from '../../utils/conditionsEngine';
import { ManeuverCatalog } from '../../constants/maneuvers';
import { deriveTurnContext } from '../../utils/turnContext';
import { filterManeuvers } from '../../utils/maneuverFilter';
import ActionPanel from './ActionPanel';
import ConditionAddPopover from './ConditionAddPopover';
import ViewModeToggle from './ViewModeToggle';
import RevealPanel from './RevealPanel';
import ManeuverSelector from './ManeuverSelector';
import ReinforcementsModal from './ReinforcementsModal';
import {
  CombatHeaderView,
  DicePanelView,
  ParticipantListView,
  CombatLogView,
  InitiativeTimeline,
} from './views';
import type {
  Participant,
  LogEntry,
  CombatState,
  TurnDecision,
  RevealState,
  Maneuver,
  TurnContext,
  ConditionInstance,
} from '../../types/combatTracker';
import type { RollResult, RollVsTargetResult } from '../../utils/dice';


// ============================================================================
// CombatTracker Component — Phase 11a (decomposed)
// ============================================================================

export default function CombatTracker() {
  const {
    combatCharacters,
    combatActive,
    saveCombatActive,
    combatHistory,
    saveCombatHistory,
    combatRulesPreset,
    combatReveal,
    saveCombatReveal,
  } = useCombatStore();
  const { state: campaignState } = useCampaignStore();
  const availableMaps = Object.values(campaignState.maps.mapsById);

  // Post-combat flow state (Phase 11c)
  type PostCombatPhase = 'active' | 'summary' | 'loot';
  const [postCombatPhase, setPostCombatPhase] = useState<PostCombatPhase>('active');
  const [endedCombatSnapshot, setEndedCombatSnapshot] = useState<CombatState | null>(null);

  // Local UI state
  const [noteText, setNoteText] = useState('');
  const [diceExpression, setDiceExpression] = useState('3d6');
  const [rollTarget, setRollTarget] = useState('');
  const [showDicePanel, setShowDicePanel] = useState(false);
  const [showActionPanel, setShowActionPanel] = useState(true);
  const [showReinforcementsModal, setShowReinforcementsModal] = useState(false);
  const [viewMode, setViewMode] = useState<ViewModeType>(ViewMode.PLAYER);
  const [gmMode, setGmMode] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  // Phase 12a.6: condition popover anchor (tracker rows + timeline tokens)
  const [conditionPopover, setConditionPopover] = useState<{
    instanceId: string;
    x: number;
    y: number;
  } | null>(null);

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

  const combat = combatActive;
  const reveal = combatReveal as RevealState | null;

  // Persistent undo/redo history (extracted hook — Phase 11a)
  const { history, recordAction, handleUndo, handleRedo } = useCombatHistory();

  // --------------------------------------------------------------------------
  // Lifecycle effects
  // --------------------------------------------------------------------------

  // Migrate Phase 1 combat on load
  useEffect(() => {
    if (combat && !combat.version) {
      const migrated = validateCombatState(combat) as { valid: boolean; combat: CombatState };
      if (migrated.valid) {
        saveCombatActive(migrated.combat);
      }
    }
  }, [combat]);

  // Force Player View when GM Mode locks
  useEffect(() => {
    if (!gmMode && viewMode === ViewMode.GM) {
      setViewMode(ViewMode.PLAYER);
    }
  }, [gmMode]);

  // Initialize reveal state if missing
  useEffect(() => {
    if (combat && !reveal) {
      const initialReveal = createInitialRevealState(combat.id, combat.participants);
      saveCombatReveal(initialReveal);
    }
  }, [combat, reveal]);

  // --------------------------------------------------------------------------
  // Early returns
  // --------------------------------------------------------------------------

  if (!combat) {
    return <div className="text-center text-gray-400 py-8">No active combat</div>;
  }

  if (!combat.participants || !combat.turnOrder) {
    return <div className="text-center text-gray-400 py-8">Invalid combat state - missing participants or turn order</div>;
  }

  // --------------------------------------------------------------------------
  // Derived state
  // --------------------------------------------------------------------------

  const combatLog = combat.log || [];
  const combatView = getCombatView(combat, reveal ?? undefined, viewMode) as { participants: Participant[] };
  const displayLog = viewMode === ViewMode.PLAYER && reveal
    ? filterLogForPlayerView(combatLog, reveal, combat) as LogEntry[]
    : combatLog;

  const currentActorInstanceId = combat.turnOrder[combat.currentTurnIndex];
  const currentActor = combatView.participants.find(p => p.instanceId === currentActorInstanceId);
  const currentActorTruth = combat.participants.find(p => p.instanceId === currentActorInstanceId);

  const turnDecisionKey = currentActorInstanceId
    ? `${combat.currentRound}_${combat.currentTurnIndex}_${currentActorInstanceId}`
    : null;
  const turnDecisions = combat.turnDecisions || {};
  const currentTurnDecision = turnDecisionKey ? (turnDecisions[turnDecisionKey] || {}) : {};
  const turnContext = deriveTurnContext(currentActorTruth ?? null) as TurnContext;
  const availableManeuvers = filterManeuvers(ManeuverCatalog as Maneuver[], turnContext, (combatRulesPreset as string) || 'standard') as Maneuver[];
  const selectedManeuverId = currentTurnDecision?.maneuverId || null;
  const selectedManeuver = (ManeuverCatalog as Maneuver[]).find(m => m.id === selectedManeuverId) || null;
  const maneuverSelection = selectedManeuver
    ? { selectedId: selectedManeuverId, prompts: selectedManeuver.prompts || {}, workflow: selectedManeuver.workflow || {} }
    : { selectedId: null, prompts: {}, workflow: {} };

  const isEnemyInPlayerView = viewMode === ViewMode.PLAYER && currentActor?.category === 'enemy';

  // --------------------------------------------------------------------------
  // Action helpers
  // --------------------------------------------------------------------------

  const normalizeTurnDecision = (decision: TurnDecision | null): TurnDecision | null => {
    if (!decision) return null;
    const hasManeuver = Boolean(decision.maneuverId);
    const hasNotes = Boolean(decision.notes && decision.notes.trim());
    const hasAim = Boolean(decision.aim?.targetInstanceId || decision.aim?.turnsAimed);
    const hasWait = Boolean(decision.wait?.triggerText && decision.wait.triggerText.trim());
    if (!hasManeuver && !hasNotes && !hasAim && !hasWait) return null;
    return {
      ...decision,
      notes: decision.notes || undefined,
      aim: decision.aim || undefined,
      wait: decision.wait || undefined,
    };
  };

  const updateTurnDecisionState = (previousDecision: TurnDecision | null, nextDecision: TurnDecision | null) => {
    if (!turnDecisionKey) return;
    const normalizedDecision = normalizeTurnDecision(nextDecision);
    const updatedTurnDecisions = { ...turnDecisions };
    if (normalizedDecision) {
      updatedTurnDecisions[turnDecisionKey] = normalizedDecision;
    } else {
      delete updatedTurnDecisions[turnDecisionKey];
    }
    saveCombatActive({ ...combat, turnDecisions: updatedTurnDecisions });
    recordAction(createSetTurnDecisionAction(turnDecisionKey, previousDecision || null, normalizedDecision));
  };

  // --------------------------------------------------------------------------
  // Extracted hooks
  // --------------------------------------------------------------------------

  const exportActions = useCombatExport(viewMode, history);

  const { handleActionComplete } = useActionResolution({
    combat,
    reveal,
    currentActorInstanceId,
    currentActorName: currentActor?.name ?? 'Unknown',
    selectedManeuver: selectedManeuverId,
    recordAction,
  });

  const {
    handleAddCondition,
    handleRemoveCondition,
    handleUpdateCondition,
    handleCycleConditionRevealed,
    addConditionTo,
    removeConditionFrom,
    cycleConditionRevealedOn,
  } = useCombatConditions({ combat, currentActorTruth, recordAction });

  // Phase 12a.6: open the condition popover for any participant (GM only)
  const openConditionPopover = useCallback(
    (instanceId: string, anchor: { x: number; y: number }) => {
      setConditionPopover({ instanceId, x: anchor.x, y: anchor.y });
    },
    [],
  );

  const { handleAddReinforcements } = useCombatReinforcements({
    combat,
    reveal,
    recordAction,
  });

  // --------------------------------------------------------------------------
  // Turn management
  // --------------------------------------------------------------------------

  const handleNextTurn = () => {
    const nextIndex = combat.currentTurnIndex + 1;
    const isNewRound = nextIndex >= combat.turnOrder.length;
    const toTurnIndex = isNewRound ? 0 : nextIndex;
    const toRound = isNewRound ? combat.currentRound + 1 : combat.currentRound;

    const action = createTurnAdvanceAction(combat.currentRound, combat.currentTurnIndex, toRound, toTurnIndex);

    const nextActorInstanceId = combat.turnOrder[toTurnIndex];
    const nextActor = combat.participants.find(p => p.instanceId === nextActorInstanceId);

    let updatedParticipants = combat.participants.map(p =>
      p.instanceId === nextActorInstanceId ? clearShock(p) as Participant : p
    );

    const expiredConditions: Array<{ participant: Participant; condition: ConditionInstance }> = [];

    if (isNewRound) {
      updatedParticipants = updatedParticipants.map(p => {
        const result = tickConditionsRound(p, toRound) as { combatant: Participant; expired: ConditionInstance[] };
        if (result.expired.length > 0) {
          expiredConditions.push(...result.expired.map(c => ({ participant: p, condition: c })));
        }
        return result.combatant;
      });
    }

    const nextActorUpdated = updatedParticipants.find(p => p.instanceId === nextActorInstanceId);
    if (nextActorUpdated) {
      const result = tickConditionsTurn(nextActorUpdated, toRound) as { combatant: Participant; expired: ConditionInstance[] };
      if (result.expired.length > 0) {
        expiredConditions.push(...result.expired.map(c => ({ participant: nextActorUpdated, condition: c })));
      }
      updatedParticipants = updatedParticipants.map(p =>
        p.instanceId === nextActorInstanceId ? result.combatant : p
      );
    }

    const newCombat: CombatState = {
      ...combat,
      currentRound: toRound,
      currentTurnIndex: toTurnIndex,
      participants: updatedParticipants,
    };

    saveCombatActive(newCombat);
    recordAction(action);

    const logEntries: LogEntry[] = [];
    if (isNewRound) {
      const roundLogEntry = createTurnLogEntry(toRound, toTurnIndex, null, `=== Round ${toRound} ===`);
      recordAction(createAddLogEntryAction(roundLogEntry));
      logEntries.push(roundLogEntry);
    }

    const turnLogEntry = createTurnLogEntry(toRound, toTurnIndex, nextActorInstanceId, nextActor?.name ?? 'Unknown');
    recordAction(createAddLogEntryAction(turnLogEntry));
    logEntries.push(turnLogEntry);

    for (const { participant, condition } of expiredConditions) {
      const condLogEntry = createTurnLogEntry(
        toRound,
        toTurnIndex,
        participant.instanceId,
        `${condition.label} expired on ${participant.name}`
      );
      recordAction(createAddLogEntryAction(condLogEntry));
      logEntries.push(condLogEntry);
    }

    saveCombatActive((prev) => (prev ? { ...prev, log: [...prev.log, ...logEntries] } : prev));
  };

  const handlePrevTurn = () => {
    const prevIndex = combat.currentTurnIndex - 1;
    const isPrevRound = prevIndex < 0;
    const toTurnIndex = isPrevRound ? combat.turnOrder.length - 1 : prevIndex;
    const toRound = isPrevRound ? Math.max(1, combat.currentRound - 1) : combat.currentRound;

    const action = createTurnAdvanceAction(combat.currentRound, combat.currentTurnIndex, toRound, toTurnIndex);

    saveCombatActive({
      ...combat,
      currentRound: toRound,
      currentTurnIndex: toTurnIndex,
    });
    recordAction(action);
  };

  const handleJumpToTurn = (targetIndex: number) => {
    if (targetIndex === combat.currentTurnIndex) return;
    if (targetIndex < 0 || targetIndex >= combat.turnOrder.length) return;

    const action = createTurnAdvanceAction(
      combat.currentRound, combat.currentTurnIndex,
      combat.currentRound, targetIndex
    );

    saveCombatActive({
      ...combat,
      currentTurnIndex: targetIndex,
    });
    recordAction(action);
  };

  const handleReorderTurnOrder = (newTurnOrder: string[]) => {
    const oldTurnOrder = combat.turnOrder;
    if (JSON.stringify(oldTurnOrder) === JSON.stringify(newTurnOrder)) return;

    // Track the current actor so their turn isn't lost after reorder
    const currentActorId = oldTurnOrder[combat.currentTurnIndex];
    const newCurrentIndex = newTurnOrder.indexOf(currentActorId);

    const action = createReorderTurnOrderAction(oldTurnOrder, newTurnOrder);
    const updatedIndex = newCurrentIndex >= 0 ? newCurrentIndex : combat.currentTurnIndex;

    // Log the reorder so the GM can see what changed
    const logEntry = createNoteLogEntry(
      combat.currentRound, updatedIndex, null, null, 'Turn order changed (drag reorder)'
    );

    saveCombatActive({
      ...combat,
      turnOrder: newTurnOrder,
      currentTurnIndex: updatedIndex,
      log: [...combat.log, logEntry],
    });
    recordAction(action);
    recordAction(createAddLogEntryAction(logEntry));
  };

  // --------------------------------------------------------------------------
  // Resource management
  // --------------------------------------------------------------------------

  const updateResource = (instanceId: string, resource: string, newValue: number) => {
    const participant = combat.participants.find(p => p.instanceId === instanceId);
    if (!participant) return;

    const resourceKey = `current${resource}` as keyof Participant;
    const oldValue = (participant[resourceKey] as number | undefined) ?? 0;
    if (oldValue === newValue) return;

    const resourceAction = createSetResourceAction(instanceId, resource as "HP" | "FP" | "MP", oldValue, newValue);
    const updatedParticipants = combat.participants.map(p =>
      p.instanceId === instanceId ? { ...p, [resourceKey]: newValue } : p
    );

    saveCombatActive({ ...combat, participants: updatedParticipants });
    recordAction(resourceAction);

    const logEntry = createResourceLogEntry(
      combat.currentRound, combat.currentTurnIndex,
      instanceId, participant.name, resource as "HP" | "FP" | "MP", oldValue, newValue
    );
    saveCombatActive((prev) => (prev ? { ...prev, log: [...prev.log, logEntry] } : prev));
    recordAction(createAddLogEntryAction(logEntry));
  };

  // --------------------------------------------------------------------------
  // Maneuver selection
  // --------------------------------------------------------------------------

  const handleSelectManeuver = (maneuverId: string | null) => {
    if (!currentActorTruth || !turnDecisionKey) return;
    const previousDecision = turnDecisions[turnDecisionKey] || null;
    const nextDecision: TurnDecision = {
      ...(previousDecision || {}),
      maneuverId: maneuverId || undefined,
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
        shockPenalty: turnContext.shockPenalty,
      },
    });
    saveCombatActive((prev) => (prev ? { ...prev, log: [...prev.log, logEntry] } : prev));
    recordAction(createAddLogEntryAction(logEntry));
  };

  const handleManeuverWorkflowUpdate = (update: { type: string; targetInstanceId?: string; turnsAimed?: number; triggerText?: string }) => {
    if (!currentActorTruth || !turnDecisionKey) return;
    const previousDecision = turnDecisions[turnDecisionKey] || null;
    const nextDecision: TurnDecision = { ...(previousDecision || {}) };
    if (update.type === 'aim') {
      nextDecision.aim = {
        ...(nextDecision.aim || {}),
        ...(update.targetInstanceId !== undefined ? { targetInstanceId: update.targetInstanceId } : {}),
        ...(update.turnsAimed !== undefined ? { turnsAimed: update.turnsAimed } : {}),
      };
    }
    if (update.type === 'wait') {
      nextDecision.wait = {
        ...(nextDecision.wait || {}),
        ...(update.triggerText !== undefined ? { triggerText: update.triggerText } : {}),
      };
    }
    updateTurnDecisionState(previousDecision, nextDecision);
  };

  // --------------------------------------------------------------------------
  // Dice rolling
  // --------------------------------------------------------------------------

  const handleRoll = () => {
    if (!diceExpression.trim()) return;
    let rollResult: RollResult | RollVsTargetResult;
    if (rollTarget && rollTarget.trim()) {
      const target = parseInt(rollTarget);
      if (isNaN(target)) { alert('Invalid target number'); return; }
      rollResult = rollVsTarget(diceExpression, target);
    } else {
      rollResult = roll(diceExpression);
    }
    if (!rollResult.valid) { alert(`Roll error: ${rollResult.error}`); return; }

    const logEntry = createRollLogEntry(
      combat.currentRound, combat.currentTurnIndex,
      currentActorInstanceId, currentActor?.name || 'Unknown', rollResult
    );
    saveCombatActive((prev) => (prev ? { ...prev, log: [...prev.log, logEntry] } : prev));
    recordAction(createAddLogEntryAction(logEntry));
  };

  // --------------------------------------------------------------------------
  // Notes
  // --------------------------------------------------------------------------

  const handleAddNote = () => {
    if (!noteText.trim()) return;
    const logEntry = createNoteLogEntry(
      combat.currentRound, combat.currentTurnIndex,
      currentActorInstanceId, currentActor?.name || null, noteText
    );
    saveCombatActive((prev) => (prev ? { ...prev, log: [...prev.log, logEntry] } : prev));
    recordAction(createAddLogEntryAction(logEntry));
    setNoteText('');
  };

  // --------------------------------------------------------------------------
  // Combat end
  // --------------------------------------------------------------------------

  const handleEndCombat = async () => {
    const confirmed = await endCombatDialog.confirm();
    if (!confirmed) return;

    const endLogEntry = createNoteLogEntry(
      combat.currentRound, combat.currentTurnIndex, null, null, 'Combat ended'
    );
    const endedCombat: CombatState = {
      ...combat,
      endTime: Date.now(),
      log: [...combat.log, endLogEntry],
    };

    // Save to history
    const newHistory = [endedCombat, ...combatHistory].slice(0, MAX_COMBAT_HISTORY);
    saveCombatHistory(newHistory);

    // Enter post-combat flow — keep combat active in store until flow completes
    // so CombatTab continues to render CombatTracker
    setEndedCombatSnapshot(endedCombat);
    setPostCombatPhase('summary');
    // Note: we do NOT call saveCombatActive(null) yet — that happens when the flow completes
  };

  /** Finalize post-combat flow and return to normal view */
  const handlePostCombatComplete = () => {
    setPostCombatPhase('active');
    setEndedCombatSnapshot(null);
    saveCombatActive(null);
  };

  // --------------------------------------------------------------------------
  // Post-combat flow renders (Phase 11c)
  // --------------------------------------------------------------------------

  if (postCombatPhase === 'summary' && endedCombatSnapshot) {
    return (
      <div className="py-6">
        <PostCombatSummary
          combat={endedCombatSnapshot}
          onComplete={handlePostCombatComplete}
          onProceedToLoot={() => setPostCombatPhase('loot')}
        />
      </div>
    );
  }

  if (postCombatPhase === 'loot' && endedCombatSnapshot) {
    return (
      <div className="py-6">
        <LootDistribution onComplete={handlePostCombatComplete} />
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <div className="space-y-4">
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
        onExportPlayerView={exportActions?.handleExportPlayerView ?? (() => {})}
        onExportGMLocked={exportActions?.handleExportGMLocked ?? (async () => {})}
        onSaveCombat={exportActions?.handleSaveCombat ?? (() => {})}
        onExportLog={exportActions?.handleExportLog ?? (() => {})}
        onLoadCombat={() => exportActions?.handleLoadCombat(loadCombatDialog.confirm)}
        onEndCombat={handleEndCombat}
      />

      <ViewModeToggle
        viewMode={viewMode}
        setViewMode={setViewMode}
        gmMode={gmMode}
        setGmMode={setGmMode}
      />

      {/* Battle map link (GM only) — linking switches the shell into map-combat layout */}
      {gmMode && (
        <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2">
          <MapIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <span className="text-sm font-medium text-gray-300">Battle Map</span>
          <select
            aria-label="Battle map"
            value={combat.mapId ?? ''}
            onChange={(e) =>
              saveCombatActive({ ...combat, mapId: e.target.value || undefined })
            }
            className="flex-1 min-w-0 rounded border border-gray-600 bg-gray-900 px-2 py-1 text-sm text-gray-200"
          >
            <option value="">None (tracker only)</option>
            {availableMaps.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          {!combat.mapId && (
            <span className="text-xs text-gray-500">tokens, movement &amp; LOS need a map</span>
          )}
        </div>
      )}

      <InitiativeTimeline
        participants={combatView.participants}
        turnOrder={combat.turnOrder}
        currentTurnIndex={combat.currentTurnIndex}
        currentRound={combat.currentRound}
        onPrevTurn={handlePrevTurn}
        onNextTurn={handleNextTurn}
        onJumpToTurn={handleJumpToTurn}
        onReorderTurnOrder={handleReorderTurnOrder}
        onOpenConditions={viewMode === ViewMode.GM ? openConditionPopover : undefined}
      />

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

      <ActionPanel
        currentActor={currentActor}
        participants={combatView.participants}
        combatState={combat}
        revealState={reveal}
        viewMode={viewMode}
        onActionComplete={handleActionComplete}
        combatRulesPreset={(combatRulesPreset as string) || 'standard'}
        expanded={showActionPanel}
        onToggleExpanded={() => setShowActionPanel(!showActionPanel)}
        maneuverSelection={isEnemyInPlayerView ? { selectedId: null, prompts: {}, workflow: {} } : maneuverSelection}
        onManeuverWorkflow={handleManeuverWorkflowUpdate}
        turnDecision={isEnemyInPlayerView ? null : currentTurnDecision}
        currentRound={combat.currentRound}
        currentTurn={combat.currentTurnIndex}
        onAddCondition={handleAddCondition}
        onRemoveCondition={handleRemoveCondition}
        onUpdateCondition={handleUpdateCondition}
        onCycleRevealed={handleCycleConditionRevealed}
      />

      {showReinforcementsModal && (
        <ReinforcementsModal
          onClose={() => setShowReinforcementsModal(false)}
          onConfirm={(data) => {
            handleAddReinforcements(data);
            setShowReinforcementsModal(false);
          }}
          combatCharacters={combatCharacters}
          participants={combat.participants}
          turnOrder={combat.turnOrder}
          currentActorInstanceId={currentActorInstanceId}
        />
      )}

      {viewMode === ViewMode.GM && (
        <RevealPanel
          combatActive={combat}
          combatReveal={reveal}
          saveCombatReveal={saveCombatReveal}
          viewMode={viewMode}
        />
      )}

      <DicePanelView
        showDicePanel={showDicePanel}
        diceExpression={diceExpression}
        rollTarget={rollTarget}
        onToggleDicePanel={() => setShowDicePanel(!showDicePanel)}
        onSetDiceExpression={setDiceExpression}
        onSetRollTarget={setRollTarget}
        onRoll={handleRoll}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ParticipantListView
          participants={combatView.participants}
          currentActorInstanceId={currentActorInstanceId}
          viewMode={viewMode}
          onUpdateResource={updateResource}
          onOpenConditions={viewMode === ViewMode.GM ? openConditionPopover : undefined}
        />
        <CombatLogView
          displayLog={displayLog}
          noteText={noteText}
          onSetNoteText={setNoteText}
          onAddNote={handleAddNote}
        />
      </div>

      {/* Phase 12a.6: two-surface condition popover (GM view only) */}
      {conditionPopover && viewMode === ViewMode.GM && (() => {
        const truthParticipant = combat.participants.find(
          (p) => p.instanceId === conditionPopover.instanceId,
        );
        if (!truthParticipant) return null;
        return (
          <ConditionAddPopover
            participant={{ ...truthParticipant, id: truthParticipant.instanceId }}
            currentRound={combat.currentRound}
            currentTurn={combat.currentTurnIndex}
            anchor={{ x: conditionPopover.x, y: conditionPopover.y }}
            onClose={() => setConditionPopover(null)}
            onAddCondition={(c) => addConditionTo(conditionPopover.instanceId, c)}
            onRemoveCondition={(id) => removeConditionFrom(conditionPopover.instanceId, id)}
            onCycleRevealed={(id) => cycleConditionRevealedOn(conditionPopover.instanceId, id)}
          />
        );
      })()}

      <ConfirmDialog {...endCombatDialog.dialogProps} />
      <ConfirmDialog {...loadCombatDialog.dialogProps} />
    </div>
  );
}
