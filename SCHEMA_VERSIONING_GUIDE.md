# Schema Versioning Guide

## Overview

The GURPS Calculator implements semantic versioning for data schemas, enabling safe data migrations as features are added. This guide documents the versioning system, migration process, and how to add new schema versions.

## Current Schema Version

**Current Version:** `1.3.0`

```javascript
import { CURRENT_SCHEMA_VERSION } from './src/utils/schemaVersioning';
console.log(CURRENT_SCHEMA_VERSION); // '1.3.0'
```

## Version History

### v1.0.0 - Initial Release
**Features:**
- Inventory management (materials, foods, tools)
- Cooking system
- Crafting system with projects and templates
- Storage to localStorage

**Data Keys:**
```javascript
{
  materials: [],
  foods: [],
  recipes: [],
  crafts: [],
  foodTypes: [],
  materialTypes: [],
  workers: [],
  customTemplates: {},
  craftDesigns: []
}
```

### v1.1.0 - Alchemy System Addition
**New Features:**
- Alchemy reagent management
- Formula brewing system
- Batch tracking with concentration refinement
- Lab management
- Effect family mapping

**Added Data Keys:**
```javascript
{
  // ... v1.0 keys ...
  alchemyReagents: [],      // Reagent inventory
  alchemyFormulas: [],       // Formula library
  alchemyBatches: [],        // Active/completed batches
  alchemyLabs: [],           // Lab configurations
  alchemySettings: {         // Alchemy preferences
    defaultLabRating: 0,
    workBlockMinutes: 120,
    showObviousRoles: true
  },
  effectFamilyMap: {}        // Effect categorization
}
```

### v1.2.0 - Combat System Addition
**New Features:**
- Active combat tracking
- Detailed character combat sheets
- Condition management (Shock, HP, FP, MP status)
- Combat rules presets
- GM mode with data encryption
- Combat history and logging

**Added Data Keys:**
```javascript
{
  // ... v1.0-1.1 keys ...
  combatActive: null,           // Current combat session
  combatActiveHistory: null,    // Combat undo history
  combatHistory: [],            // Combat logs
  combatRulesPreset: 'standard', // Rules variant
  combatReveal: null,           // Condition/status reveal
  gmMode: false,                // GM mode flag
  gmLockData: null              // Encrypted GM data
}
```

### v1.3.0 - Gathering System Addition
**New Features:**
- Fishing and foraging management
- Species tracking and yields
- Gathering tools and environments
- Daily event logging
- Group session management

**Added Data Keys:**
```javascript
{
  // ... v1.0-1.2 keys ...
  gatheringSpecies: [],         // Fish/plant species
  gatheringTools: [],           // Gathering equipment
  gatheringTables: [],          // Yield tables
  gatheringEnvironments: [],    // Environment data
  gatheringSessions: [],        // Group sessions
  gatheringDailyEvents: {},     // Daily event log
  gatheringBait: [],            // Bait types
  gatheringCategories: [],      // Item categories
  gatheringItems: [],           // Gathered items
  currentDay: 1                 // Campaign day tracking
}
```

## Migration System

### How Migrations Work

When application state is loaded from localStorage:

1. **Version Detection**: Read `schemaVersion` from storage
2. **Version Comparison**: Compare stored version with `CURRENT_SCHEMA_VERSION`
3. **Path Calculation**: Determine migration steps needed (e.g., 1.0.0 → 1.1.0 → 1.2.0 → 1.3.0)
4. **Sequential Migration**: Apply each migration step in order
5. **Backup Creation**: Create timestamped backups before each step
6. **Validation**: Verify migrated data structure
7. **Version Update**: Save new schema version to storage

### Migration Flow Diagram

```
┌─────────────────────────┐
│  Load Data from Storage │
│  schemaVersion: 1.1.0   │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────────┐
│  Compare Versions           │
│  1.1.0 < 1.3.0 = Migration  │
└────────────┬────────────────┘
             │
             ▼
┌────────────────────────────────┐
│  Calculate Migration Path      │
│  [1.1.0→1.2.0, 1.2.0→1.3.0]   │
└────────────┬───────────────────┘
             │
             ▼
┌──────────────────────────┐
│  Create Backup v1.1.0    │
│  backup_1.1.0_1234567890 │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────────┐
│  Apply Migration 1.1.0→1.2.0 │
│  Add combat fields           │
└────────────┬─────────────────┘
             │
             ▼
┌──────────────────────────┐
│  Create Backup v1.2.0    │
│  backup_1.2.0_1234567891 │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────────┐
│  Apply Migration 1.2.0→1.3.0 │
│  Add gathering fields        │
└────────────┬─────────────────┘
             │
             ▼
┌─────────────────────────┐
│  Validate v1.3.0 Data   │
│  All required fields OK │
└────────────┬────────────┘
             │
             ▼
┌────────────────────────────┐
│  Save schemaVersion: 1.3.0 │
│  Complete!                 │
└────────────────────────────┘
```

## API Reference

