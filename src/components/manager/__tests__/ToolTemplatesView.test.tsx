import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ToolTemplatesView } from '../views/ToolTemplatesView';


vi.mock('../../../state/campaignStore', () => ({
  useCampaignStore: () => ({
    state: {
      entities: {
        toolTemplates: {
          'template-1': {
            templateId: 'template-1',
            name: 'Smith Hammer',
            activityCategories: {
              crafting: { skillBonus: 2, timeBonus: 0, qualityModifier: 1, yieldFlat: 0 }
            }
          },
          'template-2': {
            templateId: 'template-2',
            name: 'Alchemist Kit',
            activityCategories: {
              alchemy: { skillBonus: 1, timeBonus: 1, qualityModifier: 0, yieldFlat: 0 }
            }
          }
        }
      }
    },
    dispatch: vi.fn()
  })
}));

describe('ToolTemplatesView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the Tool Templates heading', () => {
    render(<ToolTemplatesView />);
    expect(screen.getByText('Tool Templates')).toBeInTheDocument();
  });

  it('displays template count', () => {
    render(<ToolTemplatesView />);
    expect(screen.getByText(/2 templates/)).toBeInTheDocument();
  });

  it('renders tool icon', () => {
    const { container } = render(<ToolTemplatesView />);
    const hammer = container.querySelector('svg.lucide-hammer');
    expect(hammer).toBeInTheDocument();
  });

  it('renders template cards with names', () => {
    render(<ToolTemplatesView />);

    expect(screen.getByText('Smith Hammer')).toBeInTheDocument();
    expect(screen.getByText('Alchemist Kit')).toBeInTheDocument();
  });

  it('displays activity modifiers for templates', () => {
    render(<ToolTemplatesView />);

    expect(screen.getByText('crafting')).toBeInTheDocument();
    expect(screen.getByText('alchemy')).toBeInTheDocument();
  });

  it('shows skill bonus in green when positive', () => {
    const { container } = render(<ToolTemplatesView />);

    const greenText = container.querySelectorAll('.text-green-400');
    expect(greenText.length).toBeGreaterThan(0);
  });

  it('displays all modifier types when present', () => {
    render(<ToolTemplatesView />);

    // Check for at least one skill modifier
    const skillModifiers = screen.queryAllByText(/Skill/);
    expect(skillModifiers.length).toBeGreaterThan(0);
  });

  it('renders multiple template cards in grid', () => {
    const { container } = render(<ToolTemplatesView />);

    // Check for grid layout
    const gridContainer = container.querySelector('[class*="grid"]');
    expect(gridContainer).toBeInTheDocument();
  });

  it('displays modifier values correctly formatted', () => {
    const { container } = render(<ToolTemplatesView />);

    // Expect formatted positive numbers like +2, +1
    expect(container.textContent).toMatch(/\+[0-9]/);
  });

  it('renders without crashing with mock data', () => {
    const { container } = render(<ToolTemplatesView />);
    expect(container).toBeInTheDocument();
  });

  it('uses campaign store to fetch tool templates', () => {
    render(<ToolTemplatesView />);

    // Verify that store data is being rendered
    expect(screen.getByText('Smith Hammer')).toBeInTheDocument();
    expect(screen.getByText('Alchemist Kit')).toBeInTheDocument();
  });
});
