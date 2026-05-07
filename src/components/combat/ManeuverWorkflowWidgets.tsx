/**
 * ManeuverWorkflowWidgets — Aim tracking and Wait trigger panels.
 *
 * Extracted from ActionPanel (Phase 11a decomposition).
 * Displayed when a maneuver allows aim or wait but no active workflow is running.
 */

import { ChangeEvent } from 'react';
import type { Participant, TurnDecision } from '../../types/combatTracker';

interface ManeuverWorkflowWidgetsProps {
  maneuverPrompts: { allowsAimPanel?: boolean; allowsWaitPanel?: boolean };
  turnDecision: TurnDecision | null;
  targets: Participant[];
  onManeuverWorkflow?: (update: {
    type: string;
    targetInstanceId?: string;
    turnsAimed?: number;
    triggerText?: string;
  }) => void;
}

export default function ManeuverWorkflowWidgets({
  maneuverPrompts,
  turnDecision,
  targets,
  onManeuverWorkflow,
}: ManeuverWorkflowWidgetsProps) {
  return (
    <div className="space-y-4">
      {maneuverPrompts?.allowsAimPanel && (
        <div className="space-y-2">
          <h5 className="text-sm font-semibold">Aim Tracking</h5>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Target</label>
            <select
              value={turnDecision?.aim?.targetInstanceId || ''}
              onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                onManeuverWorkflow?.({
                  type: 'aim',
                  targetInstanceId: e.target.value || undefined,
                })
              }
              className="w-full px-3 py-2 bg-gray-700 rounded"
            >
              <option value="">No target</option>
              {targets.map((target) => (
                <option key={target.instanceId} value={target.instanceId}>
                  {target.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              Turns Aimed
            </label>
            <input
              type="number"
              min={0}
              value={turnDecision?.aim?.turnsAimed ?? 0}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                onManeuverWorkflow?.({
                  type: 'aim',
                  turnsAimed: parseInt(e.target.value, 10) || 0,
                })
              }
              className="w-full px-3 py-2 bg-gray-700 rounded"
            />
          </div>
        </div>
      )}
      {maneuverPrompts?.allowsWaitPanel && (
        <div className="space-y-2">
          <h5 className="text-sm font-semibold">Wait Trigger</h5>
          <input
            type="text"
            value={turnDecision?.wait?.triggerText || ''}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              onManeuverWorkflow?.({
                type: 'wait',
                triggerText: e.target.value,
              })
            }
            placeholder="Describe the trigger condition"
            className="w-full px-3 py-2 bg-gray-700 rounded"
          />
        </div>
      )}
    </div>
  );
}
