import { ChevronUp } from 'lucide-react';

interface ActionPanelHeaderProps {
  onToggleExpanded?: () => void;
}

export default function ActionPanelHeader({
  onToggleExpanded
}: ActionPanelHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="text-lg font-semibold">Action Panel</h3>
      {onToggleExpanded && (
        <button onClick={onToggleExpanded} className="text-gray-400 hover:text-white" type="button">
          <ChevronUp size={20} />
        </button>
      )}
    </div>
  );
}
