import {
  Swords,
  Shield,
  Zap,
  MessageSquare,
  Droplet,
  Activity,
} from 'lucide-react';
import type { WorkflowType } from './types';

interface ActionPanelWorkflowSelectorProps {
  selectedManeuver: string | null;
  allowsAttackPanel?: boolean;
  allowsDefensePanel?: boolean;
  onSelectWorkflow: (workflow: WorkflowType) => void;
}

/** ActionPanelWorkflowSelector - Action workflow selection grid for the active combatant. */
export default function ActionPanelWorkflowSelector({
  selectedManeuver,
  allowsAttackPanel,
  allowsDefensePanel,
  onSelectWorkflow,
}: ActionPanelWorkflowSelectorProps) {
  return (
    <div>
      <label className="block text-sm font-semibold mb-2">Choose Action</label>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => onSelectWorkflow('attack')} className="flex items-center justify-center gap-2 p-3 bg-red-600 hover:bg-red-700 rounded" disabled={!allowsAttackPanel} aria-label="Start attack workflow">
          <Swords size={20} /> Attack
        </button>
        <button onClick={() => onSelectWorkflow('defense')} className="flex items-center justify-center gap-2 p-3 bg-blue-600 hover:bg-blue-700 rounded" disabled={!allowsDefensePanel} aria-label="Start defense workflow">
          <Shield size={20} /> Defense
        </button>
        <button onClick={() => onSelectWorkflow('damage')} className="flex items-center justify-center gap-2 p-3 bg-orange-600 hover:bg-orange-700 rounded" aria-label="Start damage workflow">
          <Zap size={20} /> Damage
        </button>
        <button onClick={() => onSelectWorkflow('note')} className="flex items-center justify-center gap-2 p-3 bg-gray-600 hover:bg-gray-500 rounded" aria-label="Add note">
          <MessageSquare size={20} /> Note
        </button>
        <button onClick={() => onSelectWorkflow('items')} className="flex items-center justify-center gap-2 p-3 bg-purple-600 hover:bg-purple-700 rounded" aria-label="Use item">
          <Droplet size={20} /> Items
        </button>
        <button onClick={() => onSelectWorkflow('conditions')} className="flex items-center justify-center gap-2 p-3 bg-indigo-600 hover:bg-indigo-700 rounded" aria-label="Manage conditions">
          <Activity size={20} /> Conditions
        </button>
      </div>
      {selectedManeuver && !allowsAttackPanel && !allowsDefensePanel && (
        <div className="text-xs text-gray-400 mt-2">This maneuver doesn&apos;t open attack or defense workflows.</div>
      )}
      {!selectedManeuver && (
        <div className="text-xs text-gray-400 mt-2">Select a maneuver above to enable relevant workflows.</div>
      )}
    </div>
  );
}
