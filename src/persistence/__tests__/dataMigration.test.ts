import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  checkMigrationNeeded,
  migrateToV2,
  rollbackMigration,
  cleanupLegacyData,
  ensureInventoryRecords,
} from '../dataMigration';
import { createCampaignState } from '../../state/campaignReducer';
import type { Character, Inventory } from '../../types/campaign';

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

// ============================================================================
// ensureInventoryRecords (schema 1.4.0, Phase 12a.5)
// ============================================================================

describe('ensureInventoryRecords', () => {
  const character = (id: string): Character =>
    ({ id, name: `char-${id}` }) as Character;

  const inventoryRecord = (id: string, overrides: Partial<Inventory> = {}): Inventory => ({
    id,
    ownerType: 'party',
    ownerId: null,
    currency: {},
    items: [],
    tools: [],
    materials: [],
    food: [],
    ...overrides,
  });

  it('creates a party record when none exists', () => {
    const state = createCampaignState();
    const next = ensureInventoryRecords(state);
    const party = Object.values(next.entities.inventories).find((i) => i.ownerType === 'party');
    expect(party).toBeDefined();
    expect(party?.ownerId).toBeNull();
  });

  it('creates a record per character lacking one', () => {
    const state = createCampaignState();
    // createCampaignState seeds party-tool sample characters; add ours on top
    state.entities.characters = {
      ...state.entities.characters,
      'c1': character('c1'),
      'c2': character('c2'),
    };
    const next = ensureInventoryRecords(state);
    const owners = new Set(
      Object.values(next.entities.inventories)
        .filter((i) => i.ownerType === 'character')
        .map((i) => i.ownerId)
    );
    // Every character — seeded and added — has a record
    for (const id of Object.keys(state.entities.characters)) {
      expect(owners.has(id)).toBe(true);
    }
  });

  it('preserves existing records and their contents', () => {
    const state = createCampaignState();
    state.entities.characters = { 'c1': character('c1') };
    state.entities.inventories = {
      party: inventoryRecord('party', {
        items: [{ id: 'rope-1', name: 'Rope', quantity: 1 }],
        currency: { gold: 50 },
      }),
      'c1': inventoryRecord('c1', { ownerType: 'character', ownerId: 'c1' }),
    };
    const next = ensureInventoryRecords(state);
    expect(next.entities.inventories['party'].items).toEqual([
      { id: 'rope-1', name: 'Rope', quantity: 1 },
    ]);
    expect(next.entities.inventories['party'].currency.gold).toBe(50);
    expect(Object.keys(next.entities.inventories)).toHaveLength(2);
  });

  it('is idempotent: second run returns the same state object', () => {
    const state = createCampaignState();
    state.entities.characters = { 'c1': character('c1') };
    const once = ensureInventoryRecords(state);
    const twice = ensureInventoryRecords(once);
    expect(twice).toBe(once); // unchanged input short-circuits
  });

  it('avoids id collisions when a character id is taken by another record', () => {
    const state = createCampaignState();
    state.entities.characters = { 'c1': character('c1') };
    // A record whose id equals the character id but is NOT their inventory
    state.entities.inventories = {
      'c1': inventoryRecord('c1', { ownerType: 'party', ownerId: null }),
    };
    const next = ensureInventoryRecords(state);
    const charInv = Object.values(next.entities.inventories).find(
      (i) => i.ownerType === 'character' && i.ownerId === 'c1'
    );
    expect(charInv).toBeDefined();
    expect(charInv?.id).toBe('inv-c1');
    // The pre-existing record is untouched
    expect(next.entities.inventories['c1'].ownerType).toBe('party');
  });
});
