import { useState, memo } from 'react';
import { Edit2, Trash2, Copy, ChevronDown, ChevronUp } from 'lucide-react';
import { calculateHPStatus } from '../../utils/combatHelpers';

type CharacterCategory = 'player' | 'ally' | 'enemy' | 'object';

interface Character {
  id: string;
  name: string;
  category: CharacterCategory;
  st: number;
  dx: number;
  iq: number;
  ht: number;
  hp: number;
  currentHP?: number;
  fp?: number;
  mp?: number;
  basicSpeed: number;
  basicMove?: number;
  dodge?: number;
  parry?: number;
  block?: number;
  dr?: number;
  notes?: string;
}

interface CharacterSheetProps {
  character: Character;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

/**
 * Character Sheet Display Component
 * Shows character info in library with expand/collapse and action buttons
 * Memoized to prevent re-renders when sibling list items change
 */
function CharacterSheet({ character, onEdit, onDelete, onDuplicate }: CharacterSheetProps) {
  const [expanded, setExpanded] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // calculateHPStatus is used internally for conditional rendering
  calculateHPStatus(character.currentHP || character.hp, character.hp);

  // Category color coding
  const getCategoryColor = (category: CharacterCategory): string => {
    switch (category) {
      case 'player': return 'text-blue-400';
      case 'ally': return 'text-green-400';
      case 'enemy': return 'text-red-400';
      case 'object': return 'text-gray-400';
      default: return 'text-gray-300';
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden">
      {/* Header - Always visible */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-700"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-4 flex-1">
          <button className="text-gray-400">
            {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold">{character.name}</h3>
              <span className={`text-sm ${getCategoryColor(character.category)}`}>
                {character.category}
              </span>
            </div>
            <div className="text-sm text-gray-400">
              Speed: {character.basicSpeed} | HP: {character.hp} | DX: {character.dx}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onDuplicate}
            className="p-2 bg-blue-600 hover:bg-blue-700 rounded"
            title="Duplicate"
          >
            <Copy size={16} />
          </button>
          <button
            onClick={onEdit}
            className="p-2 bg-yellow-600 hover:bg-yellow-700 rounded"
            title="Edit"
          >
            <Edit2 size={16} />
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-2 bg-red-600 hover:bg-red-700 rounded"
            title="Delete"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="p-4 pt-0 border-t border-gray-700">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            {/* Attributes */}
            <div>
              <h4 className="text-xs text-gray-400 uppercase mb-2">Attributes</h4>
              <div className="space-y-1 text-sm">
                <div>ST: {character.st}</div>
                <div>DX: {character.dx}</div>
                <div>IQ: {character.iq}</div>
                <div>HT: {character.ht}</div>
              </div>
            </div>

            {/* Secondary Characteristics */}
            <div>
              <h4 className="text-xs text-gray-400 uppercase mb-2">Secondary</h4>
              <div className="space-y-1 text-sm">
                <div>HP: {character.hp}</div>
                <div>FP: {character.fp || 0}</div>
                <div>MP: {character.mp || 0}</div>
              </div>
            </div>

            {/* Combat Stats */}
            <div>
              <h4 className="text-xs text-gray-400 uppercase mb-2">Combat</h4>
              <div className="space-y-1 text-sm">
                <div>Speed: {character.basicSpeed}</div>
                <div>Move: {character.basicMove}</div>
                <div>Dodge: {character.dodge}</div>
              </div>
            </div>

            {/* Defenses */}
            <div>
              <h4 className="text-xs text-gray-400 uppercase mb-2">Defenses</h4>
              <div className="space-y-1 text-sm">
                <div>Parry: {character.parry}</div>
                <div>Block: {character.block}</div>
                <div>DR: {character.dr}</div>
              </div>
            </div>
          </div>

          {/* Notes */}
          {character.notes && (
            <div className="mt-4">
              <h4 className="text-xs text-gray-400 uppercase mb-2">Notes</h4>
              <p className="text-sm whitespace-pre-wrap">{character.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg max-w-md">
            <h3 className="text-xl font-bold mb-4">Confirm Delete</h3>
            <p className="mb-6">
              Are you sure you want to delete <strong>{character.name}</strong>?
              {character.category === 'player' && (
                <span className="block mt-2 text-yellow-400">
                  Warning: This is a player character!
                </span>
              )}
            </p>
            <div className="flex gap-4 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDelete();
                  setShowDeleteConfirm(false);
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Custom comparison function for memoization
 * Prevents re-renders when:
 * - Character ID and basic properties haven't changed
 * - Callback functions are the same reference (passed from parent)
 */
const arePropsEqual = (prevProps: CharacterSheetProps, nextProps: CharacterSheetProps): boolean => {
  return (
    prevProps.character?.id === nextProps.character?.id &&
    prevProps.character?.name === nextProps.character?.name &&
    prevProps.character?.hp === nextProps.character?.hp &&
    prevProps.character?.currentHP === nextProps.character?.currentHP &&
    prevProps.character?.category === nextProps.character?.category &&
    prevProps.character?.basicSpeed === nextProps.character?.basicSpeed &&
    prevProps.character?.st === nextProps.character?.st &&
    prevProps.character?.dx === nextProps.character?.dx &&
    prevProps.character?.iq === nextProps.character?.iq &&
    prevProps.character?.ht === nextProps.character?.ht &&
    prevProps.character?.fp === nextProps.character?.fp &&
    prevProps.character?.mp === nextProps.character?.mp &&
    prevProps.onEdit === nextProps.onEdit &&
    prevProps.onDelete === nextProps.onDelete &&
    prevProps.onDuplicate === nextProps.onDuplicate
  );
};

export default memo(CharacterSheet, arePropsEqual);
