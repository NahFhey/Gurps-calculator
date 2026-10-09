import { describe, it, expect, expectTypeOf } from 'vitest';
import { campaignReducer, createCampaignState, type CampaignState } from '../../state/campaignReducer';
import {
  fromCampaignDTO,
  fromSnapshotDTO,
  toCampaignDTO,
  toDetachedCampaignDTO,
  toSnapshotDTO,
  type CampaignDTO,
  type CampaignSnapshotDTO,
} from '../campaignCodec';
import { createNewMap } from '../../utils/mapUtils';
import { createInitialRevealState } from '../../utils/combatReveal';
import type { CombatState, Participant } from '../../types/combatTracker';

/** true when a Set appears anywhere inside T. */
type HasSet<T> = T extends Set<unknown>
  ? true
  : T extends readonly (infer U)[]
    ? HasSet<U>
    : T extends (...args: never[]) => unknown
      ? false
      : T extends object
        ? true extends { [K in keyof T]-?: HasSet<T[K]> }[keyof T] ? true : false
        : false;

const participant = (overrides: Partial<Participant>): Participant => ({
  instanceId: 'hero', id: 'hero', name: 'Aria', category: 'player',
  st: 11, dx: 12, iq: 10, ht: 11, hp: 12, fp: 11, mp: 0,
  maxHP: 12, currentHP: 12, currentFP: 11, basicSpeed: 5.75, basicMove: 5,
  conditions: [],
  ...overrides,
});

const combatSession = (): CombatState => {
  const participants = [
    participant({}),
    participant({ instanceId: 'ogre', id: 'ogre', name: 'Ogre', category: 'enemy', hp: 15, maxHP: 15, currentHP: 9 }),
  ];
  return {
    id: 'combat-1',
    name: 'Bridge Ambush',
    startTime: 1_000,
    participants,
    turnOrder: participants.map(p => p.instanceId),
    currentTurnIndex: 0,
    currentRound: 2,
    turnDecisions: {},
    log: [{ id: 'log-1', timestamp: 1_100, round: 1, turn: 1, entryType: 'note', text: 'Ogre waits' }],
  };
};

/** A campaign with every Set field populated, a running combat, combat history and a checkpoint. */
function populatedCampaign(): CampaignState {
  let state = createCampaignState();
  const map = createNewMap({ name: 'Vale', scale: '12mi', startTerrainId: 'plains' });
  map.revealedTileIds = new Set([...map.revealedTileIds, 'tile-extra']);
  state = { ...state, maps: { ...state.maps, mapsById: { [map.id]: map }, activeMapId: map.id } };
  const session = combatSession();
  state.combat = {
    ...state.combat,
    active: true,
    encounterId: 'enc-1',
    activeSession: session,
    reveal: {
      revealedTargets: new Set(['ogre', 'goblin']),
      revealedHP: new Set(['ogre']),
      revealedDefenseValues: { ogre: { dodge: 8 } },
    },
    revealState: createInitialRevealState(session.id, session.participants),
  };
  state.entities = { ...state.entities, combatHistory: [{ ...session, id: 'combat-0', endTime: 900 } as CombatState] };
  return campaignReducer(state, { type: 'createCheckpoint', payload: 'Before test' });
}

const jsonRoundTrip = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

describe('campaign DTO types', () => {
  it('has no Set anywhere in CampaignDTO or CampaignSnapshotDTO', () => {
    expectTypeOf<HasSet<CampaignDTO>>().toEqualTypeOf<false>();
    expectTypeOf<HasSet<CampaignSnapshotDTO>>().toEqualTypeOf<false>();
    // The check is not vacuous: the runtime type does hold Sets.
    expectTypeOf<HasSet<CampaignState>>().toEqualTypeOf<true>();
  });

  it('types the three Set fields as arrays', () => {
    expectTypeOf<CampaignDTO['combat']['reveal']['revealedTargets']>().toEqualTypeOf<string[]>();
    expectTypeOf<CampaignDTO['combat']['reveal']['revealedHP']>().toEqualTypeOf<string[]>();
    expectTypeOf<CampaignDTO['maps']['mapsById'][string]['revealedTileIds']>().toEqualTypeOf<string[]>();
  });
});

