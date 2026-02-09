import { ReactNode, useEffect, useCallback } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface ConfirmDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Dialog title */
  title: string;
  /** Dialog message/content - can be string or JSX */
  message: ReactNode;
  /** Text for confirm button (default: "Confirm") */
  confirmLabel?: string;
  /** Text for cancel button (default: "Cancel") */
  cancelLabel?: string;
  /** Variant affects confirm button styling */
  variant?: 'default' | 'danger' | 'warning';
  /** Called when user confirms */
  onConfirm: () => void;
  /** Called when user cancels or closes */
  onCancel: () => void;
  /** Whether confirm button is disabled */
  confirmDisabled?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * ConfirmDialog Component
 *
 * A reusable confirmation dialog that replaces native window.confirm().
 * Provides consistent styling and better UX across the application.
 *
 * @example
 * ```tsx
 * <ConfirmDialog
 *   isOpen={showDeleteConfirm}
 *   title="Delete Item"
 *   message="Are you sure you want to delete this item?"
 *   variant="danger"
 *   confirmLabel="Delete"
 *   onConfirm={handleDelete}
 *   onCancel={() => setShowDeleteConfirm(false)}
 * />
 * ```
 */
export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
  confirmDisabled = false,
}: ConfirmDialogProps) {
  // Handle escape key to close
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel();
      }
    },
    [onCancel]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll when dialog is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) {
    return null;
  }

  // Confirm button styles based on variant
  const confirmButtonClass = {
    default: 'bg-blue-600 hover:bg-blue-500 text-white',
    danger: 'bg-red-600 hover:bg-red-500 text-white',
    warning: 'bg-yellow-600 hover:bg-yellow-500 text-white',
  }[variant];

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div
        className="bg-gray-800 rounded-lg border border-gray-600 w-full max-w-md m-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="confirm-dialog-title"
          className="text-lg font-semibold text-gray-100 mb-4"
        >
          {title}
        </h2>
        <div className="text-gray-300 mb-6">
          {message}
        </div>
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded border border-gray-600 text-gray-300 hover:border-gray-500 hover:bg-gray-700"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirmDisabled}
            className={`px-4 py-2 rounded font-semibold ${confirmButtonClass} ${
              confirmDisabled ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// HOOK FOR EASIER USAGE
// ============================================================================

import { useState } from 'react';

export interface UseConfirmDialogOptions {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger' | 'warning';
}

export interface UseConfirmDialogReturn {
  /** The ConfirmDialog component props (spread to ConfirmDialog) */
  dialogProps: ConfirmDialogProps;
  /** Opens the dialog and returns a promise that resolves with user's choice */
  confirm: () => Promise<boolean>;
  /** Closes the dialog (resolves promise with false) */
  close: () => void;
}

/**
 * Hook to manage confirm dialog state and promises.
 *
 * @example
 * ```tsx
 * const { dialogProps, confirm } = useConfirmDialog({
 *   title: 'Delete Item',
 *   message: 'Are you sure?',
 *   variant: 'danger',
 * });
 *
 * const handleDelete = async () => {
 *   if (await confirm()) {
 *     // User confirmed, proceed with deletion
 *   }
 * };
 *
 * return (
 *   <>
 *     <button onClick={handleDelete}>Delete</button>
 *     <ConfirmDialog {...dialogProps} />
 *   </>
 * );
 * ```
 */
export function useConfirmDialog(options: UseConfirmDialogOptions): UseConfirmDialogReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [resolveRef, setResolveRef] = useState<((value: boolean) => void) | null>(null);

  const confirm = useCallback((): Promise<boolean> => {
    return new Promise((resolve) => {
      setResolveRef(() => resolve);
      setIsOpen(true);
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setIsOpen(false);
    resolveRef?.(true);
    setResolveRef(null);
  }, [resolveRef]);

  const handleCancel = useCallback(() => {
    setIsOpen(false);
    resolveRef?.(false);
    setResolveRef(null);
  }, [resolveRef]);

  const close = useCallback(() => {
    handleCancel();
  }, [handleCancel]);

  return {
    dialogProps: {
      isOpen,
      title: options.title,
      message: options.message,
      confirmLabel: options.confirmLabel,
      cancelLabel: options.cancelLabel,
      variant: options.variant,
      onConfirm: handleConfirm,
      onCancel: handleCancel,
    },
    confirm,
    close,
  };
}
