import type { ChangeEvent } from 'react';

interface ActionPanelNoteWorkflowProps {
  noteText: string;
  onNoteTextChange: (noteText: string) => void;
  onAddNote: () => void;
  onCancel: () => void;
}

export default function ActionPanelNoteWorkflow({
  noteText,
  onNoteTextChange,
  onAddNote,
  onCancel,
}: ActionPanelNoteWorkflowProps) {
  return (
    <div className="border-t border-gray-700 pt-4">
      <h4 className="text-lg font-semibold mb-3">Add Note</h4>
      <div className="space-y-3">
        <textarea
          value={noteText}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
            onNoteTextChange(event.target.value)
          }
          placeholder="Enter note or description..."
          className="w-full px-3 py-2 bg-gray-700 rounded h-24"
        />
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded"
            type="button"
          >
            Cancel
          </button>
          <button
            onClick={onAddNote}
            disabled={!noteText.trim()}
            className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            type="button"
          >
            Add Note
          </button>
        </div>
      </div>
    </div>
  );
}
