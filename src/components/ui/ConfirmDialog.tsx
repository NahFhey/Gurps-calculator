import { ReactNode, useCallback, useState } from 'react';
import { Modal } from './Modal';

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
  // Confirm button styles based on variant
  const confirmButtonClass = {
    default: 'bg-accent-600 hover:bg-accent-500 text-white',
    danger: 'bg-danger-600 hover:bg-danger-500 text-white',
    warning: 'bg-yellow-600 hover:bg-yellow-500 text-white',
  }[variant];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      size="md"
      hideCloseButton
      ariaDescribedby="confirm-dialog-message"
      footer={(
        <>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded border border-edge-strong text-fg-secondary hover:border-edge-bright hover:bg-surface-2"
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
        </>
      )}
    >
      <div id="confirm-dialog-message" className="text-fg-secondary">
        {message}
      </div>
    </Modal>
  );
}

// ============================================================================
// HOOK FOR EASIER USAGE
// ============================================================================

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
