import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { CampaignDayView } from '../views/CampaignDayView';

describe('CampaignDayView', () => {
  const mockSaveCurrentDay = vi.fn();

  const defaultProps = {
    currentDay: 1,
    saveCurrentDay: mockSaveCurrentDay
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the Campaign Day Tracker heading', () => {
    render(<CampaignDayView {...defaultProps} />);
    expect(screen.getByText('Campaign Day Tracker')).toBeInTheDocument();
  });

  it('renders the current day input', () => {
    render(<CampaignDayView {...defaultProps} currentDay={5} />);
    expect(screen.getByDisplayValue('5')).toBeInTheDocument();
  });

  it('renders + Day and - Day buttons', () => {
    render(<CampaignDayView {...defaultProps} />);
    expect(screen.getByRole('button', { name: '+ Day' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '- Day' })).toBeInTheDocument();
  });

  it('renders explanation text', () => {
    render(<CampaignDayView {...defaultProps} />);
    expect(screen.getByText(/campaign day is used to track daily events/i)).toBeInTheDocument();
  });

  it('calls saveCurrentDay with incremented value when + Day clicked', () => {
    render(<CampaignDayView {...defaultProps} currentDay={5} />);

    fireEvent.click(screen.getByRole('button', { name: '+ Day' }));

    expect(mockSaveCurrentDay).toHaveBeenCalledWith(6);
  });

  it('calls saveCurrentDay with decremented value when - Day clicked', () => {
    render(<CampaignDayView {...defaultProps} currentDay={5} />);

    fireEvent.click(screen.getByRole('button', { name: '- Day' }));

    expect(mockSaveCurrentDay).toHaveBeenCalledWith(4);
  });

  it('does not allow day to go below 1 when - Day clicked', () => {
    render(<CampaignDayView {...defaultProps} currentDay={1} />);

    fireEvent.click(screen.getByRole('button', { name: '- Day' }));

    expect(mockSaveCurrentDay).toHaveBeenCalledWith(1);
  });

  it('calls saveCurrentDay when input value changes', () => {
    render(<CampaignDayView {...defaultProps} currentDay={1} />);

    const input = screen.getByDisplayValue('1');
    fireEvent.change(input, { target: { value: '10' } });

    expect(mockSaveCurrentDay).toHaveBeenCalledWith(10);
  });

  it('defaults to 1 when input is cleared or invalid', () => {
    render(<CampaignDayView {...defaultProps} currentDay={5} />);

    const input = screen.getByDisplayValue('5');
    fireEvent.change(input, { target: { value: '' } });

    expect(mockSaveCurrentDay).toHaveBeenCalledWith(1);
  });

  it('handles string input that parses to number', () => {
    render(<CampaignDayView {...defaultProps} currentDay={1} />);

    const input = screen.getByDisplayValue('1');
    fireEvent.change(input, { target: { value: '25' } });

    expect(mockSaveCurrentDay).toHaveBeenCalledWith(25);
  });
});
