import { useEffect } from 'react';
import { X, Keyboard } from 'lucide-react';
import { SHORTCUT_LIST } from '../../hooks/useKeyboardShortcuts';

interface KeyboardShortcutsModalProps {
  onClose: () => void;
}

/**
 * Overlay listing the global keyboard shortcuts (Phase 15c).
 * Opened with "?" or from wherever the shell decides to surface it.
 */
export function KeyboardShortcutsModal({ onClose }: KeyboardShortcutsModalProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
      data-testid="keyboard-shortcuts-modal"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        className="w-full max-w-md rounded-lg border border-gray-600 bg-gray-800 p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-100">
            <Keyboard className="h-5 w-5 text-gray-400" />
            <h2 className="text-lg font-semibold">Keyboard Shortcuts</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <ul className="space-y-2">
          {SHORTCUT_LIST.map((shortcut) => (
            <li key={shortcut.keys} className="flex items-start justify-between gap-4 text-sm">
              <span className="text-gray-300">{shortcut.description}</span>
              <kbd className="shrink-0 rounded border border-gray-600 bg-gray-900 px-2 py-0.5 font-mono text-xs text-gray-200">
                {shortcut.keys}
              </kbd>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default KeyboardShortcutsModal;
