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
    <div className="bg-surface-1 rounded-lg p-4">
      <div className="flex items-center gap-4">
        {/* Portrait placeholder */}
        <div className="w-20 h-20 bg-surface-2 rounded-lg flex items-center justify-center">
          <User size={40} className="text-fg-faint" />
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            {editMode ? (
              <input
                type="text"
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                placeholder="Character Name"
                className="text-xl font-bold bg-surface-2 border border-edge-strong rounded px-2 py-1 text-fg-bright w-64"
              />
            ) : (
              <h2 className="text-xl font-bold text-fg-bright">{name}</h2>
            )}
            {isPlayer && (
              <span className="px-2 py-0.5 bg-accent-600 text-xs rounded text-white">
                Player
              </span>
            )}
          </div>
          <div className="text-fg-muted text-sm">
            Total Points: <span className="text-fg-primary font-medium">{totalPoints}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
