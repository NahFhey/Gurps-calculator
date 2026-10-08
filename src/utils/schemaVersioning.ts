/**
 * @fileoverview Schema versioning system for application data persistence
 */

import { logger } from './logger';
import {
  CAMPAIGN_SCHEMA_VERSION,
  classifySchemaVersion,
  compareSchemaVersions,
} from '../../shared/campaignVersion';

export { classifySchemaVersion, compareSchemaVersions };

export interface SchemaMetadataEntry {
  name: string;
  timestamp: string;
  breaking: boolean;
  description: string;
  features: string[];
  migratesFrom?: string[];
}

/** The single campaign schema version (shared/campaignVersion.ts). */
export const CURRENT_SCHEMA_VERSION = CAMPAIGN_SCHEMA_VERSION;

export const SCHEMA_METADATA: Record<string, SchemaMetadataEntry> = {
  '1.7.0': { name: 'Schema version contract', timestamp: '2026-10-07', breaking: false,
    description: 'One semver contract: meta.schemaVersion is stamped on every persisted campaign; newer versions are refused',
    features: ['schema_version_contract'], migratesFrom: ['1.6.5'] },
  '1.6.5': { name: 'Persistent map tokens', timestamp: '2026-09-08', breaking: true,
    description: 'Map-owned token instances, participant references and square movement coordinates',
    features: ['map_tokens'], migratesFrom: ['1.6.4'] },
  '1.6.4': {
    name: 'Unit-carrying map scale',
    timestamp: '2026-09-07',
    breaking: true,
    description: "Map scale becomes a unit-carrying rung (scale: '1yd' | '12mi' | '50mi' | '457mi'); scaleMilesPerTile removed",
    features: ['map_scale_rungs', 'tactical_maps'],
    migratesFrom: ['1.6.3'],
  },
  '1.6.3': {
    name: 'Map stamp library',
    timestamp: '2026-09-06',
    breaking: false,
    description: 'Reusable map stamps with measure-to-fit placement and image slicing',
    features: ['map_stamp_library', 'measure_to_fit', 'stamp_image_slicing'],
    migratesFrom: ['1.6.2'],
  },
  '1.0.0': {
    name: 'Initial Schema',
    timestamp: '2025-01-01',
    breaking: false,
    description: 'Basic inventory, cooking, crafting systems',
    features: ['inventory', 'cooking', 'crafting'],
  },
  '1.1.0': {
    name: 'Alchemy System',
    timestamp: '2025-06-01',
    breaking: false,
    description: 'Added comprehensive alchemy with reagents, formulas, and batches',
    features: ['alchemy_reagents', 'alchemy_formulas', 'alchemy_batches', 'alchemy_labs'],
    migratesFrom: ['1.0.0'],
  },
  '1.2.0': {
    name: 'Combat System',
    timestamp: '2025-09-01',
    breaking: false,
    description: 'Added combat tracker with turn management and conditions',
    features: ['combat_active', 'combat_history', 'combat_conditions', 'combat_reveal'],
    migratesFrom: ['1.1.0'],
  },
  '1.3.0': {
    name: 'Gathering System',
    timestamp: '2026-01-01',
    breaking: false,
    description: 'Added gathering/fishing system with daily events and yields',
    features: ['gathering_sessions', 'gathering_daily_events', 'gathering_species', 'current_day'],
    migratesFrom: ['1.2.0'],
  },
  '1.4.0': {
    name: 'Inventory Integration Bus',
    timestamp: '2026-06-09',
    breaking: false,
    description:
      'Crafting/gathering/loot write to inventory via itemAcquired/itemRetagged; ' +
      'owner records (party + per-character) guaranteed on load',
    features: ['inventory_bus', 'inventory_owner_records'],
    migratesFrom: ['1.3.0'],
  },
  '1.5.0': {
    name: 'Combat Condition Visibility',
    timestamp: '2026-07-04',
    breaking: false,
    description:
      'Per-instance condition reveal state (closed/half/open) seeded from catalog defaults; ' +
      'legacy isStunned/isUnconscious participant booleans folded into conditions[]',
    features: ['condition_reveal_state', 'condition_bool_fold'],
    migratesFrom: ['1.4.0'],
  },
  '1.5.1': {
    name: 'Combat Character Category',
    timestamp: '2026-07-12',
    breaking: false,
    description:
      'CombatCharacter persists the library form category (player/ally/enemy/object); ' +
      'pre-1.5.1 records backfilled from isNPC so EncounterSetup library groups show them',
    features: ['combat_character_category'],
    migratesFrom: ['1.5.0'],
  },
  '1.5.2': {
    name: 'Party Meal Buff',
    timestamp: '2026-08-25',
    breaking: false,
    description: 'Successful cooking grants a display-only party meal buff for the current day',
    features: ['party_meal_buff'],
    migratesFrom: ['1.5.1'],
  },
  '1.5.3': {
    name: 'Combat History Entry Shape',
    timestamp: '2026-08-25',
    breaking: false,
    description:
      'combatHistory holds canonical CombatState snapshots; pre-rewrite ' +
      'CombatSession records (characterId/team participants, startDate strings) upgraded on load',
    features: ['combat_history_combat_state'],
    migratesFrom: ['1.5.2'],
  },
  '1.5.4': {
    name: 'Owner-Attributed Material Holdings',
    timestamp: '2026-08-25',
    breaking: true,
    description: 'Materials and foods are authoritative per-owner Inventory holdings',
    features: ['owner_material_holdings', 'owner_food_holdings'],
    migratesFrom: ['1.5.3'],
  },
  '1.5.5': {
    name: 'Travel State Cleanup',
    timestamp: '2026-08-31',
    breaking: true,
    description: 'Remove legacy location-graph travel semantics and persisted map travel UI state',
    features: ['map_tile_travel', 'legacy_travel_cleanup'],
    migratesFrom: ['1.5.4'],
  },
  '1.5.6': {
    name: 'Travel Groups & Vehicles',
    timestamp: '2026-08-31',
    breaking: true,
    description: 'Replace the singleton map party position with persistent travel groups and vehicles',
    features: ['travel_groups', 'vehicles', 'group_positions'],
    migratesFrom: ['1.5.5'],
  },
  '1.5.7': {
    name: 'Per-Map Ambient Weather & Seasons',
    timestamp: '2026-08-31',
    breaking: true,
    description: 'Move ambient climate and weather to maps and add derived campaign seasons',
    features: ['map_climate', 'map_weather', 'calendar_seasons'],
    migratesFrom: ['1.5.6'],
  },
  '1.5.8': {
    name: 'Locations on the Map',
    timestamp: '2026-08-31',
    breaking: true,
    description: 'Pin locations to map markers and validate facility attachment references',
    features: ['location_pins', 'location_discovery', 'facility_attachments', 'contact_locations'],
    migratesFrom: ['1.5.7'],
  },
  '1.5.9': {
    name: 'The Journey Loop',
    timestamp: '2026-09-01',
    breaking: false,
    description: 'Progress travel journeys through ordinary time slots with engine-owned travel tasks',
    features: ['journeys', 'travel_tasks', 'night_slots'],
    migratesFrom: ['1.5.8'],
  },
  '1.6.0': {
    name: 'Travel Events & Provisioning',
    timestamp: '2026-09-01',
    breaking: false,
    description: 'Add terrain-keyed travel events, encounter hand-off, and travel meal ledgers',
    features: ['travel_events', 'travel_encounters', 'journey_provisioning'],
    migratesFrom: ['1.5.9'],
  },
  '1.6.1': {
    name: 'Inventory Equipment Bridge',
    timestamp: '2026-09-01',
    breaking: false,
    description: 'Add optional inventory equipment cargo and atomic sheet promotion/demotion',
    features: ['equipment_bridge', 'equipment_provenance'],
    migratesFrom: ['1.6.0'],
  },
  '1.6.2': {
    name: 'Injury Persistence',
    timestamp: '2026-09-01',
    breaking: false,
    description: 'Persist party conditions, crippled limbs, and death across combat and downtime',
    features: ['injury_persistence'],
    migratesFrom: ['1.6.1'],
  },
};

