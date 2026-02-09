import { useMemo } from 'react';
import { Swords, Play, Users, Heart } from 'lucide-react';
import { useCampaignStore } from '../../state/campaignStore';

/**
 * CombatTile - Compact combat status display at the bottom of the layout
 *
 * Part of Phase 2: Layout Restructure
 *
 * Shows:
 * - When no combat: "Start Combat" button
 * - When combat active: Round, current turn, participant count, HP summary
 *
 * Clicking expands to full Combat module or opens as modal
 */

interface CombatTileProps {
  onExpand?: () => void;
  compact?: boolean;
}

export function CombatTile({ onExpand, compact = false }: CombatTileProps) {
  const { state, actions } = useCampaignStore();

  const combatActive = state.combat.active;
  const session = state.combat.activeSession;

  // Compute participant stats
  const participantStats = useMemo(() => {
    if (!session?.participants) {
      return { total: 0, allies: 0, enemies: 0, active: 0 };
    }

    const allies = session.participants.filter(p => p.team === 'ally');
    const enemies = session.participants.filter(p => p.team === 'enemy');
    const active = session.participants.filter(p => p.status === 'active');

    return {
      total: session.participants.length,
      allies: allies.length,
      enemies: enemies.length,
      active: active.length,
    };
  }, [session?.participants]);

  // Get current turn character name
  const currentTurnCharacter = useMemo(() => {
    if (!session?.participants || session.currentTurn === undefined) {
      return null;
    }

    // Sort participants by initiative (descending) to match turn order
    const sortedParticipants = [...session.participants].sort(
      (a, b) => b.initiative - a.initiative
    );

    const turnIndex = session.currentTurn % sortedParticipants.length;
    const currentParticipant = sortedParticipants[turnIndex];

    if (!currentParticipant) return null;

    // Get character name from combat characters
    const combatChar = state.entities.combatCharacters[currentParticipant.characterId];
    return combatChar?.name || 'Unknown';
  }, [session, state.entities.combatCharacters]);

  // Get HP summary for allies
  const hpSummary = useMemo(() => {
    if (!session?.participants) return null;

    const allies = session.participants.filter(p => p.team === 'ally');
    if (allies.length === 0) return null;

    return allies.slice(0, 3).map(p => {
      const char = state.entities.combatCharacters[p.characterId];
      const maxHP = char?.maxHP || 10;
      const percentage = Math.round((p.currentHP / maxHP) * 100);
      return {
        name: char?.name?.slice(0, 8) || '???',
        hp: p.currentHP,
        maxHP,
        percentage,
      };
    });
  }, [session?.participants, state.entities.combatCharacters]);

  const handleClick = () => {
    if (onExpand) {
      onExpand();
    } else {
      // Default behavior: switch to combat module
      actions.setActiveModule('combat');
    }
  };

  const handleStartCombat = () => {
    // If combat module is already open, close it (toggle behavior)
    if (state.ui.activeModule === 'combat') {
      actions.setActiveModule('');
    } else {
      actions.startCombat();
      actions.setActiveModule('combat');
    }
  };

  // Inactive combat state
  if (!combatActive || !session) {
    return (
      <div
        className={`rounded border border-gray-700 bg-gray-800/60 ${compact ? 'p-2' : 'p-4'}`}
        data-testid="combat-tile-inactive"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-gray-700/50">
              <Swords className="h-4 w-4 text-gray-400" />
            </div>
            <div>
              <div className="text-sm font-medium text-gray-300">No Active Combat</div>
              {!compact && (
                <div className="text-xs text-gray-500">Start an encounter to begin tracking</div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleStartCombat}
            className="flex items-center gap-2 rounded border border-red-500/50 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200 transition-colors hover:border-red-400 hover:bg-red-500/20"
            data-testid="start-combat-button"
          >
            <Play className="h-4 w-4" />
            Start Combat
          </button>
        </div>
      </div>
    );
  }

  // Active combat state
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleClick();
        }
      }}
      className={`cursor-pointer rounded border border-red-500/40 bg-red-500/5 transition-colors hover:border-red-400 hover:bg-red-500/10 ${
        compact ? 'p-2' : 'p-4'
      }`}
      data-testid="combat-tile-active"
    >
      <div className="flex items-center justify-between gap-4">
        {/* Left: Combat Status */}
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-red-500/20">
            <Swords className="h-4 w-4 text-red-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-red-200">
                Round {session.currentRound || 1}
              </span>
              {currentTurnCharacter && (
                <>
                  <span className="text-gray-500">|</span>
                  <span className="text-sm text-gray-300">
                    Turn: <span className="text-white">{currentTurnCharacter}</span>
                  </span>
                </>
              )}
            </div>
            {!compact && session.name && (
              <div className="text-xs text-gray-400">{session.name}</div>
            )}
          </div>
        </div>

        {/* Center: Participants */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-gray-400" />
            <span className="text-gray-300">
              <span className="text-blue-300">{participantStats.allies}</span>
              <span className="text-gray-500"> vs </span>
              <span className="text-red-300">{participantStats.enemies}</span>
            </span>
          </div>

          {/* HP Summary */}
          {!compact && hpSummary && hpSummary.length > 0 && (
            <div className="flex items-center gap-3 border-l border-gray-700 pl-4">
              {hpSummary.map((char, idx) => (
                <div key={idx} className="flex items-center gap-1 text-xs">
                  <Heart
                    className={`h-3 w-3 ${
                      char.percentage > 50
                        ? 'text-green-400'
                        : char.percentage > 25
                        ? 'text-yellow-400'
                        : 'text-red-400'
                    }`}
                  />
                  <span className="text-gray-400">{char.name}</span>
                  <span className="text-gray-300">
                    {char.hp}/{char.maxHP}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Action hint */}
        <div className="text-xs text-gray-500">
          Click to {state.ui.activeModule === 'combat' ? 'view' : 'return to'} combat
        </div>
      </div>
    </div>
  );
}

export default CombatTile;
