import type { CampaignSnapshot, CampaignState } from '../state/campaignReducer';
import type { Persisted } from './campaignDto';

/** The campaign as it is saved, exported, sent and snapshotted: no Sets. */
export type CampaignDTO = Persisted<CampaignState>;
/** A checkpoint snapshot: the campaign DTO without `checkpoints`. */
export type CampaignSnapshotDTO = Persisted<CampaignSnapshot>;

type CombatDTO = CampaignDTO['combat'];
type MapsDTO = CampaignDTO['maps'];

/**
 * Accepts a Set, a serialized array, or the {} left behind by pre-fix
 * checkpoints that JSON.stringify'd a Set.
 */
export const reviveSet = <T>(value: unknown): Set<T> => {
  if (value instanceof Set) {
    return value as Set<T>;
  }
  return new Set(Array.isArray(value) ? (value as T[]) : []);
};

// The three Set fields: combat.reveal.revealedTargets, combat.reveal.revealedHP
// and maps.mapsById[*].revealedTileIds. These four functions are the only
// place they convert; Persisted<T> makes tsc check every other field.

// A combat slice without `reveal` (pre-reveal data, hand-built states) gets an
// empty one in both directions instead of throwing.

const encodeCombat = (combat: CampaignState['combat']): CombatDTO => ({
  ...combat,
  reveal: {
    ...combat.reveal,
    revealedDefenseValues: combat.reveal?.revealedDefenseValues ?? {},
    revealedTargets: Array.from(combat.reveal?.revealedTargets ?? []),
    revealedHP: Array.from(combat.reveal?.revealedHP ?? []),
  },
});

const decodeCombat = (combat: CombatDTO): CampaignState['combat'] => ({
  ...combat,
  reveal: {
    ...combat.reveal,
    revealedDefenseValues: combat.reveal?.revealedDefenseValues ?? {},
    revealedTargets: reviveSet<string>(combat.reveal?.revealedTargets),
    revealedHP: reviveSet<string>(combat.reveal?.revealedHP),
  },
});

const encodeMaps = (maps: CampaignState['maps']): MapsDTO => ({
  ...maps,
  mapsById: Object.fromEntries(
    Object.entries(maps.mapsById).map(([mapId, map]) => [
      mapId,
      { ...map, revealedTileIds: Array.from(map.revealedTileIds ?? []) },
    ])
  ),
});

const decodeMaps = (maps: MapsDTO): CampaignState['maps'] => ({
  ...maps,
  mapsById: Object.fromEntries(
    Object.entries(maps.mapsById ?? {}).map(([mapId, map]) => [
      mapId,
      { ...map, revealedTileIds: reviveSet<string>(map.revealedTileIds) },
    ])
  ),
});

/** Runtime state to DTO. Does not touch its input; safe on an Immer draft. */
export const toCampaignDTO = (state: CampaignState): CampaignDTO => ({
  ...state,
  combat: encodeCombat(state.combat),
  maps: encodeMaps(state.maps),
});

/**
 * DTO to runtime state. With a `Partial` DTO (hand-edited debug JSON, an old
 * snapshot) the missing root slices stay missing, so the caller's replacement
 * defaults fill them.
 */
export function fromCampaignDTO(dto: CampaignDTO): CampaignState;
export function fromCampaignDTO(dto: Partial<CampaignDTO>): Partial<CampaignState>;
export function fromCampaignDTO(dto: Partial<CampaignDTO>): Partial<CampaignState> {
  const { combat, maps, ...rest } = dto;
  return {
    ...rest,
    ...(combat ? { combat: decodeCombat(combat) } : {}),
    ...(maps ? { maps: decodeMaps(maps) } : {}),
  };
}

// Audited cast: a JSON round trip of a value that is already a DTO (no Sets,
// no Maps) has the same type. The only JSON clone in the codec.
const jsonClone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/**
 * `toCampaignDTO`, deep-cloned through JSON so it shares nothing with `state`
 * (for exports, which outlive the Immer draft or store state they came from).
 */
export const toDetachedCampaignDTO = (state: CampaignState): CampaignDTO =>
  jsonClone(toCampaignDTO(state));

/**
 * A checkpoint snapshot of `state`: its DTO without `checkpoints`, deep-cloned
 * through JSON because callers pass Immer drafts. Throws when the state is not
 * JSON-serializable; the caller skips the checkpoint.
 */
export const toSnapshotDTO = (state: CampaignState): CampaignSnapshotDTO => {
  const { checkpoints: _checkpoints, ...snapshot } = toCampaignDTO(state);
  return jsonClone<CampaignSnapshotDTO>(snapshot);
};

export function fromSnapshotDTO(dto: CampaignSnapshotDTO): CampaignSnapshot;
export function fromSnapshotDTO(dto: Partial<CampaignSnapshotDTO>): Partial<CampaignSnapshot>;
export function fromSnapshotDTO(dto: Partial<CampaignSnapshotDTO>): Partial<CampaignSnapshot> {
  return fromCampaignDTO(dto);
}
