interface ActionPanelItemsWorkflowProps {
  onCancel: () => void;
}

export default function ActionPanelItemsWorkflow({
  onCancel,
}: ActionPanelItemsWorkflowProps) {
  return (
    <div className="border-t border-gray-700 pt-4">
      <h4 className="text-lg font-semibold mb-3">Use Item (Phase 6)</h4>
      <div className="text-gray-400 text-sm mb-4">Item system coming soon...</div>
      <button
        onClick={onCancel}
        className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded"
        type="button"
      >
        Close
      </button>
    </div>
  );
}
