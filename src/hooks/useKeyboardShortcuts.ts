import { useEffect } from 'react';
import { useCampaignActions, useCampaignHistory } from '../state/campaignStore';
import { useToastOptional } from '../components/ui/Toast';

/** Module ids in Alt+1..N order — mirrors the rail order in UnifiedShell. */
export const SHORTCUT_MODULE_IDS = [
  'inventory',
  'downtime',
  'combat',
  'map',
  'manager',
  'rules',
  'changelog',
] as const;

export interface ShortcutDefinition {
  keys: string;
  description: string;
}

/** Displayed by KeyboardShortcutsModal; keep in sync with the handler below. */
export const SHORTCUT_LIST: ShortcutDefinition[] = [
  { keys: 'Ctrl+Z', description: 'Undo last change' },
  { keys: 'Ctrl+Shift+Z / Ctrl+Y', description: 'Redo' },
  { keys: 'Alt+1 … Alt+7', description: 'Switch module (Inventory, Downtime, Combat, Map, Manager, Rules, Changelog)' },
  { keys: '?', description: 'Show keyboard shortcuts' },
  { keys: 'Esc', description: 'Close dialogs' },
];

const isTypingTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
};

interface UseKeyboardShortcutsOptions {
  onToggleHelp: () => void;
}

/**
 * Global keyboard shortcuts (Phase 15c). Mounted once in UnifiedShell.
 * All shortcuts are suppressed while an input, textarea, select, or
 * contenteditable has focus, so native text-editing keys keep working.
 */
export function useKeyboardShortcuts({ onToggleHelp }: UseKeyboardShortcutsOptions) {
  const actions = useCampaignActions();
  const { undo, redo } = useCampaignHistory();
  const toastContext = useToastOptional();
  const addToast = toastContext?.addToast;

  useEffect(() => {
    const info = (message: string, duration?: number) =>
      addToast?.({ type: 'info', message, duration });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;

      const primary = event.ctrlKey || event.metaKey;

      if (primary && !event.altKey) {
        const key = event.key.toLowerCase();
        if (key === 'z') {
          event.preventDefault();
          if (event.shiftKey) {
            if (!redo()) info('Nothing to redo', 1800);
          } else {
            if (!undo()) info('Nothing to undo', 1800);
          }
          return;
        }
        if (key === 'y' && !event.shiftKey) {
          event.preventDefault();
          if (!redo()) info('Nothing to redo', 1800);
          return;
        }
        return;
      }

      if (event.altKey && !primary && !event.shiftKey) {
        const index = Number.parseInt(event.key, 10) - 1;
        if (index >= 0 && index < SHORTCUT_MODULE_IDS.length) {
          event.preventDefault();
          actions.setActiveModule(SHORTCUT_MODULE_IDS[index]);
        }
        return;
      }

      if (event.key === '?' && !primary && !event.altKey) {
        event.preventDefault();
        onToggleHelp();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [actions, undo, redo, addToast, onToggleHelp]);
}
