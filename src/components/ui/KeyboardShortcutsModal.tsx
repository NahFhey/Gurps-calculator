import { Keyboard } from 'lucide-react';
import { SHORTCUT_LIST } from '../../hooks/useKeyboardShortcuts';
import { Modal } from './Modal';

interface KeyboardShortcutsModalProps {
  onClose: () => void;
}

/**
 * Overlay listing the global keyboard shortcuts (Phase 15c).
 * Opened with "?" or from wherever the shell decides to surface it.
 */
export function KeyboardShortcutsModal({ onClose }: KeyboardShortcutsModalProps) {
  return (
    <Modal
      isOpen
      onClose={onClose}
      title={(
        <span className="flex items-center gap-2">
          <Keyboard className="h-5 w-5 text-fg-muted" />
          Keyboard Shortcuts
        </span>
      )}
      size="md"
      bodyClassName="p-5"
    >
      <ul className="space-y-2">
        {SHORTCUT_LIST.map((shortcut) => (
          <li key={shortcut.keys} className="flex items-start justify-between gap-4 text-sm">
            <span className="text-fg-secondary">{shortcut.description}</span>
            <kbd className="shrink-0 rounded border border-edge-strong bg-surface-0 px-2 py-0.5 font-mono text-xs text-fg-primary">
              {shortcut.keys}
            </kbd>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

export default KeyboardShortcutsModal;
