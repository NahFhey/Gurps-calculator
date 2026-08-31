import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CalendarView } from '../views/CalendarView';
import { DEFAULT_CALENDAR } from '../../../utils/timeSystem';

const mocks = vi.hoisted(() => ({
  store: {
    state: { time: { calendar: undefined as typeof DEFAULT_CALENDAR | undefined } },
    actions: { setCalendarConfig: vi.fn() },
  },
}));

vi.mock('../../../state/campaignStore', () => ({ useCampaignStore: () => mocks.store }));

describe('CalendarView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.store.state.time.calendar = undefined;
  });

  it('renders the four configured seasons', () => {
    render(<CalendarView />);
    expect(screen.getAllByLabelText(/Season \d name/)).toHaveLength(4);
    expect(screen.getByLabelText('Season 1 name')).toHaveValue('Spring');
    expect(screen.getByLabelText('Season 4 name')).toHaveValue('Winter');
  });

  it('dispatches the whole config when a season name changes', () => {
    render(<CalendarView />);
    fireEvent.change(screen.getByLabelText('Season 1 name'), { target: { value: 'Bloom' } });
    expect(mocks.store.actions.setCalendarConfig).toHaveBeenCalledWith(expect.objectContaining({
      seasons: expect.arrayContaining([expect.objectContaining({ name: 'Bloom' })]),
    }));
  });

  it('dispatches a starting season change', () => {
    render(<CalendarView />);
    fireEvent.change(screen.getByLabelText('Starting season'), { target: { value: '3' } });
    expect(mocks.store.actions.setCalendarConfig).toHaveBeenCalledWith(expect.objectContaining({ startSeasonIndex: 3 }));
  });

  it('resets to the default calendar', () => {
    render(<CalendarView />);
    fireEvent.click(screen.getByRole('button', { name: 'Reset to defaults' }));
    expect(mocks.store.actions.setCalendarConfig).toHaveBeenCalledWith(DEFAULT_CALENDAR);
  });
});
