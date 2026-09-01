// ============================================================================
// TYPES
// ============================================================================

export interface LoadingSpinnerProps {
  /** Size of the spinner */
  size?: 'sm' | 'md' | 'lg';
  /** Optional label displayed below spinner */
  label?: string;
  /** Whether to center in parent container */
  centered?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export interface LoadingOverlayProps {
  /** Whether overlay is visible */
  isLoading: boolean;
  /** Optional label displayed below spinner */
  label?: string;
  /** Whether to use full-screen overlay (default: false - covers parent) */
  fullScreen?: boolean;
}

// ============================================================================
// COMPONENTS
// ============================================================================

/**
 * LoadingSpinner Component
 *
 * A simple animated loading spinner with optional label.
 *
 * @example
 * ```tsx
 * <LoadingSpinner size="lg" label="Loading data..." centered />
 * ```
 */
export function LoadingSpinner({
  size = 'md',
  label,
  centered = false,
  className = '',
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4 border-2',
    md: 'h-8 w-8 border-2',
    lg: 'h-12 w-12 border-3',
  }[size];

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  }[size];

  const spinner = (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <div
        className={`${sizeClasses} rounded-full border-edge-strong border-t-accent-500 animate-spin`}
        role="status"
        aria-label={label || 'Loading'}
      />
      {label && (
        <span className={`${textSizeClasses} text-fg-muted`}>{label}</span>
      )}
    </div>
  );

  if (centered) {
    return (
      <div className="flex items-center justify-center w-full h-full min-h-[100px]">
        {spinner}
      </div>
    );
  }

  return spinner;
}

/**
 * LoadingOverlay Component
 *
 * An overlay that covers its parent (or screen) with a semi-transparent backdrop
 * and centered loading spinner. Useful for blocking UI during async operations.
 *
 * @example
 * ```tsx
 * <div className="relative">
 *   <YourContent />
 *   <LoadingOverlay isLoading={isSaving} label="Saving..." />
 * </div>
 * ```
 */
export function LoadingOverlay({
  isLoading,
  label,
  fullScreen = false,
}: LoadingOverlayProps) {
  if (!isLoading) {
    return null;
  }

  const positionClass = fullScreen ? 'fixed' : 'absolute';

  return (
    <div
      className={`${positionClass} inset-0 bg-surface-0/70 flex items-center justify-center z-40`}
      role="progressbar"
      aria-busy="true"
      aria-label={label || 'Loading'}
    >
      <LoadingSpinner size="lg" label={label} />
    </div>
  );
}

// ============================================================================
// SKELETON COMPONENTS
// ============================================================================

export interface SkeletonProps {
  /** Width class (e.g., "w-full", "w-32") */
  width?: string;
  /** Height class (e.g., "h-4", "h-8") */
  height?: string;
  /** Whether to use rounded corners */
  rounded?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Skeleton Component
 *
 * A placeholder element that pulses to indicate loading content.
 * Use to create skeleton screens that match your content layout.
 *
 * @example
 * ```tsx
 * // Text line skeleton
 * <Skeleton width="w-48" height="h-4" />
 *
 * // Avatar skeleton
 * <Skeleton width="w-10" height="h-10" rounded className="rounded-full" />
 * ```
 */
export function Skeleton({
  width = 'w-full',
  height = 'h-4',
  rounded = true,
  className = '',
}: SkeletonProps) {
  return (
    <div
      className={`${width} ${height} bg-surface-2 animate-pulse ${
        rounded ? 'rounded' : ''
      } ${className}`}
      role="presentation"
      aria-hidden="true"
    />
  );
}

/**
 * SkeletonText Component
 *
 * Multiple skeleton lines to represent text content.
 *
 * @example
 * ```tsx
 * <SkeletonText lines={3} />
 * ```
 */
export function SkeletonText({
  lines = 3,
  className = '',
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height="h-4"
          width={i === lines - 1 ? 'w-3/4' : 'w-full'}
        />
      ))}
    </div>
  );
}

/**
 * SkeletonCard Component
 *
 * A card-shaped skeleton placeholder.
 *
 * @example
 * ```tsx
 * <SkeletonCard />
 * ```
 */
export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div
      className={`bg-surface-1 border border-edge rounded-lg p-4 ${className}`}
    >
      <div className="flex items-center gap-3 mb-4">
        <Skeleton width="w-10" height="h-10" className="rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton width="w-32" height="h-4" />
          <Skeleton width="w-24" height="h-3" />
        </div>
      </div>
      <SkeletonText lines={2} />
    </div>
  );
}
