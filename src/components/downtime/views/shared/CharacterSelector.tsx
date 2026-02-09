/**
 * Character Selector
 *
 * Dropdown for selecting characters with assignment status indicators.
 * Shows which characters are available vs already assigned.
 */

import { User, UserCheck, AlertTriangle, AlertOctagon } from 'lucide-react';
import type { Character } from '../../../../types/campaign';
import type { CharacterSlotSummary, FatigueStatus } from '../../../../state/downtime/downtimeSelectors';

// ============================================================================
// TYPES
// ============================================================================

interface CharacterSelectorProps {
  /** Label for the selector */
  label: string;
  /** Currently selected character ID */
  value: string;
  /** Called when selection changes */
  onChange: (characterId: string) => void;
  /** All available characters */
  characters: Character[];
  /** Map of character IDs to their slot summaries (for assignment status) */
  summaries?: Map<string, CharacterSlotSummary>;
  /** Character IDs to exclude from selection (e.g., already selected as leader) */
  excludeIds?: string[];
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Placeholder text when nothing selected */
  placeholder?: string;
  /** Error message to display */
  error?: string;
  /** Optional additional CSS classes */
  className?: string;
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

interface FatigueBadgeProps {
  status: FatigueStatus;
}

function FatigueBadge({ status }: FatigueBadgeProps) {
  if (status === 'rested') return null;

  const config = {
    tired: {
      icon: AlertTriangle,
      bg: 'bg-yellow-900/50',
      text: 'text-yellow-300',
      label: 'Tired',
    },
    exhausted: {
      icon: AlertOctagon,
      bg: 'bg-red-900/50',
      text: 'text-red-300',
      label: 'Exhausted',
    },
  };

  const { icon: Icon, bg, text, label } = config[status];

  return (
    <span className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-xs ${bg} ${text}`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

export function CharacterSelector({
  label,
  value,
  onChange,
  characters,
  summaries,
  excludeIds = [],
  disabled = false,
  placeholder = 'Select a character...',
  error,
  className = '',
}: CharacterSelectorProps) {
  // Get availability and fatigue info for each character
  const getCharacterStatus = (charId: string) => {
    const summary = summaries?.get(charId);
    const isExcluded = excludeIds.includes(charId);

    return {
      isAssigned: summary?.isAssigned ?? false,
      activityName: summary?.activityDisplayName ?? null,
      fatigueStatus: summary?.fatigueStatus ?? 'rested',
      isExcluded,
      isAvailable: !summary?.isAssigned && !isExcluded,
    };
  };

  // Sort characters: available first, then by name
  const sortedCharacters = [...characters].sort((a, b) => {
    const statusA = getCharacterStatus(a.id);
    const statusB = getCharacterStatus(b.id);

    // Available characters first
    if (statusA.isAvailable !== statusB.isAvailable) {
      return statusA.isAvailable ? -1 : 1;
    }

    // Then by name
    return a.name.localeCompare(b.name);
  });

  return (
    <div className={`character-selector ${className}`}>
      <label className="block text-sm font-medium text-gray-300 mb-1">
        {label}
      </label>

      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={`
            block w-full rounded-md border px-3 py-2 pr-10 text-sm text-gray-100
            ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-gray-600 focus:border-blue-500 focus:ring-blue-500'}
            ${disabled ? 'bg-gray-800 cursor-not-allowed' : 'bg-gray-900'}
          `}
          data-testid="character-selector"
        >
          <option value="">{placeholder}</option>

          {sortedCharacters.map((char) => {
            const status = getCharacterStatus(char.id);
            const isDisabled = !status.isAvailable && char.id !== value;

            let optionLabel = char.name;
            if (status.isAssigned) {
              optionLabel += ` (${status.activityName ?? 'Assigned'})`;
            } else if (status.isExcluded) {
              optionLabel += ' (Selected above)';
            }

            return (
              <option key={char.id} value={char.id} disabled={isDisabled}>
                {optionLabel}
              </option>
            );
          })}
        </select>

        {/* Status Icon */}
        <div className="absolute inset-y-0 right-8 flex items-center pointer-events-none">
          {value && (
            <span className="text-gray-500">
              {getCharacterStatus(value).isAssigned ? (
                <UserCheck className="w-4 h-4 text-green-400" />
              ) : (
                <User className="w-4 h-4" />
              )}
            </span>
          )}
        </div>
      </div>

      {/* Fatigue Warning */}
      {value && summaries?.get(value)?.fatigueStatus && (
        <div className="mt-1">
          <FatigueBadge status={summaries.get(value)!.fatigueStatus} />
        </div>
      )}

      {/* Error Message */}
      {error && (
        <p className="mt-1 text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// ============================================================================
// MULTI-SELECT VARIANT
// ============================================================================

interface MultiCharacterSelectorProps {
  /** Label for the selector */
  label: string;
  /** Currently selected character IDs */
  value: string[];
  /** Called when selection changes */
  onChange: (characterIds: string[]) => void;
  /** All available characters */
  characters: Character[];
  /** Map of character IDs to their slot summaries */
  summaries?: Map<string, CharacterSlotSummary>;
  /** Character IDs to exclude from selection */
  excludeIds?: string[];
  /** Maximum number of selections allowed */
  maxSelections?: number;
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Optional additional CSS classes */
  className?: string;
}

/**
 * Multi-select character picker for helper selection.
 */
export function MultiCharacterSelector({
  label,
  value,
  onChange,
  characters,
  summaries,
  excludeIds = [],
  maxSelections,
  disabled = false,
  className = '',
}: MultiCharacterSelectorProps) {
  const toggleCharacter = (charId: string) => {
    if (value.includes(charId)) {
      onChange(value.filter((id) => id !== charId));
    } else if (!maxSelections || value.length < maxSelections) {
      onChange([...value, charId]);
    }
  };

  const getCharacterStatus = (charId: string) => {
    const summary = summaries?.get(charId);
    const isExcluded = excludeIds.includes(charId);

    return {
      isAssigned: summary?.isAssigned ?? false,
      fatigueStatus: summary?.fatigueStatus ?? 'rested',
      isExcluded,
      isAvailable: !summary?.isAssigned && !isExcluded,
    };
  };

  const availableCharacters = characters.filter((c) => {
    const status = getCharacterStatus(c.id);
    return status.isAvailable || value.includes(c.id);
  });

  return (
    <div className={`multi-character-selector ${className}`}>
      <label className="block text-sm font-medium text-gray-300 mb-1">
        {label}
        {maxSelections && (
          <span className="text-gray-500 font-normal ml-1">
            ({value.length}/{maxSelections})
          </span>
        )}
      </label>

      <div className="space-y-1 max-h-32 overflow-y-auto border border-gray-600 rounded-md p-2 bg-gray-900">
        {availableCharacters.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No characters available</p>
        ) : (
          availableCharacters.map((char) => {
            const status = getCharacterStatus(char.id);
            const isSelected = value.includes(char.id);
            const isDisabledByMax = !isSelected && maxSelections && value.length >= maxSelections;

            return (
              <label
                key={char.id}
                className={`
                  flex items-center gap-2 p-1 rounded cursor-pointer
                  ${isSelected ? 'bg-blue-900/50' : 'hover:bg-gray-800'}
                  ${disabled || isDisabledByMax ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleCharacter(char.id)}
                  disabled={disabled || !!isDisabledByMax}
                  className="rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm flex-1 text-gray-200">{char.name}</span>
                {status.fatigueStatus !== 'rested' && (
                  <FatigueBadge status={status.fatigueStatus} />
                )}
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}