### schemaVersioning.js

#### CURRENT_SCHEMA_VERSION
```javascript
export const CURRENT_SCHEMA_VERSION = '1.3.0';
```

#### SCHEMA_METADATA
Object documenting features for each version:
```javascript
export const SCHEMA_METADATA = {
  '1.0.0': {
    features: ['inventory', 'cooking', 'crafting'],
    addedAt: 'Initial release',
    breakingChanges: []
  },
  '1.1.0': {
    features: [..., 'alchemy_reagents', 'alchemy_formulas', ...],
    addedAt: 'Alchemy system added',
    breakingChanges: []
  },
  // ... etc
};
```

#### getStoredSchemaVersion()
```javascript
const version = getStoredSchemaVersion(); // '1.1.0'
```

#### saveSchemaVersion(version)
```javascript
saveSchemaVersion('1.3.0');
```

#### compareVersions(v1, v2)
Semantic version comparison:
```javascript
compareVersions('1.0.0', '1.1.0'); // -1 (v1 < v2)
compareVersions('1.3.0', '1.3.0'); // 0 (equal)
compareVersions('1.2.0', '1.1.0'); // 1 (v1 > v2)
```

#### getMigrationPath(fromVersion, toVersion)
```javascript
const path = getMigrationPath('1.0.0', '1.3.0');
// Result: ['1.1.0', '1.2.0', '1.3.0']
```

#### logMigration(fromVersion, toVersion, metadata)
```javascript
logMigration('1.1.0', '1.2.0', {
  success: true,
  dataKeys: ['combatActive', 'gmMode', ...]
});
```

### dataMigrations.js

#### migrateData(data, fromVersion, toVersion)
```javascript
const migratedData = migrateData(
  oldData,
  '1.1.0',
  '1.3.0'
);
```

#### validateDataForVersion(data, version)
```javascript
const validation = validateDataForVersion(data, '1.3.0');
if (!validation.valid) {
  console.error('Validation issues:', validation.issues);
}
```

#### getLastBackup(version)
```javascript
const backup = getLastBackup('1.1.0');
if (backup) {
  console.log(backup.data); // Backed up data
}
```

#### listBackups()
```javascript
const allBackups = listBackups();
allBackups.forEach(b => {
  console.log(`${b.version} at ${b.timestamp}`);
});
```

#### restoreFromBackup(backupKey)
```javascript
const data = restoreFromBackup('backup_1.1.0_1234567890');
```

### exportImport.js

#### SCHEMA_VERSION
Constant synchronized with schemaVersioning.js:
```javascript
export const SCHEMA_VERSION = CURRENT_SCHEMA_VERSION; // '1.3.0'
```

#### validateImport(data)
```javascript
const validation = validateImport(importedData);
if (!validation.valid) {
  console.error(validation.error);
} else if (validation.warnings.length > 0) {
  console.warn(validation.warnings);
}
```

#### migrateImport(data)
```javascript
const migratedData = migrateImport(importedData);
// Automatically applies all necessary migrations
```

#### importFile(jsonInput)
```javascript
const result = await importFile(jsonString);
if (result.ok) {
  console.log(result.data); // Ready to load
  if (result.warnings.length > 0) {
    console.warn(result.warnings);
  }
} else {
  console.error(result.error);
}
```

### storage.js

Storage module automatically handles versioning on read/write:

```javascript
// Get with automatic migration
const result = await storage.get('appState', true); // migrations = true
if (result.value) {
  const data = JSON.parse(result.value); // Already migrated
}

// Set with automatic version tracking
await storage.set('appState', jsonString, true); // trackVersion = true
// Now reads will compare this version to current
```

## Adding a New Schema Version

### Step 1: Update schemaVersioning.js

```javascript
// Increment the version constant
export const CURRENT_SCHEMA_VERSION = '1.4.0';

// Add to SCHEMA_METADATA
export const SCHEMA_METADATA = {
  // ... existing versions ...
  '1.4.0': {
    features: [
      ...previousFeatures,
      'new_system_fields'
    ],
    addedAt: 'Date/description of new feature',
    breakingChanges: false
  }
};

// Add to version list
const SCHEMA_VERSIONS = [
  '1.0.0',
  '1.1.0',
  '1.2.0',
  '1.3.0',
  '1.4.0' // Add here
];
```

### Step 2: Create Migration Handler in dataMigrations.js

```javascript
// Add handler key to migrationHandlers object
const migrationHandlers = {
  '1.0.0:1.1.0': migrateTo1_1_0,
  '1.1.0:1.2.0': migrateTo1_2_0,
  '1.2.0:1.3.0': migrateTo1_3_0,
  '1.3.0:1.4.0': migrateTo1_4_0 // Add here
};

// Implement migration function
/**
 * Migration: 1.3.0 → 1.4.0 (Add New System)
 * Description of what fields are added/changed
 */
function migrateTo1_4_0(data) {
  return {
    ...data,
    newSystemField: data.newSystemField || [],
    newSystemSettings: {
      defaultValue: 'value',
      ...data.newSystemSettings
    }
  };
}
```

