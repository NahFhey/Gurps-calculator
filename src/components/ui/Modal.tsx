import {
  type MouseEvent,
  type ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
} from 'react';
import { createPortal } from 'react-dom';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
  ariaLabel?: string;
  ariaDescribedby?: string;
  hideCloseButton?: boolean;
  size?: ModalSize;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  footer?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}

const sizeClasses: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-[95vw]',
};

const openModalStack: symbol[] = [];
let bodyScrollLockCount = 0;
let previousBodyOverflow = '';

function isTopmostModal(id: symbol): boolean {
  return openModalStack[openModalStack.length - 1] === id;
}

function getFocusableElements(panel: HTMLElement): HTMLElement[] {
  return Array.from(
    panel.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter(element => element.getAttribute('aria-hidden') !== 'true');
}

export function Modal({
  isOpen,
  onClose,
  title,
  ariaLabel,
  ariaDescribedby,
  hideCloseButton = false,
  size = 'md',
  closeOnBackdrop = true,
  closeOnEscape = true,
  footer,
  className = '',
  bodyClassName = 'p-6',
  children,
}: ModalProps) {
  const modalIdRef = useRef(Symbol('modal'));
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const generatedTitleId = useId();

  // Read via refs inside the open-lifecycle effect so changing callback
  // identities can't re-run it — a re-run re-pushes this modal onto the
  // stack, wrongly making a re-rendered background modal "topmost".
  const onCloseRef = useRef(onClose);
  const closeOnEscapeRef = useRef(closeOnEscape);
  useEffect(() => {
    onCloseRef.current = onClose;
    closeOnEscapeRef.current = closeOnEscape;
  }, [onClose, closeOnEscape]);

  useEffect(() => {
    if (!isOpen) return;

    const modalId = modalIdRef.current;
    openModalStack.push(modalId);

    if (bodyScrollLockCount === 0) {
      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    bodyScrollLockCount += 1;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isTopmostModal(modalId)) return;

      if (event.key === 'Escape' && closeOnEscapeRef.current) {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel) return;

      const focusableElements = getFocusableElements(panel);
      if (focusableElements.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey && (activeElement === first || activeElement === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (activeElement === last || !panel.contains(activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);

      const stackIndex = openModalStack.lastIndexOf(modalId);
      if (stackIndex !== -1) openModalStack.splice(stackIndex, 1);

      bodyScrollLockCount = Math.max(0, bodyScrollLockCount - 1);
      if (bodyScrollLockCount === 0) {
        document.body.style.overflow = previousBodyOverflow;
      }
    };
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) return;

    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const panel = panelRef.current;
    const autofocusTarget = panel?.querySelector<HTMLElement>('[autofocus], [data-autofocus]');
    (autofocusTarget ?? panel)?.focus();

    return () => {
      const previousElement = previouslyFocusedRef.current;
      if (previousElement?.isConnected) previousElement.focus();
      previouslyFocusedRef.current = null;
    };
  }, [isOpen]);

  if (!isOpen || typeof document === 'undefined') return null;

  const titleId = title === undefined ? undefined : generatedTitleId;

  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (
      event.target === event.currentTarget &&
      closeOnBackdrop &&
      isTopmostModal(modalIdRef.current)
    ) {
      onClose();
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={handleBackdropClick}
      data-testid="modal-backdrop"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-label={titleId ? undefined : (ariaLabel ?? 'Dialog')}
        aria-describedby={ariaDescribedby}
        tabIndex={-1}
        className={`flex max-h-[90vh] w-full flex-col overflow-hidden rounded-lg border border-edge bg-surface-1 shadow-2xl ${sizeClasses[size]} ${className}`}
      >
        {(title !== undefined || !hideCloseButton) && (
          <div className="flex flex-none items-center justify-between gap-4 border-b border-edge px-6 py-4">
            {title !== undefined && (
              <h2 id={titleId} className="min-w-0 text-xl font-bold text-fg-bright">
                {title}
              </h2>
            )}
            {!hideCloseButton && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="ml-auto rounded p-1 text-2xl leading-none text-fg-muted transition hover:bg-surface-2 hover:text-fg-primary"
              >
                <span aria-hidden="true">×</span>
              </button>
            )}
          </div>
        )}

        <div className={`min-h-0 flex-1 overflow-y-auto ${bodyClassName}`}>
          {children}
        </div>

        {footer !== undefined && (
          <div className="flex flex-none justify-end gap-3 border-t border-edge px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
