import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FishingResolutionPanel } from '../FishingResolutionPanel';
import { CampaignStoreProvider } from '../../../../state/campaignStore';
import { DowntimeProvider } from '../../DowntimeContext';
import type { DowntimeTask, FishingData } from '../../../../types/downtime';
import type { Character } from '../../../../types/campaign';
import type {
  GatheringSpeciesExtended,
  GatheringBaitExtended,
  GatheringEnvironmentExtended,
  GatheringTableExtended,
} from '../../../../types/gathering';

const testLeader: Character = {
  id: 'char-1',
  name: 'Fisher Jane',
  skills: [{ name: 'Fishing', level: 13 }],
} as unknown as Character;

const fishingTask: DowntimeTask = {
  id: 'task-fish-1',
  activityType: 'fishing',
  dayKey: 1,
  slot: 0,
  leaderId: 'char-1',
  helperIds: [],
  status: 'in_progress',
  createdAt: Date.now(),
  activityData: {
    type: 'fishing',
    method: 'Rod',
    spotId: 'spot-1',
    targetSpeciesId: '',
    baitId: '',
    toolIds: [],
    skill: 'fishing',
    leaderSkill: 13,
    skillModifier: 0,
    catchMode: 'random',
  } as FishingData,
} as DowntimeTask;

const testSpecies: GatheringSpeciesExtended[] = [
  {
    id: 'species-1',
    name: 'Trout',
    type: 'fish',
    size: 'medium',
    rarity: 'common',
    skillMod: 0,
    yield: '1d6',
    habitat: ['freshwater'],
  } as unknown as GatheringSpeciesExtended,
];

const testSpots: GatheringEnvironmentExtended[] = [
  {
    id: 'spot-1',
    name: 'River Bend',
    type: 'freshwater',
    skillMod: 0,
    species: ['species-1'],
  } as unknown as GatheringEnvironmentExtended,
];

const testBait: GatheringBaitExtended[] = [];
const testTables: GatheringTableExtended[] = [];

function renderPanel(overrides = {}) {
  const defaultProps = {
    task: fishingTask,
    leader: testLeader,
    species: testSpecies,
    spots: testSpots,
    bait: testBait,
    gatheringTables: testTables,
    onFinalize: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
  return render(
    <CampaignStoreProvider>
      <DowntimeProvider currentDayKey={1} currentSlot={0}>
        <FishingResolutionPanel {...defaultProps} />
      </DowntimeProvider>
    </CampaignStoreProvider>
  );
}

describe('FishingResolutionPanel', () => {
  describe('rendering', () => {
    it('renders the resolution panel', () => {
      renderPanel();
      // Panel should render without crashing and show cancel button
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('shows fishing-related content', () => {
      renderPanel();
      const allText = document.body.textContent ?? '';
      expect(allText).toMatch(/Fish|Skill|Roll/i);
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
    it('shows fishing skill information', () => {
      renderPanel();
      // Should display skill-related content
      const allText = document.body.textContent ?? '';
      expect(allText).toMatch(/Skill|Fishing|13/i);
    });
  });

  describe('without leader', () => {
    it('renders gracefully when leader is undefined', () => {
      renderPanel({ leader: undefined });
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
  });

  describe('with empty data', () => {
    it('renders with no species', () => {
      renderPanel({ species: [] });
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('renders with no spots', () => {
      renderPanel({ spots: [] });
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
  });
});
