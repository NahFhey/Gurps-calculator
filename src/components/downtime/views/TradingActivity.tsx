import { useCallback, useMemo, useState } from 'react';
import { AlertCircle, Coins, Plus } from 'lucide-react';
import { useCampaignStore } from '../../../state/campaignStore';
import { generateTaskId, selectTasksForSlot, validateTaskCreation } from '../../../state/downtime';
import { DowntimeValidationError } from '../../../state/downtime/downtimeErrors';
import { selectCurrencyConfig } from '../../../state/selectors';
import { isTradingTask } from '../../../types/downtime';
import { makePriceBookKey } from '../../../utils/trading';
import { tradingLog } from '../../../utils/activityLogger';
import { useDowntimeContext } from '../DowntimeContext';
import { TradingResolutionPanel } from './TradingResolutionPanel';
import { TradingTaskCard } from './TradingTaskCard';
import { TradingTaskForm } from './TradingTaskForm';
import type { AcquiredItem } from '../../../types/campaign';
import type { CreateTaskPayload } from '../../../state/downtime/downtimeActions';
import type { TaskResults, TradingData } from '../../../types/downtime';
import type { TradeOutcome } from './TradingResolutionPanel';
import type { TradingTask } from './TradingTaskCard';

interface TradingActivityProps {
  currentDayKey: number;
  currentSlot: number;
}

