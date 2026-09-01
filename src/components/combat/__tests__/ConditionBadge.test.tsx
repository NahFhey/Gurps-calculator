import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ConditionBadge from '../ConditionBadge';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../../utils/conditionsEngine', () => ({
  formatConditionDuration: vi.fn((_condition: unknown, _round: number) => '3 rounds'),
}));

vi.mock('../../../constants/conditions', () => ({
  getConditionIcon: vi.fn((id: string) => {
    const icons: Record<string, string> = {
      stunned: '💫',
      prone: '⬇',
      bleeding: '🩸',
    };
    return icons[id] ?? '❓';
  }),
  getCondition: vi.fn((id: string) => {
    const map: Record<string, unknown> = {
      stunned: { id: 'stunned', label: 'Stunned', icon: '💫', description: 'Cannot act' },
    };
    return map[id] ?? null;
  }),
}));

// NOTE: the ui module (Tooltip) is intentionally NOT mocked — tooltip
// behavior is part of the Phase 12a.6 badge contract and is tested below.

// ---------------------------------------------------------------------------
// Test data + helpers
// ---------------------------------------------------------------------------

type TestExpiresAt = {
  type: 'turn' | 'round' | 'endOfCombat';
  turnsRemaining?: number;
  round?: number;
};

function makeCondition(overrides: Record<string, unknown> = {}) {
  return {
    conditionId: 'stunned',
    instanceId: 'cond-1',
    label: 'Stunned',
    expiresAt: null as TestExpiresAt | null,
    severity: null as number | null,
    ...overrides,
  };
}

/** The badge element itself (inside the Tooltip trigger span). */
function getBadge(label = 'Stunned') {
  return screen.getByLabelText(label);
}

/**
 * React synthesizes onMouseEnter/onMouseLeave from bubbling mouseover/mouseout,
 * so fire those rather than the non-bubbling enter/leave events.
 */
