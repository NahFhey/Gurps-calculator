import { useState, KeyboardEvent } from 'react';
import { Lock, Unlock, AlertTriangle } from 'lucide-react';
import { Modal } from './ui/Modal';

interface GMLockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUnlock: (password: string) => void | Promise<void>;
  error?: string | null;
}

/**
 * Modal for entering password to unlock GM mode when gmLock is present.
 * Used when importing locked data and user wants to access GM features.
 */
export function GMLockModal({ isOpen, onClose, onUnlock, error }: GMLockModalProps) {
  const [password, setPassword] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const descId = 'gm-lock-modal-desc';
  const passwordId = 'gm-lock-modal-password';
  const errorId = 'gm-lock-modal-error';

  if (!isOpen) return null;

  const handleUnlock = async () => {
    if (!password) {
      return;
    }

    setIsUnlocking(true);
    try {
      await onUnlock(password);
      setPassword('');
    } catch {
      // Error will be displayed via error prop
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && password) {
      handleUnlock();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={(
        <span className="flex items-center gap-2">
            <Lock className="text-yellow-400" size={20} aria-hidden="true" />
            Enter GM Password
        </span>
      )}
      ariaDescribedby={descId}
      size="md"
      closeOnBackdrop={false}
      bodyClassName="p-4 space-y-4"
      footer={(
        <>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-surface-2 hover:bg-surface-3 text-fg-bright rounded transition"
            disabled={isUnlocking}
          >
            Cancel
          </button>
          <button
            onClick={handleUnlock}
            className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!password || isUnlocking}
          >
            <Unlock size={16} aria-hidden="true" />
            {isUnlocking ? 'Unlocking...' : 'Unlock GM Mode'}
          </button>
        </>
      )}
    >
          {/* Info message */}
          <div id={descId} className="bg-accent-900 bg-opacity-30 border border-accent-700 rounded p-3 flex gap-2">
            <AlertTriangle className="text-accent-400 flex-shrink-0 mt-0.5" size={18} aria-hidden="true" />
            <div className="text-sm text-accent-200">
              <p className="font-semibold mb-1">GM Mode is Password Protected</p>
              <p>This imported data has GM content encrypted. Enter the password to access:</p>
              <ul className="list-disc list-inside mt-1 ml-2 space-y-0.5">
                <li>Full hazard details</li>
                <li>Reagent secrets and notes</li>
                <li>Formula design information</li>
                <li>Batch GM observations</li>
              </ul>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div id={errorId} role="alert" className="bg-danger-900 bg-opacity-30 border border-danger-700 rounded p-3 flex gap-2">
              <AlertTriangle className="text-danger-400 flex-shrink-0 mt-0.5" size={18} aria-hidden="true" />
              <div className="text-sm text-danger-200">
                <p className="font-semibold">Unlock Failed</p>
                <p>{error}</p>
              </div>
            </div>
          )}

          {/* Password input */}
          <div>
            <label htmlFor={passwordId} className="block text-sm font-medium text-fg-secondary mb-1">
              Password
            </label>
            <div className="relative">
              <input
                id={passwordId}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter GM password"
                aria-invalid={error ? true : undefined}
                aria-errormessage={error ? errorId : undefined}
                className="w-full p-2 pr-10 bg-surface-2 border border-edge-strong rounded text-fg-bright placeholder-fg-faint focus:outline-none focus:ring-2 focus:ring-accent-500"
                disabled={isUnlocking}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-fg-muted hover:text-fg-primary"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {/* Security disclaimer */}
          <div className="text-xs text-fg-muted bg-surface-0 bg-opacity-50 rounded p-2">
            <p className="font-semibold mb-1">Security Note:</p>
            <p>
              This is a "casual lock" to prevent accidental viewing, not strong
              security against technical users. The encryption prevents players
              from easily accessing GM content, but should not be relied upon
              for protecting sensitive real-world information.
            </p>
          </div>
    </Modal>
  );
}
