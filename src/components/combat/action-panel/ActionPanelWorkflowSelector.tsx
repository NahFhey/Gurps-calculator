import {
  Activity,
  Droplet,
  MessageSquare,
  Shield,
  Swords,
  Zap,
  type LucideIcon
} from 'lucide-react';
import type { ManeuverPrompts, WorkflowType } from '../../../types/actionPanel';

interface ActionPanelWorkflowSelectorProps {
  selectedManeuver: string | null;
  maneuverPrompts?: ManeuverPrompts;
  onStartWorkflow: (workflow: WorkflowType) => void;
}

interface ActionButtonConfig {
  workflow: Exclude<WorkflowType, null>;
  label: string;
  icon: LucideIcon;
  className: string;
  disabled?: boolean;
}

export default function ActionPanelWorkflowSelector({
  selectedManeuver,
  maneuverPrompts,
  onStartWorkflow
}: ActionPanelWorkflowSelectorProps) {
  const actionButtons: ActionButtonConfig[] = [
    {
      workflow: 'attack',
      label: 'Attack',
      icon: Swords,
      className: 'bg-red-600 hover:bg-red-700',
      disabled: !maneuverPrompts?.allowsAttackPanel
    },
    {
      workflow: 'defense',
      label: 'Defense',
      icon: Shield,
      className: 'bg-blue-600 hover:bg-blue-700',
      disabled: !maneuverPrompts?.allowsDefensePanel
    },
    {
      workflow: 'damage',
      label: 'Damage',
      icon: Zap,
      className: 'bg-orange-600 hover:bg-orange-700'
    },
    {
      workflow: 'note',
      label: 'Note',
      icon: MessageSquare,
      className: 'bg-gray-600 hover:bg-gray-500'
    },
    {
      workflow: 'items',
      label: 'Items',
      icon: Droplet,
      className: 'bg-purple-600 hover:bg-purple-700'
    },
    {
      workflow: 'conditions',
      label: 'Conditions',
      icon: Activity,
      className: 'bg-indigo-600 hover:bg-indigo-700'
    }
  ];

  return (
    <div>
      <label className="block text-sm font-semibold mb-2">Choose Action</label>
      <div className="grid grid-cols-2 gap-2">
        {actionButtons.map(({ workflow, label, icon: Icon, className, disabled = false }) => (
          <button
            key={workflow}
            onClick={() => onStartWorkflow(workflow)}
            className={`flex items-center justify-center gap-2 p-3 rounded ${className}`}
            disabled={disabled}
            type="button"
          >
            <Icon size={20} />
            {label}
          </button>
        ))}
      </div>
      {selectedManeuver && !maneuverPrompts?.allowsAttackPanel && !maneuverPrompts?.allowsDefensePanel && (
        <div className="text-xs text-gray-400 mt-2">
          This maneuver doesn&apos;t open attack or defense workflows. Use notes or other panels as needed.
        </div>
      )}
      {!selectedManeuver && (
        <div className="text-xs text-gray-400 mt-2">
          Select a maneuver above to enable relevant workflows.
        </div>
      )}
    </div>
  );
}
