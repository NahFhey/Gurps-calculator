import { afterEach, describe, it, expect, vi } from 'vitest';
import { campaignReducer, createCampaignState, type CampaignState } from '../campaignReducer';
import { initialMapState } from '../../types/map';
import { REPLACEMENT_POLICIES } from '../campaignReplacement';
import { toCampaignDTO } from '../../persistence/campaignCodec';
import { createInitialLocationState } from '../../utils/weatherSystem';
import { createNewMap } from '../../utils/mapUtils';

const ROOT_KEYS = Object.keys(createCampaignState()).sort();

function campaignWithMap(): CampaignState {
  const state = createCampaignState();
  const map = createNewMap({ name: 'Vale', scale: '12mi', startTerrainId: 'plains' });
  state.maps = { ...state.maps, mapsById: { [map.id]: map }, activeMapId: map.id };
  state.combat.reveal.revealedTargets.add('ogre');
  return state;
}

describe('whole-state replacement policies', () => {
  it.each(Object.keys(REPLACEMENT_POLICIES))('%s decides every root key of CampaignState', name => {
    const policy = REPLACEMENT_POLICIES[name as keyof typeof REPLACEMENT_POLICIES];
    expect(Object.keys(policy).sort()).toEqual(ROOT_KEYS);
  });

  it('import keeps checkpoints and nothing else', () => {
    const kept = Object.entries(REPLACEMENT_POLICIES.import).filter(([, rule]) => rule === 'keep').map(([key]) => key);
    expect(kept).toEqual(['checkpoints']);
  });

  it('restore keeps every root key its policy keeps and replaces the rest from the snapshot', () => {
    let state = campaignWithMap();
    state = campaignReducer(state, { type: 'createCheckpoint', payload: 'Before' });
    const checkpointId = state.checkpoints.entries[0].id;
    const snapshot = state.checkpoints.entries[0].snapshot;

    const diverged = campaignReducer(
      campaignReducer(state, { type: 'advanceTime' }),
      { type: 'createCheckpoint', payload: 'After' }
    );
    const restored = campaignReducer(diverged, { type: 'restoreCheckpoint', payload: checkpointId });

    for (const [key, rule] of Object.entries(REPLACEMENT_POLICIES.restore) as [keyof CampaignState, string][]) {
      if (rule === 'keep') {
        expect(restored[key], key).toEqual(diverged[key]);
      } else if (key === 'logs') {
        // The rollback entry is appended after the snapshot's logs are restored.
        expect(restored.logs.entries.slice(1)).toEqual(snapshot.logs.entries);
        expect(restored.logs.entries[0].type).toBe('campaign.rollback');
      } else {
        expect(toCampaignDTO(restored)[key], key).toEqual(snapshot[key as keyof typeof snapshot]);
      }
    }
    expect(REPLACEMENT_POLICIES.restore.checkpoints).toBe('keep');
  });
});

describe('applyDebugState', () => {
  it('revives every Set from the JSON the debug panel applies', () => {
    const source = campaignWithMap();
    const mapId = source.maps.activeMapId!;
    const json = JSON.parse(JSON.stringify(toCampaignDTO(source)));

    const applied = campaignReducer(createCampaignState(), { type: 'applyDebugState', payload: json });

    expect(applied.maps.mapsById[mapId].revealedTileIds).toBeInstanceOf(Set);
    expect(applied.maps.mapsById[mapId].revealedTileIds).toEqual(source.maps.mapsById[mapId].revealedTileIds);
    expect(applied.combat.reveal.revealedTargets).toEqual(new Set(['ogre']));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('replaces the checkpoint ring with the one in the applied JSON', () => {
    const current = campaignReducer(createCampaignState(), { type: 'createCheckpoint', payload: 'Before debug' });
    expect(current.checkpoints.entries).toHaveLength(1);
    const json = JSON.parse(JSON.stringify(toCampaignDTO(createCampaignState())));

    const applied = campaignReducer(current, { type: 'applyDebugState', payload: json });

    expect(applied.checkpoints).toEqual(json.checkpoints);
  });

  it('fills slices missing from the applied JSON with defaults', () => {
    // The default location gets a time- and random-based id; pin both so the
    // reducer's default and the expected value are built alike.
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const json = JSON.parse(JSON.stringify(toCampaignDTO(createCampaignState())));
    json.time = { ...json.time, day: 5 };
    delete json.maps;
    delete json.locations;
    delete json.inventory;

    const applied = campaignReducer(createCampaignState(), { type: 'applyDebugState', payload: json });

    expect(applied.maps).toEqual(initialMapState);
    expect(applied.locations).toEqual(createInitialLocationState(json.time));
    expect(applied.inventory).toEqual(createCampaignState().inventory);
  });
});
