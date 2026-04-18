import { ChevronDown } from 'lucide-react';

interface ActionPanelCollapsedViewProps {
  onToggleExpanded?: () => void;
}

export default function ActionPanelCollapsedView({
  onToggleExpanded
}: ActionPanelCollapsedViewProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-3">
      <button
        onClick={onToggleExpanded}
        className="flex items-center justify-between w-full text-left"
        type="button"
      >
        <span className="font-semibold">Action Panel</span>
        <ChevronDown size={20} />
      </button>
    </div>
  );
}
