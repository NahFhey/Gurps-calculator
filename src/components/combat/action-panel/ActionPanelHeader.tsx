import { ChevronUp } from 'lucide-react';

interface ActionPanelHeaderProps {
  onToggleExpanded?: () => void;
}

/**
 * ActionPanelHeader - Expanded action panel header with collapse control.
 */
export default function ActionPanelHeader({
  onToggleExpanded,
}: ActionPanelHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="text-lg font-semibold">Action Panel</h3>
      {onToggleExpanded && (
        <button onClick={onToggleExpanded} className="text-fg-muted hover:text-white" aria-label="Collapse Action Panel">
          <ChevronUp size={20} />
        </button>
      )}
    </div>
  );
}
