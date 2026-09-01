import { ReactNode } from 'react';
import { usePanelLayout } from '../../contexts/PanelLayoutContext';

/**
 * DowntimeTile - A clickable tile that opens a downtime activity system
 *
 * Part of the Downtime System
 *
 * Clicking a tile expands it to fill the center panel area (default behavior)
 * or can open as a modal overlay.
 */

export interface DowntimeTileProps {
  /** Title of the activity (e.g., "Alchemy", "Cooking") */
  title: string;
  /** Brief description shown below the title */
  description: string;
  /** Icon to display (emoji or React node) */
  icon: ReactNode;
  /** The component to render when the tile is clicked */
  activityComponent: ReactNode;
  /** Optional: Active project/item count to show on tile */
  activeCount?: number;
  /** Optional: Whether to use modal instead of expand (default: false = expand) */
  useModal?: boolean;
  /** Optional: Callback when tile is clicked (before opening) */
  onClick?: () => void;
}

export function DowntimeTile({
  title,
  description,
  icon,
  activityComponent,
  activeCount,
  useModal = false,
  onClick,
}: DowntimeTileProps) {
  const { actions } = usePanelLayout();

  const handleClick = () => {
    onClick?.();

    if (useModal) {
      actions.openModal(activityComponent, title);
    } else {
      // Default: expand to fill center area
      actions.openModal(activityComponent, title);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex flex-col items-center justify-center p-4 bg-surface-1 hover:bg-surface-2
                 border border-edge-strong hover:border-edge-bright rounded-lg
                 transition-all duration-200 cursor-pointer
        focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 focus:ring-offset-surface-0
                 min-h-[120px] relative group"
    >
      {/* Active count badge */}
      {activeCount !== undefined && activeCount > 0 && (
        <span className="absolute top-2 right-2 bg-accent-600 text-white text-xs font-bold
                        px-2 py-0.5 rounded-full min-w-[20px] text-center">
          {activeCount}
        </span>
      )}

      {/* Icon */}
      <span className="text-3xl mb-2 group-hover:scale-110 transition-transform duration-200">
        {icon}
      </span>

      {/* Title */}
      <span className="text-sm font-semibold text-fg-bright mb-1">
        {title}
      </span>

      {/* Description */}
      <span className="text-xs text-fg-muted text-center">
        {description}
      </span>
    </button>
  );
}

export default DowntimeTile;
