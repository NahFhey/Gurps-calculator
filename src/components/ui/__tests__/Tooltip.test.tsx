import '@testing-library/jest-dom';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Tooltip } from '../Tooltip';

describe('Tooltip', () => {
  it('renders its children', () => {
    render(
      <Tooltip content="Helpful text">
        <span>Trigger</span>
      </Tooltip>
    );

    expect(screen.getByText('Trigger')).toBeInTheDocument();
  });

  it('is hidden until hover', () => {
    render(
      <Tooltip content="Helpful text">
        <span>Trigger</span>
      </Tooltip>
    );

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('shows the content on hover and hides on leave', () => {
    render(
      <Tooltip content="Helpful text">
        <span>Trigger</span>
      </Tooltip>
    );

    // React synthesizes mouseEnter/mouseLeave from bubbling mouseover/mouseout
    fireEvent.mouseOver(screen.getByText('Trigger'));
    expect(screen.getByRole('tooltip')).toHaveTextContent('Helpful text');

    fireEvent.mouseOut(screen.getByText('Trigger'));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('renders structured node content', () => {
    render(
      <Tooltip
        content={
          <div>
            <div>Line one</div>
            <div>Line two</div>
          </div>
        }
      >
        <span>Trigger</span>
      </Tooltip>
    );

    fireEvent.mouseOver(screen.getByText('Trigger'));
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveTextContent('Line one');
    expect(tooltip).toHaveTextContent('Line two');
  });

  it('portals the tooltip to document.body (escapes clipped containers)', () => {
    render(
      <div style={{ overflow: 'hidden' }}>
        <Tooltip content="Escaped">
          <span>Trigger</span>
        </Tooltip>
      </div>
    );

    fireEvent.mouseOver(screen.getByText('Trigger'));
    expect(screen.getByRole('tooltip').parentElement).toBe(document.body);
  });
});
