import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { LoadingSpinner, LoadingOverlay } from '../LoadingSpinner';
import { ToastProvider, ToastContainer, useToast } from '../Toast';
import { ConfirmDialog } from '../ConfirmDialog';

// ============================================================================
// LOADING SPINNER
// ============================================================================

describe('LoadingSpinner', () => {
  it('renders a spinner element with status role', () => {
    render(<LoadingSpinner />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('uses default aria-label "Loading" when no label is provided', () => {
    render(<LoadingSpinner />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Loading');
  });

  it('renders the provided label text', () => {
    render(<LoadingSpinner label="Fetching data..." />);
    expect(screen.getByText('Fetching data...')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Fetching data...');
  });

  it('applies size classes for each size variant', () => {
    const { rerender } = render(<LoadingSpinner size="sm" />);
    expect(screen.getByRole('status').className).toContain('h-4');

    rerender(<LoadingSpinner size="md" />);
    expect(screen.getByRole('status').className).toContain('h-8');

    rerender(<LoadingSpinner size="lg" />);
    expect(screen.getByRole('status').className).toContain('h-12');
  });

  it('wraps in a centering container when centered is true', () => {
    const { container } = render(<LoadingSpinner centered />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain('justify-center');
    expect(wrapper.className).toContain('items-center');
  });

  it('does not add centering wrapper when centered is false', () => {
    const { container } = render(<LoadingSpinner />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).not.toContain('justify-center');
  });
});

describe('LoadingOverlay', () => {
  it('renders nothing when isLoading is false', () => {
    const { container } = render(<LoadingOverlay isLoading={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders overlay with progressbar role when isLoading is true', () => {
    render(<LoadingOverlay isLoading={true} label="Saving..." />);
    const overlay = screen.getByRole('progressbar');
    expect(overlay).toBeInTheDocument();
    expect(overlay).toHaveAttribute('aria-busy', 'true');
    expect(overlay).toHaveAttribute('aria-label', 'Saving...');
  });

  it('uses fixed positioning when fullScreen is true', () => {
    render(<LoadingOverlay isLoading={true} fullScreen />);
    expect(screen.getByRole('progressbar').className).toContain('fixed');
  });

  it('uses absolute positioning by default', () => {
    render(<LoadingOverlay isLoading={true} />);
    expect(screen.getByRole('progressbar').className).toContain('absolute');
  });
});

// ============================================================================
// TOAST
// ============================================================================

describe('Toast (via ToastProvider + ToastContainer)', () => {
  /** Helper that renders a button which triggers a toast when clicked. */
  function ToastTrigger({ type, message }: { type: 'success' | 'error' | 'warning' | 'info'; message: string }) {
    const toast = useToast();
    return (
      <button onClick={() => toast[type](message)}>
        trigger-{type}
      </button>
    );
  }

  it('renders a toast message and dismiss button', () => {
    render(
      <ToastProvider>
        <ToastTrigger type="success" message="Item saved!" />
        <ToastContainer />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText('trigger-success'));

    expect(screen.getByText('Item saved!')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByLabelText('Dismiss')).toBeInTheDocument();
  });

  it('dismisses a toast when the dismiss button is clicked', async () => {
    vi.useFakeTimers();

    render(
      <ToastProvider>
        <ToastTrigger type="error" message="Something went wrong" />
        <ToastContainer />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText('trigger-error'));
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Dismiss'));
      // Wait for the 300ms exit animation timeout
      vi.advanceTimersByTime(350);
    });

    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it('renders different toast types (success, error, warning, info)', () => {
    function Multi() {
      const t = useToast();
      return (
        <>
          <button onClick={() => { t.success('s'); t.error('e'); t.warning('w'); t.info('i'); }}>fire</button>
        </>
      );
    }

    render(
      <ToastProvider>
        <Multi />
        <ToastContainer />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText('fire'));

    const alerts = screen.getAllByRole('alert');
    expect(alerts).toHaveLength(4);
  });
});

// ============================================================================
// CONFIRM DIALOG
// ============================================================================

describe('ConfirmDialog', () => {
  const baseProps = {
    isOpen: true,
    title: 'Delete Character',
    message: 'Are you sure you want to delete this character?',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(<ConfirmDialog {...baseProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders title and message when open', () => {
    render(<ConfirmDialog {...baseProps} />);
    expect(screen.getByText('Delete Character')).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to delete this character?')).toBeInTheDocument();
  });

  it('renders default button labels (Confirm / Cancel)', () => {
    render(<ConfirmDialog {...baseProps} />);
    expect(screen.getByText('Confirm')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('renders custom button labels', () => {
    render(<ConfirmDialog {...baseProps} confirmLabel="Delete" cancelLabel="Keep" />);
    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(screen.getByText('Keep')).toBeInTheDocument();
  });

  it('calls onConfirm when confirm button is clicked', () => {
    render(<ConfirmDialog {...baseProps} />);
    fireEvent.click(screen.getByText('Confirm'));
    expect(baseProps.onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when cancel button is clicked', () => {
    render(<ConfirmDialog {...baseProps} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(baseProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when backdrop is clicked', () => {
    render(<ConfirmDialog {...baseProps} />);
    const backdrop = screen.getByRole('dialog');
    fireEvent.click(backdrop);
    expect(baseProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when Escape key is pressed', () => {
    render(<ConfirmDialog {...baseProps} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(baseProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it('disables confirm button when confirmDisabled is true', () => {
    render(<ConfirmDialog {...baseProps} confirmDisabled />);
    const confirmBtn = screen.getByText('Confirm');
    expect(confirmBtn).toBeDisabled();
  });

  it('has role="dialog" and aria-modal="true"', () => {
    render(<ConfirmDialog {...baseProps} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });
});

// ============================================================================
// STORAGE QUOTA BANNER
// ============================================================================

// StorageQuotaBanner depends heavily on useCampaignStore + storage utilities.
// We mock both to test the rendering path.

const mockBreakdown = [
  { key: 'campaign', sizeKB: 512 },
  { key: 'combat', sizeKB: 256 },
];

vi.mock('../../../utils/storage', () => ({
  getStorageBreakdown: vi.fn(() => Promise.resolve(mockBreakdown)),
  resetQuotaAlert: vi.fn(),
}));

vi.mock('../../../state/campaignStore', () => ({
  useCampaignStore: vi.fn().mockReturnValue({
    state: {
      checkpoints: { entries: [{ id: 1 }] },
      logs: { entries: [{ id: 1 }, { id: 2 }] },
      entities: { combatHistory: [{ id: 1 }] },
    },
    actions: {
      clearCheckpoints: vi.fn(),
      clearLogs: vi.fn(),
      clearCombatHistory: vi.fn(),
    },
  }),
}));

// Import after mocks are set up
import { StorageQuotaBanner } from '../StorageQuotaBanner';

describe('StorageQuotaBanner', () => {
  it('renders nothing by default (no quota event fired)', () => {
    const { container } = render(<StorageQuotaBanner />);
    // The banner starts hidden — only appears after 'storage-quota-exceeded' event
    expect(container.querySelector('[class*="Storage Full"]')).toBeNull();
  });

  it('renders warning banner after storage-quota-exceeded event', async () => {
    const { getStorageBreakdown } = await import('../../../utils/storage');
    // Ensure mock returns a fresh resolved promise each call
    vi.mocked(getStorageBreakdown).mockImplementation(() => Promise.resolve(mockBreakdown));

    render(<StorageQuotaBanner />);

    // Dispatch event and let the async handler settle
    await act(async () => {
      window.dispatchEvent(new Event('storage-quota-exceeded'));
    });

    expect(screen.getByText('Storage Full')).toBeInTheDocument();
  });

  it('shows cleanup action buttons when banner is visible', async () => {
    const { getStorageBreakdown } = await import('../../../utils/storage');
    vi.mocked(getStorageBreakdown).mockImplementation(() => Promise.resolve(mockBreakdown));

    render(<StorageQuotaBanner />);

    await act(async () => {
      window.dispatchEvent(new Event('storage-quota-exceeded'));
    });

    expect(screen.getByText(/Clear checkpoints/)).toBeInTheDocument();
    expect(screen.getByText(/Clear logs/)).toBeInTheDocument();
    expect(screen.getByText(/Clear combat history/)).toBeInTheDocument();
  });

  it('dismisses banner when dismiss button is clicked', async () => {
    const { getStorageBreakdown } = await import('../../../utils/storage');
    vi.mocked(getStorageBreakdown).mockImplementation(() => Promise.resolve(mockBreakdown));

    render(<StorageQuotaBanner />);

    await act(async () => {
      window.dispatchEvent(new Event('storage-quota-exceeded'));
    });

    expect(screen.getByText('Storage Full')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Dismiss'));

    expect(screen.queryByText('Storage Full')).not.toBeInTheDocument();
  });
});
