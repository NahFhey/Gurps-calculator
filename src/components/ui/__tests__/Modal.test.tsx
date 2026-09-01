import '@testing-library/jest-dom';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Modal } from '../Modal';

afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
});

describe('Modal', () => {
  it('renders nothing when closed', () => {
    render(
      <Modal isOpen={false} onClose={vi.fn()} title="Closed">
        Hidden content
      </Modal>
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('wires the dialog role and title accessibility attributes', () => {
    render(
      <Modal isOpen onClose={vi.fn()} title="Accessible title">
        Content
      </Modal>
    );

    const dialog = screen.getByRole('dialog');
    const title = screen.getByRole('heading', { name: 'Accessible title' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', title.id);
  });

  it('calls onClose on Escape', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="Escape test">
        Content
      </Modal>
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('only closes the topmost modal on Escape', () => {
    const closeLower = vi.fn();
    const closeUpper = vi.fn();
    render(
      <>
        <Modal isOpen onClose={closeLower} title="Lower">
          Lower content
        </Modal>
        <Modal isOpen onClose={closeUpper} title="Upper">
          Upper content
        </Modal>
      </>
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(closeUpper).toHaveBeenCalledTimes(1);
    expect(closeLower).not.toHaveBeenCalled();
  });

  it('keeps the top modal topmost when the lower modal re-renders with a new onClose', () => {
    const closeUpper = vi.fn();
    const { rerender } = render(
      <>
        <Modal isOpen onClose={vi.fn()} title="Lower">
          Lower content
        </Modal>
        <Modal isOpen onClose={closeUpper} title="Upper">
          Upper content
        </Modal>
      </>
    );

    // A background state update gives the lower modal a fresh callback
    // identity; it must not re-register as topmost.
    const closeLowerAfterRerender = vi.fn();
    rerender(
      <>
        <Modal isOpen onClose={closeLowerAfterRerender} title="Lower">
          Lower content
        </Modal>
        <Modal isOpen onClose={closeUpper} title="Upper">
          Upper content
        </Modal>
      </>
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(closeUpper).toHaveBeenCalledTimes(1);
    expect(closeLowerAfterRerender).not.toHaveBeenCalled();
  });

  it('honors closeOnBackdrop', () => {
    const closes = [vi.fn(), vi.fn()];
    render(
      <>
        <Modal isOpen onClose={closes[0]} title="Closable">
          Content
        </Modal>
        <Modal isOpen onClose={closes[1]} title="Protected" closeOnBackdrop={false}>
          Content
        </Modal>
      </>
    );

    const backdrops = screen.getAllByTestId('modal-backdrop');
    fireEvent.click(backdrops[1]);
    expect(closes[1]).not.toHaveBeenCalled();
  });

  it('moves focus to the panel and restores it after close', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    const { unmount } = render(
      <Modal isOpen onClose={vi.fn()} title="Focus test">
        Content
      </Modal>
    );

    expect(screen.getByRole('dialog')).toHaveFocus();
    unmount();
    expect(trigger).toHaveFocus();
    trigger.remove();
  });

  it('traps Tab and Shift+Tab within the panel', () => {
    render(
      <Modal isOpen onClose={vi.fn()} title="Trap test">
        <button>First</button>
        <button>Last</button>
      </Modal>
    );

    const close = screen.getByRole('button', { name: 'Close' });
    const last = screen.getByRole('button', { name: 'Last' });
    last.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(close).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(last).toHaveFocus();
  });

  it('keeps body scroll locked until all nested modals close', () => {
    document.body.style.overflow = 'scroll';
    const { rerender } = render(
      <>
        <Modal isOpen onClose={vi.fn()} title="Lower">Lower</Modal>
        <Modal isOpen onClose={vi.fn()} title="Upper">Upper</Modal>
      </>
    );

    expect(document.body.style.overflow).toBe('hidden');

    rerender(
      <>
        <Modal isOpen onClose={vi.fn()} title="Lower">Lower</Modal>
        <Modal isOpen={false} onClose={vi.fn()} title="Upper">Upper</Modal>
      </>
    );
    expect(document.body.style.overflow).toBe('hidden');

    rerender(
      <>
        <Modal isOpen={false} onClose={vi.fn()} title="Lower">Lower</Modal>
        <Modal isOpen={false} onClose={vi.fn()} title="Upper">Upper</Modal>
      </>
    );
    expect(document.body.style.overflow).toBe('scroll');
  });

  it('renders the footer slot', () => {
    render(
      <Modal isOpen onClose={vi.fn()} title="Footer" footer={<button>Save</button>}>
        Content
      </Modal>
    );

    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });
});
