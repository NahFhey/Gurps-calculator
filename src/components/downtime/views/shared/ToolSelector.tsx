/**
 * Tool Selector
 *
 * Multi-select for tools with availability indicators.
 * Shows which tools are reserved vs available in the current slot.
 */

import { Wrench, Lock, CheckCircle } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface Tool {
  id: string;
  name: string;
  type?: string;
  condition?: string;
}

interface ToolSelectorProps {
  /** Label for the selector */
  label: string;
  /** Currently selected tool IDs */
  value: string[];
  /** Called when selection changes */
  onChange: (toolIds: string[]) => void;
  /** All available tools */
  tools: Tool[];
  /** Set of tool IDs that are currently reserved */
  reservedToolIds?: Set<string>;
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Minimum number of required tools */
  minRequired?: number;
  /** Maximum number of tools allowed */
  maxAllowed?: number;
  /** Error message to display */
  error?: string;
  /** Optional additional CSS classes */
  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ToolSelector({
  label,
  value,
  onChange,
  tools,
  reservedToolIds = new Set(),
  disabled = false,
  minRequired = 0,
  maxAllowed,
  error,
  className = '',
}: ToolSelectorProps) {
  const toggleTool = (toolId: string) => {
    if (value.includes(toolId)) {
      onChange(value.filter((id) => id !== toolId));
    } else if (!maxAllowed || value.length < maxAllowed) {
      onChange([...value, toolId]);
    }
  };

  // Sort tools: available first, then reserved
  const sortedTools = [...tools].sort((a, b) => {
    const aReserved = reservedToolIds.has(a.id);
    const bReserved = reservedToolIds.has(b.id);

    if (aReserved !== bReserved) {
      return aReserved ? 1 : -1;
    }

    return a.name.localeCompare(b.name);
  });

  const selectedCount = value.length;
  const hasMinimum = selectedCount >= minRequired;

  return (
    <div className={`tool-selector ${className}`}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {(minRequired > 0 || maxAllowed) && (
          <span className={`ml-1 font-normal ${hasMinimum ? 'text-gray-500' : 'text-red-500'}`}>
            ({selectedCount}
            {minRequired > 0 && `/${minRequired} min`}
            {maxAllowed && `, ${maxAllowed} max`})
          </span>
        )}
      </label>

      <div
        className={`
          space-y-1 max-h-40 overflow-y-auto border rounded-md p-2
          ${error ? 'border-red-300' : 'border-gray-300'}
        `}
      >
        {sortedTools.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No tools available</p>
        ) : (
          sortedTools.map((tool) => {
            const isReserved = reservedToolIds.has(tool.id);
            const isSelected = value.includes(tool.id);
            const isDisabledByMax = !isSelected && maxAllowed && value.length >= maxAllowed;
            const isDisabledByReserve = isReserved && !isSelected;

            return (
              <label
                key={tool.id}
                className={`
                  flex items-center gap-2 p-1.5 rounded cursor-pointer
                  ${isSelected ? 'bg-blue-50 border border-blue-200' : 'border border-transparent'}
                  ${isReserved && !isSelected ? 'opacity-50' : ''}
                  ${disabled || isDisabledByMax || isDisabledByReserve ? 'cursor-not-allowed' : 'hover:bg-gray-50'}
                `}
                title={isReserved ? 'This tool is reserved by another task in this slot' : undefined}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleTool(tool.id)}
                  disabled={disabled || !!isDisabledByMax || isDisabledByReserve}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />

                {/* Tool Icon */}
                <span className="flex-shrink-0">
                  {isReserved ? (
                    <Lock className="w-4 h-4 text-red-400" />
                  ) : isSelected ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <Wrench className="w-4 h-4 text-gray-400" />
                  )}
                </span>

                {/* Tool Info */}
                <div className="flex-1 min-w-0">
                  <span className="text-sm block truncate">{tool.name}</span>
                  {tool.type && (
                    <span className="text-xs text-gray-500">{tool.type}</span>
                  )}
                </div>

                {/* Status Badge */}
                {isReserved && (
                  <span className="text-xs text-red-500 flex-shrink-0">In use</span>
                )}
                {tool.condition && !isReserved && (
                  <span className="text-xs text-gray-500 flex-shrink-0">{tool.condition}</span>
                )}
              </label>
            );
          })
        )}
      </div>

      {/* Error Message */}
      {error && (
        <p className="mt-1 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {/* Help Text */}
      {!error && reservedToolIds.size > 0 && (
        <p className="mt-1 text-xs text-gray-500">
          Tools marked "In use" are reserved by other tasks in this slot
        </p>
      )}
    </div>
  );
}

// ============================================================================
// COMPACT TOOL DISPLAY
// ============================================================================

interface ToolDisplayProps {
  /** Tool IDs to display */
  toolIds: string[];
  /** All tools for name lookup */
  tools: Tool[];
  /** Optional label */
  label?: string;
  /** Optional additional CSS classes */
  className?: string;
}

/**
 * Read-only display of selected tools.
 */
export function ToolDisplay({ toolIds, tools, label = 'Tools', className = '' }: ToolDisplayProps) {
  if (toolIds.length === 0) {
    return null;
  }

  const toolNames = toolIds
    .map((id) => tools.find((t) => t.id === id)?.name ?? id)
    .join(', ');

  return (
    <div className={`tool-display text-sm ${className}`}>
      <span className="font-medium">{label}:</span>{' '}
      <span className="text-gray-600">{toolNames}</span>
    </div>
  );
}
