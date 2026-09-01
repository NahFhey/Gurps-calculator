import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mock lucide-react icons
// ---------------------------------------------------------------------------

vi.mock('lucide-react', () => ({
  ChevronDown: () => <span data-testid="chevron-down">▼</span>,
  ChevronRight: () => <span data-testid="chevron-right">▶</span>,
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { QuickNavigationView } from '../QuickNavigationView';
import { RuleSectionView } from '../RuleSectionView';
import type { RuleSection } from '../../../../types/rules';

// ============================================================================
// 1. QuickNavigationView
// ============================================================================

describe('QuickNavigationView', () => {
  it('renders Quick Navigation heading', () => {
    render(<QuickNavigationView />);
    expect(screen.getByText('Quick Navigation')).toBeInTheDocument();
  });

  it('renders instruction text about clicking sections', () => {
    render(<QuickNavigationView />);
    expect(screen.getByText(/Click any section above to expand/i)).toBeInTheDocument();
  });

  it('contains information about subsections', () => {
    render(<QuickNavigationView />);
    expect(screen.getByText(/subsections covering specific mechanics/i)).toBeInTheDocument();
  });

  it('has styled container with accent theme', () => {
    const { container } = render(<QuickNavigationView />);
    const wrapper = container.querySelector('[class*="bg-accent"]');
    expect(wrapper).toBeInTheDocument();
  });
});

// ============================================================================
// 2. RuleSectionView
// ============================================================================

describe('RuleSectionView', () => {
  const mockSection: RuleSection = {
    id: 'combat',
    title: 'Combat Rules',
    icon: '⚔️',
    subsections: [
      {
        title: 'Initiative',
        content: 'Roll 3d6 for initiative...',
      },
      {
        title: 'Attack Resolution',
        content: 'Roll 3d6 against defense...',
      },
    ],
  };

  it('renders section title', () => {
    render(
      <RuleSectionView
        section={mockSection}
        isExpanded={false}
        onToggle={vi.fn()}
      />
    );

    expect(screen.getByText('Combat Rules')).toBeInTheDocument();
  });

  it('renders section icon', () => {
    render(
      <RuleSectionView
        section={mockSection}
        isExpanded={false}
        onToggle={vi.fn()}
      />
    );

    expect(screen.getByText('⚔️')).toBeInTheDocument();
  });

  it('shows ChevronRight icon when collapsed', () => {
    render(
      <RuleSectionView
        section={mockSection}
        isExpanded={false}
        onToggle={vi.fn()}
      />
    );

    expect(screen.getByTestId('chevron-right')).toBeInTheDocument();
    expect(screen.queryByTestId('chevron-down')).not.toBeInTheDocument();
  });

  it('shows ChevronDown icon when expanded', () => {
    render(
      <RuleSectionView
        section={mockSection}
        isExpanded={true}
        onToggle={vi.fn()}
      />
    );

    expect(screen.getByTestId('chevron-down')).toBeInTheDocument();
    expect(screen.queryByTestId('chevron-right')).not.toBeInTheDocument();
  });

  it('calls onToggle when button is clicked', () => {
    const mockOnToggle = vi.fn();
    render(
      <RuleSectionView
        section={mockSection}
        isExpanded={false}
        onToggle={mockOnToggle}
      />
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(mockOnToggle).toHaveBeenCalledOnce();
  });

  it('shows subsections when expanded', () => {
    render(
      <RuleSectionView
        section={mockSection}
        isExpanded={true}
        onToggle={vi.fn()}
      />
    );

    expect(screen.getByText('Initiative')).toBeInTheDocument();
    expect(screen.getByText('Attack Resolution')).toBeInTheDocument();
    expect(screen.getByText('Roll 3d6 for initiative...')).toBeInTheDocument();
    expect(screen.getByText('Roll 3d6 against defense...')).toBeInTheDocument();
  });

  it('hides subsections when collapsed', () => {
    render(
      <RuleSectionView
        section={mockSection}
        isExpanded={false}
        onToggle={vi.fn()}
      />
    );

    expect(screen.queryByText('Initiative')).not.toBeInTheDocument();
    expect(screen.queryByText('Attack Resolution')).not.toBeInTheDocument();
  });

  it('renders all subsection titles in expanded view', () => {
    const sectionWithMultipleSubsections: RuleSection = {
      id: 'test',
      title: 'Test Section',
      icon: '📖',
      subsections: [
        { title: 'Sub 1', content: 'Content 1' },
        { title: 'Sub 2', content: 'Content 2' },
        { title: 'Sub 3', content: 'Content 3' },
      ],
    };

    render(
      <RuleSectionView
        section={sectionWithMultipleSubsections}
        isExpanded={true}
        onToggle={vi.fn()}
      />
    );

    expect(screen.getByText('Sub 1')).toBeInTheDocument();
    expect(screen.getByText('Sub 2')).toBeInTheDocument();
    expect(screen.getByText('Sub 3')).toBeInTheDocument();
  });

  it('renders subsection content formatted correctly', () => {
    const sectionWithContent: RuleSection = {
      id: 'test',
      title: 'Test Section',
      icon: '📖',
      subsections: [
        {
          title: 'Example Subsection',
          content: 'Line 1\nLine 2\nLine 3',
        },
      ],
    };

    render(
      <RuleSectionView
        section={sectionWithContent}
        isExpanded={true}
        onToggle={vi.fn()}
      />
    );

    // Check that content is preserved with whitespace
    expect(screen.getByText(/Line 1/)).toBeInTheDocument();
  });

  it('is clickable and has proper button styling', () => {
    const mockOnToggle = vi.fn();
    render(
      <RuleSectionView
        section={mockSection}
        isExpanded={false}
        onToggle={mockOnToggle}
      />
    );

    const button = screen.getByRole('button');
    expect(button).toHaveClass('w-full');
    expect(button).toHaveClass('text-left');

    fireEvent.click(button);
    expect(mockOnToggle).toHaveBeenCalledOnce();
  });

  it('toggles between expanded and collapsed on repeated clicks', () => {
    const mockOnToggle = vi.fn();
    const { rerender } = render(
      <RuleSectionView
        section={mockSection}
        isExpanded={false}
        onToggle={mockOnToggle}
      />
    );

    const button = screen.getByRole('button');

    // First click - expand
    fireEvent.click(button);
    expect(mockOnToggle).toHaveBeenCalledTimes(1);

    // Simulate expansion
    rerender(
      <RuleSectionView
        section={mockSection}
        isExpanded={true}
        onToggle={mockOnToggle}
      />
    );

    // Subsections should now be visible
    expect(screen.getByText('Initiative')).toBeInTheDocument();

    // Second click - collapse
    fireEvent.click(button);
    expect(mockOnToggle).toHaveBeenCalledTimes(2);
  });
});
