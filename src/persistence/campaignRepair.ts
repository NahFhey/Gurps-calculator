/**
 * The repair stage of the campaign decoder (docs/TYPED_BOUNDARIES_PLAN.md §2.3):
 * defaults merged over a validated payload, the idempotent ensure* repairs,
 * and the current schema version stamped. Production code reaches it only
 * through `decodeCampaign` (src/persistence/decodeCampaign.ts), which
 * validates first; it lives apart from campaignStorage so that module and the
 * decoder do not import each other.
 */
import { createCampaignState, type CampaignState } from '../state/campaignReducer';
import { fromCampaignDTO, toCampaignDTO, type CampaignDTO } from './campaignCodec';
import { removeLegacyTravelState } from '../utils/dataMigrations';
import { ensureMapTokens, ensureMapScale, ensureAmbientWeather, ensureCharacterTemplates, ensureTravelGroups, ensureJourneyIntegrity, ensureTravelEventTables, ensureInventoryRecords, ensureOwnerAttributedHoldings, ensureConditionVisibility, ensureCombatCharacterCategories, ensureCombatHistoryShape, ensureLocationIntegrity } from './dataMigration';
import { DEFAULT_CALENDAR } from '../utils/timeSystem';
import { CAMPAIGN_SCHEMA_VERSION, classifySchemaVersion } from '../../shared/campaignVersion';
import { describeVersionRefusal } from '../../shared/campaignDocument';

// Legacy key as a string literal on purpose: the field no longer exists on
// MapModel, but pre-1.5.6 saves still carry it.
const LEGACY_PARTY_POSITION_KEY = 'partyTileId';

/** Map repairs on the DTO: climate/visionMode defaults, the legacy party-position key dropped. */
const hydrateMapState = (
  maps: CampaignDTO['maps'] | undefined,
  base: CampaignDTO['maps']
): CampaignDTO['maps'] => {
  if (!maps || !maps.mapsById) {
    return base;
  }
  const hydratedMaps: CampaignDTO['maps']['mapsById'] = {};
  for (const [mapId, map] of Object.entries(maps.mapsById)) {
    const repaired = {
      ...map,
      climate: map.climate ?? 'temperate',
      visionMode: map.visionMode ?? 'lineOfSight',
    };
    Reflect.deleteProperty(repaired, LEGACY_PARTY_POSITION_KEY);
    hydratedMaps[mapId] = repaired;
  }
  return {
    ...base,
    ...maps,
    mapsById: hydratedMaps,
  };
};

/**
 * A campaign payload whose `meta.schemaVersion` this build cannot read: a
 * newer build wrote it ('future'), or the version is not strict semver
 * ('malformed'). Thrown before anything is repaired or stamped.
 */
export class CampaignVersionError extends Error {
  constructor(readonly version: unknown, readonly versionClass: 'future' | 'malformed') {
    super(describeVersionRefusal(version, versionClass));
    this.name = 'CampaignVersionError';
  }
}

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Refuse a payload from a newer build or with a malformed version. A missing
 * version, or any below 1.7.0, is pre-contract: the old `'1.0.0'` was never
 * bumped, so hydration's idempotent repairs are what bring it up to date.
 */
function assertReadableSchemaVersion(payload: unknown): void {
  const meta = isPlainRecord(payload) ? payload.meta : undefined;
  if (!isPlainRecord(meta) || meta.schemaVersion === undefined) return;
  const versionClass = classifySchemaVersion(meta.schemaVersion);
  if (versionClass === 'future' || versionClass === 'malformed') {
    throw new CampaignVersionError(meta.schemaVersion, versionClass);
  }
}

/**
 * Turn a parsed campaign payload into runtime state: refuse unreadable
 * versions, run the idempotent repairs, and stamp the current schema version.
 */
export const hydrateCampaignState = (payload: CampaignDTO): CampaignState => {
  assertReadableSchemaVersion(payload);
  payload = ensureMapTokens(removeLegacyTravelState(payload));
  const base = toCampaignDTO(createCampaignState());
  const reveal = payload.combat?.reveal ?? base.combat.reveal;
  // Merge and repair on the DTO; the codec revives the Sets before the ensure* chain.
  const merged: CampaignDTO = {
    ...base,
    ...payload,
    // Ensure all nested structures have proper defaults
    meta: {
      ...base.meta,
      ...(isPlainRecord(payload.meta) ? payload.meta : {}),
      schemaVersion: CAMPAIGN_SCHEMA_VERSION,
    },
    ui: {
      ...base.ui,
      ...payload.ui,
      pendingIntent: null
    },
    checkpoints: {
      ...base.checkpoints,
      ...payload.checkpoints,
      entries: payload.checkpoints?.entries ?? base.checkpoints.entries
    },
    entities: {
      ...base.entities,
      ...payload.entities
    },
    time: {
      ...base.time,
      ...payload.time,
      calendar: payload.time?.calendar ?? DEFAULT_CALENDAR,
    },
    locations: {
      ...base.locations,
      ...payload.locations,
      locations: payload.locations?.locations ?? base.locations.locations,
      weatherTables: payload.locations?.weatherTables ?? base.locations.weatherTables,
    },
    legacy: {
      ...base.legacy,
      ...payload.legacy,
      appState: base.legacy.appState
    },
    combat: {
      ...base.combat,
      ...payload.combat,
      reveal: {
        ...base.combat.reveal,
        ...reveal,
      }
    },
    maps: hydrateMapState(payload.maps, base.maps),
  };
  return ensureLocationIntegrity(ensureAmbientWeather(ensureTravelEventTables(ensureJourneyIntegrity(ensureTravelGroups(ensureCharacterTemplates(ensureCombatHistoryShape(ensureCombatCharacterCategories(ensureConditionVisibility(ensureOwnerAttributedHoldings(ensureInventoryRecords(ensureMapScale(
    fromCampaignDTO(merged)
  ))))))))))));
};
