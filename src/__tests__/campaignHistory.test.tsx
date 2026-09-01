/**
 * Global undo/redo + keyboard shortcuts + notification bridge (Phase 15c).
 */
import '@testing-library/jest-dom';
import { useEffect, useRef, useState } from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { describe, expect, it, beforeEach } from 'vitest';
import {
  CampaignStoreProvider,
  useCampaignHistory,
  useCampaignSelector,
  useCampaignStore,
} from '../state/campaignStore';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { NotificationBridge } from '../components/ui/NotificationBridge';
import { ToastProvider, ToastContainer } from '../components/ui/Toast';
import { createActivityLogEntry } from '../utils/activityLogger';
import type { Character } from '../types/campaign';

type Actions = ReturnType<typeof useCampaignStore>['actions'];
type History = ReturnType<typeof useCampaignHistory>;

const captured: { actions: Actions | null; history: History | null } = {
  actions: null,
  history: null,
};

function Capture() {
  const { actions } = useCampaignStore();
  const history = useCampaignHistory();
  const actionsRef = useRef(actions);
  actionsRef.current = actions;
  captured.history = history;
  useEffect(() => {
    captured.actions = actionsRef.current;
  }, []);
  return null;
}

function StateProbe() {
  const characterCount = useCampaignSelector((s) => Object.keys(s.entities.characters).length);
  const activeModule = useCampaignSelector((s) => s.ui.activeModule);
  const timeDay = useCampaignSelector((s) => s.time.day);
  return (
    <div>
      <span data-testid="character-count">{characterCount}</span>
      <span data-testid="active-module">{activeModule}</span>
      <span data-testid="time-day">{timeDay}</span>
    </div>
  );
}

const makeCharacter = (i: number): Character => ({
  id: `char-${i}`,
  name: `Character ${i}`,
  work: { skills: {} },
});

const mountStore = (extra?: React.ReactNode) =>
  render(
    <CampaignStoreProvider>
      <Capture />
      <StateProbe />
      {extra}
    </CampaignStoreProvider>
  );

beforeEach(() => {
  captured.actions = null;
  captured.history = null;
});

describe('global undo/redo', () => {
  it('undoes and redoes a data action', () => {
    mountStore();
    expect(captured.history!.canUndo).toBe(false);
    const base = Number(screen.getByTestId('character-count').textContent);

    act(() => captured.actions!.addCharacter(makeCharacter(0)));
    expect(screen.getByTestId('character-count')).toHaveTextContent(String(base + 1));
    expect(captured.history!.canUndo).toBe(true);

    act(() => {
      captured.history!.undo();
    });
    expect(screen.getByTestId('character-count')).toHaveTextContent(String(base));
    expect(captured.history!.canRedo).toBe(true);

    act(() => {
      captured.history!.redo();
    });
    expect(screen.getByTestId('character-count')).toHaveTextContent(String(base + 1));
  });

  it('does not record view/navigation actions', () => {
    mountStore();
    act(() => {
      captured.actions!.setActiveModule('map');
      captured.actions!.selectCharacter(null);
      captured.actions!.setGmMode(true);
    });
    expect(captured.history!.canUndo).toBe(false);
  });

  it('preserves the current view while undoing data changes', () => {
    mountStore();
    const base = Number(screen.getByTestId('character-count').textContent);
    act(() => captured.actions!.addCharacter(makeCharacter(0)));
    act(() => captured.actions!.setActiveModule('manager'));

    act(() => {
      captured.history!.undo();
    });
    // Character add is undone, but the tab switch (made after) survives.
    expect(screen.getByTestId('character-count')).toHaveTextContent(String(base));
    expect(screen.getByTestId('active-module')).toHaveTextContent('manager');
  });

  it('drops a preserved selection when the restored state lacks the character', () => {
    function SelectionProbe() {
      const selected = useCampaignSelector((s) => s.ui.selectedCharacterId);
      return <span data-testid="selected-id">{selected ?? 'none'}</span>;
    }
    mountStore(<SelectionProbe />);
    act(() => captured.actions!.addCharacter(makeCharacter(0)));
    act(() => captured.actions!.selectCharacter('char-0'));
    expect(screen.getByTestId('selected-id')).toHaveTextContent('char-0');

    // Undo removes char-0 from the restored state — the stale selection must go too.
    act(() => {
      captured.history!.undo();
    });
    expect(screen.getByTestId('selected-id')).toHaveTextContent('none');
  });

  it('clears the redo stack on a new action', () => {
    mountStore();
    act(() => captured.actions!.addCharacter(makeCharacter(0)));
    act(() => {
      captured.history!.undo();
    });
    expect(captured.history!.canRedo).toBe(true);
    act(() => captured.actions!.addCharacter(makeCharacter(1)));
    expect(captured.history!.canRedo).toBe(false);
  });

  it('undoes advanceTime', () => {
    mountStore();
    const dayBefore = screen.getByTestId('time-day').textContent;
    act(() => captured.actions!.advanceTime());
    act(() => {
      captured.history!.undo();
    });
    expect(screen.getByTestId('time-day')).toHaveTextContent(dayBefore ?? '1');
  });
});

