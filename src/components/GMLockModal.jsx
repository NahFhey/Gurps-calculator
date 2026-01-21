import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Lock, Unlock, X, AlertTriangle } from 'lucide-react';

/**
 * Modal for entering password to unlock GM mode when gmLock is present.
 * Used when importing locked data and user wants to access GM features.
 */
export function GMLockModal({ isOpen, onClose, onUnlock, error }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (!isOpen) return null;

  const handleUnlock = async () => {
    if (!password) {
      return;
    }

    setIsUnlocking(true);
    try {
      await onUnlock(password);
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      // Error will be displayed via error prop
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && password) {
      handleUnlock();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Lock className="text-yellow-400" size={20} />
            <h2 className="text-xl font-bold text-gray-100">Enter GM Password</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {/* Info message */}
          <div className="bg-blue-900 bg-opacity-30 border border-blue-700 rounded p-3 flex gap-2">
            <AlertTriangle className="text-blue-400 flex-shrink-0 mt-0.5" size={18} />
            <div className="text-sm text-blue-200">
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
            <div className="bg-red-900 bg-opacity-30 border border-red-700 rounded p-3 flex gap-2">
              <AlertTriangle className="text-red-400 flex-shrink-0 mt-0.5" size={18} />
              <div className="text-sm text-red-200">
                <p className="font-semibold">Unlock Failed</p>
                <p>{error}</p>
              </div>
            </div>
          )}

          {/* Password input */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter GM password"
                className="w-full p-2 pr-10 bg-gray-700 border border-gray-600 rounded text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isUnlocking}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {/* Security disclaimer */}
          <div className="text-xs text-gray-400 bg-gray-900 bg-opacity-50 rounded p-2">
            <p className="font-semibold mb-1">Security Note:</p>
            <p>
              This is a "casual lock" to prevent accidental viewing, not strong
              security against technical users. The encryption prevents players
              from easily accessing GM content, but should not be relied upon
              for protecting sensitive real-world information.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 justify-end p-4 border-t border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-100 rounded transition"
            disabled={isUnlocking}
          >
            Cancel
          </button>
          <button
            onClick={handleUnlock}
            className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!password || isUnlocking}
          >
            <Unlock size={16} />
            {isUnlocking ? 'Unlocking...' : 'Unlock GM Mode'}
          </button>
        </div>
      </div>
    </div>
  );
}

GMLockModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onUnlock: PropTypes.func.isRequired,
  error: PropTypes.string
};
