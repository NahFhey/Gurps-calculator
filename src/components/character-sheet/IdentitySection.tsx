import { User } from 'lucide-react';

interface IdentitySectionProps {
  name: string;
  totalPoints: number;
  isPlayer?: boolean;
  editMode: boolean;
  onNameChange: (name: string) => void;
}

export function IdentitySection({
  name,
  totalPoints,
  isPlayer,
  editMode,
  onNameChange,
}: IdentitySectionProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-center gap-4">
        {/* Portrait placeholder */}
        <div className="w-20 h-20 bg-gray-700 rounded-lg flex items-center justify-center">
          <User size={40} className="text-gray-500" />
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            {editMode ? (
              <input
                type="text"
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                placeholder="Character Name"
                className="text-xl font-bold bg-gray-700 border border-gray-600 rounded px-2 py-1 text-gray-100 w-64"
              />
            ) : (
              <h2 className="text-xl font-bold text-gray-100">{name}</h2>
            )}
            {isPlayer && (
              <span className="px-2 py-0.5 bg-blue-600 text-xs rounded text-white">
                Player
              </span>
            )}
          </div>
          <div className="text-gray-400 text-sm">
            Total Points: <span className="text-gray-200 font-medium">{totalPoints}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
