/**
 * Shared Downtime Components
 *
 * Re-exports all shared components for convenient importing.
 *
 * Usage:
 * ```ts
 * import { StatusBadge, TaskActions, ValidationError } from '../shared';
 * ```
 */

// Status display
export { StatusBadge, getStatusBorderColor, getStatusBackgroundColor } from './StatusBadge';

// Task results
export { TaskResultsDisplay, CancelledMessage } from './TaskResultsDisplay';
export { ChainingAffordances } from './ChainingAffordances';

// Task actions
export { TaskActions, ResolveButton, CancelButton } from './TaskActions';

// Error display
export { ValidationError, InlineError } from './ValidationError';

// Character selection
export { CharacterSelector, MultiCharacterSelector } from './CharacterSelector';

// Tool selection
export { ToolSelector, ToolDisplay } from './ToolSelector';
