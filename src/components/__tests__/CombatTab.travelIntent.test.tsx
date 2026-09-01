import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CombatTab } from '../CombatTab';

let pendingIntent: { kind: string; templateId: string | null; groupId: string } | null = {
  kind: 'encounter', templateId: null, groupId: 'g',
};

vi.mock('../../state/campaignStore', () => ({
  useCampaignStore: () => ({
    state: {
      ui: { pendingIntent },
      combat: { activeSession: null, rulesPreset: 'standard' },
    },
    actions: { setCombatRulesPreset: vi.fn() },
  }),
}));
vi.mock('../combat/CharacterLibrary', () => ({ default: () => <div>Library view</div> }));
vi.mock('../combat/EncounterSetup', () => ({ default: () => <div data-testid="encounter-setup">Setup view</div> }));
vi.mock('../combat/CombatTracker', () => ({ default: () => <div>Tracker view</div> }));
vi.mock('../combat/CombatHistory', () => ({ default: () => <div>History view</div> }));
vi.mock('../combat/CombatRulesSettings', () => ({ default: () => <div>Settings view</div> }));

describe('CombatTab travel encounter intent', () => {
  it('forces Encounter Setup while there is no active combat', () => {
    pendingIntent = { kind: 'encounter', templateId: null, groupId: 'g' };
    render(<CombatTab />);
    expect(screen.getByTestId('encounter-setup')).toBeInTheDocument();
    expect(screen.queryByText('Library view')).not.toBeInTheDocument();
  });

  it('stays on Encounter Setup after the intent is consumed and cleared', () => {
    pendingIntent = { kind: 'encounter', templateId: null, groupId: 'g' };
    const { rerender } = render(<CombatTab />);
    expect(screen.getByTestId('encounter-setup')).toBeInTheDocument();
    // EncounterSetup consumes the intent on mount; the view must not snap back.
    pendingIntent = null;
    rerender(<CombatTab />);
    expect(screen.getByTestId('encounter-setup')).toBeInTheDocument();
    expect(screen.queryByText('Library view')).not.toBeInTheDocument();
  });
});