describe('keyboard shortcuts', () => {
  function ShortcutHost() {
    const [helpVisible, setHelpVisible] = useState(false);
    useKeyboardShortcuts({ onToggleHelp: () => setHelpVisible((v) => !v) });
    return helpVisible ? <div data-testid="help-overlay" /> : null;
  }

  const mountWithShortcuts = () =>
    render(
      <CampaignStoreProvider>
        <Capture />
        <StateProbe />
        <ShortcutHost />
      </CampaignStoreProvider>
    );

  it('Ctrl+Z undoes and Ctrl+Shift+Z redoes', () => {
    mountWithShortcuts();
    const base = Number(screen.getByTestId('character-count').textContent);
    act(() => captured.actions!.addCharacter(makeCharacter(0)));

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(screen.getByTestId('character-count')).toHaveTextContent(String(base));

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true, shiftKey: true });
    expect(screen.getByTestId('character-count')).toHaveTextContent(String(base + 1));
  });

  it('Alt+4 switches to the map module', () => {
    mountWithShortcuts();
    fireEvent.keyDown(window, { key: '4', altKey: true });
    expect(screen.getByTestId('active-module')).toHaveTextContent('map');
  });

  it('? toggles the help overlay', () => {
    mountWithShortcuts();
    fireEvent.keyDown(window, { key: '?' });
    expect(screen.getByTestId('help-overlay')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: '?' });
    expect(screen.queryByTestId('help-overlay')).not.toBeInTheDocument();
  });

  it('ignores shortcuts while typing in an input', () => {
    mountWithShortcuts();
    const base = Number(screen.getByTestId('character-count').textContent);
    act(() => captured.actions!.addCharacter(makeCharacter(0)));

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    fireEvent.keyDown(input, { key: 'z', ctrlKey: true });
    expect(screen.getByTestId('character-count')).toHaveTextContent(String(base + 1));
    input.remove();
  });
});

describe('notification bridge', () => {
  const mountWithBridge = () =>
    render(
      <ToastProvider>
        <CampaignStoreProvider>
          <Capture />
          <NotificationBridge />
        </CampaignStoreProvider>
        <ToastContainer />
      </ToastProvider>
    );

  it('toasts a completed activity log entry', () => {
    mountWithBridge();
    act(() => {
      captured.actions!.addLogEntry(
        createActivityLogEntry('gathering', 'session_completed', {
          message: 'Fishing trip complete: 3 trout landed',
        })
      );
    });
    expect(screen.getByText('Fishing trip complete: 3 trout landed')).toBeInTheDocument();
  });

  it('does not toast uninteresting or pre-existing entries', () => {
    mountWithBridge();
    act(() => {
      captured.actions!.addLogEntry(
        createActivityLogEntry('crafting', 'project_started', {
          message: 'Started forging a sword',
        })
      );
    });
    expect(screen.queryByText('Started forging a sword')).not.toBeInTheDocument();
  });

  it('hides gmOnly notifications when GM mode is off', () => {
    mountWithBridge();
    act(() => {
      captured.actions!.addLogEntry(
        createActivityLogEntry(
          'travel',
          'event_resolved',
          { message: 'Secret ambush resolved' },
          'gmOnly'
        )
      );
    });
    expect(screen.queryByText('Secret ambush resolved')).not.toBeInTheDocument();

    act(() => captured.actions!.setGmMode(true));
    act(() => {
      captured.actions!.addLogEntry(
        createActivityLogEntry(
          'travel',
          'event_resolved',
          { message: 'Visible ambush resolved' },
          'gmOnly'
        )
      );
    });
    expect(screen.getByText('Visible ambush resolved')).toBeInTheDocument();
  });
});
