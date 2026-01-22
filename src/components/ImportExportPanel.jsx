import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Download, Upload, Lock, Unlock, FileJson, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { exportUnlocked, exportLocked, importFile, downloadJSON, mergeGM } from '../utils/exportImport';

/**
 * Panel for importing and exporting GURPS Tool data with GM/Player separation.
 * Handles password-protected exports, validation, and state merging.
 */
export function ImportExportPanel({
  state,
  _gmMode,
  gmLockData,
  _setGmMode,
  setGmLockData,
  onImport,
  onShowGMLockModal
}) {
  const [exportPassword, setExportPassword] = useState('');
  const [exportPasswordConfirm, setExportPasswordConfirm] = useState('');
  const [showExportPassword, setShowExportPassword] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importStatus, setImportStatus] = useState(null); // { type: 'success'|'error'|'warning', message, warnings: [] }

  // Handle export unlocked (GM only)
  const handleExportUnlocked = () => {
    setExporting(true);
    try {
      const data = exportUnlocked(state);
      const filename = `gurps-export-unlocked-${new Date().toISOString().split('T')[0]}.json`;
      downloadJSON(data, filename);
      setImportStatus({
        type: 'success',
        message: 'Export successful! Unlocked file downloaded (GM use only).'
      });
    } catch (err) {
      setImportStatus({
        type: 'error',
        message: `Export failed: ${err.message}`
      });
    } finally {
      setExporting(false);
    }
  };

  // Handle export locked (player-safe)
  const handleExportLocked = async () => {
    if (!exportPassword) {
      setImportStatus({
        type: 'error',
        message: 'Please enter a password for locked export'
      });
      return;
    }

    if (exportPassword !== exportPasswordConfirm) {
      setImportStatus({
        type: 'error',
        message: 'Passwords do not match'
      });
      return;
    }

    if (exportPassword.length < 8) {
      setImportStatus({
        type: 'warning',
        message: 'Password is short (< 8 characters). Consider using a longer password.'
      });
    }

    setExporting(true);
    try {
      const data = await exportLocked(state, exportPassword);
      const filename = `gurps-export-locked-${new Date().toISOString().split('T')[0]}.json`;
      downloadJSON(data, filename);
      setImportStatus({
        type: 'success',
        message: 'Locked export successful! File is safe to share with players. GM content requires password to access.'
      });
      setExportPassword('');
      setExportPasswordConfirm('');
    } catch (err) {
      setImportStatus({
        type: 'error',
        message: `Export failed: ${err.message}`
      });
    } finally {
      setExporting(false);
    }
  };

  // Handle file selection for import
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const result = await importFile(text);

      if (!result.ok) {
        setImportStatus({
          type: 'error',
          message: result.error
        });
        return;
      }

      // Show warnings if any
      if (result.warnings && result.warnings.length > 0) {
        setImportStatus({
          type: 'warning',
          message: 'Import successful with warnings:',
          warnings: result.warnings
        });
      } else {
        setImportStatus({
          type: 'success',
          message: 'Import successful!'
        });
      }

      // Check if locked
      if (result.isLocked) {
        // Store gmLock for later unlock
        setGmLockData(result.data.gmLock);
        setImportStatus({
          type: 'success',
          message: 'Locked import successful! Public data loaded. Enable GM Mode and enter password to access GM content.',
          warnings: result.warnings
        });
        // Load public data only
        onImport(result.data.public);
      } else {
        // Unlocked - merge GM data if present
        const mergedState = result.data.gm
          ? mergeGM(result.data.public, result.data.gm)
          : result.data.public;
        onImport(mergedState);
        setGmLockData(null);
      }
    } catch (err) {
      setImportStatus({
        type: 'error',
        message: `Import failed: ${err.message}`
      });
    }

    // Reset file input
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-gray-100 mb-2">Import / Export Data</h3>
        <p className="text-sm text-gray-400">
          Export your data for backup or sharing. Import previously exported files.
        </p>
      </div>

      {/* Status message */}
      {importStatus && (
        <div
          className={`rounded-lg p-4 border flex gap-3 ${
            importStatus.type === 'success'
              ? 'bg-green-900 bg-opacity-30 border-green-700'
              : importStatus.type === 'warning'
              ? 'bg-yellow-900 bg-opacity-30 border-yellow-700'
              : 'bg-red-900 bg-opacity-30 border-red-700'
          }`}
        >
          {importStatus.type === 'success' && <CheckCircle className="text-green-400 flex-shrink-0 mt-0.5" size={20} />}
          {importStatus.type === 'warning' && <AlertTriangle className="text-yellow-400 flex-shrink-0 mt-0.5" size={20} />}
          {importStatus.type === 'error' && <XCircle className="text-red-400 flex-shrink-0 mt-0.5" size={20} />}
          <div className="flex-1">
            <p className={`font-semibold ${
              importStatus.type === 'success' ? 'text-green-200' :
              importStatus.type === 'warning' ? 'text-yellow-200' :
              'text-red-200'
            }`}>
              {importStatus.message}
            </p>
            {importStatus.warnings && importStatus.warnings.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm">
                {importStatus.warnings.map((w, i) => (
                  <li key={i} className="text-gray-300">• {w}</li>
                ))}
              </ul>
            )}
          </div>
          <button
            onClick={() => setImportStatus(null)}
            className="text-gray-400 hover:text-gray-200"
          >
            ×
          </button>
        </div>
      )}

      {/* GM Lock indicator */}
      {gmLockData && (
        <div className="bg-yellow-900 bg-opacity-30 border border-yellow-700 rounded-lg p-4 flex gap-3">
          <Lock className="text-yellow-400 flex-shrink-0 mt-0.5" size={20} />
          <div className="flex-1">
            <p className="font-semibold text-yellow-200 mb-1">GM Content is Locked</p>
            <p className="text-sm text-yellow-300">
              This imported data has encrypted GM content. Enable GM Mode to unlock it.
            </p>
          </div>
        </div>
      )}

      {/* Import Section */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-3">
        <h4 className="font-semibold text-gray-100 flex items-center gap-2">
          <Upload size={18} />
          Import Data
        </h4>
        <p className="text-sm text-gray-400">
          Load data from a previously exported JSON file. Supports both locked (player-safe) and unlocked (GM) exports.
        </p>
        <label className="block">
          <div className="cursor-pointer bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded transition inline-flex items-center gap-2">
            <FileJson size={18} />
            <span>Choose File to Import</span>
          </div>
          <input
            type="file"
            accept=".json,application/json"
            onChange={handleFileSelect}
            className="hidden"
          />
        </label>
      </div>

      {/* Export Section */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-4">
        <h4 className="font-semibold text-gray-100 flex items-center gap-2">
          <Download size={18} />
          Export Data
        </h4>

        {/* Unlocked Export (GM Only) */}
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <Unlock className="text-red-400 flex-shrink-0 mt-1" size={18} />
            <div className="flex-1">
              <p className="font-medium text-gray-200">Unlocked Export (GM Use Only)</p>
              <p className="text-sm text-gray-400 mt-1">
                All data in plaintext JSON. <strong className="text-red-400">Do NOT share with players</strong> - contains all GM secrets.
              </p>
            </div>
          </div>
          <button
            onClick={handleExportUnlocked}
            disabled={exporting}
            className="bg-red-700 hover:bg-red-600 text-white px-4 py-2 rounded transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Download size={16} />
            Export Unlocked (GM Only)
          </button>
        </div>

        <div className="border-t border-gray-700 pt-4">
          {/* Locked Export (Player-Safe) */}
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <Lock className="text-green-400 flex-shrink-0 mt-1" size={18} />
              <div className="flex-1">
                <p className="font-medium text-gray-200">Locked Export (Player-Safe)</p>
                <p className="text-sm text-gray-400 mt-1">
                  GM content is encrypted with a password. Safe to share with players. They can use the tool in Player Mode, and only you (with the password) can access GM features.
                </p>
              </div>
            </div>

            {/* Password inputs */}
            <div className="space-y-2">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showExportPassword ? 'text' : 'password'}
                    value={exportPassword}
                    onChange={(e) => setExportPassword(e.target.value)}
                    placeholder="Enter password (min 8 characters)"
                    className="w-full p-2 pr-16 bg-gray-700 border border-gray-600 rounded text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowExportPassword(!showExportPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-200"
                  >
                    {showExportPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Confirm Password
                </label>
                <input
                  type={showExportPassword ? 'text' : 'password'}
                  value={exportPasswordConfirm}
                  onChange={(e) => setExportPasswordConfirm(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>

            <button
              onClick={handleExportLocked}
              disabled={exporting || !exportPassword || exportPassword !== exportPasswordConfirm}
              className="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Lock size={16} />
              Export Locked (Player-Safe)
            </button>
          </div>
        </div>

        {/* Security disclaimer */}
        <div className="bg-gray-900 bg-opacity-50 border border-gray-700 rounded p-3 text-xs text-gray-400">
          <p className="font-semibold mb-1">Security Disclaimer:</p>
          <p>
            Password protection is a "casual lock" to prevent accidental viewing by players.
            It uses WebCrypto (AES-GCM + PBKDF2), but client-side encryption has limitations.
            Do not use this for protecting sensitive real-world information.
          </p>
        </div>
      </div>
    </div>
  );
}

ImportExportPanel.propTypes = {
  state: PropTypes.object.isRequired,
  _gmMode: PropTypes.bool.isRequired,
  gmLockData: PropTypes.object,
  _setGmMode: PropTypes.func.isRequired,
  setGmLockData: PropTypes.func.isRequired,
  onImport: PropTypes.func.isRequired,
  onShowGMLockModal: PropTypes.func.isRequired
};
