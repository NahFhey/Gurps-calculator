import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ConditionBadge from '../ConditionBadge';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../../utils/conditionsEngine', () => ({
  formatConditionDuration: vi.fn((_condition: unknown, _round: number) => '3 rounds'),
  formatConditionTooltip: vi.fn((_condition: unknown, _round: number) => 'Stunned tooltip text'),
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
}));

// ---------------------------------------------------------------------------
// Test data
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ConditionBadge', () => {
  describe('basic rendering', () => {
    it('renders the condition label and icon', () => {
      render(<ConditionBadge condition={makeCondition()} />);

      expect(screen.getByText('Stunned')).toBeInTheDocument();
      expect(screen.getByText('💫')).toBeInTheDocument();
    });

    it('shows tooltip from formatConditionTooltip', () => {
      const { container } = render(<ConditionBadge condition={makeCondition()} />);

      const badge = container.firstElementChild;
      expect(badge).toHaveAttribute('title', 'Stunned tooltip text');
    });

    it('renders severity when provided', () => {
      render(<ConditionBadge condition={makeCondition({ severity: 3 })} />);

      expect(screen.getByText('×3')).toBeInTheDocument();
    });

    it('does not render severity when null', () => {
      render(<ConditionBadge condition={makeCondition({ severity: null })} />);

      expect(screen.queryByText(/×/)).not.toBeInTheDocument();
    });
  });

  describe('urgency color-coding', () => {
    it('shows "expiring" urgency for 0 turns remaining (turn-based)', () => {
      const condition = makeCondition({
        expiresAt: { type: 'turn', turnsRemaining: 0 },
      });

      const { container } = render(
        <ConditionBadge condition={condition} currentRound={5} />
      );

      // Should have red styling and pulse animation
      const badge = container.firstElementChild!;
      expect(badge.className).toContain('border-red-500');
      expect(badge.className).toContain('animate-pulse');
    });

    it('shows "low" urgency for 1-2 turns remaining', () => {
      const condition = makeCondition({
        expiresAt: { type: 'turn', turnsRemaining: 2 },
      });

      const { container } = render(
        <ConditionBadge condition={condition} currentRound={3} />
      );

      const badge = container.firstElementChild!;
      expect(badge.className).toContain('border-orange-500');
      expect(badge.className).not.toContain('animate-pulse');
    });

    it('shows "normal" urgency for 3+ turns remaining', () => {
      const condition = makeCondition({
        expiresAt: { type: 'turn', turnsRemaining: 5 },
      });

      const { container } = render(
        <ConditionBadge condition={condition} currentRound={1} />
      );

      const badge = container.firstElementChild!;
      expect(badge.className).toContain('border-purple-700');
    });

    it('shows "none" urgency for permanent conditions (no expiresAt)', () => {
      const condition = makeCondition({ expiresAt: null });

      const { container } = render(
        <ConditionBadge condition={condition} currentRound={1} />
      );

      const badge = container.firstElementChild!;
      expect(badge.className).toContain('border-purple-700');
      expect(badge.className).not.toContain('animate-pulse');
    });

    it('calculates round-based remaining correctly', () => {
      const condition = makeCondition({
        expiresAt: { type: 'round', round: 7 },
      });

      // currentRound=5, expires at round 7 → 2 remaining → "low" urgency
      const { container } = render(
        <ConditionBadge condition={condition} currentRound={5} />
      );

      const badge = container.firstElementChild!;
      expect(badge.className).toContain('border-orange-500');
    });

    it('treats endOfCombat as no urgency', () => {
      const condition = makeCondition({
        expiresAt: { type: 'endOfCombat' },
      });

      const { container } = render(
        <ConditionBadge condition={condition} currentRound={10} />
      );

      const badge = container.firstElementChild!;
      expect(badge.className).toContain('border-purple-700');
    });
  });

  describe('countdown text', () => {
    it('shows "expires now" for 0 remaining', () => {
      const condition = makeCondition({
        expiresAt: { type: 'turn', turnsRemaining: 0 },
      });

      render(<ConditionBadge condition={condition} currentRound={5} />);
      expect(screen.getByText('expires now')).toBeInTheDocument();
    });

    it('shows "1 turn left" for 1 turn remaining', () => {
      const condition = makeCondition({
        expiresAt: { type: 'turn', turnsRemaining: 1 },
      });

      render(<ConditionBadge condition={condition} currentRound={5} />);
      expect(screen.getByText('1 turn left')).toBeInTheDocument();
    });

    it('shows "2 rounds left" for 2 rounds remaining', () => {
      const condition = makeCondition({
        expiresAt: { type: 'round', round: 7 },
      });

      render(<ConditionBadge condition={condition} currentRound={5} />);
      expect(screen.getByText('2 rounds left')).toBeInTheDocument();
    });

    it('shows parenthesized duration for normal urgency', () => {
      const condition = makeCondition({
        expiresAt: { type: 'turn', turnsRemaining: 5 },
      });

      render(<ConditionBadge condition={condition} currentRound={1} />);
      // Normal urgency wraps in parens — uses formatConditionDuration fallback
      expect(screen.getByText('(5 turns left)')).toBeInTheDocument();
    });

    it('hides duration when showDuration is false', () => {
      const condition = makeCondition({
        expiresAt: { type: 'turn', turnsRemaining: 2 },
      });

      render(
        <ConditionBadge condition={condition} currentRound={1} showDuration={false} />
      );

      expect(screen.queryByText(/left/)).not.toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('calls onClick when the badge is clicked', () => {
      const onClick = vi.fn();
      const condition = makeCondition();

      render(<ConditionBadge condition={condition} onClick={onClick} />);

      fireEvent.click(screen.getByText('Stunned'));
      expect(onClick).toHaveBeenCalledWith(condition);
    });

    it('does not render remove button when onRemove is not provided', () => {
      render(<ConditionBadge condition={makeCondition()} />);

      expect(screen.queryByTitle('Remove Stunned')).not.toBeInTheDocument();
    });

    it('renders remove button when onRemove is provided', () => {
      const onRemove = vi.fn();
      render(<ConditionBadge condition={makeCondition()} onRemove={onRemove} />);

      expect(screen.getByTitle('Remove Stunned')).toBeInTheDocument();
    });

    it('calls onRemove when the X button is clicked', () => {
      const onRemove = vi.fn();
      const condition = makeCondition();

      render(<ConditionBadge condition={condition} onRemove={onRemove} />);

      fireEvent.click(screen.getByTitle('Remove Stunned'));
      expect(onRemove).toHaveBeenCalledWith(condition);
    });

    it('stops propagation on remove click (does not trigger onClick)', () => {
      const onClick = vi.fn();
      const onRemove = vi.fn();
      const condition = makeCondition();

      render(
        <ConditionBadge condition={condition} onClick={onClick} onRemove={onRemove} />
      );

      fireEvent.click(screen.getByTitle('Remove Stunned'));
      expect(onRemove).toHaveBeenCalledOnce();
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('compact mode', () => {
    it('applies compact styling when compact is true', () => {
      const { container } = render(
        <ConditionBadge condition={makeCondition()} compact={true} />
      );

      const badge = container.firstElementChild!;
      expect(badge.className).toContain('px-1.5');
      expect(badge.className).toContain('py-0.5');
    });

    it('applies normal styling when compact is false', () => {
      const { container } = render(
        <ConditionBadge condition={makeCondition()} compact={false} />
      );

      const badge = container.firstElementChild!;
      expect(badge.className).toContain('px-2');
      expect(badge.className).toContain('py-1');
    });
  });
});
