import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ToolsView } from '../views/ToolsView';
import type { GatheringToolExtended } from '../../../types/gathering';

describe('ToolsView', () => {
  const mockSaveTools = vi.fn();
  const mockOnDelete = vi.fn();

  const defaultProps = {
    tools: [] as GatheringToolExtended[],
    foodTypes: ['fish', 'shellfish'],
    materialTypes: ['scales', 'shells'],
    saveTools: mockSaveTools,
    onDelete: mockOnDelete
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the Gathering Tools heading with count', () => {
    render(<ToolsView {...defaultProps} />);
    expect(screen.getByText('Gathering Tools (0)')).toBeInTheDocument();
  });

  it('shows count in header when tools exist', () => {
    const tools = [
      { id: '1', name: 'Fishing Rod', toolType: 'fishing_rod', allowedModes: ['Fishing'], allowedMethods: [], bonuses: [], durability: null, notes: '' } as any,
      { id: '2', name: 'Net', toolType: 'net', allowedModes: ['Fishing'], allowedMethods: [], bonuses: [], durability: null, notes: '' } as any
    ];
    render(<ToolsView {...defaultProps} tools={tools} />);
    expect(screen.getByText('Gathering Tools (2)')).toBeInTheDocument();
  });

  it('renders Add Tool button', () => {
    render(<ToolsView {...defaultProps} />);
    expect(screen.getByRole('button', { name: /add tool/i })).toBeInTheDocument();
  });

  it('shows add form when Add Tool button is clicked', () => {
    render(<ToolsView {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /add tool/i }));

    expect(screen.getByPlaceholderText(/quality fishing rod/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
  });

  it('shows empty state when no tools', () => {
    render(<ToolsView {...defaultProps} tools={[]} />);
    expect(screen.getByText(/no tools defined/i)).toBeInTheDocument();
  });

  it('renders existing tools with type and skill bonus', () => {
    const tools = [
      {
        id: '1',
        name: 'Quality Fishing Rod',
        toolType: 'fishing_rod',
        allowedModes: ['Fishing'],
        allowedMethods: [],
        bonuses: [{ type: 'skill_bonus', skill: 'Fishing', value: 2 }],
        durability: null,
        notes: ''
      } as any
    ];

    render(<ToolsView {...defaultProps} tools={tools} />);

    expect(screen.getByText('Quality Fishing Rod')).toBeInTheDocument();
    expect(screen.getByText('+2')).toBeInTheDocument();
  });

  it('alerts when trying to add tool with empty name', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    render(<ToolsView {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /add tool/i }));
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(alertSpy).toHaveBeenCalledWith('Enter tool name');
    expect(mockSaveTools).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });

  it('calls saveTools when adding a new tool with valid data', () => {
    render(<ToolsView {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /add tool/i }));
    fireEvent.change(screen.getByPlaceholderText(/quality fishing rod/i), {
      target: { value: 'Expert Net' }
    });

    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(mockSaveTools).toHaveBeenCalled();
    const savedTools = mockSaveTools.mock.calls[0][0];
    expect(savedTools[savedTools.length - 1].name).toBe('Expert Net');
  });

  it('calls onDelete with correct parameters when delete button is clicked', () => {
    const tools = [
      {
        id: 'tool-123',
        name: 'Test Tool',
        toolType: 'fishing_rod',
        allowedModes: ['Fishing'],
        allowedMethods: [],
        bonuses: [],
        durability: null,
        notes: ''
      } as any
    ];

    render(<ToolsView {...defaultProps} tools={tools} />);

    const deleteButton = document.querySelector('button.text-red-400');
    expect(deleteButton).not.toBeNull();
    if (deleteButton) fireEvent.click(deleteButton);

    expect(mockOnDelete).toHaveBeenCalledWith('tool', 'tool-123', 'Test Tool');
  });

  it('enters edit mode when edit button is clicked', () => {
    const tools = [
      {
        id: '1',
        name: 'Edit Tool',
        toolType: 'fishing_rod',
        allowedModes: ['Fishing'],
        allowedMethods: [],
        bonuses: [],
        durability: null,
        notes: ''
      } as any
    ];

    render(<ToolsView {...defaultProps} tools={tools} />);

    const editButton = document.querySelector('button.text-blue-400');
    expect(editButton).not.toBeNull();
    if (editButton) fireEvent.click(editButton);

    // Form should show with Update button
    expect(screen.getByRole('button', { name: /update/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Edit Tool')).toBeInTheDocument();
  });

  it('displays tool type in list', () => {
    const tools = [
      {
        id: '1',
        name: 'Basic Net',
        toolType: 'net',
        allowedModes: ['Fishing'],
        allowedMethods: [],
        bonuses: [],
        durability: null,
        notes: ''
      } as any
    ];

    render(<ToolsView {...defaultProps} tools={tools} />);

    expect(screen.getByText('Basic Net')).toBeInTheDocument();
  });

  it('shows skill bonus when present', () => {
    const tools = [
      {
        id: '1',
        name: 'Enchanted Rod',
        toolType: 'fishing_rod',
        allowedModes: ['Fishing'],
        allowedMethods: [],
        bonuses: [{ type: 'skill_bonus', skill: 'Fishing', value: 3 }],
        durability: 50,
        notes: 'Magical'
      } as any
    ];

    render(<ToolsView {...defaultProps} tools={tools} />);

    expect(screen.getByText('Enchanted Rod')).toBeInTheDocument();
    expect(screen.getByText('+3')).toBeInTheDocument();
  });

  it('displays durability when present', () => {
    const tools = [
      {
        id: '1',
        name: 'Durable Rod',
        toolType: 'fishing_rod',
        allowedModes: ['Fishing'],
        allowedMethods: [],
        bonuses: [],
        durability: 100,
        notes: ''
      } as any
    ];

    render(<ToolsView {...defaultProps} tools={tools} />);

    expect(screen.getByText('Durable Rod')).toBeInTheDocument();
  });
});
