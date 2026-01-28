import '@testing-library/jest-dom';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DowntimePanel } from '../DowntimePanel';

describe('DowntimePanel', () => {
  const defaultProps = {
    currentDayKey: 1,
    currentSlot: 0,
  };

  it('renders without crashing', () => {
    render(<DowntimePanel {...defaultProps} />);
    expect(screen.getByText('Downtime')).toBeInTheDocument();
  });

  it('shows tile grid by default', () => {
    render(<DowntimePanel {...defaultProps} />);
    expect(screen.getByText('Fishing')).toBeInTheDocument();
    expect(screen.getByText('Foraging')).toBeInTheDocument();
  });

  it('does not show back button on tile view', () => {
    render(<DowntimePanel {...defaultProps} />);
    expect(screen.queryByLabelText('Back to activities')).not.toBeInTheDocument();
  });

  it('navigates to activity and shows back button', () => {
    render(<DowntimePanel {...defaultProps} />);
    fireEvent.click(screen.getByText('Fishing'));
    expect(screen.getByLabelText('Back to activities')).toBeInTheDocument();
  });

  it('returns to tiles when back clicked', () => {
    render(<DowntimePanel {...defaultProps} />);
    fireEvent.click(screen.getByText('Fishing'));
    fireEvent.click(screen.getByLabelText('Back to activities'));
    expect(screen.getByText('Foraging')).toBeInTheDocument();
  });
});
