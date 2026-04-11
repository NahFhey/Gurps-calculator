import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { ConfirmDialog } from '../ConfirmDialog';
import {
  ToastProvider,
  ToastContainer,
  useToast,
  standaloneToast,
  setToastRef,
} from '../Toast';
import {
  LoadingSpinner,
  LoadingOverlay,
  Skeleton,
  SkeletonText,
  SkeletonCard,
} from '../LoadingSpinner';

// ============================================================================
// ConfirmDialog
// ============================================================================

describe('ConfirmDialog', () => {
  const defaultProps = {
    isOpen: true,
    title: 'Delete Item',
    message: 'Are you sure you want to delete this?',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders when open', () => {
    render(<ConfirmDialog {...defaultProps} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Delete Item')).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to delete this?')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<ConfirmDialog {...defaultProps} isOpen={false} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('calls onConfirm when confirm button clicked', () => {
    render(<ConfirmDialog {...defaultProps} />);
    fireEvent.click(screen.getByText('Confirm'));
    expect(defaultProps.onConfirm).toHaveBeenCalled();
  });

  it('calls onCancel when cancel button clicked', () => {
    render(<ConfirmDialog {...defaultProps} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(defaultProps.onCancel).toHaveBeenCalled();
  });

  it('calls onCancel when backdrop clicked', () => {
    render(<ConfirmDialog {...defaultProps} />);
    fireEvent.click(screen.getByRole('dialog'));
    expect(defaultProps.onCancel).toHaveBeenCalled();
  });

  it('calls onCancel on Escape key', () => {
    render(<ConfirmDialog {...defaultProps} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(defaultProps.onCancel).toHaveBeenCalled();
  });

  it('uses custom button labels', () => {
    render(
      <ConfirmDialog
        {...defaultProps}
        confirmLabel="Yes, Delete"
        cancelLabel="Keep It"
      />
    );
    expect(screen.getByText('Yes, Delete')).toBeInTheDocument();
    expect(screen.getByText('Keep It')).toBeInTheDocument();
  });

  it('disables confirm button when confirmDisabled is true', () => {
    render(<ConfirmDialog {...defaultProps} confirmDisabled />);
    expect(screen.getByText('Confirm')).toBeDisabled();
  });

  it('applies danger variant styling', () => {
    render(<ConfirmDialog {...defaultProps} variant="danger" />);
    const confirmBtn = screen.getByText('Confirm');
    expect(confirmBtn.className).toContain('red');
  });

  it('applies warning variant styling', () => {
    render(<ConfirmDialog {...defaultProps} variant="warning" />);
    const confirmBtn = screen.getByText('Confirm');
    expect(confirmBtn.className).toContain('yellow');
  });

  it('does not propagate click from dialog content to backdrop', () => {
    render(<ConfirmDialog {...defaultProps} />);
    // Click on the dialog content area (not the backdrop)
    const dialogContent = screen.getByText('Delete Item').closest('div.bg-gray-800');
    if (dialogContent) {
      fireEvent.click(dialogContent);
    }
    // onCancel should NOT have been called from clicking the content
    expect(defaultProps.onCancel).not.toHaveBeenCalled();
  });

  it('renders JSX message content', () => {
    render(
      <ConfirmDialog
        {...defaultProps}
        message={<p data-testid="custom-msg">Custom <strong>bold</strong> message</p>}
      />
    );
    expect(screen.getByTestId('custom-msg')).toBeInTheDocument();
  });
});

// ============================================================================
// LoadingSpinner
// ============================================================================

describe('LoadingSpinner', () => {
  it('renders with default size', () => {
    render(<LoadingSpinner />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Loading');
  });

  it('renders label text', () => {
    render(<LoadingSpinner label="Loading data..." />);
    expect(screen.getByText('Loading data...')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Loading data...');
  });

  it('uses small size classes', () => {
    render(<LoadingSpinner size="sm" />);
    const spinner = screen.getByRole('status');
    expect(spinner.className).toContain('h-4');
  });

  it('uses large size classes', () => {
    render(<LoadingSpinner size="lg" />);
    const spinner = screen.getByRole('status');
    expect(spinner.className).toContain('h-12');
  });

  it('wraps in centering container when centered', () => {
    const { container } = render(<LoadingSpinner centered />);
    expect(container.querySelector('.flex.items-center.justify-center')).toBeInTheDocument();
  });
});

describe('LoadingOverlay', () => {
  it('renders when isLoading is true', () => {
    render(<LoadingOverlay isLoading label="Saving..." />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByText('Saving...')).toBeInTheDocument();
  });

  it('returns null when isLoading is false', () => {
    const { container } = render(<LoadingOverlay isLoading={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('uses fixed positioning for fullScreen', () => {
    render(<LoadingOverlay isLoading fullScreen />);
    const overlay = screen.getByRole('progressbar');
    expect(overlay.className).toContain('fixed');
  });

  it('uses absolute positioning by default', () => {
    render(<LoadingOverlay isLoading />);
    const overlay = screen.getByRole('progressbar');
    expect(overlay.className).toContain('absolute');
  });
});

// ============================================================================
// Skeleton
// ============================================================================

describe('Skeleton', () => {
  it('renders with default props', () => {
    const { container } = render(<Skeleton />);
    const el = container.querySelector('[aria-hidden="true"]')!;
    expect(el).toBeInTheDocument();
    expect(el.className).toContain('w-full');
    expect(el.className).toContain('h-4');
    expect(el.className).toContain('animate-pulse');
  });

  it('uses custom width and height', () => {
    const { container } = render(<Skeleton width="w-32" height="h-8" />);
    const el = container.querySelector('[aria-hidden="true"]')!;
    expect(el.className).toContain('w-32');
    expect(el.className).toContain('h-8');
  });

  it('removes rounded when set to false', () => {
    const { container } = render(<Skeleton rounded={false} />);
    const el = container.querySelector('[aria-hidden="true"]')!;
    expect(el.className).not.toContain('rounded');
  });
});

describe('SkeletonText', () => {
  it('renders correct number of lines', () => {
    const { container } = render(<SkeletonText lines={4} />);
    const skeletons = container.querySelectorAll('[aria-hidden="true"]');
    expect(skeletons).toHaveLength(4);
  });

  it('defaults to 3 lines', () => {
    const { container } = render(<SkeletonText />);
    const skeletons = container.querySelectorAll('[aria-hidden="true"]');
    expect(skeletons).toHaveLength(3);
  });

  it('makes last line shorter', () => {
    const { container } = render(<SkeletonText lines={2} />);
    const skeletons = container.querySelectorAll('[aria-hidden="true"]');
    expect(skeletons[1].className).toContain('w-3/4');
    expect(skeletons[0].className).toContain('w-full');
  });
});

describe('SkeletonCard', () => {
  it('renders card structure', () => {
    const { container } = render(<SkeletonCard />);
    expect(container.querySelector('.bg-gray-800')).toBeInTheDocument();
    const skeletons = container.querySelectorAll('[aria-hidden="true"]');
    expect(skeletons.length).toBeGreaterThan(3);
  });
});

// ============================================================================
// Toast system
// ============================================================================

describe('Toast system', () => {
  function TestConsumer() {
    const { success, error, warning, info, toasts, dismissToast, clearToasts } = useToast();
    return (
      <div>
        <button onClick={() => success('Saved!')}>success</button>
        <button onClick={() => error('Failed!')}>error</button>
        <button onClick={() => warning('Watch out!')}>warning</button>
        <button onClick={() => info('FYI')}>info</button>
        <button onClick={() => clearToasts()}>clear</button>
        <div data-testid="count">{toasts.length}</div>
        {toasts.map(t => (
          <div key={t.id} data-testid={`toast-${t.type}`}>
            {t.message}
            <button onClick={() => dismissToast(t.id)}>dismiss</button>
          </div>
        ))}
      </div>
    );
  }

  it('adds and displays toasts', () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    );
    fireEvent.click(screen.getByText('success'));
    expect(screen.getByTestId('toast-success')).toHaveTextContent('Saved!');
    expect(screen.getByTestId('count')).toHaveTextContent('1');
  });

  it('adds multiple toast types', () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    );
    fireEvent.click(screen.getByText('success'));
    fireEvent.click(screen.getByText('error'));
    fireEvent.click(screen.getByText('warning'));
    fireEvent.click(screen.getByText('info'));
    expect(screen.getByTestId('count')).toHaveTextContent('4');
  });

  it('dismisses individual toast', () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    );
    fireEvent.click(screen.getByText('success'));
    expect(screen.getByTestId('count')).toHaveTextContent('1');
    fireEvent.click(screen.getByText('dismiss'));
    expect(screen.getByTestId('count')).toHaveTextContent('0');
  });

  it('clears all toasts', () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    );
    fireEvent.click(screen.getByText('success'));
    fireEvent.click(screen.getByText('error'));
    expect(screen.getByTestId('count')).toHaveTextContent('2');
    fireEvent.click(screen.getByText('clear'));
    expect(screen.getByTestId('count')).toHaveTextContent('0');
  });

  it('throws when useToast is used outside provider', () => {
    expect(() => {
      renderHook(() => useToast());
    }).toThrow('useToast must be used within a ToastProvider');
  });
});

describe('ToastContainer', () => {
  it('renders nothing when no toasts', () => {
    const { container } = render(
      <ToastProvider>
        <ToastContainer />
      </ToastProvider>
    );
    expect(container.querySelector('[aria-label="Notifications"]')).not.toBeInTheDocument();
  });
});

describe('standaloneToast', () => {
  beforeEach(() => {
    setToastRef(null);
  });

  it('falls back to console when no ref set', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    standaloneToast.success('Test message');
    expect(logSpy).toHaveBeenCalledWith('[Toast Success]', 'Test message');
    logSpy.mockRestore();
  });

  it('falls back to console.error for error toast', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    standaloneToast.error('Error message');
    expect(spy).toHaveBeenCalledWith('[Toast Error]', 'Error message');
    spy.mockRestore();
  });

  it('falls back to console.warn for warning toast', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    standaloneToast.warning('Warning message');
    expect(spy).toHaveBeenCalledWith('[Toast Warning]', 'Warning message');
    spy.mockRestore();
  });

  it('falls back to console.info for info toast', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    standaloneToast.info('Info message');
    expect(spy).toHaveBeenCalledWith('[Toast Info]', 'Info message');
    spy.mockRestore();
  });

  it('uses ref when set', () => {
    const mockRef = {
      toasts: [],
      addToast: vi.fn().mockReturnValue('toast-1'),
      dismissToast: vi.fn(),
      clearToasts: vi.fn(),
    };
    setToastRef(mockRef);
    standaloneToast.success('Test');
    expect(mockRef.addToast).toHaveBeenCalledWith({ type: 'success', message: 'Test' });
    setToastRef(null);
  });
});
