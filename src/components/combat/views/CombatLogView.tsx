import { memo, ChangeEvent, KeyboardEvent, ReactNode } from 'react';
import { Plus } from 'lucide-react';
import type {
  CombatLogViewProps,
  RollLogEntryProps,
  ActionLogEntryProps,
  LogEntry
} from '../../../types/combatTracker';

/**
 * CombatLogView - Combat log display with note input
 *
 * Displays the combat log with formatted entries for rolls,
 * actions, and other events. Includes a note input field.
 */
function CombatLogViewBase({
  displayLog,
  noteText,
  onSetNoteText,
  onAddNote
}: CombatLogViewProps) {
  return (
    <div className="space-y-2">
      <h3 className="text-lg font-semibold">Combat Log</h3>
      <div className="bg-surface-1 rounded p-4 h-96 overflow-y-auto font-mono text-sm">
        {displayLog.map((entry, index) => {
          const formatted = formatLogEntry(entry);
          return (
            <div key={entry.id || index} className="mb-1">
              {formatted}
            </div>
          );
        })}
      </div>

      {/* Add Note */}
      <div className="flex gap-2">
        <input
          type="text"
          value={noteText}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onSetNoteText(e.target.value)}
          onKeyPress={(e: KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && onAddNote()}
          placeholder="Add a note..."
          aria-label="Add a note to the combat log"
          className="flex-1 px-3 py-2 bg-surface-2 rounded"
        />
        <button
          onClick={onAddNote}
          aria-label="Add note to combat log"
          className="px-4 py-2 bg-success-600 hover:bg-success-700 rounded"
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
}

export const CombatLogView = memo(CombatLogViewBase);

// ============================================================================
// Log Entry Formatting
// ============================================================================

/**
 * Format log entry for display
 * Renders special components for roll entries with colored dice and action entries
 */
function formatLogEntry(entry: LogEntry): ReactNode {
  const timestamp = new Date(entry.timestamp).toLocaleTimeString();

  // Phase 3 action entry with detailed breakdown
  if (entry.entryType === 'action' && entry.action) {
    return <ActionLogEntry timestamp={timestamp} entry={entry} />;
  }

  // Phase 2 structured format with roll data
  if (entry.entryType === 'roll' && entry.roll) {
    return <RollLogEntry timestamp={timestamp} entry={entry} />;
  }

  // Regular Phase 2 structured format
  if (entry.entryType) {
    return `[${timestamp}] ${entry.text}`;
  }

  // Fallback for Phase 1
  return `[${timestamp}] ${entry.message || 'Unknown event'}`;
}

// ============================================================================
// RollLogEntry Component
// ============================================================================

/**
 * Roll Log Entry Component
 * Displays roll with colored individual dice
 * Memoized to prevent re-renders when other log entries change
 */
function RollLogEntryBase({ timestamp, entry }: RollLogEntryProps): ReactNode {
  const { roll } = entry;
  if (!roll) return null;

  const actorName = entry.text?.split(' rolled ')[0] || 'Unknown'; // Extract actor name from text

  // Colors for dice (cycling through a palette)
  const diceColors = [
    'text-danger-400',
    'text-accent-400',
    'text-success-400',
    'text-yellow-400',
    'text-purple-400',
    'text-pink-400',
    'text-cyan-400',
    'text-orange-400'
  ];

  const getDiceColor = (index: number): string => diceColors[index % diceColors.length];

  // Format: [timestamp] Name rolled 3d6 [3][4][5]: 12
  return (
    <span>
      [{timestamp}] {actorName} rolled {roll.expression}{' '}
      {roll.dice.map((die, index) => (
        <span key={index} className={`font-bold ${getDiceColor(index)}`}>
          [{die}]
        </span>
      ))}
      {roll.modifier !== 0 && (
        <span> {roll.modifier > 0 ? `+${roll.modifier}` : roll.modifier}</span>
      )}
      : {roll.total}
      {roll.target !== null && (
        <span>
          {' vs '}
          <span className="font-semibold">{roll.target}</span>
          {' ['}
          <span className={roll.margin >= 0 ? 'text-success-400 font-bold' : 'text-danger-400 font-bold'}>
            {roll.margin >= 0 ? `+${roll.margin}` : roll.margin}
          </span>
          {'] '}
          <span className={roll.success ? 'text-success-400 font-bold' : 'text-danger-400 font-bold'}>
            {roll.success ? 'SUCCESS' : 'FAILURE'}
          </span>
        </span>
      )}
    </span>
  );
}

const RollLogEntry = memo(RollLogEntryBase);

// ============================================================================
// ActionLogEntry Component
// ============================================================================

/**
 * Action Log Entry Component (Phase 3)
 * Displays combat actions with detailed breakdown
 * Memoized to prevent re-renders when other log entries change
 */
function ActionLogEntryBase({ timestamp, entry }: ActionLogEntryProps): ReactNode {
  const { action } = entry;
  if (!action) return null;

  return (
    <div className="bg-surface-0 rounded p-2 my-1">
      <div className="text-xs text-fg-faint">[{timestamp}]</div>
      <div className="font-semibold">{entry.text}</div>

      {/* Show modifier details if available */}
      {action.attack && action.attack.modifiers && action.attack.modifiers.length > 0 && (
        <div className="text-xs text-fg-muted mt-1">
          Modifiers: {action.attack.modifiers.map(m => `${m.label} ${m.value >= 0 ? '+' : ''}${m.value}`).join(', ')}
        </div>
      )}

      {action.defense && action.defense.modifiers && action.defense.modifiers.length > 0 && (
        <div className="text-xs text-fg-muted mt-1">
          Modifiers: {action.defense.modifiers.map(m => `${m.label} ${m.value >= 0 ? '+' : ''}${m.value}`).join(', ')}
        </div>
      )}

      {action.damage && (
        <div className="text-xs text-fg-muted mt-1">
          {action.damage.expression && action.damage.expression !== 'manual' && (
            <span>Damage: {action.damage.expression} → {action.damage.rolledDamage}</span>
          )}
          {(action.damage.generalDRUsed || 0) > 0 && (
            <span> | DR: {action.damage.generalDRUsed}</span>
          )}
        </div>
      )}
    </div>
  );
}

const ActionLogEntry = memo(ActionLogEntryBase);
