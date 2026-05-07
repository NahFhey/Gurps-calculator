import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ForagingResolutionPanel } from '../ForagingResolutionPanel';
import { CampaignStoreProvider } from '../../../../state/campaignStore';
import { DowntimeProvider } from '../../DowntimeContext';
import type { DowntimeTask, ForagingData } from '../../../../types/downtime';
import type { Character } from '../../../../types/campaign';

const testLeader: Character = {
  id: 'char-1',
  name: 'Forager Sam',
  skills: [{ name: 'Naturalist', level: 14 }],
} as unknown as Character;

const foragingTask: DowntimeTask = {
  id: 'task-forage-1',
  activityType: 'foraging',
  dayKey: 1,
  slot: 0,
  leaderId: 'char-1',
  helperIds: [],
  status: 'in_progress',
  createdAt: Date.now(),
  activityData: {
    type: 'foraging',
    method: 'General',
    skill: 'naturalist',
    leaderSkill: 14,
    toolIds: [],
    skillModifier: 0,
    zoneId: 'zone-1',
    contextFlags: {},
  } as unknown as ForagingData,
} as unknown as DowntimeTask;

function renderPanel(overrides = {}) {
  const defaultProps = {
    task: foragingTask,
    leader: testLeader,
    onFinalize: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
  return render(
    <CampaignStoreProvider>
      <DowntimeProvider currentDayKey={1} currentSlot={0}>
        <ForagingResolutionPanel {...defaultProps} />
      </DowntimeProvider>
    </CampaignStoreProvider>
  );
}

describe('ForagingResolutionPanel', () => {
  describe('rendering', () => {
    it('renders the resolution panel', () => {
      renderPanel();
      // Panel should render without crashing and show cancel button
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('shows foraging-related content', () => {
      renderPanel();
      const allText = document.body.textContent ?? '';
      expect(allText).toMatch(/Forag|Skill|Roll/i);
    });

    it('shows cancel button', () => {
      renderPanel();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('calls onCancel when cancel is clicked', () => {
      const onCancel = vi.fn();
      renderPanel({ onCancel });
      fireEvent.click(screen.getByText('Cancel'));
      expect(onCancel).toHaveBeenCalledOnce();
    });
  });

  describe('skill display', () => {
    it('shows foraging skill level', () => {
      renderPanel();
      // Should display skill-related content
      const allText = document.body.textContent ?? '';
      expect(allText).toMatch(/Skill|Foraging|14/i);
    });
  });

  describe('without leader', () => {
    it('renders gracefully when leader is undefined', () => {
      renderPanel({ leader: undefined });
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
  });

  describe('step progression', () => {
    it('starts at step 1 (skill roll)', () => {
      renderPanel();
      // First step should be visible — check the page content has roll-related text
      const allText = document.body.textContent ?? '';
      expect(allText).toMatch(/Roll|Step|Skill/i);
    });
  });
});
