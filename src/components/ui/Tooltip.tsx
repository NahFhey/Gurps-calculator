import { useCallback, useRef, useState, ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface TooltipProps {
  /** Tooltip body. Plain text or a structured node. */
  content: ReactNode;
  children: ReactNode;
  /** Extra classes for the inline trigger wrapper. */
  className?: string;
}

interface TooltipPosition {
  x: number;
  y: number;
  /** Render above (default) or below the trigger when near the viewport top. */
  side: 'top' | 'bottom';
}

/**
 * Phase 12a.6: Lightweight hover/focus tooltip.
 *
 * Rendered through a portal so it escapes overflow-clipped containers
 * (tracker rows, timeline strip). Position is computed once on open —
 * tooltips close on mouse-leave, so live tracking isn't needed.
 */
export function Tooltip({ content, children, className = '' }: TooltipProps) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [position, setPosition] = useState<TooltipPosition | null>(null);

  const show = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const side: TooltipPosition['side'] = rect.top < 120 ? 'bottom' : 'top';
    setPosition({
      // Clamped so the (max-w-xs ≈ 320px) tooltip body stays on-screen
      x: Math.min(Math.max(rect.left + rect.width / 2, 168), window.innerWidth - 168),
      y: side === 'top' ? rect.top - 6 : rect.bottom + 6,
      side,
    });
  }, []);

  const hide = useCallback(() => setPosition(null), []);

  return (
    <span
      ref={triggerRef}
      className={`inline-flex ${className}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {position !== null && content != null &&
        createPortal(
          <div
            role="tooltip"
            className="fixed z-50 max-w-xs px-3 py-2 rounded bg-surface-sunken border border-edge-strong shadow-lg text-xs text-fg-primary whitespace-pre-wrap pointer-events-none"
            style={{
              left: position.x,
              top: position.y,
              transform:
                position.side === 'top'
                  ? 'translate(-50%, -100%)'
                  : 'translate(-50%, 0)',
            }}
          >
            {content}
          </div>,
          document.body
        )}
    </span>
  );
}
