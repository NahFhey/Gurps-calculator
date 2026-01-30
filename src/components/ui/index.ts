/**
 * Shared UI Components
 *
 * This module exports reusable UI components for consistent styling
 * and behavior across the application.
 */

// Confirmation Dialog
export {
  ConfirmDialog,
  useConfirmDialog,
  type ConfirmDialogProps,
  type UseConfirmDialogOptions,
  type UseConfirmDialogReturn,
} from './ConfirmDialog';

// Loading States
export {
  LoadingSpinner,
  LoadingOverlay,
  Skeleton,
  SkeletonText,
  SkeletonCard,
  type LoadingSpinnerProps,
  type LoadingOverlayProps,
  type SkeletonProps,
} from './LoadingSpinner';

// Toast Notifications
export {
  ToastProvider,
  ToastContainer,
  useToast,
  standaloneToast,
  setToastRef,
  type ToastType,
  type ToastData,
  type ToastProps,
  type ToastContainerProps,
} from './Toast';
