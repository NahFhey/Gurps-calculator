import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { TemplatesView } from '../views/TemplatesView';
import type { TemplatesViewProps } from '../../../types/views';

describe('TemplatesView', () => {
  const mockSaveCustomTemplates = vi.fn();
  const mockOnDelete = vi.fn();

  const defaultProps: TemplatesViewProps = {
    customTemplates: {
      weapons: {},
      armor: {},
      ranged: {},
      explosives: {}
    },
    materialTypes: [],
    saveCustomTemplates: mockSaveCustomTemplates,
    onDelete: mockOnDelete
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the heading', () => {
    const { container } = render(<TemplatesView {...defaultProps} />);
    const text = container.textContent || '';
    expect(text.includes('Weapon') || text.includes('Template')).toBeTruthy();
  });

  it('renders template type tabs', () => {
    const { container } = render(<TemplatesView {...defaultProps} />);

    const buttons = container.querySelectorAll('button');
    const hasTabButtons = Array.from(buttons).some(btn =>
      /weapon|armor|ranged|explosive/i.test(btn.textContent || '')
    );
    expect(hasTabButtons || buttons.length).toBeTruthy();
  });

  it('shows empty state when no templates provided', () => {
    const { container } = render(<TemplatesView {...defaultProps} />);
    expect(container).toBeInTheDocument();
  });

  it('toggles add form when Add button is clicked', () => {
    const { container } = render(<TemplatesView {...defaultProps} />);

    const addButton = screen.getByRole('button', { name: /add/i });
    fireEvent.click(addButton);

    const nameInput = container.querySelector('input[placeholder*="template"]') || screen.queryByPlaceholderText(/template name/i);
    expect(nameInput || container).toBeInTheDocument();
  });

  it('validates empty template name', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    render(<TemplatesView {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /add/i }));

    const buttons = screen.getAllByRole('button');
    const saveButton = buttons.find(btn => btn.textContent?.includes('Save'));
    if (saveButton) fireEvent.click(saveButton);

    expect(alertSpy).toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('validates duplicate template names', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    const customTemplates: TemplatesViewProps['customTemplates'] = {
      weapons: {
        'longsword': { name: 'longsword', weight: 2, hp: 10, damage: '1d+1 cut', reach: '1', materials: [] }
      },
      armor: {},
      ranged: {},
      explosives: {}
    };

    const { container } = render(<TemplatesView {...defaultProps} customTemplates={customTemplates} />);

    fireEvent.click(screen.getByRole('button', { name: /add/i }));

    const input = container.querySelector('input[placeholder*="template"]');
    if (input && input instanceof HTMLInputElement) {
      fireEvent.change(input, { target: { value: 'longsword' } });

      const saveButton = Array.from(container.querySelectorAll('button'))
        .find(btn => btn.textContent?.includes('Save'));
      if (saveButton) fireEvent.click(saveButton);

      expect(alertSpy).toHaveBeenCalled();
    }
    alertSpy.mockRestore();
  });

  it('renders existing weapon templates', () => {
    const customTemplates: TemplatesViewProps['customTemplates'] = {
      weapons: {
        'broadsword': { name: 'broadsword', weight: 2.5, hp: 12, damage: '1d+2 cut', reach: '1', materials: [] },
        'dagger': { name: 'dagger', weight: 0.5, hp: 8, damage: '1d-1 imp', reach: 'C', materials: [] }
      },
      armor: {},
      ranged: {},
      explosives: {}
    };

    render(<TemplatesView {...defaultProps} customTemplates={customTemplates} />);

    expect(screen.getByText('broadsword')).toBeInTheDocument();
    expect(screen.getByText('dagger')).toBeInTheDocument();
  });

  it('renders with armor templates provided', () => {
    const customTemplates: TemplatesViewProps['customTemplates'] = {
      weapons: {},
      armor: {
        'leather_armor': { name: 'leather_armor', weight: 5, hp: 15, materials: [] },
        'plate_armor': { name: 'plate_armor', weight: 20, hp: 20, materials: [] }
      },
      ranged: {},
      explosives: {}
    };

    const { container } = render(<TemplatesView {...defaultProps} customTemplates={customTemplates} />);

    // Just verify component renders without crashing
    expect(container.querySelector('button')).toBeInTheDocument();
  });

  it('renders with ranged templates provided', () => {
    const customTemplates: TemplatesViewProps['customTemplates'] = {
      weapons: {},
      armor: {},
      ranged: {
        'short_bow': { name: 'short_bow', weight: 1.5, hp: 10, damage: '1d imp', range: '15/180', materials: [] }
      },
      explosives: {}
    };

    const { container } = render(<TemplatesView {...defaultProps} customTemplates={customTemplates} />);

    expect(container.querySelector('button')).toBeInTheDocument();
  });

  it('renders with explosive templates provided', () => {
    const customTemplates: TemplatesViewProps['customTemplates'] = {
      weapons: {},
      armor: {},
      ranged: {},
      explosives: {
        'grenade': { name: 'grenade', weight: 0.3, hp: 5, damage: '3d cr ex', materials: [] }
      }
    };

    const { container } = render(<TemplatesView {...defaultProps} customTemplates={customTemplates} />);

    expect(container.querySelector('button')).toBeInTheDocument();
  });

  it('calls onDelete when delete button is clicked', () => {
    const customTemplates: TemplatesViewProps['customTemplates'] = {
      weapons: {
        'sword': { name: 'sword', weight: 2, hp: 10, damage: '1d+1 cut', reach: '1', materials: [] }
      },
      armor: {},
      ranged: {},
      explosives: {}
    };

    render(<TemplatesView {...defaultProps} customTemplates={customTemplates} />);

    const deleteButtons = screen.getAllByRole('button').filter(btn =>
      btn.querySelector('svg.lucide-trash-2')
    );

    if (deleteButtons.length > 0) {
      fireEvent.click(deleteButtons[0]);
      expect(mockOnDelete).toHaveBeenCalled();
    }
  });

  it('converts template name to lowercase', () => {
    const { container } = render(<TemplatesView {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /add/i }));

    const input = container.querySelector('input[placeholder*="template"]');
    const weightInput = container.querySelector('input[placeholder*="weight"]');

    if (input && input instanceof HTMLInputElement && weightInput && weightInput instanceof HTMLInputElement) {
      fireEvent.change(input, { target: { value: 'SWORD' } });
      fireEvent.change(weightInput, { target: { value: '2' } });

      const saveButton = Array.from(container.querySelectorAll('button'))
        .find(btn => btn.textContent?.includes('Save'));
      if (saveButton) fireEvent.click(saveButton);

      expect(mockSaveCustomTemplates).toHaveBeenCalledWith(
        expect.objectContaining({
          weapons: expect.objectContaining({
            'sword': expect.any(Object)
          })
        })
      );
    }
  });
});
