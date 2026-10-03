/**
 * shared/playerProjection — one test per redaction (review claim D).
 */
import { describe, expect, it } from 'vitest';
import { playerProjectionGaps, projectCampaignForPlayers } from '../../../shared/playerProjection';
import { hydrateCampaignState } from '../../persistence/campaignStorage';
import { createCampaignState, type CampaignState } from '../../state/campaignReducer';
import type { MapStamp } from '../../types/map';
import { gmSecretsCampaign, SECRET_MARKER, secretPaths } from './fixtures/gmSecretsCampaign';

type Loose = Record<string, unknown>;

function projected() {
  const fixture = gmSecretsCampaign();
  return { ...fixture, out: projectCampaignForPlayers(fixture.state) };
}

describe('projectCampaignForPlayers', () => {
  it('leaves no GM secret anywhere in the projection', () => {
    expect(secretPaths(projected().out)).toEqual([]);
  });

  it('(A) turns GM mode off', () => {
    const { out } = projected();
    expect(out.ui.gmModeEnabled).toBe(false);
    expect(out.ui.gmSessionUnlocked).toBe(false);
    expect(out.ui.pendingIntent).toBeNull();
  });

  it('(B) drops checkpoint snapshots', () => {
    const { state, out } = projected();
    expect(state.checkpoints.entries).toHaveLength(1);
    expect(out.checkpoints.entries).toEqual([]);
    expect(out.checkpoints.maxSize).toBe(state.checkpoints.maxSize);
  });

  describe('(C) reagents show only what identification reveals', () => {
    it('level 0 keeps identity and obvious physical roles only', () => {
      const reagent = projected().out.entities.alchemyReagents.unknown;
      expect(reagent).toEqual({ id: 'unknown', name: 'Grey Dust', quantity: 2, identificationLevel: 0, roles: ['Solvent'] });
    });

    it('level 1 shows only the primary aspect of three', () => {
      const { state } = gmSecretsCampaign();
      state.entities.alchemyReagents.unknown.identificationLevel = 1;
      const reagent = projectCampaignForPlayers(state).entities.alchemyReagents.unknown;
      expect(reagent.aspects).toEqual({ primary: 'SECRET-fire' });
      expect(reagent.roles).toEqual(['Solvent']);
      expect(reagent.effectFamily).toBeUndefined();
      expect(reagent.potency).toBeUndefined();
    });

    it('a partial identification reads its aspects from the false profile', () => {
      const reagent = projected().out.entities.alchemyReagents.disguised;
      expect(reagent.aspects).toEqual({ primary: 'Water', secondary: 'Ice' });
      expect(reagent.falseProfile).toBeUndefined();
      expect(reagent.hazards).toBeUndefined();
      expect(reagent.roles).toEqual(['Binder']);
    });

    it('a full identification keeps every property except GM notes', () => {
      const { state, out } = projected();
      const { notes: _notes, ...expected } = state.entities.alchemyReagents.identified;
      expect(out.entities.alchemyReagents.identified).toEqual(expected);
    });

    it('a full identification of a disguised reagent shows the false profile', () => {
      const { state } = gmSecretsCampaign();
      state.entities.alchemyReagents.disguised.identificationLevel = 4;
      const reagent = projectCampaignForPlayers(state).entities.alchemyReagents.disguised;
      expect(reagent.aspects).toEqual({ primary: 'Water', secondary: 'Ice', tertiary: 'Mist-SECRET' });
      expect(reagent.hazards).toEqual(['SECRET fake hazard']);
      expect(reagent.roles).toBeUndefined();
      // The false profile names no family or potency, so the real ones must not show through.
      expect(reagent.effectFamily).toBeUndefined();
      expect(reagent.potency).toBeUndefined();
    });

    it('a full identification of a disguised reagent shows the false family and potency', () => {
      const { state } = gmSecretsCampaign();
      const disguised = state.entities.alchemyReagents.disguised;
      disguised.identificationLevel = 4;
      disguised.falseProfile = { ...disguised.falseProfile, ...{ effectFamily: 'Frost', potency: 3 } };
      const reagent = projectCampaignForPlayers(state).entities.alchemyReagents.disguised;
      expect(reagent.effectFamily).toBe('Frost');
      expect(reagent.potency).toBe(3);
    });

    it('obvious roles stay hidden when the campaign turns them off', () => {
      const { state } = gmSecretsCampaign();
      state.entities.alchemySettings = { ...state.entities.alchemySettings, showObviousRoles: false };
      expect(projectCampaignForPlayers(state).entities.alchemyReagents.unknown.roles).toBeUndefined();
    });
  });

  it('(D) strips GM fields from formulas and batches', () => {
    const { out } = projected();
    const formula = out.entities.alchemyFormulas.tonic as unknown as Loose;
    expect(formula).toEqual({ id: 'tonic', name: 'Warming Tonic', tier: 2 });
    const batch = out.entities.alchemyBatches.brew as unknown as Loose;
    expect(batch.gmHazards).toBeUndefined();
    expect(batch.hazardDetails).toBeUndefined();
    expect(batch.gmNotes).toBeUndefined();
    expect(batch.hazardsPublic).toEqual(['Smells odd']);
  });

  it('(E) keeps effect GM notes only when shared with players', () => {
    const effects = projected().out.entities.effectFamilyMap['Fire|Water'].effects!;
    expect(effects[0].gmNotes).toBeUndefined();
    expect(effects[0].notes).toBe('Player note');
    expect(effects[1].gmNotes).toBe('Shared GM note');
  });

  it('(F) strips location GM notes', () => {
    const location = projected().out.locations.locations.loc;
    expect(location.gmNotes).toBeUndefined();
    expect(location.name).toBe('Thornwood');
  });

  it('(G) drops GM-only log entries and replaces mixed ones with their masked text', () => {
    const entries = projected().out.logs.entries;
    expect(entries.map((entry) => entry.id)).toEqual(['mixed', 'public']);
    // The changelog shows players only the masked text: no title, no meta (quantity carries the damage).
    expect(entries[0].payload).toEqual({ message: 'A combatant was injured', maskedMessage: 'A combatant was injured' });
    expect(entries[0].meta).toBeUndefined();
    expect(entries[1].meta).toEqual({ characterNames: ['Ada'] });
  });

  it('(G) a mixed entry without masked text gets the placeholder the changelog shows', () => {
    const { state } = gmSecretsCampaign();
    delete state.logs.entries[1].payload.maskedMessage;
    expect(projectCampaignForPlayers(state).logs.entries[0].payload).toEqual({
      message: 'Details hidden in player mode.' });
  });

  describe('(H) maps', () => {
    it('drops GM markers and their tile references', () => {
      const { out, map, gmTile, playerTile } = projected();
      const outMap = out.maps.mapsById[map.id];
      expect(Object.keys(outMap.markersById)).toEqual(['inn']);
      expect(outMap.tilesById[gmTile].markerIds).toEqual([]);
      expect(outMap.tilesById[playerTile].markerIds).toEqual(['inn']);
    });

    it('drops GM-only image layers', () => {
      const { out, map } = projected();
      expect(out.maps.mapsById[map.id].imageLayers!.map((layer) => layer.id)).toEqual(['public-layer']);
    });

    it('empties the GM stamp library and keeps the key', () => {
      const { state } = gmSecretsCampaign();
      const stamp: MapStamp = { id: 'stamp-1', name: 'SECRET lair entrance', category: 'room', assetId: 'asset-gm',
        width: 1, height: 1, placement: 'overlay', createdAt: 1 };
      state.maps = { ...state.maps, stamps: { [stamp.id]: stamp } };
      const out = projectCampaignForPlayers(state);
      expect(out.maps.stamps).toEqual({});
      expect(secretPaths(out)).toEqual([]);
    });

    it('uses the player label, drops hidden tokens, and keeps hidden tokens still in combat', () => {
      const { out, map } = projected();
      const tokens = out.maps.mapsById[map.id].tokens;
      expect(tokens['hidden-token']).toBeUndefined();
      expect(tokens['masked-token'].label).toBe('Hooded figure');
      expect(tokens['fighting-token']).toBeDefined();
    });
  });

  it('(I) redacts pre-campaign data kept under legacy.appState', () => {
    const appState = projected().out.legacy.appState;
    expect(appState.gmNotes).toBeUndefined();
    expect(appState.gmCustomRules).toBeUndefined();
    expect(appState.alchemyReagents).toEqual([{ id: 'old', name: 'Old Root', identificationLevel: 0 }]);
  });

  it('does not touch its input and is idempotent', () => {
    const { state, out } = projected();
    expect(state.ui.gmModeEnabled).toBe(true);
    expect(state.entities.alchemyReagents.unknown.notes).toContain(SECRET_MARKER);
    expect(projectCampaignForPlayers(out)).toEqual(out);
  });

  it('serializes Sets as arrays and passes non-campaign objects through', () => {
    const { state } = gmSecretsCampaign();
    state.combat.reveal.revealedHP = new Set(['a']);
    const out = projectCampaignForPlayers(state) as unknown as { combat: { reveal: { revealedHP: unknown } } };
    expect(out.combat.reveal.revealedHP).toEqual(['a']);
    expect(projectCampaignForPlayers({ data: 1 })).toEqual({ data: 1 });
  });

  it('keeps the campaign shape so the player client can load it', () => {
    const { state, out } = projected();
    expect(Object.keys(out).sort()).toEqual(Object.keys(state).sort());
    expect(Object.keys(out.entities)).toEqual(expect.arrayContaining(Object.keys(state.entities)));
    expect(Object.keys(out.ui)).toEqual(expect.arrayContaining(Object.keys(state.ui)));
    const loaded = hydrateCampaignState(out as CampaignState);
    expect(loaded.time.day).toBe(42);
    expect(Object.keys(loaded.entities.alchemyReagents).sort()).toEqual(['disguised', 'identified', 'unknown']);
  });
});

describe('playerProjectionGaps', () => {
  it('is empty for a campaign with no combat data', () => {
    expect(playerProjectionGaps(createCampaignState())).toEqual([]);
  });

  it('reports combat records when only tombstones are present', () => {
    const state = createCampaignState() as unknown as { entities: Record<string, unknown> };
    state.entities.combatTombstones = [{ id: 'gone' }];
    expect(playerProjectionGaps(state)).toEqual(['past combat records (history and defeated combatants)']);
  });
});
