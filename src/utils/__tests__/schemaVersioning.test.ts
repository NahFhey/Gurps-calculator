/**
 * @fileoverview Test suite for schema versioning system
 * 
 * Tests migration paths, data transformations, and version compatibility
 * across all supported schema versions.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  CURRENT_SCHEMA_VERSION,
  compareVersions,
  getMigrationPath,
  getMigrationHistory,
  logMigration,
  MIGRATION_HISTORY_KEY,
  SCHEMA_METADATA
} from '../schemaVersioning';
import {
  migrateData,
  validateDataForVersion
} from '../dataMigrations';

type MigratedCondition = Record<string, unknown> & {
  conditionId?: string;
  revealed?: string;
};

type MigratedParticipant = Record<string, unknown> & {
  conditions: MigratedCondition[];
};

function assertMigratedCombat(
  data: Record<string, unknown>
): asserts data is Record<string, unknown> & {
  combatActive: Record<string, unknown> & { participants: MigratedParticipant[] };
} {
  if (
    !data.combatActive
    || typeof data.combatActive !== 'object'
    || !('participants' in data.combatActive)
    || !Array.isArray(data.combatActive.participants)
  ) {
    throw new Error('Expected migrated combat participants');
  }

  for (const participant of data.combatActive.participants) {
    if (
      !participant
      || typeof participant !== 'object'
      || !('conditions' in participant)
      || !Array.isArray(participant.conditions)
    ) {
      throw new Error('Expected migrated participant conditions');
    }
  }
}

function assertArrayProperty<Key extends string>(
  data: Record<string, unknown>,
  key: Key
): asserts data is Record<string, unknown> & Record<Key, unknown[]> {
  if (!Array.isArray(data[key])) {
    throw new Error(`Expected ${key} to be an array`);
  }
}

describe('Schema Versioning System', () => {
  describe('Version Constants', () => {
    it('should have current schema version defined', () => {
      expect(CURRENT_SCHEMA_VERSION).toBe('1.5.7');
    });

    it('should have metadata for all supported versions', () => {
      expect(SCHEMA_METADATA['1.0.0']).toBeDefined();
      expect(SCHEMA_METADATA['1.1.0']).toBeDefined();
      expect(SCHEMA_METADATA['1.2.0']).toBeDefined();
      expect(SCHEMA_METADATA['1.3.0']).toBeDefined();
      expect(SCHEMA_METADATA['1.4.0']).toBeDefined();
      expect(SCHEMA_METADATA['1.5.0']).toBeDefined();
      expect(SCHEMA_METADATA['1.5.1']).toBeDefined();
      expect(SCHEMA_METADATA['1.5.3']).toBeDefined();
      expect(SCHEMA_METADATA['1.5.5']).toBeDefined();
      expect(SCHEMA_METADATA['1.5.6']).toBeDefined();
    });

    it('should include features list in metadata', () => {
      Object.values(SCHEMA_METADATA).forEach(meta => {
        expect(Array.isArray(meta.features)).toBe(true);
        expect(meta.features.length).toBeGreaterThan(0);
      });
    });
  });

  describe('compareVersions()', () => {
    it('should return -1 when first version is less', () => {
      expect(compareVersions('1.0.0', '1.1.0')).toBe(-1);
      expect(compareVersions('1.0.0', '1.3.0')).toBe(-1);
      expect(compareVersions('1.2.0', '1.3.0')).toBe(-1);
    });

    it('should return 0 when versions are equal', () => {
      expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
      expect(compareVersions('1.3.0', '1.3.0')).toBe(0);
    });

    it('should return 1 when first version is greater', () => {
      expect(compareVersions('1.3.0', '1.0.0')).toBe(1);
      expect(compareVersions('1.2.0', '1.0.0')).toBe(1);
    });

    it('should handle patch versions correctly', () => {
      expect(compareVersions('1.0.0', '1.0.1')).toBe(-1);
      expect(compareVersions('1.0.1', '1.0.0')).toBe(1);
    });
  });

  describe('getMigrationPath()', () => {
    it('should return empty array if no migration needed', () => {
      const path = getMigrationPath('1.3.0', '1.3.0');
      expect(path).toEqual([]);
    });

    it('should return empty array if source is newer', () => {
      const path = getMigrationPath('1.3.0', '1.0.0');
      expect(path).toEqual([]);
    });

    it('should return correct path for 1.0.0 to 1.3.0', () => {
      const path = getMigrationPath('1.0.0', '1.3.0');
      expect(path).toEqual(['1.1.0', '1.2.0', '1.3.0']);
    });

    it('should return correct path for 1.1.0 to 1.3.0', () => {
      const path = getMigrationPath('1.1.0', '1.3.0');
      expect(path).toEqual(['1.2.0', '1.3.0']);
    });

    it('should return single-step path when needed', () => {
      const path = getMigrationPath('1.2.0', '1.3.0');
      expect(path).toEqual(['1.3.0']);
    });
  });

  describe('migrateData()', () => {
    it('should add alchemy fields when migrating from 1.0.0 to 1.1.0', () => {
      const v1_0_data = {
        materials: [],
        foods: [],
        recipes: []
      };

      const result = migrateData(v1_0_data, '1.0.0', '1.1.0');

      expect(Array.isArray(result.alchemyReagents)).toBe(true);
      expect(Array.isArray(result.alchemyFormulas)).toBe(true);
      expect(Array.isArray(result.alchemyBatches)).toBe(true);
      expect(Array.isArray(result.alchemyLabs)).toBe(true);
      expect(result.alchemySettings).toBeDefined();
      expect(result.effectFamilyMap).toBeDefined();
    });

    it('should add combat fields when migrating from 1.1.0 to 1.2.0', () => {
      const v1_1_data = {
        materials: [],
        alchemyReagents: []
      };

      const result = migrateData(v1_1_data, '1.1.0', '1.2.0');

      expect(result.combatActive).toBeNull();
      expect(Array.isArray(result.combatHistory)).toBe(true);
      expect(typeof result.gmMode).toBe('boolean');
    });

    it('should add gathering fields when migrating from 1.2.0 to 1.3.0', () => {
      const v1_2_data = {
        combatActive: null,
        gmMode: false
      };

      const result = migrateData(v1_2_data, '1.2.0', '1.3.0');

      expect(Array.isArray(result.gatheringSpecies)).toBe(true);
      expect(Array.isArray(result.gatheringSessions)).toBe(true);
      expect(typeof result.currentDay).toBe('number');
      expect(result.currentDay).toBe(1);
    });

    it('should add inventories when migrating from 1.3.0 to 1.4.0', () => {
      const v1_3_data = {
        combatActive: null,
        currentDay: 4
      };

      const result = migrateData(v1_3_data, '1.3.0', '1.4.0');

      expect(result.inventories).toEqual({});
      expect(result.currentDay).toBe(4);
      expect(result.schemaVersion).toBe('1.4.0');
    });

    it('should preserve existing inventories when migrating to 1.4.0', () => {
      const v1_3_data = {
        currentDay: 4,
        inventories: { party: { id: 'party', ownerType: 'party' } }
      };

      const result = migrateData(v1_3_data, '1.3.0', '1.4.0');

      expect(result.inventories).toEqual({ party: { id: 'party', ownerType: 'party' } });
    });

    it('should fold combat participant booleans into conditions when migrating from 1.4.0 to 1.5.0', () => {
      const v1_4_data = {
        currentDay: 4,
        combatActive: {
          id: 'combat-1',
          participants: [
            {
              instanceId: 'p1',
              isStunned: true,
              conditions: [
                { instanceId: 'c1', conditionId: 'poisoned', label: 'Poisoned' }
              ]
            }
          ]
        }
      };

      const result = migrateData(v1_4_data, '1.4.0', '1.5.0');
      assertMigratedCombat(result);
      const participant = result.combatActive.participants[0];

      expect(result.schemaVersion).toBe('1.5.0');
      expect('isStunned' in participant).toBe(false);
      expect(participant.conditions.some(c => c.conditionId === 'stunned')).toBe(true);
      // Pre-existing instance gets its eye state backfilled from the catalog
      const poisoned = participant.conditions.find(c => c.conditionId === 'poisoned');
      if (!poisoned) {
        throw new Error('Expected pre-existing poisoned condition');
      }
      expect(poisoned.revealed).toBe('closed');
    });

    it('should pass through 1.5.0 migration when no combat is active', () => {
      const v1_4_data = { currentDay: 4, combatActive: null };
      const result = migrateData(v1_4_data, '1.4.0', '1.5.0');
      expect(result.combatActive).toBeNull();
      expect(result.schemaVersion).toBe('1.5.0');
    });

    it('should backfill combat character categories when migrating from 1.5.0 to 1.5.1', () => {
      const v1_5_data = {
        currentDay: 4,
        combatCharacters: [
          { id: 'c1', name: 'Manual Enemy', isNPC: true },
          { id: 'c2', name: 'Manual PC', isNPC: false },
          { id: 'c3', name: 'Already Tagged', category: 'ally', isNPC: false }
        ],
        combatTombstones: [
          { id: 't1', name: 'Fallen Foe', isNPC: true }
        ]
      };

      const result = migrateData(v1_5_data, '1.5.0', '1.5.1');
      assertArrayProperty(result, 'combatCharacters');
      assertArrayProperty(result, 'combatTombstones');
      const [c1, c2, c3] = result.combatCharacters;

      expect(result.schemaVersion).toBe('1.5.1');
      expect(c1).toMatchObject({ category: 'enemy', isNPC: true });
      expect(c2).toMatchObject({ category: 'player', isNPC: false });
      // A valid pre-existing category wins over isNPC, and isNPC is recomputed
      expect(c3).toMatchObject({ category: 'ally', isNPC: true });
      expect(result.combatTombstones[0]).toMatchObject({ category: 'enemy', isNPC: true });
    });

    it('should pass through 1.5.1 migration when no combat characters exist', () => {
      const v1_5_data = { currentDay: 4 };
      const result = migrateData(v1_5_data, '1.5.0', '1.5.1');
      expect(result.schemaVersion).toBe('1.5.1');
      expect('combatCharacters' in result).toBe(false);
    });

    it('should perform full migration from 1.0.0 to 1.3.0', () => {
      const v1_0_data = {
        materials: [],
        foods: [],
        recipes: [],
        crafts: []
      };

      const result = migrateData(v1_0_data, '1.0.0', '1.3.0');

      // Check v1.1 fields
      expect(Array.isArray(result.alchemyReagents)).toBe(true);
      expect(Array.isArray(result.alchemyFormulas)).toBe(true);

      // Check v1.2 fields
      expect(result.combatActive).toBeNull();
      expect(Array.isArray(result.combatHistory)).toBe(true);

      // Check v1.3 fields
      expect(Array.isArray(result.gatheringSessions)).toBe(true);
      expect(result.currentDay).toBe(1);

      // Verify schema version updated
      expect(result.schemaVersion).toBe('1.3.0');
    });

    it('should preserve existing data during migration', () => {
      const v1_0_data = {
        materials: [
          { id: '1', name: 'Iron', quantity: 100 }
        ],
        foods: [
          { id: '2', name: 'Bread', quantity: 50 }
        ]
      };

      const result = migrateData(v1_0_data, '1.0.0', '1.3.0');

      expect(result.materials).toEqual(v1_0_data.materials);
      expect(result.foods).toEqual(v1_0_data.foods);
    });

    it('should return data at target version without change if no migration needed', () => {
      const v1_3_data = {
        materials: [],
        currentDay: 1,
        gatheringSessions: []
      };

      const result = migrateData(v1_3_data, '1.3.0', '1.3.0');

      expect(result.materials).toEqual(v1_3_data.materials);
      expect(result.currentDay).toBe(1);
      expect(result.schemaVersion).toBe('1.3.0');
    });
  });

  describe('validateDataForVersion()', () => {
    it('should validate v1.3.0 data correctly', () => {
      const validData = {
        materials: [],
        foods: [],
        recipes: [],
        alchemyReagents: [],
        alchemyFormulas: [],
        combatActive: null,
        gatheringSessions: [],
        currentDay: 1
      };

      const validation = validateDataForVersion(validData, '1.3.0');

      expect(validation.valid).toBe(true);
      expect(validation.issues).toEqual([]);
    });

    it('should detect missing required fields', () => {
      const invalidData = {
        materials: [],
        foods: [],
        recipes: [],
        // Missing alchemy, combat, gathering fields
      };

      const validation = validateDataForVersion(invalidData, '1.3.0');

      expect(validation.valid).toBe(false);
      expect(validation.issues.length).toBeGreaterThan(0);
    });

    it('should detect invalid data types', () => {
      const invalidData = {
        materials: [],
        alchemyReagents: 'not an array', // Should be array
        gatheringSessions: null,           // Should be array
        currentDay: '1'                    // Should be number
      };

      const validation = validateDataForVersion(invalidData, '1.3.0');

      expect(validation.valid).toBe(false);
      expect(validation.issues.length).toBeGreaterThan(0);
    });

    it('should validate v1.0.0 subset correctly', () => {
      const v1_0_data = {
        materials: [],
        foods: [],
        recipes: []
      };

      const validation = validateDataForVersion(v1_0_data, '1.0.0');

      // v1.0.0 has less strict requirements
      expect(validation.valid || validation.issues.length <= 3).toBe(true);
    });
  });

  describe('Full Migration Workflow', () => {
    it('should handle complete migration lifecycle', () => {
      // Start with v1.0 data
      const originalData = {
        materials: [{ id: '1', name: 'Wood', quantity: 100 }],
        foods: [{ id: '2', name: 'Apple', quantity: 50 }],
        recipes: []
      };

      // Migrate to latest
      const migratedData = migrateData(
        originalData,
        '1.0.0',
        '1.3.0'
      );
      assertArrayProperty(migratedData, 'materials');
      assertArrayProperty(migratedData, 'foods');

      // Verify migration succeeded
      expect(migratedData.schemaVersion).toBe('1.3.0');

      // Verify original data preserved
      expect(migratedData.materials[0]).toEqual(originalData.materials[0]);
      expect(migratedData.foods[0]).toEqual(originalData.foods[0]);

      // Verify new fields added
      expect(Array.isArray(migratedData.alchemyReagents)).toBe(true);
      expect(Array.isArray(migratedData.gatheringSessions)).toBe(true);

      // Validate final data
      const validation = validateDataForVersion(migratedData, '1.3.0');
      expect(validation.valid).toBe(true);
    });
  });

  describe('Migration with Empty Data', () => {
    it('should handle migration of completely empty state', () => {
      const emptyData = {};

      const result = migrateData(emptyData, '1.0.0', '1.3.0');

      expect(result.schemaVersion).toBe('1.3.0');
      expect(Array.isArray(result.materials) || result.materials === undefined).toBe(true);
      expect(Array.isArray(result.alchemyReagents)).toBe(true);
      expect(Array.isArray(result.gatheringSessions)).toBe(true);
    });
  });

  describe('getMigrationHistory() malformed input', () => {
    beforeEach(() => {
      localStorage.removeItem(MIGRATION_HISTORY_KEY);
    });

    afterEach(() => {
      localStorage.removeItem(MIGRATION_HISTORY_KEY);
    });

    it('returns empty array when stored history is malformed JSON', () => {
      localStorage.setItem(MIGRATION_HISTORY_KEY, '{not valid json');
      expect(() => getMigrationHistory()).not.toThrow();
      expect(getMigrationHistory()).toEqual([]);
    });

    it('returns empty array when storage key is absent', () => {
      expect(getMigrationHistory()).toEqual([]);
    });

    it('logMigration recovers when prior history is malformed', () => {
      localStorage.setItem(MIGRATION_HISTORY_KEY, 'garbage');
      expect(() => logMigration('1.0.0', '1.1.0')).not.toThrow();
    });
  });

  describe('Backward Compatibility', () => {
    it('should mark data as needing migration if older version', () => {
      expect(compareVersions('1.0.0', '1.3.0')).toBeLessThan(0);
      expect(compareVersions('1.1.0', '1.3.0')).toBeLessThan(0);
      expect(compareVersions('1.2.0', '1.3.0')).toBeLessThan(0);
    });

    it('should have upgrade path for all old versions', () => {
      const oldVersions = ['1.0.0', '1.1.0', '1.2.0', '1.3.0', '1.4.0', '1.5.0', '1.5.1'];

      oldVersions.forEach(version => {
        const path = getMigrationPath(version, CURRENT_SCHEMA_VERSION);
        expect(path.length).toBeGreaterThan(0);
        expect(path[path.length - 1]).toBe(CURRENT_SCHEMA_VERSION);
      });
    });
  });
});
