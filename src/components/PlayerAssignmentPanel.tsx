/**
 * PlayerAssignmentPanel — GM-only panel for assigning characters to connected players.
 * Shown inside the ConnectionDialog when the GM is connected.
 */

import { useMemo } from 'react';
import { Users, UserPlus, X } from 'lucide-react';
import { useSyncContext } from '../net/SyncProvider';
import { useCampaignCharacters, useCampaignStore } from '../state/campaignStore';
import { Role } from '../../shared/session';

export function PlayerAssignmentPanel() {
  const { playerList } = useSyncContext();
  const characters = useCampaignCharacters();
  const { state, actions } = useCampaignStore();

  const playerCharacters = state.multiplayer?.playerCharacters ?? {};

  // Only show non-GM players
  const players = useMemo(
    () => playerList.filter(p => p.role !== Role.GM),
    [playerList]
  );

  // Characters not assigned to anyone
  const unassignedCharacters = useMemo(() => {
    const assignedIds = new Set(
      Object.values(playerCharacters).flat()
    );
    return characters.filter(c => !assignedIds.has(c.id));
  }, [characters, playerCharacters]);

  if (players.length === 0) {
    return (
      <div className="mt-4 pt-4 border-t border-gray-700">
        <div className="flex items-center gap-2 mb-2">
          <Users className="h-4 w-4 text-gray-400" />
          <h3 className="text-sm font-medium text-gray-300">Player Assignment</h3>
        </div>
        <p className="text-xs text-gray-500">No players connected yet. Share the join code above.</p>
      </div>
    );
  }

  const handleAssign = (playerName: string, characterId: string) => {
    actions.assignCharacterToPlayer(playerName, characterId);
  };

  const handleUnassign = (playerName: string, characterId: string) => {
    actions.unassignCharacterFromPlayer(playerName, characterId);
  };

  return (
    <div className="mt-4 pt-4 border-t border-gray-700">
      <div className="flex items-center gap-2 mb-3">
        <Users className="h-4 w-4 text-gray-400" />
        <h3 className="text-sm font-medium text-gray-300">Player Assignment</h3>
      </div>

      <div className="space-y-3">
        {players.map(player => {
          const assignedIds = playerCharacters[player.displayName] || [];
          const assignedChars = characters.filter(c => assignedIds.includes(c.id));

          return (
            <div key={player.socketId} className="rounded bg-gray-900 p-3">
              <div className="text-sm font-medium text-gray-200 mb-2">
                {player.displayName}
                <span className="ml-2 text-xs text-gray-500 font-normal">
                  ({player.role})
                </span>
              </div>

              {/* Assigned characters */}
              {assignedChars.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {assignedChars.map(char => (
                    <span
                      key={char.id}
                      className="inline-flex items-center gap-1 rounded bg-blue-500/20 border border-blue-500/40 px-2 py-0.5 text-xs text-blue-200"
                    >
                      {char.name}
                      <button
                        onClick={() => handleUnassign(player.displayName, char.id)}
                        className="hover:text-red-300"
                        title="Unassign"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Assign dropdown */}
              {unassignedCharacters.length > 0 && (
                <select
                  className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
                  value=""
                  onChange={(e) => {
                    if (e.target.value) {
                      handleAssign(player.displayName, e.target.value);
                    }
                  }}
                >
                  <option value="">
                    <UserPlus className="h-3 w-3" />
                    Assign character...
                  </option>
                  {unassignedCharacters.map(char => (
                    <option key={char.id} value={char.id}>
                      {char.name}
                    </option>
                  ))}
                </select>
              )}

              {unassignedCharacters.length === 0 && assignedChars.length === 0 && (
                <p className="text-xs text-gray-500">No characters available to assign</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
