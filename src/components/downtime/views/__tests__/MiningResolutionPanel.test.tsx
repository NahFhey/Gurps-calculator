import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MiningResolutionPanel } from '../MiningResolutionPanel';
import { CampaignStoreProvider } from '../../../../state/campaignStore';
import { DowntimeProvider } from '../../DowntimeContext';
import type { DowntimeTask, MiningSite, MiningData } from '../../../../types/downtime';
import type { Character } from '../../../../types/campaign';

const testLeader: Character = {
  id: 'char-1',
  name: 'Miner Bob',
  skills: [{ name: 'Prospecting', level: 12 }],
} as unknown as Character;

const surfaceProspectingTask: DowntimeTask = {
  id: 'task-1',
  activityType: 'mining',
  dayKey: 1,
  slot: 0,
  leaderId: 'char-1',
  helperIds: [],
  status: 'in_progress',
  createdAt: Date.now(),
  activityData: {
    type: 'mining',
    method: 'Surface Prospecting',
    zoneId: 'zone-1',
    locateSkill: 'prospecting',
    extractionSkill: 'prospecting',
    leaderLocateSkill: 12,
    leaderExtractionSkill: 10,
    toolIds: [],
    skillModifier: 0,
    dangerMode: 'lite',
    contextFlags: {},
  } as unknown as MiningData,
} as unknown as DowntimeTask;

const deepMiningTask: DowntimeTask = {
  ...surfaceProspectingTask,
  id: 'task-2',
  activityData: {
    type: 'mining',
    method: 'Deep Mining',
    zoneId: 'zone-1',
    siteId: 'site-1',
    locateSkill: 'prospecting',
    extractionSkill: 'mining',
    leaderLocateSkill: 12,
    leaderExtractionSkill: 14,
    toolIds: [],
    skillModifier: 0,
    dangerMode: 'lite',
    contextFlags: {},
  } as unknown as MiningData,
} as unknown as DowntimeTask;

const testSites: MiningSite[] = [
  {
    id: 'site-1',
    name: 'Iron Vein',
    zoneId: 'zone-1',
    materials: ['iron'],
    depositSize: 'Medium',
    totalUnits: 20,
    remainingUnits: 15,
    mapped: true,
    depleted: false,
    quality: 'normal',
    discoveredAt: Date.now(),
  },
];

function renderPanel(overrides = {}) {
  const defaultProps = {
    task: surfaceProspectingTask,
    leader: testLeader,
    miningSites: testSites,
    onFinalize: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
  return render(
    <CampaignStoreProvider>
      <DowntimeProvider currentDayKey={1} currentSlot={0}>
        <MiningResolutionPanel {...defaultProps} />
      </DowntimeProvider>
    </CampaignStoreProvider>
  );
}

describe('MiningResolutionPanel', () => {
  describe('Surface Prospecting flow', () => {
    it('renders the resolution panel', () => {
      renderPanel();
      // Panel should render without crashing
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('shows leader name in the panel', () => {
      renderPanel();
      expect(screen.getByText(/Miner Bob/)).toBeInTheDocument();
    });

    it('shows mining-related content for Surface Prospecting', () => {
      renderPanel();
      // Should show some mining resolution UI elements
      const allText = document.body.textContent ?? '';
      expect(allText).toMatch(/Locate|Prospecting|Mining/i);
    });

    it('calls onCancel when cancel is clicked', () => {
      const onCancel = vi.fn();
      renderPanel({ onCancel });
      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);
      expect(onCancel).toHaveBeenCalledOnce();
    });
  });

  describe('Deep Mining flow', () => {
    it('renders for deep mining task', () => {
      renderPanel({ task: deepMiningTask });
      // Should render without crashing
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('shows extraction content for deep mining', () => {
      renderPanel({ task: deepMiningTask });
      const allText = document.body.textContent ?? '';
      expect(allText).toMatch(/Extraction|Mining|Iron Vein/i);
    });
  });

  describe('without leader', () => {
    it('renders gracefully when leader is undefined', () => {
      renderPanel({ leader: undefined });
      // Should still render without crashing
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
  });
});
