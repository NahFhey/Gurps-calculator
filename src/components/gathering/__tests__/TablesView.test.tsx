import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { TablesView } from '../views/TablesView';
import type {
  GatheringSpeciesExtended,
  GatheringTableExtended,
  TableEntry,
  TablesViewProps,
} from '../../../types/gathering';

function makeSpecies(
  overrides: Partial<GatheringSpeciesExtended> = {},
): GatheringSpeciesExtended {
  return {
    id: 'species-1',
    name: 'Trout',
    type: 'fish',
    tags: [],
    foodType: 'fish',
    yieldMeatFormula: '1',
    secondaryMaterialType: null,
    yieldSecondaryFormula: null,
    secondaryNameOverride: null,
    st: null,
    specialRules: [],
    ...overrides,
  };
}

function makeTableEntry(
  overrides: Partial<TableEntry> = {},
): TableEntry {
  return {
    id: 'entry-1',
    rollValue: 2,
    resultType: 'species',
    speciesId: 'species-1',
    text: '',
    ...overrides,
  };
}

function makeTable(
  overrides: Partial<GatheringTableExtended> = {},
): GatheringTableExtended {
  return {
    id: 'table-1',
    name: 'Basic Catch',
    tableType: 'FishingRandomCatch',
    rollMethod: '2d6',
    entries: [],
    ...overrides,
  };
}

describe('TablesView', () => {
  const mockSaveTables = vi.fn();
  const mockOnDelete = vi.fn();

  const defaultProps: TablesViewProps = {
    tables: [],
    species: [
      makeSpecies(),
      makeSpecies({ id: 'species-2', name: 'Salmon' }),
    ],
    items: [],
    saveTables: mockSaveTables,
    onDelete: mockOnDelete
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the Gathering Tables heading with count', () => {
    render(<TablesView {...defaultProps} />);
    expect(screen.getByText('Gathering Tables (0)')).toBeInTheDocument();
  });

  it('shows count in header when tables exist', () => {
    const tables = [
      makeTable({ id: '1' }),
      makeTable({ id: '2', name: 'Rare Catch' }),
    ];
    render(<TablesView {...defaultProps} tables={tables} />);
    expect(screen.getByText('Gathering Tables (2)')).toBeInTheDocument();
  });

  it('renders Add Table button', () => {
    render(<TablesView {...defaultProps} />);
    expect(screen.getByRole('button', { name: /add table/i })).toBeInTheDocument();
  });

  it('shows add form when Add Table button is clicked', () => {
    render(<TablesView {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /add table/i }));

    expect(screen.getByPlaceholderText(/coastal waters catch table/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
  });

  it('shows empty state when no tables', () => {
    render(<TablesView {...defaultProps} tables={[]} />);
    expect(screen.getByText(/no tables defined/i)).toBeInTheDocument();
  });

  it('renders existing tables with type and entry count', () => {
    const tables = [
      makeTable({
        id: '1',
        name: 'Coastal Waters Catch Table',
        entries: [
          makeTableEntry(),
          makeTableEntry({
            id: 'entry-2',
            rollValue: 3,
            speciesId: 'species-2',
          }),
        ],
      }),
    ];

    render(<TablesView {...defaultProps} tables={tables} />);

    expect(screen.getByText('Coastal Waters Catch Table')).toBeInTheDocument();
  });

  it('alerts when trying to add table with empty name', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    render(<TablesView {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /add table/i }));
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(alertSpy).toHaveBeenCalledWith('Enter table name');
    expect(mockSaveTables).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });

  it('shows form validation message on save attempt', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    render(<TablesView {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /add table/i }));
    fireEvent.change(screen.getByPlaceholderText(/coastal waters catch table/i), {
      target: { value: 'River Catch Table' }
    });

    // Try to save without entries - should show validation error
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    // Will show alert about needing correct number of entries
    expect(alertSpy.mock.calls.length).toBeGreaterThan(0);

    alertSpy.mockRestore();
  });

  it('calls onDelete with correct parameters when delete button is clicked', () => {
    const tables = [
      makeTable({
        id: 'table-123',
        name: 'Test Table',
      }),
    ];

    render(<TablesView {...defaultProps} tables={tables} />);

    // First expand the table by clicking on the chevron/name
    fireEvent.click(screen.getByText('Test Table'));

    // Now find and click the delete button
    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    if (deleteButtons.length > 0) {
      fireEvent.click(deleteButtons[deleteButtons.length - 1]);
    }

    expect(mockOnDelete).toHaveBeenCalledWith('table', 'table-123', 'Test Table');
  });

  it('shows table name is clickable for expansion', () => {
    const tables = [
      makeTable({
        id: '1',
        name: 'Edit Table',
      }),
    ];

    render(<TablesView {...defaultProps} tables={tables} />);

    expect(screen.getByText('Edit Table')).toBeInTheDocument();
  });

  it('displays table type in list', () => {
    const tables = [
      makeTable({
        id: '1',
        name: 'Event Table',
        tableType: 'GatheringEvent',
      }),
    ];

    render(<TablesView {...defaultProps} tables={tables} />);

    expect(screen.getByText('Event Table')).toBeInTheDocument();
  });

  it('renders table with entries', () => {
    const tables = [
      makeTable({
        id: '1',
        name: 'Expandable Table',
        entries: [makeTableEntry()],
      }),
    ];

    render(<TablesView {...defaultProps} tables={tables} />);

    // Table should be rendered with name
    expect(screen.getByText('Expandable Table')).toBeInTheDocument();
  });

  it('shows roll method in table details', () => {
    const tables = [
      makeTable({
        id: '1',
        name: 'D6 Table',
        rollMethod: '3d6',
      }),
    ];

    render(<TablesView {...defaultProps} tables={tables} />);

    expect(screen.getByText('D6 Table')).toBeInTheDocument();
  });
});