export function TradingActivity({ currentDayKey, currentSlot }: TradingActivityProps) {
  const { state, characters, createDowntimeTask, beginResolve, resolve, cancel } = useDowntimeContext();
  const { state: campaignState, actions: campaignActions } = useCampaignStore();
  const [isCreating, setIsCreating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [resolvingTask, setResolvingTask] = useState<TradingTask | null>(null);
  const tasks = useMemo(
    () => selectTasksForSlot(state, currentDayKey, currentSlot).filter(isTradingTask),
    [currentDayKey, currentSlot, state]
  );
  const pendingTasks = tasks.filter((task) => task.status === 'pending' || task.status === 'in_progress');
  const completedTasks = tasks.filter((task) => task.status === 'resolved' || task.status === 'cancelled');

  const handleCreate = useCallback((data: { leaderId: string; helperIds: string[]; activityData: TradingData }) => {
    const payload: CreateTaskPayload = {
      id: generateTaskId(),
      activityType: 'trading',
      dayKey: currentDayKey,
      slot: currentSlot,
      ...data,
    };
    const validation = validateTaskCreation(state, payload);
    if (!validation.valid) {
      setValidationError(validation.message ?? 'Validation failed');
      return;
    }
    try {
      createDowntimeTask(payload);
      const leader = characters.find((character) => character.id === payload.leaderId);
      campaignActions.addLogEntry(tradingLog.tripCreated(
        leader?.name ?? payload.leaderId,
        data.activityData.merchantName,
        { characterIds: [payload.leaderId], taskId: payload.id }
      ));
      setIsCreating(false);
      setValidationError(null);
    } catch (error) {
      setValidationError(error instanceof DowntimeValidationError ? error.message : 'Failed to create trip');
    }
  }, [campaignActions, characters, createDowntimeTask, currentDayKey, currentSlot, state]);

  const handleFinalize = useCallback((results: TaskResults, outcome: TradeOutcome) => {
    if (!resolvingTask) return;
    const config = selectCurrencyConfig(campaignState);
    const primaryKey = config.primaryKey;

    if (!outcome.dealBroken) {
      for (const line of outcome.lines) {
        if (line.kind !== 'sell') continue;
        if (line.itemKind === 'material') {
          campaignActions.consumeMaterials('party', [{ name: line.name, type: line.materialType, quantity: line.quantity }]);
        } else if (line.itemKind === 'food') {
          campaignActions.consumeFoods('party', [{ name: line.name, type: line.materialType || undefined, quantity: line.quantity }]);
        } else if (line.itemKind === 'item' && line.itemId) {
          campaignActions.consumeItem(line.itemId, line.quantity);
        }
      }

      for (const line of outcome.lines) {
        if (line.kind !== 'buy' || !line.itemKind) continue;
        let item: AcquiredItem;
        if (line.itemKind === 'material') {
          item = {
            kind: 'material',
            id: `trade-${resolvingTask.id}-${line.id}`,
            name: line.name,
            type: line.materialType || 'Trade Goods',
            quantity: line.quantity,
          };
        } else if (line.itemKind === 'food') {
          item = {
            kind: 'food',
            id: `trade-${resolvingTask.id}-${line.id}`,
            name: line.name,
            quantity: line.quantity,
          };
        } else {
          item = {
            kind: 'equipment',
            id: `trade-${resolvingTask.id}-${line.id}`,
            name: line.name,
            quantity: line.quantity,
            value: line.unitPrice,
          };
        }
        campaignActions.acquireItem(item, 'party', 'trade');
      }

      if (outcome.totals.net > 0) {
        campaignActions.acquireItem(
          { kind: 'currency', currencyKey: primaryKey, amount: outcome.totals.net },
          'party',
          'trade'
        );
      } else if (outcome.totals.net < 0) {
        campaignActions.spendCurrency('party', primaryKey, -outcome.totals.net);
      }

      const updatedAt = Date.now();
      for (const line of outcome.lines) {
        if (line.kind === 'adjust' || !line.itemKind) continue;
        const kind = line.itemKind;
        campaignActions.setPriceBookEntry({
          key: makePriceBookKey(kind, line.name),
          name: line.name,
          kind,
          price: line.unitPrice,
          updatedAt,
        });
      }
    }

    const leader = characters.find((character) => character.id === resolvingTask.leaderId);
    beginResolve(resolvingTask.id);
    resolve(resolvingTask.id, results);
    campaignActions.addLogEntry(tradingLog.tripResolved(
      leader?.name ?? resolvingTask.leaderId,
      resolvingTask.activityData.merchantName,
      outcome.summary,
      {
        characterIds: [resolvingTask.leaderId],
        taskId: resolvingTask.id,
        quantity: outcome.totals.net,
      }
    ));
    setResolvingTask(null);
  }, [beginResolve, campaignActions, campaignState, characters, resolve, resolvingTask]);

  const resolvingLeader = resolvingTask
    ? characters.find((character) => character.id === resolvingTask.leaderId)
    : undefined;

  return (
    <div data-testid="trading-activity">
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2"><Coins className="h-5 w-5 text-warning-400" /><h3 className="text-lg font-semibold text-fg-bright">Trading</h3></div>
        {!isCreating && !resolvingTask && (
          <button type="button" onClick={() => setIsCreating(true)} data-testid="new-trading-task-button" className="flex items-center gap-1 rounded bg-warning-600 px-3 py-1.5 text-sm text-white hover:bg-warning-700"><Plus className="h-4 w-4" /> New Trip</button>
        )}
      </header>

      {validationError && <div role="alert" data-testid="validation-error" className="mb-4 flex items-center gap-2 rounded border border-danger-500 bg-danger-900/30 px-3 py-2 text-sm text-danger-300"><AlertCircle className="h-4 w-4" /> {validationError}</div>}

      {resolvingTask && resolvingLeader && (
        <div className="mb-4"><TradingResolutionPanel task={resolvingTask} leader={resolvingLeader} onFinalize={handleFinalize} onCancel={() => setResolvingTask(null)} /></div>
      )}
      {isCreating && !resolvingTask && (
        <TradingTaskForm characters={characters} state={state} currentDayKey={currentDayKey} currentSlot={currentSlot} onSubmit={handleCreate} onCancel={() => { setIsCreating(false); setValidationError(null); }} />
      )}

      {!resolvingTask && (
        <>
          <section className="mb-6" data-testid="pending-tasks-section">
            <h4 className="mb-2 font-medium text-fg-primary">Pending ({pendingTasks.length})</h4>
            {pendingTasks.length === 0 ? <p className="text-sm italic text-fg-muted">No pending trading trips</p> : <div className="space-y-2">{pendingTasks.map((task) => <TradingTaskCard key={task.id} task={task} leader={characters.find((character) => character.id === task.leaderId)} onResolve={() => setResolvingTask(task)} onCancel={() => cancel(task.id)} />)}</div>}
          </section>
          <section data-testid="completed-tasks-section">
            <h4 className="mb-2 font-medium text-fg-primary">Completed ({completedTasks.length})</h4>
            {completedTasks.length === 0 ? <p className="text-sm italic text-fg-muted">No completed trading trips</p> : <div className="space-y-2">{completedTasks.map((task) => <TradingTaskCard key={task.id} task={task} leader={characters.find((character) => character.id === task.leaderId)} readonly />)}</div>}
          </section>
        </>
      )}
    </div>
  );
}