### Step 3: Update validateDataForVersion()

```javascript
export function validateDataForVersion(data, version) {
  const issues = [];

  // ... existing validations ...

  if (version >= '1.4.0') {
    if (!Array.isArray(data.newSystemField)) {
      issues.push('Missing or invalid newSystemField array');
    }
  }

  return {
    valid: issues.length === 0,
    issues
  };
}
```

### Step 4: Update Components

Add any UI changes needed for new fields:

```javascript
// Components can now use new fields
const { newSystemField } = appState;

// Add PropTypes validation
NewComponent.propTypes = {
  newSystemField: PropTypes.array.isRequired,
  // ...
};
```

## Testing Migrations

### Manual Testing

```javascript
// In browser console:
import { migrateData, getStoredSchemaVersion } from './utils/schemaVersioning';

// Check current version
console.log(getStoredSchemaVersion()); // '1.1.0'

// Load old data
const oldData = JSON.parse(localStorage.getItem('appState'));

// Test migration
const newData = migrateData(oldData, '1.1.0', '1.3.0');

// Verify fields
console.log(newData.gatheringSessions); // Should be empty array
```

### Automated Testing

Create test file: `src/utils/__tests__/dataMigrations.test.js`

```javascript
import { describe, it, expect } from 'vitest';
import { migrateData, validateDataForVersion } from '../dataMigrations';

describe('dataMigrations', () => {
  it('should migrate v1.0.0 to v1.3.0', () => {
    const v1_0_data = {
      materials: [],
      foods: [],
      recipes: []
    };

    const result = migrateData(v1_0_data, '1.0.0', '1.3.0');

    expect(result.alchemyReagents).toEqual([]);
    expect(result.combatActive).toBeNull();
    expect(result.gatheringSessions).toEqual([]);
    expect(result.currentDay).toBe(1);
  });

  it('should validate v1.3.0 data correctly', () => {
    const validData = {
      // v1.0 fields
      materials: [],
      foods: [],
      recipes: [],
      // v1.1 fields
      alchemyReagents: [],
      alchemyFormulas: [],
      // v1.2 fields
      combatActive: null,
      // v1.3 fields
      gatheringSessions: [],
      currentDay: 1
    };

    const validation = validateDataForVersion(validData, '1.3.0');
    expect(validation.valid).toBe(true);
  });
});
```

## Recovery and Debugging

### Viewing Migration History

```javascript
import { getMigrationHistory } from './utils/schemaVersioning';

const history = getMigrationHistory();
// Result:
// [
//   { from: '1.0.0', to: '1.1.0', timestamp: '...', success: true },
//   { from: '1.1.0', to: '1.2.0', timestamp: '...', success: true },
//   { from: '1.2.0', to: '1.3.0', timestamp: '...', success: true }
// ]
```

### Listing Available Backups

```javascript
import { listBackups } from './utils/dataMigrations';

const backups = listBackups();
backups.forEach(b => {
  console.log(`${b.key}: v${b.version} @ ${b.timestamp}`);
});
```

### Restoring from Backup

```javascript
import { restoreFromBackup } from './utils/dataMigrations';

// Find backup key from listBackups()
const data = restoreFromBackup('backup_1.2.0_1687123456789');

if (data) {
  localStorage.setItem('appState', JSON.stringify(data));
  console.log('Restored successfully');
}
```

### Clearing Migration Metadata

When debugging, you can clear the migration history:

```javascript
localStorage.removeItem('schema_version');
localStorage.removeItem('migration_history');
// On next load, will re-run all migrations
```

## Best Practices

1. **Always Create Backups**: Before releasing a new version with migrations, test with backups enabled
2. **Idempotent Migrations**: Migrations should safely handle partial/repeated application
3. **Default Values**: Always provide sensible defaults for new fields
4. **Semantic Versioning**: Follow major.minor.patch (1.0.0, 1.1.0, 1.2.0)
5. **Log Everything**: Use logger for migration debugging
6. **Test Coverage**: Write tests for each migration path
7. **Document Changes**: Update this guide when adding versions
8. **User Communication**: Inform users about data format changes in release notes

## Troubleshooting

### Migration Fails During Load
- Check browser console for error messages
- Review migration logs: `getMigrationHistory()`
- Try restoring from backup: `restoreFromBackup(backupKey)`
- Export/import as fallback recovery

### Data Missing After Migration
- Check backup system: `listBackups()`
- Review validation issues: `validateDataForVersion(data, version)`
- Verify migration handler creates all required fields

### Performance Issues During Migration
- Check data size (should be <5MB for localStorage)
- Review backup cleanup (keeps last 5 per version)
- Consider implementing server-side migration for very large datasets

## References

- [Semantic Versioning](https://semver.org/)
- [Storage API](src/utils/storage.js)
- [Export/Import System](src/utils/exportImport.js)
- [Logger Utility](src/utils/logger.js)