function hover(el: Element) {
  fireEvent.mouseOver(el);
}
function unhover(el: Element) {
  fireEvent.mouseOut(el);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ConditionBadge', () => {
  describe('full mode', () => {
    it('renders the condition label and icon', () => {
      render(<ConditionBadge condition={makeCondition()} mode="full" />);

      expect(screen.getByText('Stunned')).toBeInTheDocument();
      expect(screen.getByText('💫')).toBeInTheDocument();
    });

    it('renders severity when provided', () => {
      render(<ConditionBadge condition={makeCondition({ severity: 3 })} mode="full" />);

      expect(screen.getByText('×3')).toBeInTheDocument();
    });

    it('does not render severity when null', () => {
      render(<ConditionBadge condition={makeCondition({ severity: null })} mode="full" />);

      expect(screen.queryByText(/×/)).not.toBeInTheDocument();
    });
  });

  describe('icon mode (default)', () => {
    it('renders only the icon — no inline label', () => {
      render(<ConditionBadge condition={makeCondition()} />);

      expect(screen.getByText('💫')).toBeInTheDocument();
      expect(screen.queryByText('Stunned')).not.toBeInTheDocument();
      // Still discoverable for assistive tech
      expect(getBadge()).toBeInTheDocument();
    });

    it('hides severity and countdown inline', () => {
      render(
        <ConditionBadge
          condition={makeCondition({
            severity: 3,
            expiresAt: { type: 'turn', turnsRemaining: 1 },
          })}
          currentRound={1}
        />
      );

      expect(screen.queryByText('×3')).not.toBeInTheDocument();
      expect(screen.queryByText(/left/)).not.toBeInTheDocument();
    });

    it('keeps urgency styling on the badge', () => {
      render(
        <ConditionBadge
          condition={makeCondition({ expiresAt: { type: 'turn', turnsRemaining: 0 } })}
          currentRound={1}
        />
      );

      expect(getBadge().className).toContain('border-danger-500');
      expect(getBadge().className).toContain('animate-pulse');
    });

    it('still offers quick-remove when onRemove is provided', () => {
      const onRemove = vi.fn();
      render(<ConditionBadge condition={makeCondition()} onRemove={onRemove} />);

      fireEvent.click(screen.getByTitle('Remove Stunned'));
      expect(onRemove).toHaveBeenCalledOnce();
    });
  });

  describe('placeholder mode', () => {
    it('renders an anonymous grey badge via mode prop', () => {
      render(
        <ConditionBadge
          condition={{ conditionId: '__concealed__', label: 'Afflicted' }}
          mode="placeholder"
        />
      );

      expect(screen.getByText('❓')).toBeInTheDocument();
      expect(screen.getByText('Afflicted')).toBeInTheDocument();
      expect(getBadge('Afflicted').className).toContain('border-edge-strong');
    });

    it('is auto-detected from the player-view placeholder flag', () => {
      render(
        <ConditionBadge
          condition={{ conditionId: 'stunned', label: 'Afflicted', placeholder: true }}
        />
      );

      // Placeholder forces the anonymous icon even if a real conditionId leaked
      expect(screen.getByText('❓')).toBeInTheDocument();
      expect(screen.queryByText('💫')).not.toBeInTheDocument();
      expect(getBadge('Afflicted').className).toContain('border-edge-strong');
    });

    it('never renders severity, duration, or quick-remove', () => {
      const onRemove = vi.fn();
      render(
        <ConditionBadge
          condition={{
            conditionId: '__concealed__',
            label: 'Afflicted',
            placeholder: true,
            severity: 3,
            expiresAt: { type: 'turn', turnsRemaining: 1 },
          }}
          mode="placeholder"
          onRemove={onRemove}
        />
      );

      expect(screen.queryByText('×3')).not.toBeInTheDocument();
      expect(screen.queryByText(/left/)).not.toBeInTheDocument();
      expect(screen.queryByTitle(/Remove/)).not.toBeInTheDocument();
    });

    it('does not pulse even when the underlying condition is expiring', () => {
      render(
        <ConditionBadge
          condition={{
            conditionId: '__concealed__',
            label: 'Afflicted',
            placeholder: true,
            expiresAt: { type: 'turn', turnsRemaining: 0 },
          }}
        />
      );

      expect(getBadge('Afflicted').className).not.toContain('animate-pulse');
    });
  });

  describe('tooltip', () => {
    it('is hidden until hover', () => {
      render(<ConditionBadge condition={makeCondition()} mode="full" />);

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('shows name, duration, source, and description on hover', () => {
      render(
        <ConditionBadge
          condition={makeCondition({ severity: 2, source: 'Goblin #1', notes: 'Save ends' })}
          mode="full"
        />
      );

      hover(getBadge());

      const tooltip = screen.getByRole('tooltip');
      expect(tooltip).toHaveTextContent('Stunned');
      expect(tooltip).toHaveTextContent('×2');
      expect(tooltip).toHaveTextContent('Duration: 3 rounds');
      expect(tooltip).toHaveTextContent('Source: Goblin #1');
      expect(tooltip).toHaveTextContent('Cannot act');
      expect(tooltip).toHaveTextContent('Notes: Save ends');
    });

    it('hides again on mouse leave', () => {
      render(<ConditionBadge condition={makeCondition()} mode="full" />);

      hover(getBadge());
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      unhover(getBadge());
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('shows a generic message for placeholders', () => {
      render(
        <ConditionBadge
          condition={{ conditionId: '__concealed__', label: 'Afflicted', placeholder: true }}
        />
      );

      hover(getBadge('Afflicted'));

      expect(screen.getByRole('tooltip')).toHaveTextContent(
        'This character has an unknown effect.'
      );
    });
  });

  describe('urgency color-coding', () => {
    it('shows "expiring" urgency for 0 turns remaining (turn-based)', () => {
      const condition = makeCondition({
        expiresAt: { type: 'turn', turnsRemaining: 0 },
      });

      render(<ConditionBadge condition={condition} currentRound={5} mode="full" />);

      const badge = getBadge();
      expect(badge.className).toContain('border-danger-500');
      expect(badge.className).toContain('animate-pulse');
    });

    it('shows "low" urgency for 1-2 turns remaining', () => {
      const condition = makeCondition({
        expiresAt: { type: 'turn', turnsRemaining: 2 },
      });

      render(<ConditionBadge condition={condition} currentRound={3} mode="full" />);

      const badge = getBadge();
      expect(badge.className).toContain('border-orange-500');
      expect(badge.className).not.toContain('animate-pulse');
    });

    it('shows "normal" urgency for 3+ turns remaining', () => {
      const condition = makeCondition({
        expiresAt: { type: 'turn', turnsRemaining: 5 },
      });

      render(<ConditionBadge condition={condition} currentRound={1} mode="full" />);

      expect(getBadge().className).toContain('border-purple-700');
    });

    it('shows "none" urgency for permanent conditions (no expiresAt)', () => {
      const condition = makeCondition({ expiresAt: null });

      render(<ConditionBadge condition={condition} currentRound={1} mode="full" />);

      const badge = getBadge();
      expect(badge.className).toContain('border-purple-700');
      expect(badge.className).not.toContain('animate-pulse');
    });

    it('calculates round-based remaining correctly', () => {
      const condition = makeCondition({
        expiresAt: { type: 'round', round: 7 },
      });

      // currentRound=5, expires at round 7 → 2 remaining → "low" urgency
      render(<ConditionBadge condition={condition} currentRound={5} mode="full" />);

      expect(getBadge().className).toContain('border-orange-500');
    });

    it('treats endOfCombat as no urgency', () => {
      const condition = makeCondition({
        expiresAt: { type: 'endOfCombat' },
      });

      render(<ConditionBadge condition={condition} currentRound={10} mode="full" />);

      expect(getBadge().className).toContain('border-purple-700');
    });
  });

  describe('countdown text', () => {
    it('shows "expires now" for 0 remaining', () => {
      const condition = makeCondition({
        expiresAt: { type: 'turn', turnsRemaining: 0 },
      });

      render(<ConditionBadge condition={condition} currentRound={5} mode="full" />);
      expect(screen.getByText('expires now')).toBeInTheDocument();
    });

    it('shows "1 turn left" for 1 turn remaining', () => {
      const condition = makeCondition({
        expiresAt: { type: 'turn', turnsRemaining: 1 },
      });

      render(<ConditionBadge condition={condition} currentRound={5} mode="full" />);
      expect(screen.getByText('1 turn left')).toBeInTheDocument();
    });

    it('shows "2 rounds left" for 2 rounds remaining', () => {
      const condition = makeCondition({
        expiresAt: { type: 'round', round: 7 },
      });

      render(<ConditionBadge condition={condition} currentRound={5} mode="full" />);
      expect(screen.getByText('2 rounds left')).toBeInTheDocument();
    });

    it('shows parenthesized duration for normal urgency', () => {
      const condition = makeCondition({
        expiresAt: { type: 'turn', turnsRemaining: 5 },
      });

      render(<ConditionBadge condition={condition} currentRound={1} mode="full" />);
      // Normal urgency wraps in parens — uses formatConditionDuration fallback
      expect(screen.getByText('(5 turns left)')).toBeInTheDocument();
    });

    it('hides duration when showDuration is false', () => {
      const condition = makeCondition({
        expiresAt: { type: 'turn', turnsRemaining: 2 },
      });

      render(
        <ConditionBadge condition={condition} currentRound={1} showDuration={false} mode="full" />
      );

      expect(screen.queryByText(/left/)).not.toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('calls onClick when the badge is clicked', () => {
      const onClick = vi.fn();
      const condition = makeCondition();

      render(<ConditionBadge condition={condition} onClick={onClick} mode="full" />);

      fireEvent.click(screen.getByText('Stunned'));
      expect(onClick).toHaveBeenCalledWith(condition);
    });

    it('does not render remove button when onRemove is not provided', () => {
      render(<ConditionBadge condition={makeCondition()} mode="full" />);

      expect(screen.queryByTitle('Remove Stunned')).not.toBeInTheDocument();
    });

    it('renders remove button when onRemove is provided', () => {
      const onRemove = vi.fn();
      render(<ConditionBadge condition={makeCondition()} onRemove={onRemove} mode="full" />);

      expect(screen.getByTitle('Remove Stunned')).toBeInTheDocument();
    });

    it('calls onRemove when the X button is clicked', () => {
      const onRemove = vi.fn();
      const condition = makeCondition();

      render(<ConditionBadge condition={condition} onRemove={onRemove} mode="full" />);

      fireEvent.click(screen.getByTitle('Remove Stunned'));
      expect(onRemove).toHaveBeenCalledWith(condition);
    });

    it('stops propagation on remove click (does not trigger onClick)', () => {
      const onClick = vi.fn();
      const onRemove = vi.fn();
      const condition = makeCondition();

      render(
        <ConditionBadge condition={condition} onClick={onClick} onRemove={onRemove} mode="full" />
      );

      fireEvent.click(screen.getByTitle('Remove Stunned'));
      expect(onRemove).toHaveBeenCalledOnce();
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('compact mode', () => {
    it('applies compact styling when compact is true', () => {
      render(<ConditionBadge condition={makeCondition()} compact={true} mode="full" />);

      const badge = getBadge();
      expect(badge.className).toContain('px-1.5');
      expect(badge.className).toContain('py-0.5');
    });

    it('applies normal styling when compact is false', () => {
      render(<ConditionBadge condition={makeCondition()} compact={false} mode="full" />);

      const badge = getBadge();
      expect(badge.className).toContain('px-2');
      expect(badge.className).toContain('py-1');
    });
  });
});
