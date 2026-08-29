import { useState } from 'react';
import { AlertTriangle, Bed, Heart, Sparkles } from 'lucide-react';
import { useDowntimeContext } from '../DowntimeContext';
import { selectCharacterHasNonRestTasksForDay } from '../../../state/downtime/downtimeSelectors';
import { getPhysicianLevel, resolveRestRecovery } from '../../../utils/recovery';
import type { RestRecoveryResult } from '../../../utils/recovery';
import type { Character } from '../../../types/campaign';
import type { TaskResults } from '../../../types/downtime';
import type { RestTask } from './RestTaskCard';

interface RestResolutionPanelProps {
  task: RestTask;
  leader: Character;
  healer: Character | null;
  onFinalize: (results: TaskResults, recovery: RestRecoveryResult | null) => void;
  onCancel: () => void;
}

const REST_PAST_TENSE: Record<RestTask['activityData']['restType'], string> = {
  sleep: 'Slept',
  light_rest: 'Light rest',
  meditation: 'Meditated',
};

function PoolBar({ label, current, max, color }: { label: string; current: number; max: number; color: string }) {
  const percent = max > 0 ? Math.max(0, Math.min(100, current / max * 100)) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-gray-300">
        <span>{label}</span><span>{current}/{max}</span>
      </div>
      <div className="h-2 overflow-hidden rounded bg-gray-900">
        <div className={`h-full ${color}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function buildRecoveryMessage(task: RestTask, recovery: RestRecoveryResult): string {
  const parts: string[] = [];
  if (recovery.hpRestored > 0) {
    const roll = recovery.recoveryRoll;
    parts.push(`${recovery.hpRestored} HP${roll ? ` (rolled ${roll.total} vs ${roll.target})` : ''}`);
  } else if (recovery.recoveryRoll) {
    parts.push(`0 HP (rolled ${recovery.recoveryRoll.total} vs ${recovery.recoveryRoll.target})`);
  }
  if (recovery.fpRestored > 0) parts.push(`${recovery.fpRestored} FP`);
  if (parts.length === 0) parts.push('nothing');

  const physician = recovery.physicianRoll
    ? ` Physician rolled ${recovery.physicianRoll.total} vs ${recovery.physicianRoll.target}.`
    : '';
  return `${REST_PAST_TENSE[task.activityData.restType]}: recovered ${parts.join(', ')}.${physician}`;
}

export function RestResolutionPanel({
  task,
  leader,
  healer,
  onFinalize,
  onCancel,
}: RestResolutionPanelProps) {
  const { state } = useDowntimeContext();
  const [overrideFullDay, setOverrideFullDay] = useState(false);
  const [recovery, setRecovery] = useState<RestRecoveryResult | null>(null);
  const gcsData = leader.gcsData;
  const hasNonRestTasks = selectCharacterHasNonRestTasksForDay(state, leader.id, task.dayKey);
  const physicianLevel = healer ? getPhysicianLevel(healer) : 0;

  const handleRoll = () => {
    if (!gcsData || recovery) return;
    setRecovery(resolveRestRecovery({
      restType: task.activityData.restType,
      recoveryBonus: task.activityData.recoveryBonus,
      ht: gcsData.attributes.HT,
      currentHP: gcsData.pools.HP.current,
      maxHP: gcsData.pools.HP.max,
      currentFP: gcsData.pools.FP.current,
      maxFP: gcsData.pools.FP.max,
      restedFullDay: !hasNonRestTasks || overrideFullDay,
      physicianLevel,
    }));
  };

  const handleApply = () => {
    if (!gcsData) {
      onFinalize({ success: true, message: 'No character sheet — recovery not tracked.' }, null);
      return;
    }
    if (!recovery) return;
    onFinalize({ success: true, message: buildRecoveryMessage(task, recovery) }, recovery);
  };

  return (
    <div className="rounded-lg border border-indigo-500/50 bg-gray-800 p-4" data-testid="rest-resolution-panel">
      <div className="mb-4 flex items-center gap-2">
        <Bed className="h-5 w-5 text-indigo-400" />
        <h4 className="font-semibold text-gray-100">Resolve recovery for {leader.name}</h4>
      </div>

      {!gcsData ? (
        <p className="mb-4 rounded bg-amber-900/30 p-3 text-sm text-amber-300">
          No character sheet — recovery will not be tracked.
        </p>
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <PoolBar label="HP" current={gcsData.pools.HP.current} max={gcsData.pools.HP.max} color="bg-red-500" />
            <PoolBar label="FP" current={gcsData.pools.FP.current} max={gcsData.pools.FP.max} color="bg-blue-500" />
          </div>

          <div className="mb-4 rounded bg-gray-900/50 p-3 text-sm text-gray-300">
            <p><span className="font-medium text-gray-100">Rest:</span> {task.activityData.restType.replace('_', ' ')}</p>
            <p><span className="font-medium text-gray-100">Recovery modifier:</span> {task.activityData.recoveryBonus >= 0 ? '+' : ''}{task.activityData.recoveryBonus}</p>
            {physicianLevel > 0 && (
              <p><span className="font-medium text-gray-100">Physician-{physicianLevel}:</span> successful care adds +1 and doubles successful HP recovery.</p>
            )}
          </div>

          {hasNonRestTasks && (
            <div className="mb-4 rounded border border-amber-600/50 bg-amber-900/30 p-3 text-sm text-amber-200">
              <p className="mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                {leader.name} worked other tasks today — no natural HP recovery
              </p>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={overrideFullDay}
                  onChange={(event) => setOverrideFullDay(event.target.checked)}
                  disabled={Boolean(recovery)}
                  data-testid="full-day-override"
                  className="rounded border-gray-600 bg-gray-900 text-indigo-600"
                />
                GM override: count as a full day of rest
              </label>
            </div>
          )}

          {recovery && (
            <div className="mb-4 space-y-2 rounded bg-indigo-900/30 p-3 text-sm text-indigo-100" data-testid="recovery-results">
              {recovery.physicianRoll && (
                <p>Physician: {recovery.physicianRoll.dice.join(' + ')} = {recovery.physicianRoll.total} vs {recovery.physicianRoll.target} — {recovery.physicianSuccess ? 'success' : 'failure'}</p>
              )}
              {recovery.recoveryRoll && (
                <p>Recovery: {recovery.recoveryRoll.dice.join(' + ')} = {recovery.recoveryRoll.total} vs {recovery.recoveryRoll.target} — {recovery.recoveryRoll.success ? 'success' : 'failure'}</p>
              )}
              {!recovery.hpRollMade && <p>No natural HP recovery roll was made.</p>}
              <p className="flex items-center gap-2"><Heart className="h-4 w-4" /> HP restored: {recovery.hpRestored}</p>
              <p className="flex items-center gap-2"><Sparkles className="h-4 w-4" /> FP restored: {recovery.fpRestored}</p>
            </div>
          )}

          <button
            type="button"
            onClick={handleRoll}
            disabled={Boolean(recovery)}
            data-testid="roll-recovery-button"
            className="mb-3 w-full rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-500"
          >
            Roll Recovery
          </button>
        </>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleApply}
          disabled={Boolean(gcsData) && !recovery}
          data-testid="apply-recovery-button"
          className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-500"
        >
          Apply
        </button>
        <button type="button" onClick={onCancel} className="rounded border border-gray-600 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700">
          Cancel
        </button>
      </div>
    </div>
  );
}
