import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import ConditionsPanel from './ConditionsPanel';
import type { ConditionInstance } from '../../types/combatTracker';

/**
 * Phase 12a.6: Two-surface condition popover.
 *
 * Floating card that reuses ConditionsPanel (badges + eye toggles + add form)
 * for a specific participant, opened from any surface that can supply a
 * participant id and a screen anchor point: tracker rows, timeline tokens,
 * and map tokens all open this same popover, and all dispatch through the
 * participant-targeted handlers in useCombatConditions.
 *
 * GM-only by construction — hosts only render it in GM view.
 */

interface PopoverParticipant {
  /** Participant instanceId (ConditionsPanel's `id`). */
  id: string;
  name: string;
  category?: string;
  conditions?: ConditionInstance[];
}

export interface ConditionAddPopoverProps {
  participant: PopoverParticipant;
  currentRound: number;
  currentTurn: number;
  /** Screen coordinates the popover anchors to (typically the click point). */
  anchor: { x: number; y: number };
  onClose: () => void;
  onAddCondition: (conditionInstance: ConditionInstance) => void;
  onRemoveCondition: (conditionInstanceId: string) => void;
  onCycleRevealed?: (conditionInstanceId: string) => void;
}

const POPOVER_WIDTH = 384; // w-96
const POPOVER_MAX_HEIGHT = 480;

export default function ConditionAddPopover({
  participant,
  currentRound,
  currentTurn,
  anchor,
  onClose,
  onAddCondition,
  onRemoveCondition,
  onCycleRevealed,
}: ConditionAddPopoverProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (
        containerRef.current &&
        e.target instanceof Node &&
        !containerRef.current.contains(e.target)
      ) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Clamp so the card stays on-screen; max-h + scroll handles tall content.
  const left = Math.min(Math.max(anchor.x, 8), window.innerWidth - POPOVER_WIDTH - 8);
  const top = Math.min(
    anchor.y + 8,
    Math.max(8, window.innerHeight - POPOVER_MAX_HEIGHT - 8),
  );

  return createPortal(
    <div
      ref={containerRef}
      role="dialog"
      aria-label={`Conditions for ${participant.name}`}
      className="fixed z-40 w-96 max-h-[30rem] overflow-y-auto bg-gray-900 border border-gray-600 rounded-lg shadow-2xl p-4"
      style={{ left, top }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="font-semibold text-sm text-gray-300 truncate">
          {participant.name}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="flex-none p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors"
          aria-label="Close conditions popover"
        >
          <X size={14} />
        </button>
      </div>

      <ConditionsPanel
        participant={participant}
        currentRound={currentRound}
        currentTurn={currentTurn}
        onAddCondition={onAddCondition}
        onRemoveCondition={onRemoveCondition}
        onCycleRevealed={onCycleRevealed}
      />
    </div>,
    document.body,
  );
}
