import { useState, useEffect, useRef, useCallback, createContext, useContext, ReactNode } from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastData {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

export interface ToastProps extends ToastData {
  onDismiss: (id: string) => void;
}

export interface ToastContainerProps {
  /** Position of toast container */
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
}

// ============================================================================
// TOAST COMPONENT
// ============================================================================

const iconMap = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const styleMap = {
  success: 'bg-green-900/90 border-green-500 text-green-100',
  error: 'bg-red-900/90 border-red-500 text-red-100',
  warning: 'bg-yellow-900/90 border-yellow-500 text-yellow-100',
  info: 'bg-blue-900/90 border-blue-500 text-blue-100',
};

const iconColorMap = {
  success: 'text-green-400',
  error: 'text-red-400',
  warning: 'text-yellow-400',
  info: 'text-blue-400',
};

/**
 * Individual Toast Component
 */
function Toast({ id, type, message, duration = 5000, onDismiss }: ToastProps) {
  const [isExiting, setIsExiting] = useState(false);
  const cancelledRef = useRef(false);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
      if (exitTimerRef.current !== null) {
        clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        if (cancelledRef.current) return;
        setIsExiting(true);
        exitTimerRef.current = setTimeout(() => {
          if (cancelledRef.current) return;
          onDismiss(id);
        }, 300);
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [id, duration, onDismiss]);

  const handleDismiss = () => {
    setIsExiting(true);
    exitTimerRef.current = setTimeout(() => {
      if (cancelledRef.current) return;
      onDismiss(id);
    }, 300);
  };

  const Icon = iconMap[type];

  return (
    <div
      className={`
        flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg
        transition-all duration-300
        ${styleMap[type]}
        ${isExiting ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'}
      `}
      role="alert"
      aria-live="polite"
    >
      <Icon className={`h-5 w-5 flex-shrink-0 ${iconColorMap[type]}`} />
      <span className="flex-1 text-sm">{message}</span>
      <button
        type="button"
        onClick={handleDismiss}
        className="flex-shrink-0 p-1 rounded hover:bg-white/10 transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// ============================================================================
// TOAST CONTAINER
// ============================================================================

const positionClasses = {
  'top-right': 'top-4 right-4',
  'top-left': 'top-4 left-4',
  'bottom-right': 'bottom-4 right-4',
  'bottom-left': 'bottom-4 left-4',
  'top-center': 'top-4 left-1/2 -translate-x-1/2',
  'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
};

/**
 * ToastContainer Component
 *
 * Renders the toast notifications. Should be placed once at the app root.
 */
export function ToastContainer({ position = 'top-right' }: ToastContainerProps) {
  const { toasts, dismissToast } = useToast();

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      className={`fixed z-50 flex flex-col gap-2 w-full max-w-sm ${positionClasses[position]}`}
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} onDismiss={dismissToast} />
      ))}
    </div>
  );
}

// ============================================================================
// TOAST CONTEXT
// ============================================================================

interface ToastContextValue {
  toasts: ToastData[];
  addToast: (toast: Omit<ToastData, 'id'>) => string;
  dismissToast: (id: string) => void;
  clearToasts: () => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

/**
 * ToastProvider Component
 *
 * Provides toast context to the application.
 *
 * @example
 * ```tsx
 * // In your app root:
 * <ToastProvider>
 *   <App />
 *   <ToastContainer position="top-right" />
 * </ToastProvider>
 * ```
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const addToast = useCallback((toast: Omit<ToastData, 'id'>): string => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
    return id;
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearToasts = useCallback(() => {
    setToasts([]);
  }, []);

  const value = { toasts, addToast, dismissToast, clearToasts };

  // Keep standaloneToast (used outside React, e.g. SyncProvider errors) wired
  // to the live provider instead of its console fallback.
  useEffect(() => {
    setToastRef(value);
    return () => setToastRef(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toasts, addToast, dismissToast, clearToasts]);

  return (
    <ToastContext.Provider value={value}>
      {children}
    </ToastContext.Provider>
  );
}

/**
 * useToast Hook
 *
 * Access toast functionality from any component.
 *
 * @example
 * ```tsx
 * const { toast, success, error } = useToast();
 *
 * // Show different toast types
 * success('Item saved successfully!');
 * error('Failed to delete item');
 * toast({ type: 'warning', message: 'This action cannot be undone' });
 * ```
 */
/**
 * Like useToast, but returns null when no ToastProvider is mounted
 * (e.g. component tests that don't render the app chrome).
 */
export function useToastOptional(): ToastContextValue | null {
  return useContext(ToastContext) ?? null;
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }

  const { addToast, dismissToast, clearToasts, toasts } = context;

  const toast = useCallback(
    (options: Omit<ToastData, 'id'>) => addToast(options),
    [addToast]
  );

  const success = useCallback(
    (message: string, duration?: number) =>
      addToast({ type: 'success', message, duration }),
    [addToast]
  );

  const error = useCallback(
    (message: string, duration?: number) =>
      addToast({ type: 'error', message, duration }),
    [addToast]
  );

  const warning = useCallback(
    (message: string, duration?: number) =>
      addToast({ type: 'warning', message, duration }),
    [addToast]
  );

  const info = useCallback(
    (message: string, duration?: number) =>
      addToast({ type: 'info', message, duration }),
    [addToast]
  );

  return {
    toasts,
    toast,
    success,
    error,
    warning,
    info,
    dismissToast,
    clearToasts,
  };
}

// ============================================================================
// STANDALONE TOAST FUNCTION (for use outside React)
// ============================================================================

// For components that can't use the hook, this is a simple wrapper
// that falls back to console logging if provider isn't available
let toastRef: ToastContextValue | null = null;

export function setToastRef(ref: ToastContextValue | null) {
  toastRef = ref;
}

/**
 * Standalone toast function for use outside React components.
 * Falls back to console if ToastProvider isn't set up.
 */
export const standaloneToast = {
  success: (message: string) => {
    if (toastRef) {
      toastRef.addToast({ type: 'success', message });
    } else {
      console.log('[Toast Success]', message);
    }
  },
  error: (message: string) => {
    if (toastRef) {
      toastRef.addToast({ type: 'error', message });
    } else {
      console.error('[Toast Error]', message);
    }
  },
  warning: (message: string) => {
    if (toastRef) {
      toastRef.addToast({ type: 'warning', message });
    } else {
      console.warn('[Toast Warning]', message);
    }
  },
  info: (message: string) => {
    if (toastRef) {
      toastRef.addToast({ type: 'info', message });
    } else {
      console.info('[Toast Info]', message);
    }
  },
};
