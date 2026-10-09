/**
 * The client campaign decoder (docs/TYPED_BOUNDARIES_PLAN.md §2.3): every
 * campaign that enters the app from outside the store — local load, import,
 * GM unlock, checkpoint restore, debug JSON, server sync and join — goes
 * through here.
 *
 * Stages: the shared structural decode (JSON, root slices, schema version),
 * then loose Zod schemas for the slices that have actually broken, then the
 * repairs in `hydrateCampaignState`. Validation runs BEFORE the repairs'
 * default merge: `{ ...base.reveal, ...'x' }` would turn a malformed slice
 * into silent garbage. The schemas are loose objects (unknown keys kept),
 * because a decoder must never drop data it does not understand.
 */
import { z } from 'zod';
import {
  CampaignRootSchema,
  decodeCampaignPayload,
  type CampaignDecodeReason,
  type SchemaVersionInfo,
} from '../../shared/campaignDocument';
import type { CampaignAction, CampaignState } from '../state/campaignReducer';
import type { CampaignDTO } from './campaignCodec';
import { hydrateCampaignState } from './campaignRepair';

const JsonObject = z.record(z.string(), z.unknown());
const RecordOfObjects = z.record(z.string(), JsonObject);
/** A Set field as persisted: a string array, or the {} pre-fix snapshots left when JSON.stringify met a Set. */
const PersistedStringSet = z.union([z.array(z.string()), z.strictObject({})]);

const MapsSchema = z.looseObject({
  mapsById: z.record(z.string(), z.looseObject({
    revealedTileIds: z.union([PersistedStringSet, z.null()]).optional(),
  })).optional(),
});

const CombatSchema = z.looseObject({
  reveal: z.looseObject({
    revealedTargets: PersistedStringSet.optional(),
    revealedHP: PersistedStringSet.optional(),
    revealedDefenseValues: RecordOfObjects.optional(),
  }).optional(),
});

/** Snapshots are decoded when they are restored, not when the campaign loads. */
const CheckpointsSchema = z.looseObject({
  entries: z.array(z.looseObject({ id: z.string(), snapshot: JsonObject })).optional(),
});

const PersistedConditionSchema = z.looseObject({
  instanceId: z.string(),
  conditionId: z.string(),
  label: z.string(),
});

const CharacterSchema = z.looseObject({
  status: z.looseObject({
    conditions: z.array(PersistedConditionSchema).optional(),
  }).nullish(),
});

type EntityKey = keyof CampaignDTO['entities'];

/** Entity id maps: each value is an object. */
const ENTITY_RECORD_KEYS = [
  'characterTemplates', 'travelGroups', 'vehicles', 'vehicleTypes', 'travelEventTables', 'travelEventTableSets',
  'recipes', 'crafts', 'craftDesigns',
  'alchemyReagents', 'alchemyFormulas', 'alchemyBatches', 'alchemyLabs',
  'gatheringSpecies', 'gatheringTools', 'gatheringTables', 'gatheringEnvironments', 'gatheringSessions',
  'gatheringBait', 'gatheringCategories', 'gatheringItems',
  'forageZoneProfiles', 'forageItems', 'priceBook', 'studyProjects', 'contacts',
  'combatCharacters', 'combatItems', 'encounterTemplates',
  'kitchens', 'toolTemplates', 'toolInstances', 'facilities', 'inventories',
] as const satisfies readonly EntityKey[];

const ENTITY_ARRAY_KEYS = ['foodTypes', 'materialTypes', 'combatHistory', 'combatTombstones'] as const satisfies readonly EntityKey[];

const ENTITY_ID_LIST_KEYS = [
  'deletedBuiltinTemplateIds', 'deletedBuiltinVehicleTypeIds', 'deletedBuiltinTravelEventIds',
] as const satisfies readonly EntityKey[];

const EntitiesSchema = z.looseObject({
  characters: z.record(z.string(), CharacterSchema).optional(),
  ...Object.fromEntries(ENTITY_RECORD_KEYS.map((key) => [key, RecordOfObjects.optional()])),
  ...Object.fromEntries(ENTITY_ARRAY_KEYS.map((key) => [key, z.array(z.unknown()).optional()])),
  ...Object.fromEntries(ENTITY_ID_LIST_KEYS.map((key) => [key, z.array(z.string()).optional()])),
});

/** The shared root plus the slices that have broken; everything else passes through. */
const CampaignSlicesSchema = CampaignRootSchema.extend({
  entities: EntitiesSchema,
  combat: CombatSchema.optional(),
  maps: MapsSchema.optional(),
  checkpoints: CheckpointsSchema.optional(),
});

export type CampaignDecodeFailure = {
  ok: false;
  reason: CampaignDecodeReason | 'invalid';
  detail: string;
};

export type ParsedCampaignDTO = { ok: true; dto: CampaignDTO; version: SchemaVersionInfo } | CampaignDecodeFailure;

export type DecodedCampaign = { ok: true; state: CampaignState; version: SchemaVersionInfo } | CampaignDecodeFailure;

const describeError = (error: unknown): string =>
  error instanceof Error ? `${error.name}: ${error.message}` : String(error);

/** Shared decode plus slice validation, without repairs: the payload as a `CampaignDTO`. */
export function parseCampaignDTO(input: unknown): ParsedCampaignDTO {
  const decoded = decodeCampaignPayload(input);
  if (!decoded.ok) return decoded;
  const slices = CampaignSlicesSchema.safeParse(decoded.state);
  if (!slices.success) {
    const issue = slices.error.issues[0];
    const path = issue?.path.join('.') ?? '';
    return {
      ok: false,
      reason: 'invalid',
      detail: `Invalid campaign${path ? ` at ${path}` : ''}: ${issue?.message ?? 'unexpected shape'}`,
    };
  }
  // Audited cast, the only unknown → CampaignDTO one: the root and the slices
  // that have broken are validated above; the rest is trusted as written and
  // repaired by hydrateCampaignState.
  return { ok: true, dto: slices.data as unknown as CampaignDTO, version: decoded.version };
}

/** Decode, validate and repair a campaign payload. Never throws. */
export function decodeCampaign(input: unknown): DecodedCampaign {
  const parsed = parseCampaignDTO(input);
  if (!parsed.ok) return parsed;
  try {
    return { ok: true, state: hydrateCampaignState(parsed.dto), version: parsed.version };
  } catch (error) {
    return { ok: false, reason: 'invalid', detail: describeError(error) };
  }
}

export type RestoreCheckpointAction = Extract<CampaignAction, { type: 'restoreCheckpoint' }>;

export type PreparedCheckpointRestore =
  | { ok: true; action: RestoreCheckpointAction }
  | { ok: false; error: string };

/**
 * Decode checkpoint `id` of `state` for restore. Done outside the reducer:
 * the reducer importing this module would close a cycle through
 * campaignStorage back to the reducer.
 */
export function prepareCheckpointRestore(state: CampaignState, id: string): PreparedCheckpointRestore {
  const checkpoint = state.checkpoints.entries.find((entry) => entry.id === id);
  if (!checkpoint) return { ok: false, error: `No checkpoint with id ${id}.` };
  let json: string;
  try {
    json = JSON.stringify(checkpoint.snapshot);
  } catch (error) {
    return { ok: false, error: `Checkpoint "${checkpoint.label}" cannot be restored: ${describeError(error)}` };
  }
  const decoded = decodeCampaign(json);
  if (!decoded.ok) return { ok: false, error: `Checkpoint "${checkpoint.label}" cannot be restored: ${decoded.detail}` };
  return { ok: true, action: { type: 'restoreCheckpoint', payload: { id, state: decoded.state } } };
}
