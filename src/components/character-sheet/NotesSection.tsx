import { FileText } from 'lucide-react';

interface NotesSectionProps {
  notes: string;
  editMode: boolean;
  onChange: (notes: string) => void;
}

export function NotesSection({
  notes,
  editMode,
  onChange,
}: NotesSectionProps) {
  if (!editMode && !notes) {
    return null; // Don't show section if empty and not editing
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <FileText size={20} className="text-blue-400" />
        <h3 className="text-lg font-semibold text-gray-100">Notes</h3>
      </div>

      {editMode ? (
        <textarea
          value={notes}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Character notes, backstory, etc..."
          className="w-full h-32 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-gray-100 text-sm resize-y"
        />
      ) : (
        <div className="text-sm text-gray-300 whitespace-pre-wrap">
          {notes || <span className="italic text-gray-500">No notes</span>}
        </div>
      )}
    </div>
  );
}
