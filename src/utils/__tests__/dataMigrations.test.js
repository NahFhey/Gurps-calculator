/**
 * @fileoverview Test suite for dataMigrations malformed-input safety
 *
 * Verifies that the three JSON.parse call sites in dataMigrations.js
 * (getLastBackup, restoreFromBackup, listBackups) recover gracefully
 * when localStorage holds malformed JSON.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getLastBackup,
  restoreFromBackup,
  listBackups
} from '../dataMigrations';

const ORIGINAL_KEYS = () => Object.keys(localStorage).filter(k => k.startsWith('backup_'));

function clearBackupKeys() {
  for (const key of ORIGINAL_KEYS()) {
    localStorage.removeItem(key);
  }
}

describe('dataMigrations malformed-input safety', () => {
  beforeEach(() => {
    clearBackupKeys();
  });

  afterEach(() => {
    clearBackupKeys();
  });

  describe('getLastBackup()', () => {
    it('returns null when stored backup is malformed JSON', () => {
      localStorage.setItem('backup_1.0.0_123', '{not valid json');
      expect(() => getLastBackup('1.0.0')).not.toThrow();
      expect(getLastBackup('1.0.0')).toBeNull();
    });

    it('returns null when no backup exists for the version', () => {
      expect(getLastBackup('9.9.9')).toBeNull();
    });

    it('returns parsed backup object for valid JSON', () => {
      const payload = { version: '1.0.0', timestamp: 'now', data: { foo: 1 } };
      localStorage.setItem('backup_1.0.0_456', JSON.stringify(payload));
      const result = getLastBackup('1.0.0');
      expect(result).toEqual(payload);
    });
  });

  describe('restoreFromBackup()', () => {
    it('returns null when stored backup is malformed JSON', () => {
      localStorage.setItem('backup_1.0.0_789', 'garbage');
      expect(() => restoreFromBackup('backup_1.0.0_789')).not.toThrow();
      expect(restoreFromBackup('backup_1.0.0_789')).toBeNull();
    });

    it('returns null when key does not exist', () => {
      expect(restoreFromBackup('nonexistent_key')).toBeNull();
    });

    it('returns inner data field for valid backup', () => {
      const data = { hello: 'world' };
      localStorage.setItem(
        'backup_1.0.0_111',
        JSON.stringify({ version: '1.0.0', timestamp: 't', data })
      );
      expect(restoreFromBackup('backup_1.0.0_111')).toEqual(data);
    });
  });

  describe('listBackups()', () => {
    it('skips malformed entries instead of throwing', () => {
      localStorage.setItem('backup_1.0.0_aaa', '{broken');
      localStorage.setItem(
        'backup_1.0.0_bbb',
        JSON.stringify({
          version: '1.0.0',
          timestamp: '2026-01-01T00:00:00Z',
          data: { ok: true }
        })
      );
      expect(() => listBackups()).not.toThrow();
      const result = listBackups();
      expect(result).toHaveLength(1);
      expect(result[0].version).toBe('1.0.0');
      expect(result[0].dataKeys).toContain('ok');
    });

    it('returns empty array when no backups exist', () => {
      expect(listBackups()).toEqual([]);
    });
  });
});
