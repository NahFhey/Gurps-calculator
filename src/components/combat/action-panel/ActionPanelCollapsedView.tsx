import { ChevronDown } from 'lucide-react';

interface ActionPanelCollapsedViewProps {
  onToggleExpanded?: () => void;
}

/**
 * ActionPanelCollapsedView - Compact action panel expansion control.
 */
export default function ActionPanelCollapsedView({
  onToggleExpanded,
}: ActionPanelCollapsedViewProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-3">
      <button onClick={onToggleExpanded} className="flex items-center justify-between w-full text-left" aria-label="Expand Action Panel">
        <span className="font-semibold">Action Panel</span>
        <ChevronDown size={20} />
      </button>
    </div>
  );
}
