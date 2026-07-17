import type { ChangeEvent } from 'react';

interface ActionPanelNoteWorkflowProps {
  noteText: string;
  onNoteTextChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

/** ActionPanelNoteWorkflow - Note entry workflow view for the active combatant. */
export default function ActionPanelNoteWorkflow({
  noteText,
  onNoteTextChange,
  onSubmit,
  onCancel,
}: ActionPanelNoteWorkflowProps) {
  return (
    <div className="border-t border-gray-700 pt-4">
      <h4 className="text-lg font-semibold mb-3">Add Note</h4>
      <textarea value={noteText} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onNoteTextChange(e.target.value)} placeholder="Enter note or description..." className="w-full px-3 py-2 bg-gray-700 rounded h-24" aria-label="Note text" />
      <div className="flex gap-2 mt-3">
        <button onClick={onCancel} className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded" aria-label="Cancel note">Cancel</button>
        <button onClick={onSubmit} disabled={!noteText.trim()} className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 rounded disabled:opacity-50 disabled:cursor-not-allowed" aria-label="Submit note">Add Note</button>
      </div>
    </div>
  );
}
