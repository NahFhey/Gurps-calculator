interface ActionPanelItemsWorkflowProps {
  onClose: () => void;
}

/** ActionPanelItemsWorkflow - Item usage placeholder workflow view for the active combatant. */
export default function ActionPanelItemsWorkflow({
  onClose,
}: ActionPanelItemsWorkflowProps) {
  return (
    <div className="border-t border-gray-700 pt-4">
      <h4 className="text-lg font-semibold mb-3">Use Item</h4>
      <div className="text-gray-400 text-sm mb-4">Item system coming soon...</div>
      <button onClick={onClose} className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded" aria-label="Close items panel">Close</button>
    </div>
  );
}
