import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ClipboardList,
  Hammer,
  Info,
  ScrollText,
  ShieldAlert,
  Users,
  Wrench,
} from 'lucide-react';
import { createPartyToolState, PARTY_TOOL_SKILLS } from '../partyToolSeed';
import { ReservationEngine } from '../../utils/reservationEngine';
import { InventoryManager } from '../../utils/inventoryManager';
import { advanceTimeSlot } from '../../utils/timeSystem';
import { calculateActivityBonuses } from '../../utils/activityCalculator';
import { preResolutionCheck, resolveActivity } from '../../utils/activityResolver';

const formatNumber = (value) => {
  if (value === 0) {
    return '0';
  }
  const abs = Math.abs(value);
  return value > 0 ? `+${abs}` : `-${abs}`;
};

const getModifierClass = (value) => {
  if (value > 0) {
    return 'text-emerald-300';
  }
  if (value < 0) {
    return 'text-rose-300';
  }
  return 'text-gray-300';
};

const getInventoryLabel = (inventory, characters) => {
  if (inventory.ownerType === 'party') {
    return 'Party Stash';
  }
  if (inventory.ownerId && characters[inventory.ownerId]?.name) {
    return `${characters[inventory.ownerId].name}'s Pack`;
  }
  return 'Unknown Inventory';
};

