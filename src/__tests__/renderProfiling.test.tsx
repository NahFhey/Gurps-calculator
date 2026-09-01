/**
 * Render profiling harness (Phase 15b).
 *
 * Measures how many times store consumers re-render for representative
 * dispatch sequences. Run with PROFILE_RENDERS=1 to print the counts:
 *
 *   PROFILE_RENDERS=1 npx vitest run src/__tests__/renderProfiling.test.tsx
 */
import '@testing-library/jest-dom';
import { Profiler, useEffect, useRef } from 'react';
import { render, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  CampaignStoreProvider,
  useCampaignActions,
  useCampaignSelector,
  useCampaignStore,
} from '../state/campaignStore';
import { UnifiedShell } from '../unified/UnifiedShell';
import type { Character } from '../types/campaign';

vi.mock('../net/SyncProvider', () => ({
  useSyncContext: () => ({
    status: 'offline' as const,
    role: null,
    sessionInfo: null,
    playerCount: 0,
    displayName: null,
    playerList: [],
    hostGame: vi.fn(),
    joinGame: vi.fn(),
    disconnect: vi.fn(),
  }),
  SyncProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const renderCounts: Record<string, number> = {};
const bump = (name: string) => {
  renderCounts[name] = (renderCounts[name] ?? 0) + 1;
};
const resetCounts = () => {
  for (const key of Object.keys(renderCounts)) delete renderCounts[key];
};
const report = (scenario: string) => {
  if (process.env.PROFILE_RENDERS) {
    console.log(`\n[render-profile] ${scenario}`);
    for (const [name, count] of Object.entries(renderCounts).sort()) {
      console.log(`  ${name}: ${count}`);
    }
  }
};

type Actions = ReturnType<typeof useCampaignStore>['actions'];
const captured: { actions: Actions | null } = { actions: null };

function Capture() {
  const { actions } = useCampaignStore();
  const ref = useRef(actions);
  ref.current = actions;
  useEffect(() => {
    captured.actions = ref.current;
  }, []);
  return null;
}

/** Consumes the whole store — the dominant pattern in the codebase today. */
function WholeStoreProbe({ name }: { name: string }) {
  useCampaignStore();
  bump(name);
  return null;
}

/** Only needs dispatch — must never re-render on state changes. */
function ActionsOnlyProbe({ name }: { name: string }) {
  const actions = useCampaignActions();
  void actions;
  bump(name);
  return null;
}

/** Reads a single character — must only re-render when that character changes. */
function CharacterProbe({ name, charId }: { name: string; charId: string }) {
  const character = useCampaignSelector((state) => state.entities.characters[charId]);
  void character;
  bump(name);
  return null;
}

const makeCharacter = (i: number): Character => ({
  id: `char-${i}`,
  name: `Character ${i}`,
  work: { skills: {} },
});

function seedCharacters(count: number) {
  act(() => {
    for (let i = 0; i < count; i++) {
      captured.actions!.addCharacter(makeCharacter(i));
    }
  });
}

describe('render profiling: probe components', () => {
  beforeEach(() => {
    resetCounts();
    captured.actions = null;
  });

  function mountProbes() {
    return render(
      <CampaignStoreProvider>
        <Capture />
        <WholeStoreProbe name="whole-store" />
        <ActionsOnlyProbe name="actions-only" />
        <CharacterProbe name="char-0-reader" charId="char-0" />
        <CharacterProbe name="char-1-reader" charId="char-1" />
      </CampaignStoreProvider>
    );
  }

  it('10 log entries: unrelated consumers should not re-render', () => {
    mountProbes();
    seedCharacters(2);
    resetCounts();

    // One act() per dispatch: models 10 separate user events (React batches
    // within a single act, which would hide the per-event render cost).
    for (let i = 0; i < 10; i++) {
      act(() => {
        captured.actions!.addLogEntry({
          id: `log-${i}`,
          timestamp: i,
          type: 'system',
          visibility: 'gmOnly',
          payload: {},
        });
      });
    }

    report('10x addLogEntry');
    expect(renderCounts['actions-only'] ?? 0).toBe(0);
    expect(renderCounts['char-0-reader'] ?? 0).toBe(0);
    expect(renderCounts['char-1-reader'] ?? 0).toBe(0);
    // Back-compat: whole-store consumers still re-render on every dispatch.
    expect(renderCounts['whole-store']).toBe(10);
  });

  it('single character update: only that character\'s reader re-renders', () => {
    mountProbes();
    seedCharacters(2);
    resetCounts();

    act(() => {
      captured.actions!.updateCharacter('char-0', { name: 'Renamed' });
    });

    report('1x updateCharacter(char-0)');
    expect(renderCounts['char-0-reader'] ?? 0).toBe(1);
    expect(renderCounts['char-1-reader'] ?? 0).toBe(0);
    expect(renderCounts['actions-only'] ?? 0).toBe(0);
  });

  it('advanceTime with 50 characters: actions-only consumers stay quiet', () => {
    mountProbes();
    seedCharacters(50);
    resetCounts();

    act(() => {
      captured.actions!.advanceTime();
    });

    report('1x advanceTime (50 characters)');
    expect(renderCounts['actions-only'] ?? 0).toBe(0);
  });
});

describe('render profiling: UnifiedShell', () => {
  beforeEach(() => {
    resetCounts();
    captured.actions = null;
  });

  it('counts shell commits during a burst of log entries', () => {
    let shellCommits = 0;
    const modules = [
      { id: 'inventory', label: 'Inventory', content: <div>Inventory Module</div> },
      { id: 'rules', label: 'Rules', content: <div>Rules Module</div> },
    ];

    render(
      <CampaignStoreProvider>
        <Capture />
        <Profiler id="shell" onRender={() => { shellCommits += 1; }}>
          <UnifiedShell modules={modules} />
        </Profiler>
      </CampaignStoreProvider>
    );
    seedCharacters(20);
    shellCommits = 0;

    for (let i = 0; i < 10; i++) {
      act(() => {
        captured.actions!.addLogEntry({
          id: `log-${i}`,
          timestamp: i,
          type: 'system',
          visibility: 'gmOnly',
          payload: {},
        });
      });
    }

    if (process.env.PROFILE_RENDERS) {
      console.log(`\n[render-profile] UnifiedShell commits during 10x addLogEntry: ${shellCommits}`);
    }
    // Log entries are unrelated to anything the shell renders.
    expect(shellCommits).toBe(0);
  });
});
