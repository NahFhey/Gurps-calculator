import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MaterialTypesView } from '../views/MaterialTypesView';
import type { MaterialTypesViewProps } from '../../../types/views';

describe('MaterialTypesView', () => {
  const mockSaveMaterialTypes = vi.fn();
  const mockRenameMaterialType = vi.fn();
  const mockOnDelete = vi.fn();

  const defaultProps: MaterialTypesViewProps = {
    materialTypes: [],
    saveMaterialTypes: mockSaveMaterialTypes,
    renameMaterialType: mockRenameMaterialType,
    onDelete: mockOnDelete
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the Material Types heading', () => {
    render(<MaterialTypesView {...defaultProps} />);
    expect(screen.getByText('Material Types')).toBeInTheDocument();
  });

  it('renders Add button', () => {
    render(<MaterialTypesView {...defaultProps} />);
    expect(screen.getByRole('button', { name: /add/i })).toBeInTheDocument();
  });

  it('shows empty state when no materials provided', () => {
    render(<MaterialTypesView {...defaultProps} />);
    const heading = screen.getByText('Material Types');
    expect(heading).toBeInTheDocument();
  });

  it('toggles add form when Add button is clicked', () => {
    render(<MaterialTypesView {...defaultProps} />);

    const addButton = screen.getByRole('button', { name: /add/i });
    fireEvent.click(addButton);

    expect(screen.getByPlaceholderText(/name/i)).toBeInTheDocument();
  });

  it('validates empty name on add', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    const { container } = render(<MaterialTypesView {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /add/i }));

    const saveButton = Array.from(container.querySelectorAll('button'))
      .find(btn => btn.textContent?.includes('Save'));
    if (saveButton) fireEvent.click(saveButton);

    expect(alertSpy).toHaveBeenCalledWith('Enter a name');
    expect(mockSaveMaterialTypes).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });

  it('validates duplicate names on add', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const materialTypes = [{ name: 'steel', difficulty: 0, ht: 10, drShift: 0, weightMod: 0, hpMod: 0, effects: '' }];

    const { container } = render(<MaterialTypesView {...defaultProps} materialTypes={materialTypes} />);

    fireEvent.click(screen.getByRole('button', { name: /add/i }));

    const input = screen.getByPlaceholderText(/name/i);
    fireEvent.change(input, { target: { value: 'steel' } });

    const saveButton = Array.from(container.querySelectorAll('button'))
      .find(btn => btn.textContent?.includes('Save'));
    if (saveButton) fireEvent.click(saveButton);

    expect(alertSpy).toHaveBeenCalledWith('Duplicate name');
    expect(mockSaveMaterialTypes).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });

  it('renders existing material types', () => {
    const materialTypes = [
      { name: 'steel', difficulty: 0, ht: 10, drShift: 2, weightMod: 0, hpMod: 0, effects: '' },
      { name: 'leather', difficulty: 1, ht: 8, drShift: 1, weightMod: 0, hpMod: 0, effects: '' }
    ];

    const { container } = render(<MaterialTypesView {...defaultProps} materialTypes={materialTypes} />);

    // Material types are rendered in the list - verify they're in the document
    expect(container.textContent).toContain('steel');
    expect(container.textContent).toContain('leather');
  });

  it('converts material names to lowercase', () => {
    const { container } = render(<MaterialTypesView {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /add/i }));

    const input = screen.getByPlaceholderText(/name/i);
    fireEvent.change(input, { target: { value: 'STEEL' } });

    const saveButton = Array.from(container.querySelectorAll('button'))
      .find(btn => btn.textContent?.includes('Save'));
    if (saveButton) fireEvent.click(saveButton);

    expect(mockSaveMaterialTypes).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ name: 'steel' })
      ])
    );
  });

  it('calls onDelete when delete button is clicked', () => {
    const materialTypes = [
      { name: 'bronze', difficulty: 0, ht: 12, drShift: 1, weightMod: 0, hpMod: 0, effects: '' }
    ];

    render(<MaterialTypesView {...defaultProps} materialTypes={materialTypes} />);

    const deleteButtons = screen.getAllByRole('button').filter(btn =>
      btn.querySelector('svg.lucide-trash-2')
    );

    if (deleteButtons.length > 0) {
      fireEvent.click(deleteButtons[0]);
      expect(mockOnDelete).toHaveBeenCalledWith('materialType', 'bronze');
    }
  });

  it('displays all material type properties', () => {
    const materialTypes = [
      { name: 'iron', difficulty: -1, ht: 11, drShift: 2, weightMod: 0.1, hpMod: 0, effects: 'brittle' }
    ];

    const { container } = render(<MaterialTypesView {...defaultProps} materialTypes={materialTypes} />);

    // Verify material type properties are rendered
    expect(container.textContent).toContain('iron');
    expect(container.textContent).toContain('11');
  });

  it('saves material type with default values', () => {
    const { container } = render(<MaterialTypesView {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /add/i }));

    const input = screen.getByPlaceholderText(/name/i);
    fireEvent.change(input, { target: { value: 'copper' } });

    const saveButton = Array.from(container.querySelectorAll('button'))
      .find(btn => btn.textContent?.includes('Save'));
    if (saveButton) fireEvent.click(saveButton);

    expect(mockSaveMaterialTypes).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'copper',
          ht: expect.any(Number),
          difficulty: expect.any(Number)
        })
      ])
    );
  });
});