describe('campaign codec', () => {
  it('round-trips a populated campaign through JSON unchanged', () => {
    const state = populatedCampaign();
    expect(state.checkpoints.entries).toHaveLength(1);

    const restored = fromCampaignDTO(jsonRoundTrip(toCampaignDTO(state)));

    expect(restored).toEqual(state);
    expect(restored.combat.reveal.revealedTargets).toBeInstanceOf(Set);
    expect(restored.combat.reveal.revealedHP).toBeInstanceOf(Set);
    for (const map of Object.values(restored.maps.mapsById)) {
      expect(map.revealedTileIds).toBeInstanceOf(Set);
    }
  });

  it('writes the Set fields as arrays and leaves the input untouched', () => {
    const state = populatedCampaign();
    const mapId = state.maps.activeMapId!;
    const dto = toCampaignDTO(state);

    expect(dto.combat.reveal.revealedTargets).toEqual(['ogre', 'goblin']);
    expect(dto.combat.reveal.revealedHP).toEqual(['ogre']);
    expect(dto.maps.mapsById[mapId].revealedTileIds).toContain('tile-extra');
    expect(JSON.parse(JSON.stringify(dto)).combat.reveal.revealedTargets).toEqual(['ogre', 'goblin']);
    expect(state.combat.reveal.revealedTargets).toBeInstanceOf(Set);
    expect(state.maps.mapsById[mapId].revealedTileIds).toBeInstanceOf(Set);
  });

  it('keeps checkpoint snapshots as DTOs inside the runtime state', () => {
    const state = populatedCampaign();
    const snapshot = state.checkpoints.entries[0].snapshot;
    expect(Array.isArray(snapshot.combat.reveal.revealedTargets)).toBe(true);
    expect(snapshot).not.toHaveProperty('checkpoints');
    expect(fromCampaignDTO(toCampaignDTO(state)).checkpoints.entries[0].snapshot).toEqual(snapshot);
  });

  it('detaches an export DTO from its input', () => {
    const state = populatedCampaign();

    const dto = toDetachedCampaignDTO(state);

    expect(dto).toEqual(toCampaignDTO(state));
    expect(dto.entities).not.toBe(state.entities);
    expect(dto.ui).not.toBe(state.ui);
    expect(dto.checkpoints.entries[0]).not.toBe(state.checkpoints.entries[0]);
  });

  it('round-trips a snapshot', () => {
    const state = populatedCampaign();
    const { checkpoints: _checkpoints, ...rest } = state;

    const snapshot = toSnapshotDTO(state);

    expect(snapshot).not.toHaveProperty('checkpoints');
    expect(fromSnapshotDTO(jsonRoundTrip(snapshot))).toEqual(rest);
  });

  it('reads the {} that pre-fix checkpoints left in place of a Set as empty', () => {
    const dto = jsonRoundTrip(toCampaignDTO(populatedCampaign()));
    const mapId = dto.maps.activeMapId!;
    (dto.combat.reveal as Record<string, unknown>).revealedTargets = {};
    (dto.maps.mapsById[mapId] as unknown as Record<string, unknown>).revealedTileIds = {};

    const state = fromCampaignDTO(dto);

    expect(state.combat.reveal.revealedTargets).toEqual(new Set());
    expect(state.maps.mapsById[mapId].revealedTileIds).toEqual(new Set());
    expect(state.combat.reveal.revealedHP).toEqual(new Set(['ogre']));
  });

  it('gives a combat slice without reveal an empty one in both directions', () => {
    const state = createCampaignState();
    const { reveal: _reveal, ...combatWithoutReveal } = state.combat;
    const empty = { revealedTargets: [], revealedHP: [], revealedDefenseValues: {} };

    const dto = toCampaignDTO({ ...state, combat: combatWithoutReveal as CampaignState['combat'] });
    expect(dto.combat.reveal).toEqual(empty);

    const { reveal: _dtoReveal, ...dtoCombatWithoutReveal } = dto.combat;
    const decoded = fromCampaignDTO({ ...dto, combat: dtoCombatWithoutReveal as CampaignDTO['combat'] });
    expect(decoded.combat.reveal).toEqual({ revealedTargets: new Set(), revealedHP: new Set(), revealedDefenseValues: {} });
  });
});
