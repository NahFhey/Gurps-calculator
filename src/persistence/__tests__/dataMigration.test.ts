import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  checkMigrationNeeded,
  migrateToV2,
  rollbackMigration,
  cleanupLegacyData,
} from '../dataMigration';

// ============================================================================
// In-memory mock for window.storage
// ============================================================================

type StorageGetResult = { value: string } | null;

interface MockStorageOptions {
  /** If true, get/set/remove throw instead of resolving. */
  failing?: boolean;
}

function installMockStorage(
  initial: Record<string, unknown> = {},
  options: MockStorageOptions = {}
): { store: Map<string, unknown>; uninstall: () => void } {
  const store = new Map<string, unknown>(Object.entries(initial));
  const originalStorage = window.storage;

  window.storage = {
    async get(key: string): Promise<StorageGetResult> {
      if (options.failing) throw new Error('storage.get failed');
      if (!store.has(key)) return null;
      return store.get(key) as StorageGetResult;
    },
    async set(key: string, value: string): Promise<void> {
      if (options.failing) throw new Error('storage.set failed');
      store.set(key, value);
    },
    async remove(key: string): Promise<void> {
      if (options.failing) throw new Error('storage.remove failed');
      store.delete(key);
    },
    async clear(): Promise<void> {
      store.clear();
    },
    async keys(): Promise<string[]> {
      return Array.from(store.keys());
    },
  };

  return {
    store,
    uninstall: () => {
      window.storage = originalStorage;
    },
  };
}

function uninstallStorage(): void {
  // Force-delete the property so the `if (!window?.storage?.get)` guard returns false.
  (window as unknown as { storage?: unknown }).storage = undefined;
}

// ============================================================================
// Suppress console noise during tests (the migration logs verbosely).
// ============================================================================

let logSpy: ReturnType<typeof vi.spyOn>;
let warnSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;
let originalStorage: Window['storage'];

beforeEach(() => {
  originalStorage = window.storage;
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  logSpy.mockRestore();
  warnSpy.mockRestore();
  errorSpy.mockRestore();
  window.storage = originalStorage;
});

// ============================================================================
// checkMigrationNeeded
// ============================================================================

describe('checkMigrationNeeded', () => {
  it('returns false when window.storage is unavailable', async () => {
    uninstallStorage();
    await expect(checkMigrationNeeded()).resolves.toBe(false);
  });

  it('returns false when campaignState already exists', async () => {
    installMockStorage({ campaignState: { value: '{}' } });
    await expect(checkMigrationNeeded()).resolves.toBe(false);
  });

  it('returns true when legacy data exists and no campaignState present', async () => {
    installMockStorage({ materials: { value: '[]' } });
    await expect(checkMigrationNeeded()).resolves.toBe(true);
  });

  it('returns false when neither legacy data nor campaignState exist', async () => {
    installMockStorage({});
    await expect(checkMigrationNeeded()).resolves.toBe(false);
  });

  it('returns false when storage.get throws', async () => {
    installMockStorage({}, { failing: true });
    await expect(checkMigrationNeeded()).resolves.toBe(false);
  });
});

// ============================================================================
// migrateToV2
// ============================================================================

describe('migrateToV2', () => {
  it('returns null when window.storage is unavailable', async () => {
    uninstallStorage();
    await expect(migrateToV2()).resolves.toBeNull();
  });

  it('completes migration and writes the new campaignState key on a fresh empty store', async () => {
    const { store } = installMockStorage({});
    const result = await migrateToV2();

    expect(result).not.toBeNull();
    // Should have written both the new state and a backup
    expect(store.has('campaignState')).toBe(true);
    expect(store.has('campaignState_backup_v1')).toBe(true);
  });

  it('returns null when storage operations throw mid-migration', async () => {
    installMockStorage({}, { failing: true });
    const result = await migrateToV2();
    expect(result).toBeNull();
  });
});

// ============================================================================
// rollbackMigration
// ============================================================================

describe('rollbackMigration', () => {
  it('returns false when window.storage is unavailable', async () => {
    uninstallStorage();
    await expect(rollbackMigration()).resolves.toBe(false);
  });

  it('returns false when no backup exists', async () => {
    installMockStorage({});
    await expect(rollbackMigration()).resolves.toBe(false);
  });

  it('restores all legacy keys from a backup and removes the new campaignState key', async () => {
    const backup = {
      timestamp: Date.now(),
      version: '1.0.0',
      data: {
        materials: [{ id: 'm1', name: 'iron' }],
        currentDay: 5,
      },
    };
    const { store } = installMockStorage({
      campaignState_backup_v1: backup,
      campaignState: 'something',
    });

    const result = await rollbackMigration();

    expect(result).toBe(true);
    expect(store.has('campaignState')).toBe(false);
    // Restored values are JSON-stringified by rollback before being written back.
    expect(store.get('materials')).toBe(JSON.stringify(backup.data.materials));
    expect(store.get('currentDay')).toBe(JSON.stringify(backup.data.currentDay));
  });

  it('returns false when the stored backup is not an object with a data field', async () => {
    installMockStorage({ campaignState_backup_v1: 'not-an-object' });
    await expect(rollbackMigration()).resolves.toBe(false);
  });
});

// ============================================================================
// cleanupLegacyData
// ============================================================================

describe('cleanupLegacyData', () => {
  it('returns early when window.storage is unavailable', async () => {
    uninstallStorage();
    // Should not throw — function logs and returns void.
    await expect(cleanupLegacyData()).resolves.toBeUndefined();
  });

  it('removes legacy keys without touching the new campaignState key', async () => {
    const { store } = installMockStorage({
      materials: { value: '[]' },
      foods: { value: '[]' },
      currentDay: { value: '3' },
      campaignState: { value: '{}' },
    });

    await cleanupLegacyData();

    expect(store.has('materials')).toBe(false);
    expect(store.has('foods')).toBe(false);
    expect(store.has('currentDay')).toBe(false);
    // The new key is not part of LEGACY_KEYS, so it must remain.
    expect(store.has('campaignState')).toBe(true);
  });

  it('continues after individual remove failures and does not throw', async () => {
    // Install storage whose remove always throws; cleanup should swallow per-key errors.
    installMockStorage({ materials: { value: '[]' } }, { failing: true });
    await expect(cleanupLegacyData()).resolves.toBeUndefined();
  });
});
