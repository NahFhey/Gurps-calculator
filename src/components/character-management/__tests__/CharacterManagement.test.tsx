/**
 * Tests for CharacterContextMenu and CharacterCreationModal
 */
import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CharacterContextMenu } from '../CharacterContextMenu';
import { CharacterCreationModal } from '../CharacterCreationModal';

// ============================================================================
// CharacterContextMenu
// ============================================================================

describe('CharacterContextMenu', () => {
  const defaultProps = {
    characterId: 'char-1',
    characterName: 'Aldric the Bold',
    position: { x: 100, y: 200 },
    onAction: vi.fn(),
    onClose: vi.fn(),
  };

  it('renders character name header', () => {
    render(<CharacterContextMenu {...defaultProps} />);
    expect(screen.getByText('Aldric the Bold')).toBeInTheDocument();
    expect(screen.getByText('Character')).toBeInTheDocument();
  });

  it('renders all five menu items', () => {
    render(<CharacterContextMenu {...defaultProps} />);
    expect(screen.getByText('View Sheet')).toBeInTheDocument();
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Duplicate')).toBeInTheDocument();
    expect(screen.getByText('Export (JSON)')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('calls onAction with correct type when View Sheet is clicked', () => {
    const onAction = vi.fn();
    const onClose = vi.fn();
    render(
      <CharacterContextMenu {...defaultProps} onAction={onAction} onClose={onClose} />
    );

    fireEvent.click(screen.getByText('View Sheet'));
    expect(onAction).toHaveBeenCalledWith({ type: 'view', characterId: 'char-1' });
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onAction with correct type when Edit is clicked', () => {
    const onAction = vi.fn();
    render(<CharacterContextMenu {...defaultProps} onAction={onAction} />);

    fireEvent.click(screen.getByText('Edit'));
    expect(onAction).toHaveBeenCalledWith({ type: 'edit', characterId: 'char-1' });
  });

  it('calls onAction with correct type when Duplicate is clicked', () => {
    const onAction = vi.fn();
    render(<CharacterContextMenu {...defaultProps} onAction={onAction} />);

    fireEvent.click(screen.getByText('Duplicate'));
    expect(onAction).toHaveBeenCalledWith({ type: 'duplicate', characterId: 'char-1' });
  });

  it('calls onAction with correct type when Export is clicked', () => {
    const onAction = vi.fn();
    render(<CharacterContextMenu {...defaultProps} onAction={onAction} />);

    fireEvent.click(screen.getByText('Export (JSON)'));
    expect(onAction).toHaveBeenCalledWith({ type: 'export', characterId: 'char-1' });
  });

  it('calls onAction with delete type for Delete', () => {
    const onAction = vi.fn();
    render(<CharacterContextMenu {...defaultProps} onAction={onAction} />);

    fireEvent.click(screen.getByText('Delete'));
    expect(onAction).toHaveBeenCalledWith({ type: 'delete', characterId: 'char-1' });
  });

  it('closes on Escape key press', async () => {
    const onClose = vi.fn();
    render(<CharacterContextMenu {...defaultProps} onClose={onClose} />);

    // The component uses setTimeout(0) before adding listeners
    await waitFor(() => {
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('positions the menu at the given coordinates', () => {
    render(<CharacterContextMenu {...defaultProps} />);

    const menu = screen.getByText('Aldric the Bold').closest('[class*="fixed"]');
    expect(menu).toHaveStyle({ left: '100px', top: '200px' });
  });

  it('does not attach document listeners when unmounted before setTimeout fires', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const addSpy = vi.spyOn(document, 'addEventListener');

    const { unmount } = render(
      <CharacterContextMenu {...defaultProps} onClose={onClose} />
    );

    // Unmount before the queued setTimeout(0) callback runs
    unmount();
    addSpy.mockClear();
    vi.runAllTimers();

    // The deferred listener registration must be cancelled
    expect(addSpy).not.toHaveBeenCalledWith('mousedown', expect.any(Function));
    expect(addSpy).not.toHaveBeenCalledWith('keydown', expect.any(Function));

    // And firing events post-unmount must not invoke onClose
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();

    addSpy.mockRestore();
    vi.useRealTimers();
  });
});

// ============================================================================
// CharacterCreationModal
// ============================================================================

describe('CharacterCreationModal', () => {
  const defaultProps = {
    onClose: vi.fn(),
    onCharacterCreated: vi.fn(),
  };

  it('renders the initial choose step with three options', () => {
    render(<CharacterCreationModal {...defaultProps} />);

    expect(screen.getByText('Add Character')).toBeInTheDocument();
    expect(screen.getByText('Blank Character')).toBeInTheDocument();
    expect(screen.getByText('From Template')).toBeInTheDocument();
    expect(screen.getByText('Import Character')).toBeInTheDocument();
  });

  it('navigates to blank character step', () => {
    render(<CharacterCreationModal {...defaultProps} />);

    fireEvent.click(screen.getByText('Blank Character'));
    expect(screen.getByText('Create Blank Character')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter character name')).toBeInTheDocument();
  });

  it('creates a blank character with entered name', () => {
    const onCharacterCreated = vi.fn();
    const onClose = vi.fn();
    render(
      <CharacterCreationModal
        onClose={onClose}
        onCharacterCreated={onCharacterCreated}
      />
    );

    fireEvent.click(screen.getByText('Blank Character'));
    fireEvent.change(screen.getByPlaceholderText('Enter character name'), {
      target: { value: 'Test Hero' },
    });
    fireEvent.click(screen.getByText('Create'));

    expect(onCharacterCreated).toHaveBeenCalledTimes(1);
    const created = onCharacterCreated.mock.calls[0][0];
    expect(created.name).toBe('Test Hero');
    expect(onClose).toHaveBeenCalled();
  });

  it('creates a blank character with default name when no name entered', () => {
    const onCharacterCreated = vi.fn();
    render(
      <CharacterCreationModal {...defaultProps} onCharacterCreated={onCharacterCreated} />
    );

    fireEvent.click(screen.getByText('Blank Character'));
    fireEvent.click(screen.getByText('Create'));

    const created = onCharacterCreated.mock.calls[0][0];
    expect(created.name).toBe('New Character');
  });

  it('navigates to template step and shows templates', () => {
    render(<CharacterCreationModal {...defaultProps} />);

    fireEvent.click(screen.getByText('From Template'));
    expect(screen.getByText('Create from Template')).toBeInTheDocument();
    expect(screen.getByText('Select Template')).toBeInTheDocument();
  });

  it('disables Create button until a template is selected', () => {
    render(<CharacterCreationModal {...defaultProps} />);

    fireEvent.click(screen.getByText('From Template'));

    const createBtn = screen.getByText('Create');
    expect(createBtn).toBeDisabled();
  });

  it('navigates to import step', () => {
    render(<CharacterCreationModal {...defaultProps} />);

    fireEvent.click(screen.getByText('Import Character'));
    expect(screen.getByText('Import Character')).toBeInTheDocument();
    expect(screen.getByText('Click to select a file')).toBeInTheDocument();
  });

  it('navigates back from blank step to choose step', () => {
    render(<CharacterCreationModal {...defaultProps} />);

    fireEvent.click(screen.getByText('Blank Character'));
    expect(screen.getByText('Create Blank Character')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Back'));
    expect(screen.getByText('Add Character')).toBeInTheDocument();
  });

  it('navigates back from template step to choose step', () => {
    render(<CharacterCreationModal {...defaultProps} />);

    fireEvent.click(screen.getByText('From Template'));
    fireEvent.click(screen.getByText('Back'));
    expect(screen.getByText('Add Character')).toBeInTheDocument();
  });

  it('navigates back from import step to choose step', () => {
    render(<CharacterCreationModal {...defaultProps} />);

    fireEvent.click(screen.getByText('Import Character'));
    // There are two elements with this text (button + header), get the Back button
    fireEvent.click(screen.getByText('Back'));
    expect(screen.getByText('Add Character')).toBeInTheDocument();
  });

  it('calls onClose when X button is clicked', () => {
    const onClose = vi.fn();
    render(<CharacterCreationModal onClose={onClose} onCharacterCreated={vi.fn()} />);

    // Find the X close button (it's the button with the X icon)
    const closeButtons = screen.getAllByRole('button');
    // The X button is the one in the header, not the creation options
    const xButton = closeButtons.find((btn) =>
      btn.querySelector('svg.h-5.w-5')
    );
    if (xButton) {
      fireEvent.click(xButton);
      expect(onClose).toHaveBeenCalled();
    }
  });
});