export const MIGRATION_HISTORY_KEY = 'app_migration_history';

export interface MigrationLogEntry {
  timestamp: string;
  from: string;
  to: string;
  [key: string]: unknown;
}

export function getMigrationPath(
  fromVersion: string,
  toVersion: string = CURRENT_SCHEMA_VERSION
): string[] {
  const versions = Object.keys(SCHEMA_METADATA).sort(compareSchemaVersions);

  const fromIndex = versions.indexOf(fromVersion);
  const toIndex = versions.indexOf(toVersion);

  if (fromIndex === -1) {
    logger.warn(`Unknown version: ${fromVersion}`);
    return [];
  }

  if (fromIndex >= toIndex) {
    return [];
  }

  return versions.slice(fromIndex + 1, toIndex + 1);
}

export function logMigration(
  fromVersion: string,
  toVersion: string,
  metadata: Record<string, unknown> = {}
): void {
  try {
    const history: MigrationLogEntry[] = JSON.parse(
      localStorage.getItem(MIGRATION_HISTORY_KEY) || '[]'
    );

    history.push({
      timestamp: new Date().toISOString(),
      from: fromVersion,
      to: toVersion,
      ...metadata,
    });

    if (history.length > 20) {
      history.shift();
    }

    localStorage.setItem(MIGRATION_HISTORY_KEY, JSON.stringify(history));
  } catch (error) {
    logger.error('Failed to log migration:', error);
  }
}

export function getMigrationHistory(): MigrationLogEntry[] {
  try {
    return JSON.parse(localStorage.getItem(MIGRATION_HISTORY_KEY) || '[]') as MigrationLogEntry[];
  } catch (error) {
    logger.error('Failed to read migration history:', error);
    return [];
  }
}

export function clearMigrationHistory(): void {
  try {
    localStorage.removeItem(MIGRATION_HISTORY_KEY);
  } catch (error) {
    logger.error('Failed to clear migration history:', error);
  }
}

export function isValidSchemaVersion(version: string): boolean {
  return version in SCHEMA_METADATA;
}

export function getFeaturesForVersion(version: string): string[] {
  const metadata = SCHEMA_METADATA[version];
  return metadata ? metadata.features : [];
}
