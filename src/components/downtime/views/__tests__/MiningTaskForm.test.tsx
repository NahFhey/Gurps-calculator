import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MiningTaskForm } from '../MiningTaskForm';
import { CampaignStoreProvider } from '../../../../state/campaignStore';
import { DowntimeProvider } from '../../DowntimeContext';
import type { DowntimeState, MiningSite } from '../../../../types/downtime';
import type { Character, GatheringTool } from '../../../../types/campaign';

// Minimal downtime state for the form
const minimalDowntimeState: DowntimeState = {
  tasks: {},
  taskOrder: [],
  reservations: {},
  config: {
    slotsPerDay: 3,
    maxDays: 30,
  },
};

// Test character
const testCharacters: Character[] = [
  {
    id: 'char-1',
    name: 'Miner Bob',
    skills: [{ name: 'Prospecting', level: 12 }],
  } as unknown as Character,
  {
    id: 'char-2',
    name: 'Helper Alice',
    skills: [],
  } as unknown as Character,
];

const testTools: GatheringTool[] = [
  {
    id: 'tool-1',
    name: 'Pickaxe',
    skillBonus: 1,
  } as unknown as GatheringTool,
];

const testSites: MiningSite[] = [
  {
    id: 'site-1',
    name: 'Iron Vein',
    zoneId: 'zone-1',
    materials: ['iron'],
    depositSize: 'medium',
    totalUnits: 20,
    remainingUnits: 15,
    mapped: true,
    depleted: false,
    quality: 'normal',
    discoveredAt: Date.now(),
  },
];

function renderForm(overrides = {}) {
  const defaultProps = {
    characters: testCharacters,
    tools: testTools,
    miningSites: testSites,
    state: minimalDowntimeState,
    currentDayKey: 1,
    currentSlot: 0,
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
  return render(
    <CampaignStoreProvider>
      <DowntimeProvider currentDayKey={1} currentSlot={0}>
        <MiningTaskForm {...defaultProps} />
      </DowntimeProvider>
    </CampaignStoreProvider>
  );
}

describe('MiningTaskForm', () => {
  describe('rendering', () => {
    it('renders the form container', () => {
      renderForm();
      expect(screen.getByTestId('mining-task-form')).toBeInTheDocument();
    });

    it('displays form title', () => {
      renderForm();
      expect(screen.getByText('New Mining Task')).toBeInTheDocument();
    });

    it('shows method selector with both options', () => {
      renderForm();
      expect(screen.getByTestId('method-selector')).toBeInTheDocument();
      expect(screen.getByText('Surface Prospecting')).toBeInTheDocument();
      expect(screen.getByText('Deep Mining')).toBeInTheDocument();
    });

    it('defaults to Surface Prospecting method', () => {
      renderForm();
      expect(
        screen.getByText(/Locate \+ harvest in 1 slot/)
      ).toBeInTheDocument();
    });

    it('shows leader selection dropdown', () => {
      renderForm();
      expect(screen.getByText('Select a leader...')).toBeInTheDocument();
    });
  });

  describe('method switching', () => {
    it('switches to Deep Mining description when clicked', () => {
      renderForm();
      fireEvent.click(screen.getByText('Deep Mining'));
      expect(
        screen.getByText(/Extract from a mapped site/)
      ).toBeInTheDocument();
    });

    it('shows mapped site selector for Deep Mining', () => {
      renderForm();
      fireEvent.click(screen.getByText('Deep Mining'));
      expect(screen.getByText('Mapped Site')).toBeInTheDocument();
    });

    it('shows no-sites message when no mapped sites and Deep Mining', () => {
      renderForm({ miningSites: [] });
      fireEvent.click(screen.getByText('Deep Mining'));
      expect(
        screen.getByText(/No mapped sites available/)
      ).toBeInTheDocument();
    });
  });

  describe('form validation', () => {
    it('submit button is disabled without leader', () => {
      renderForm();
      const createButton = screen.getByText('Create Task');
      expect(createButton).toBeDisabled();
    });

    it('submit button is enabled after selecting a leader for Surface Prospecting', () => {
      renderForm();
      const leaderSelect = screen.getByRole('combobox', { name: /leader/i }) as HTMLSelectElement;
      fireEvent.change(leaderSelect, { target: { value: 'char-1' } });
      const createButton = screen.getByText('Create Task');
      expect(createButton).not.toBeDisabled();
    });
  });

  describe('cancel', () => {
    it('calls onCancel when Cancel button is clicked', () => {
      const onCancel = vi.fn();
      renderForm({ onCancel });
      fireEvent.click(screen.getByText('Cancel'));
      expect(onCancel).toHaveBeenCalledOnce();
    });

    it('calls onCancel when X button is clicked', () => {
      const onCancel = vi.fn();
      renderForm({ onCancel });
      // The X button is the first button in the header
      const buttons = screen.getAllByRole('button');
      // Find the X close button (it has the X icon)
      const closeButton = buttons.find(
        (b) => b.querySelector('.lucide-x') || b.textContent === ''
      );
      if (closeButton) {
        fireEvent.click(closeButton);
        expect(onCancel).toHaveBeenCalled();
      }
    });
  });

  describe('context modifiers', () => {
    it('shows context modifier checkboxes', () => {
      renderForm();
      expect(screen.getByText(/Detailed Maps\/Notes/)).toBeInTheDocument();
      expect(screen.getByText(/Known Rich Deposit/)).toBeInTheDocument();
      expect(screen.getByText(/Random Unexplored/)).toBeInTheDocument();
      expect(screen.getByText(/Supervisor 15\+/)).toBeInTheDocument();
      expect(screen.getByText(/Proper Tools/)).toBeInTheDocument();
      expect(screen.getByText(/Improvised\/No Tools/)).toBeInTheDocument();
    });
  });

  describe('tools section', () => {
    it('shows available tools', () => {
      renderForm();
      expect(screen.getByText('Pickaxe')).toBeInTheDocument();
    });

    it('does not show tools section when no tools available', () => {
      renderForm({ tools: [] });
      expect(screen.queryByText('Tools')).not.toBeInTheDocument();
    });
  });
});
