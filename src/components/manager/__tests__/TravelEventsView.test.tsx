import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TravelEventsView } from '../views/TravelEventsView';

const mocks = vi.hoisted(() => ({
  store: {
    state: {} as Record<string, unknown>,
    actions: {
      partyUpsertTravelEventTable: vi.fn(),
      partyRemoveTravelEventTable: vi.fn(),
      partyUpsertTravelEventTableSet: vi.fn(),
      partyRemoveTravelEventTableSet: vi.fn(),
    },
  },
}));

vi.mock('../../../state/campaignStore', () => ({ useCampaignStore: () => mocks.store }));

describe('TravelEventsView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.store.state = {
      entities: {
        travelEventTables: {
          road: { id: 'road', name: 'Road Events', builtin: true, entries: [{ id: 'e', kind: 'flavor', weight: 10, name: 'Milestone', description: 'An old stone.' }] },
        },
        travelEventTableSets: {
          default: { id: 'default', name: 'Default Events', byTerrain: { 'terrain-road': 'road' } },
        },
        encounterTemplates: {},
      },
    };
  });

  it('renders table summaries and builtin badges', () => {
    render(<TravelEventsView />);
    expect(screen.getByText('Road Events')).toBeInTheDocument();
    expect(screen.getByText('1 entries')).toBeInTheDocument();
    expect(screen.getByText('Built-in')).toBeInTheDocument();
  });

  it('edits and saves an event entry', async () => {
    render(<TravelEventsView />);
    fireEvent.click(screen.getByText('Road Events'));
    const name = await screen.findByLabelText('Event 1 name');
    fireEvent.change(name, { target: { value: 'Weathered milestone' } });
    fireEvent.click(screen.getByRole('button', { name: /Save/ }));
    await waitFor(() => expect(mocks.store.actions.partyUpsertTravelEventTable).toHaveBeenCalledWith(
      expect.objectContaining({ entries: [expect.objectContaining({ name: 'Weathered milestone' })] })
    ));
  });
});