export function PartyToolApp() {
  const [activeTab, setActiveTab] = useState('activity');
  const [state, setState] = useState(createPartyToolState);
  const [reservationMap, setReservationMap] = useState({});
  const [activityLogs, setActivityLogs] = useState([]);
  const [timeLogs, setTimeLogs] = useState([]);
  const [currentSlot, setCurrentSlot] = useState(0);
  const [selectedSkill, setSelectedSkill] = useState(PARTY_TOOL_SKILLS[0]);
  const [primaryWorkerId, setPrimaryWorkerId] = useState('');
  const [helperIds, setHelperIds] = useState([]);
  const [toolSelections, setToolSelections] = useState({});
  const [selectedFacilityId, setSelectedFacilityId] = useState('implicit');
  const [gmOverride, setGmOverride] = useState(false);
  const [transferState, setTransferState] = useState(null);
  const sessionId = 'active-activity-session';

  const reservationEngine = useMemo(
    () => new ReservationEngine(state, reservationMap),
    [state, reservationMap]
  );
  const inventoryManager = useMemo(
    () => new InventoryManager(state, reservationEngine),
    [state, reservationEngine]
  );

  useEffect(() => {
    setReservationMap({ ...reservationEngine.activeReservations });
  }, []);

  const playerWorkers = useMemo(() => {
    return Object.values(state.characters).filter(
      (character) => character.isPlayer && character.work?.skills?.[selectedSkill]
    );
  }, [state.characters, selectedSkill]);

  useEffect(() => {
    if (!primaryWorkerId && playerWorkers.length > 0) {
      setPrimaryWorkerId(playerWorkers[0].id);
    }
  }, [playerWorkers, primaryWorkerId]);

  const selectedWorkers = useMemo(() => {
    const workerMap = new Map();
    if (primaryWorkerId) {
      workerMap.set(primaryWorkerId, state.characters[primaryWorkerId]);
    }
    helperIds.forEach((helperId) => {
      if (state.characters[helperId]) {
        workerMap.set(helperId, state.characters[helperId]);
      }
    });
    return Array.from(workerMap.values()).filter(Boolean);
  }, [primaryWorkerId, helperIds, state.characters]);

  const combinedTools = useMemo(() => {
    const toolList = [];
    selectedWorkers.forEach((worker) => {
      const inventory = Object.values(state.inventories).find(
        (inv) => inv.ownerId === worker.id
      );
      if (inventory) {
        inventory.tools.forEach((tool) => {
          toolList.push({
            ...tool,
            ownerId: worker.id,
            ownerName: worker.name ?? 'Unknown',
          });
        });
      }
    });
    return toolList;
  }, [selectedWorkers, state.inventories]);

  const reservedToolSessions = useMemo(() => {
    const mapping = {};
    Object.entries(reservationMap).forEach(([reservedSession, tools]) => {
      tools.forEach((toolId) => {
        mapping[toolId] = reservedSession;
      });
    });
    return mapping;
  }, [reservationMap]);

  const toolSelectionsList = useMemo(() => {
    return Object.entries(toolSelections)
      .filter(([, toolId]) => toolId)
      .map(([workerId, toolId]) => {
        const toolInstance = state.toolInstances[toolId];
        const template = toolInstance ? state.toolTemplates[toolInstance.templateId] : null;
        const modifiers =
          template?.activityCategories?.[selectedSkill] ?? {
            skillBonus: 0,
            yieldFlat: 0,
            yieldPercent: 0,
            timeBonus: 0,
            riskModifier: 0,
            qualityModifier: 0,
          };

        return {
          toolId,
          name: template?.name ?? 'Unknown Tool',
          assignedWorkerId: workerId,
          conditionId: toolInstance?.conditionId,
          modifiers,
        };
      });
  }, [toolSelections, state.toolInstances, state.toolTemplates, selectedSkill]);

  const facilitySelection = useMemo(() => {
    if (selectedFacilityId === 'implicit') {
      return null;
    }
    const facility = state.facilities[selectedFacilityId];
    if (!facility) {
      return null;
    }
    return {
      facilityId: facility.id,
      name: facility.name,
      conditionId: facility.conditionId,
      modifiers: facility.activityCategories?.[selectedSkill] ?? {
        skillBonus: 0,
        yieldFlat: 0,
        yieldPercent: 0,
        timeBonus: 0,
        riskModifier: 0,
        qualityModifier: 0,
      },
    };
  }, [selectedFacilityId, selectedSkill, state.facilities]);

  const activityTotals = useMemo(() => {
    if (!primaryWorkerId) {
      return null;
    }
    return calculateActivityBonuses({
      primaryWorkerId,
      helperWorkerIds: helperIds,
      toolsUsed: toolSelectionsList.map((tool) => ({
        toolId: tool.toolId,
        assignedWorkerId: tool.assignedWorkerId,
        modifiers: tool.modifiers,
        conditionId: tool.conditionId,
      })),
      facility: facilitySelection
        ? {
            facilityId: facilitySelection.facilityId,
            modifiers: facilitySelection.modifiers,
            conditionId: facilitySelection.conditionId,
          }
        : null,
    });
  }, [primaryWorkerId, helperIds, toolSelectionsList, facilitySelection]);

  const validation = useMemo(() => {
    if (!primaryWorkerId || !state.characters[primaryWorkerId]) {
      return { warnings: [], errors: [] };
    }
    const primaryWorker = {
      id: primaryWorkerId,
      skills: state.characters[primaryWorkerId].work?.skills ?? {},
    };
    const helpers = helperIds
      .map((helperId) => state.characters[helperId])
      .filter(Boolean)
      .map((helper) => ({
        id: helper.id,
        skills: helper.work?.skills ?? {},
      }));

    return preResolutionCheck({
      sessionId,
      skillKey: selectedSkill,
      primaryWorker,
      helpers,
      toolsUsed: toolSelectionsList,
      facility: facilitySelection
        ? {
            facilityId: facilitySelection.facilityId,
            name: facilitySelection.name,
            conditionId: facilitySelection.conditionId,
            modifiers: facilitySelection.modifiers,
          }
        : null,
      inventories: state.inventories,
      consumables: [],
      reservedToolSessions,
    });
  }, [
    primaryWorkerId,
    helperIds,
    selectedSkill,
    toolSelectionsList,
    facilitySelection,
    state.characters,
    state.inventories,
    reservedToolSessions,
  ]);

  const hasHardStop = activityTotals?.hardStop ?? false;
  const hardStopMessage = activityTotals?.errorMessage;
  const isResolveDisabled = (validation.errors.length > 0 || hasHardStop) && !gmOverride;

  const resetSelections = () => {
    setHelperIds([]);
    setToolSelections({});
    setSelectedFacilityId('implicit');
    setGmOverride(false);
  };

  const syncReservations = (nextSelections) => {
    const nextEngine = new ReservationEngine(state, { ...reservationMap });
    nextEngine.clearAllReservations();
    Object.values(nextSelections).forEach((toolId) => {
      if (toolId) {
        nextEngine.reserveTool(sessionId, toolId);
      }
    });
    setReservationMap({ ...nextEngine.activeReservations });
  };

  const handleHelperToggle = (helperId) => {
    setHelperIds((prev) => {
      if (prev.includes(helperId)) {
        const nextHelpers = prev.filter((id) => id !== helperId);
        const toolId = toolSelections[helperId];
        if (toolId) {
          reservationEngine.invalidateReservationsForTool(toolId);
          const nextSelections = { ...toolSelections };
          delete nextSelections[helperId];
          setToolSelections(nextSelections);
          setReservationMap({ ...reservationEngine.activeReservations });
          syncReservations(nextSelections);
        }
        return nextHelpers;
      }
      return [...prev, helperId];
    });
  };

  const handleToolSelection = (workerId, toolId) => {
    const nextSelections = { ...toolSelections, [workerId]: toolId };
    setToolSelections(nextSelections);
    syncReservations(nextSelections);
  };

  const handleResolve = () => {
    if (!primaryWorkerId) {
      return;
    }
    const primaryWorker = {
      id: primaryWorkerId,
      skills: state.characters[primaryWorkerId].work?.skills ?? {},
    };
    const helpers = helperIds
      .map((helperId) => state.characters[helperId])
      .filter(Boolean)
      .map((helper) => ({
        id: helper.id,
        skills: helper.work?.skills ?? {},
      }));

    const result = resolveActivity(
      {
        sessionId,
        skillKey: selectedSkill,
        primaryWorker,
        helpers,
        toolsUsed: toolSelectionsList,
        facility: facilitySelection
          ? {
              facilityId: facilitySelection.facilityId,
              name: facilitySelection.name,
              conditionId: facilitySelection.conditionId,
              modifiers: facilitySelection.modifiers,
            }
          : null,
        inventories: state.inventories,
        consumables: [],
        reservedToolSessions,
      },
      gmOverride
    );

    setActivityLogs((prev) => [
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        timestamp: Date.now(),
        outcome: result.logEntry.outcome,
        primaryWorkerId: result.logEntry.primaryWorkerId,
        helperIds: result.logEntry.helperIds,
        toolNames: result.logEntry.toolNames,
        totalModifiers: result.logEntry.totalModifiers,
        gmOverrideUsed: result.logEntry.gmOverrideUsed,
      },
      ...prev,
    ]);
  };

  const handleTransfer = () => {
    if (!transferState || !transferState.targetInventoryId) {
      return;
    }
    if (transferState.type === 'currency') {
      inventoryManager.transferCurrency(
        transferState.sourceInventoryId,
        transferState.targetInventoryId,
        transferState.currencyKey,
        Number(transferState.amount || 0)
      );
    } else {
      inventoryManager.transferItem(
        transferState.sourceInventoryId,
        transferState.targetInventoryId,
        transferState.itemId
      );
    }
    setState((prev) => ({
      ...prev,
      inventories: { ...prev.inventories },
      currencyLogs: [...prev.currencyLogs],
      toolInstances: { ...prev.toolInstances },
    }));
    setTransferState(null);
  };

  const handleAdvanceTime = () => {
    const { nextSlot, logEntry } = advanceTimeSlot(currentSlot, reservationEngine, {
      totalSlots: 3,
      slotLabels: ['Morning', 'Afternoon', 'Evening'],
      clearEquipmentSelections: () => {
        resetSelections();
      },
      logEntry: (entry) => {
        setTimeLogs((prev) => [entry, ...prev]);
      },
    });
    setCurrentSlot(nextSlot);
    setReservationMap({ ...reservationEngine.activeReservations });
    resetSelections();
    setTimeLogs((prev) => [logEntry, ...prev]);
  };

  const allInventories = Object.values(state.inventories);

  const unifiedLogs = useMemo(() => {
    const activityEntries = activityLogs.map((entry) => ({
      type: 'activity',
      timestamp: entry.timestamp,
      entry,
    }));
    const currencyEntries = state.currencyLogs.map((entry) => ({
      type: 'currency',
      timestamp: entry.timestamp,
      entry,
    }));
    return [...activityEntries, ...currencyEntries].sort(
      (a, b) => b.timestamp - a.timestamp
    );
  }, [activityLogs, state.currencyLogs]);

  return (
    <div className="min-h-screen bg-slate-950 text-gray-100">
      <header className="border-b border-slate-800 bg-slate-900/80 px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-white">GURPS Party Tool</h1>
            <p className="text-sm text-slate-300">
              Coordinate activities, track tools, and manage party logistics in real time.
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-300">
            <span className="rounded-full bg-slate-800 px-3 py-1">
              Time Slot: {['Morning', 'Afternoon', 'Evening'][currentSlot]}
            </span>
            <span className="rounded-full bg-slate-800 px-3 py-1">
              Active Reservations: {Object.keys(reservedToolSessions).length}
            </span>
          </div>
        </div>
      </header>

      <div className="px-6 py-4">
        <nav className="flex flex-wrap gap-2 border-b border-slate-800 pb-4 text-sm">
          {[
            { id: 'activity', label: 'Active Activity', icon: ClipboardList },
            { id: 'inventories', label: 'Inventories', icon: Users },
            { id: 'logs', label: 'Logs', icon: ScrollText },
            { id: 'gm', label: 'GM Workshop', icon: Wrench },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-full px-4 py-2 transition ${
                activeTab === tab.id
                  ? 'bg-indigo-500/20 text-indigo-200'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </nav>

        {activeTab === 'activity' && (
          <section className="mt-6 grid gap-6 lg:grid-cols-[2fr,1fr]">
            <div className="space-y-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">Activity Configurator</h2>
                  <p className="text-sm text-slate-300">
                    Assign workers, reserve equipment, and preview the activity outcome.
                  </p>
                </div>
                <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
                  Session: {sessionId}
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm">
                  Activity Skill
                  <select
                    value={selectedSkill}
                    onChange={(event) => {
                      setSelectedSkill(event.target.value);
                      resetSelections();
                    }}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
                  >
                    {PARTY_TOOL_SKILLS.map((skill) => (
                      <option key={skill} value={skill}>
                        {skill}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-2 text-sm">
                  Primary Worker
                  <select
                    value={primaryWorkerId}
                    onChange={(event) => {
                      setPrimaryWorkerId(event.target.value);
                      resetSelections();
                    }}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
                  >
                    {playerWorkers.map((worker) => (
                      <option key={worker.id} value={worker.id}>
                        {worker.name} (Skill {worker.work.skills[selectedSkill]})
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                  <Users className="h-4 w-4" /> Helpers
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {playerWorkers
                    .filter((worker) => worker.id !== primaryWorkerId)
                    .map((worker) => (
                      <label
                        key={worker.id}
                        className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={helperIds.includes(worker.id)}
                          onChange={() => handleHelperToggle(worker.id)}
                          className="h-4 w-4 rounded border-slate-500 bg-slate-900 text-indigo-400"
                        />
                        <span>{worker.name}</span>
                        <span className="ml-auto text-xs text-slate-400">
                          Skill {worker.work.skills[selectedSkill]}
                        </span>
                      </label>
                    ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                  <Hammer className="h-4 w-4" /> Equipment Slots
                </div>
                <div className="grid gap-4">
                  {[primaryWorkerId, ...helperIds].filter(Boolean).map((workerId) => {
                    const worker = state.characters[workerId];
                    if (!worker) {
                      return null;
                    }
                    return (
                      <label
                        key={workerId}
                        className="flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-sm"
                      >
                        <span className="text-slate-300">
                          {worker.name}'s Tool
                        </span>
                        <select
                          value={toolSelections[workerId] ?? ''}
                          onChange={(event) => handleToolSelection(workerId, event.target.value)}
                          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
                        >
                          <option value="">No tool selected</option>
                          {combinedTools.map((tool) => {
                            const template = state.toolTemplates[tool.templateId];
                            const isReserved =
                              reservedToolSessions[tool.toolId] &&
                              reservedToolSessions[tool.toolId] !== sessionId;
                            const displayName = `${template?.name ?? 'Unknown Tool'} (${
                              tool.ownerName
                            })`;
                            return (
                              <option
                                key={tool.toolId}
                                value={tool.toolId}
                                disabled={isReserved}
                              >
                                {isReserved ? `Reserved • ${displayName}` : displayName}
                                {tool.conditionId === 'Broken' ? ' • Broken' : ''}
                              </option>
                            );
                          })}
                        </select>
                      </label>
                    );
                  })}
                </div>
                <div className="text-xs text-slate-400">
                  Reserved tools appear with strike-through styling elsewhere in the UI.
                </div>
              </div>

              <label className="flex flex-col gap-2 text-sm">
                Facility
                <select
                  value={selectedFacilityId}
                  onChange={(event) => setSelectedFacilityId(event.target.value)}
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
                >
                  <option value="implicit">Implicit Basic +0</option>
                  {Object.values(state.facilities).map((facility) => (
                    <option key={facility.id} value={facility.id}>
                      {facility.name} {facility.conditionId === 'Broken' ? '• Broken' : ''}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
                <h3 className="text-sm font-semibold text-slate-200">Real-time Modifiers</h3>
                {activityTotals ? (
                  <table className="mt-4 w-full text-sm text-slate-300">
                    <tbody className="divide-y divide-slate-800">
                      {[
                        ['Skill', activityTotals.skillBonus],
                        ['Yield Flat', activityTotals.yieldFlat],
                        ['Yield %', activityTotals.yieldPercent],
                        ['Time', activityTotals.timeBonus],
                        ['Risk', activityTotals.riskModifier],
                        ['Quality', activityTotals.qualityModifier],
                      ].map(([label, value]) => (
                        <tr key={label} className="border-slate-800">
                          <td className="py-2">{label}</td>
                          <td className={`py-2 text-right ${getModifierClass(value)}`}>
                            {formatNumber(value)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="mt-4 text-sm text-slate-400">
                    Select a primary worker to compute modifiers.
                  </p>
                )}
                {hasHardStop && hardStopMessage && (
                  <div className="mt-4 flex items-start gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-200">
                    <ShieldAlert className="mt-0.5 h-4 w-4" />
                    {hardStopMessage}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                  <AlertTriangle className="h-4 w-4 text-amber-300" /> Pre-Resolution Checklist
                </div>
                <div className="mt-4 space-y-3 text-sm">
                  {validation.errors.length === 0 && validation.warnings.length === 0 && (
                    <div className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-emerald-200">
                      <Info className="h-4 w-4" /> All checks passed.
                    </div>
                  )}
                  {validation.errors.map((error) => (
                    <div
                      key={error}
                      className="flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-rose-200"
                    >
                      <ShieldAlert className="h-4 w-4" />
                      {error}
                    </div>
                  ))}
                  {validation.warnings.map((warning) => (
                    <div
                      key={warning}
                      className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-amber-200"
                    >
                      <AlertTriangle className="h-4 w-4" />
                      {warning}
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between gap-4 text-xs text-slate-300">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={gmOverride}
                      onChange={(event) => setGmOverride(event.target.checked)}
                      className="h-4 w-4 rounded border-slate-500 bg-slate-900 text-indigo-400"
                    />
                    GM Override
                  </label>
                  {gmOverride && (
                    <span className="rounded-full bg-rose-500/20 px-3 py-1 text-rose-200">
                      Override active
                    </span>
                  )}
                </div>
                <button
                  onClick={handleResolve}
                  disabled={isResolveDisabled}
                  className={`mt-4 w-full rounded-lg px-4 py-2 text-sm font-semibold transition ${
                    isResolveDisabled
                      ? 'cursor-not-allowed bg-slate-800 text-slate-500'
                      : 'bg-indigo-500 text-white hover:bg-indigo-400'
                  }`}
                >
                  Resolve Activity
                </button>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'inventories' && (
          <section className="mt-6 grid gap-6 lg:grid-cols-[2fr,1fr]">
            <div className="space-y-6">
              {allInventories.map((inventory) => (
                <div
                  key={inventory.id}
                  className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">
                      {getInventoryLabel(inventory, state.characters)}
                    </h3>
                    <span className="text-xs text-slate-400">{inventory.id}</span>
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-300">Items</h4>
                      <ul className="mt-2 space-y-2 text-sm text-slate-200">
                        {inventory.items.map((item) => (
                          <li
                            key={item.id}
                            className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2"
                          >
                            <span>
                              {item.name} <span className="text-slate-400">x{item.quantity}</span>
                            </span>
                            <button
                              onClick={() =>
                                setTransferState({
                                  type: 'item',
                                  itemId: item.id,
                                  sourceInventoryId: inventory.id,
                                  targetInventoryId: '',
                                })
                              }
                              className="rounded-full bg-indigo-500/20 px-3 py-1 text-xs text-indigo-200"
                            >
                              Transfer
                            </button>
                          </li>
                        ))}
                        {inventory.items.length === 0 && (
                          <li className="text-xs text-slate-500">No items.</li>
                        )}
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-300">Tools</h4>
                      <ul className="mt-2 space-y-2 text-sm text-slate-200">
                        {inventory.tools.map((tool) => {
                          const template = state.toolTemplates[tool.templateId];
                          const isReserved =
                            reservedToolSessions[tool.toolId] &&
                            reservedToolSessions[tool.toolId] !== sessionId;
                          return (
                            <li
                              key={tool.toolId}
                              className={`flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 ${
                                isReserved ? 'opacity-60 line-through' : ''
                              }`}
                            >
                              <span>
                                {template?.name ?? 'Unknown Tool'}
                                <span className="text-slate-400"> • {tool.conditionId}</span>
                              </span>
                              <button
                                onClick={() =>
                                  setTransferState({
                                    type: 'tool',
                                    itemId: tool.toolId,
                                    sourceInventoryId: inventory.id,
                                    targetInventoryId: '',
                                  })
                                }
                                className="rounded-full bg-indigo-500/20 px-3 py-1 text-xs text-indigo-200"
                              >
                                Transfer
                              </button>
                            </li>
                          );
                        })}
                        {inventory.tools.length === 0 && (
                          <li className="text-xs text-slate-500">No tools.</li>
                        )}
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-300">Currency</h4>
                      <ul className="mt-2 space-y-2 text-sm text-slate-200">
                        {Object.entries(inventory.currency).map(([currencyKey, amount]) => (
                          <li
                            key={currencyKey}
                            className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2"
                          >
                            <span>
                              {currencyKey}: <span className="text-slate-400">{amount}</span>
                            </span>
                            <button
                              onClick={() =>
                                setTransferState({
                                  type: 'currency',
                                  currencyKey,
                                  amount: '',
                                  sourceInventoryId: inventory.id,
                                  targetInventoryId: '',
                                })
                              }
                              className="rounded-full bg-indigo-500/20 px-3 py-1 text-xs text-indigo-200"
                            >
                              Transfer
                            </button>
                          </li>
                        ))}
                        {Object.keys(inventory.currency).length === 0 && (
                          <li className="text-xs text-slate-500">No currency.</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
              <h3 className="text-lg font-semibold text-white">Transfer Console</h3>
              {!transferState && (
                <p className="mt-3 text-sm text-slate-400">
                  Select an item, tool, or currency to initiate a transfer between inventories.
                </p>
              )}
              {transferState && (
                <div className="mt-4 space-y-4 text-sm text-slate-200">
                  <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2">
                    <p className="text-xs uppercase text-slate-400">Source</p>
                    <p>{getInventoryLabel(state.inventories[transferState.sourceInventoryId], state.characters)}</p>
                  </div>
                  <label className="flex flex-col gap-2">
                    Target Inventory
                    <select
                      value={transferState.targetInventoryId}
                      onChange={(event) =>
                        setTransferState((prev) => ({
                          ...prev,
                          targetInventoryId: event.target.value,
                        }))
                      }
                      className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
                    >
                      <option value="">Select destination</option>
                      {allInventories
                        .filter((inv) => inv.id !== transferState.sourceInventoryId)
                        .map((inv) => (
                          <option key={inv.id} value={inv.id}>
                            {getInventoryLabel(inv, state.characters)}
                          </option>
                        ))}
                    </select>
                  </label>
                  {transferState.type === 'currency' && (
                    <label className="flex flex-col gap-2">
                      Amount
                      <input
                        type="number"
                        value={transferState.amount}
                        onChange={(event) =>
                          setTransferState((prev) => ({ ...prev, amount: event.target.value }))
                        }
                        className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
                      />
                    </label>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={handleTransfer}
                      className="flex-1 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
                    >
                      Confirm Transfer
                    </button>
                    <button
                      onClick={() => setTransferState(null)}
                      className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === 'logs' && (
          <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <h2 className="text-lg font-semibold text-white">Activity & Currency Logs</h2>
            <div className="mt-4 space-y-4">
              {unifiedLogs.map((log) => {
                if (log.type === 'activity') {
                  const entry = log.entry;
                  return (
                    <div
                      key={entry.id}
                      className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-200"
                    >
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>Activity</span>
                        <span>{new Date(entry.timestamp).toLocaleString()}</span>
                      </div>
                      <div className="mt-2 font-semibold text-white">
                        {state.characters[entry.primaryWorkerId]?.name ?? 'Unknown'} led the task
                      </div>
                      <p className="mt-1 text-xs text-slate-300">
                        Helpers: {entry.helperIds.map((id) => state.characters[id]?.name).join(', ') || 'None'}
                      </p>
                      <p className="mt-1 text-xs text-slate-300">
                        Tools: {entry.toolNames.join(', ') || 'None'}
                      </p>
                      <p className="mt-1 text-xs text-slate-300">
                        Outcome: <span className="text-slate-100">{entry.outcome}</span>
                      </p>
                      {entry.gmOverrideUsed && (
                        <span className="mt-2 inline-flex items-center rounded-full bg-rose-500/20 px-3 py-1 text-xs text-rose-200">
                          GM Override
                        </span>
                      )}
                    </div>
                  );
                }
                const entry = log.entry;
                return (
                  <div
                    key={entry.id}
                    className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-200"
                  >
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Transfer</span>
                      <span>{new Date(entry.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-200">
                      {entry.currencyKey
                        ? `Moved ${entry.amount} ${entry.currencyKey}`
                        : entry.itemInstanceId
                        ? `Moved item ${entry.itemInstanceId}`
                        : `Moved tool ${entry.toolId}`}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      From {getInventoryLabel(state.inventories[entry.sourceInventoryId], state.characters)} to{' '}
                      {getInventoryLabel(state.inventories[entry.targetInventoryId], state.characters)}
                    </p>
                  </div>
                );
              })}
              {unifiedLogs.length === 0 && (
                <p className="text-sm text-slate-400">No logs yet.</p>
              )}
            </div>
          </section>
        )}

        {activeTab === 'gm' && (
          <section className="mt-6 grid gap-6 lg:grid-cols-[2fr,1fr]">
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                  <Hammer className="h-4 w-4" /> Tool Templates
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {Object.values(state.toolTemplates).map((template) => (
                    <div
                      key={template.templateId}
                      className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 text-sm"
                    >
                      <div className="font-semibold text-white">{template.name}</div>
                      <div className="mt-2 space-y-1 text-xs text-slate-300">
                        {Object.entries(template.activityCategories).map(([category, modifiers]) => (
                          <div key={category} className="flex items-center justify-between">
                            <span>{category}</span>
                            <span className="text-slate-400">
                              Skill {formatNumber(modifiers.skillBonus ?? 0)}, Time{' '}
                              {formatNumber(modifiers.timeBonus ?? 0)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                  <Wrench className="h-4 w-4" /> Facilities
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {Object.values(state.facilities).map((facility) => (
                    <div
                      key={facility.id}
                      className={`rounded-lg border border-slate-800 bg-slate-950/60 p-4 text-sm ${
                        facility.conditionId === 'Broken' ? 'border-rose-500/60' : ''
                      }`}
                    >
                      <div className="font-semibold text-white">{facility.name}</div>
                      <div className="text-xs text-slate-400">{facility.conditionId}</div>
                      <div className="mt-2 space-y-1 text-xs text-slate-300">
                        {Object.entries(facility.activityCategories).map(([category, modifiers]) => (
                          <div key={category} className="flex items-center justify-between">
                            <span>{category}</span>
                            <span className="text-slate-400">
                              Quality {formatNumber(modifiers.qualityModifier ?? 0)}, Risk{' '}
                              {formatNumber(modifiers.riskModifier ?? 0)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                  <Wrench className="h-4 w-4" /> Time Control
                </div>
                <p className="mt-2 text-sm text-slate-300">
                  Advance the session to clear reservations and reset activity selections.
                </p>
                <button
                  onClick={handleAdvanceTime}
                  className="mt-4 w-full rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
                >
                  Advance Time Slot
                </button>
                <div className="mt-4 space-y-2 text-xs text-slate-400">
                  {timeLogs.map((log, index) => (
                    <div key={`${log.timestamp}-${index}`} className="rounded-lg bg-slate-950/60 px-3 py-2">
                      {log.label ?? 'Time shift'} ({log.fromSlot} ➜ {log.toSlot})
                    </div>
                  ))}
                  {timeLogs.length === 0 && (
                    <p className="text-xs text-slate-500">No time adjustments yet.</p>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
