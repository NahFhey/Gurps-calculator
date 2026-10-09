/**
 * Client campaign decoder (docs/TYPED_BOUNDARIES_PLAN.md §2.3, TB3): shared
 * structural decode → loose slice schemas → repairs. Every failure is a
 * result, never a throw, and nothing it does not understand is dropped.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { campaignReducer, createCampaignState, type CampaignState } from '../../state/campaignReducer';
import { createNewMap } from '../../utils/mapUtils';
import { decodeCampaign, parseCampaignDTO, prepareCheckpointRestore } from '../decodeCampaign';
import { toCampaignDTO, type CampaignDTO } from '../campaignCodec';
import { hydrateCampaignState } from '../campaignRepair';
import {
  getCampaignLoadIssue,
  loadCampaignState,
  resetRevisionGuard,
  saveCampaignState,
  serializeCampaignState,
} from '../campaignStorage';
import { createMemoryAssetStore, setAssetStoreForTests } from '../../assets/assetStore';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** A real campaign with a fogged map and a character carrying a persistent condition. */
function campaign(): CampaignState {
  const state = createCampaignState();
  const map = createNewMap({ name: 'Vale', scale: '12mi', startTerrainId: 'plains' });
  map.revealedTileIds = new Set([...map.revealedTileIds, 'tile-extra']);
  const [characterId, character] = Object.entries(state.entities.characters)[0];
  return {
    ...state,
    time: { ...state.time, day: 9 },
    maps: { ...state.maps, mapsById: { [map.id]: map }, activeMapId: map.id },
    entities: {
      ...state.entities,
      characters: {
        ...state.entities.characters,
        [characterId]: {
          ...character,
          status: { ...character.status, conditions: [{ instanceId: 'c-1', conditionId: 'stunned', label: 'Stunned' }] },
        },
      },
    },
  };
}

/** The campaign as saved JSON, edited by `edit`. */
function savedJson(edit: (json: Json) => void = () => {}): Json {
  const json: Json = JSON.parse(JSON.stringify(serializeCampaignState(campaign())));
  edit(json);
  return json;
}

const firstMap = (json: Json): Json => Object.values(json.maps.mapsById)[0] as Json;
const firstCharacter = (json: Json): Json => Object.values(json.entities.characters)[0] as Json;

describe('decodeCampaign', () => {
  it('decodes a saved campaign into runtime state (Sets revived, version stamped)', () => {
    const result = decodeCampaign(JSON.stringify(savedJson()));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.time.day).toBe(9);
    expect(Object.values(result.state.maps.mapsById)[0].revealedTileIds.has('tile-extra')).toBe(true);
    expect(result.state.combat.reveal.revealedTargets).toBeInstanceOf(Set);
    expect(result.state.meta.schemaVersion).toBe('1.7.0');
  });

  it.each([
    ['a reveal that is a string', (j: Json) => { j.combat.reveal = 'x'; }],
    ['revealed targets that are a string', (j: Json) => { j.combat.reveal.revealedTargets = 'hero'; }],
    ['revealed HP holding non-strings', (j: Json) => { j.combat.reveal.revealedHP = [1, 2]; }],
    ['revealed defense values that are an array', (j: Json) => { j.combat.reveal.revealedDefenseValues = []; }],
    ['a map registry that is an array', (j: Json) => { j.maps.mapsById = []; }],
    ['a map that is a string', (j: Json) => { j.maps.mapsById.broken = 'map'; }],
    ['revealed tiles that are a number', (j: Json) => { firstMap(j).revealedTileIds = 5; }],
    ['checkpoint entries that are an object', (j: Json) => { j.checkpoints.entries = {}; }],
    ['a checkpoint without an id', (j: Json) => { j.checkpoints.entries = [{ label: 'x', snapshot: {} }]; }],
    ['a checkpoint whose snapshot is a string', (j: Json) => { j.checkpoints.entries = [{ id: 'cp', snapshot: 'x' }]; }],
    ['a character registry that is an array', (j: Json) => { j.entities.characters = []; }],
    ['a character that is a number', (j: Json) => { j.entities.characters.broken = 7; }],
    ['an inventory registry entry that is null', (j: Json) => { j.entities.inventories.broken = null; }],
    ['food types that are an object', (j: Json) => { j.entities.foodTypes = {}; }],
    ['combat history that is an object', (j: Json) => { j.entities.combatHistory = {}; }],
    ['deleted template ids that are a string', (j: Json) => { j.entities.deletedBuiltinTemplateIds = 'a'; }],
    ['persisted conditions that are a string', (j: Json) => { firstCharacter(j).status.conditions = 'stunned'; }],
    ['a persisted condition without an instance id', (j: Json) => {
      firstCharacter(j).status.conditions = [{ conditionId: 'stunned', label: 'Stunned' }];
    }],
    ['a persisted condition whose label is a number', (j: Json) => {
      firstCharacter(j).status.conditions = [{ instanceId: 'c-1', conditionId: 'stunned', label: 5 }];
    }],
    ['a persisted condition whose condition id is a number', (j: Json) => {
      firstCharacter(j).status.conditions = [{ instanceId: 'c-1', conditionId: 3, label: 'Stunned' }];
    }],
  ])('returns invalid (not a throw) for %s', (_label, edit) => {
    const result = decodeCampaign(JSON.stringify(savedJson(edit)));
    // The validation stage must refuse it: a repair-stage TypeError would also be `invalid`.
    expect(result).toEqual({ ok: false, reason: 'invalid', detail: expect.stringMatching(/^Invalid campaign at /) });
  });

  it.each([
    ['travel group members that are a string', (j: Json) => {
      j.entities.travelGroups = { tg1: { id: 'tg1', name: 'The Party', memberIds: 'pc1', vehicleId: null, position: null } };
    }],
    ['a location that is null', (j: Json) => { j.locations.locations = { loc1: null }; }],
  ])('returns invalid (not a throw) when a repair throws on %s', (_label, edit) => {
    // Passes the slice schemas (they do not cover these slices); the repairs then throw.
    const result = decodeCampaign(JSON.stringify(savedJson(edit)));
    expect(result).toEqual({ ok: false, reason: 'invalid', detail: expect.stringMatching(/^TypeError: /) });
  });

  it.each([
    ['revealed tiles left as {} by a pre-fix snapshot', (j: Json) => { firstMap(j).revealedTileIds = {}; }],
    ['revealed tiles that are null', (j: Json) => { firstMap(j).revealedTileIds = null; }],
    ['revealed targets left as {}', (j: Json) => { j.combat.reveal.revealedTargets = {}; }],
    ['no combat slice', (j: Json) => { delete j.combat; }],
    ['no maps slice', (j: Json) => { delete j.maps; }],
    ['no checkpoints slice', (j: Json) => { delete j.checkpoints; }],
    ['a character without status', (j: Json) => { delete firstCharacter(j).status; }],
  ])('accepts %s', (_label, edit) => {
    expect(decodeCampaign(savedJson(edit)).ok).toBe(true);
  });

  it('passes the shared reasons through', () => {
    expect(decodeCampaign('{oops')).toMatchObject({ ok: false, reason: 'not-json' });
    expect(decodeCampaign({ materials: [] })).toMatchObject({ ok: false, reason: 'not-a-campaign' });
    expect(decodeCampaign(savedJson((j) => { j.meta.schemaVersion = '1.6.x'; }))).toMatchObject({ ok: false, reason: 'malformed-version' });
    expect(decodeCampaign(savedJson((j) => { j.meta.schemaVersion = '2.0.0'; }))).toMatchObject({ ok: false, reason: 'future-version' });
  });

  it('keeps unknown fields at the root, in a slice and deep inside an entity through decode and save', () => {
    const json = savedJson((j) => {
      j.futureRoot = { kept: true };
      j.combat.futureSlice = [1, 2, 3];
      firstCharacter(j).futureNested = { deep: 'yes' };
      firstMap(j).futureMapField = 'kept';
      j.combat.reveal.futureReveal = 1;
    });
    const result = decodeCampaign(json);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const saved: Json = JSON.parse(JSON.stringify(serializeCampaignState(result.state)));
    expect(saved.futureRoot).toEqual({ kept: true });
    expect(saved.combat.futureSlice).toEqual([1, 2, 3]);
    expect(firstCharacter(saved).futureNested).toEqual({ deep: 'yes' });
    expect(firstMap(saved).futureMapField).toBe('kept');
    expect(saved.combat.reveal.futureReveal).toBe(1);
  });
});

describe('parseCampaignDTO', () => {
  it('validates without repairing: the DTO is the input, unknown keys and all', () => {
    const json = savedJson((j) => { j.futureRoot = 1; });
    const result = parseCampaignDTO(json);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dto).toEqual(json);
    // Zod's output, not the caller's object (value-equal either way).
    expect(result.dto).not.toBe(json);
    expect(result.dto.maps).not.toBe(json.maps);
  });

  it('refuses a malformed slice with reason invalid', () => {
    expect(parseCampaignDTO(savedJson((j) => { j.combat.reveal = 'x'; }))).toMatchObject({ ok: false, reason: 'invalid' });
  });
});

describe('repair stage (hydrateCampaignState)', () => {
  // decodeCampaign refuses these first; repair's own check is reached only by direct callers.
  it('refuses a campaign from a newer build', () => {
    const dto = savedJson((j) => { j.meta.schemaVersion = '1.99.0'; }) as CampaignDTO;
    expect(() => hydrateCampaignState(dto)).toThrow(/newer version of the app/);
  });

  it('refuses a malformed schema version', () => {
    const dto = savedJson((j) => { j.meta.schemaVersion = '1.6.x'; }) as CampaignDTO;
    expect(() => hydrateCampaignState(dto)).toThrow(/malformed schema version/);
  });
});

describe('local load through the decoder', () => {
  beforeEach(() => {
    setAssetStoreForTests(createMemoryAssetStore());
    localStorage.clear();
    resetRevisionGuard();
  });

  it.each([
    ['a malformed reveal object', (j: Json) => { j.combat.reveal = 'x'; }],
    ['a malformed map', (j: Json) => { j.maps.mapsById.broken = 'map'; }],
  ])('reports %s as an invalid load issue, keeps the bytes and blocks saves', async (_label, edit) => {
    const raw = JSON.stringify(savedJson(edit));
    localStorage.setItem('campaignState', raw);

    const loaded = await loadCampaignState();

    expect(getCampaignLoadIssue()?.kind).toBe('invalid');
    expect(getCampaignLoadIssue()?.raw).toBe(raw);
    await expect(saveCampaignState(loaded)).rejects.toThrow();
    expect(localStorage.getItem('campaignState')).toBe(raw);
  });

  it('keeps unknown fields at three depths through load → save', async () => {
    localStorage.setItem('campaignState', JSON.stringify(savedJson((j) => {
      j.futureRoot = 'r';
      j.time.futureSlice = 's';
      firstCharacter(j).futureNested = 'n';
    })));

    const loaded = await loadCampaignState();
    expect(getCampaignLoadIssue()).toBeNull();
    await saveCampaignState(loaded);

    const saved: Json = JSON.parse(localStorage.getItem('campaignState')!);
    expect(saved.futureRoot).toBe('r');
    expect(saved.time.futureSlice).toBe('s');
    expect(firstCharacter(saved).futureNested).toBe('n');
  });
});

describe('prepareCheckpointRestore', () => {
  /** A campaign with one checkpoint whose snapshot is edited by `edit`, then moved on to day 40. */
  function withCheckpoint(edit: (snapshot: Json) => void = () => {}): { state: CampaignState; id: string } {
    const created = campaignReducer(campaign(), { type: 'createCheckpoint', payload: 'test' });
    const entry = created.checkpoints.entries[0];
    const snapshot: Json = JSON.parse(JSON.stringify(entry.snapshot));
    edit(snapshot);
    const state: CampaignState = {
      ...created,
      time: { ...created.time, day: 40 },
      checkpoints: { ...created.checkpoints, entries: [{ ...entry, snapshot: snapshot as CampaignDTO }] },
    };
    return { state, id: entry.id };
  }

  it('restores the snapshot through the decoder', () => {
    const { state, id } = withCheckpoint();
    const prepared = prepareCheckpointRestore(state, id);
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    const restored = campaignReducer(state, prepared.action);
    expect(restored.time.day).toBe(9);
    expect(restored.checkpoints.entries).toHaveLength(1);
    expect(restored.logs.entries[0].type).toBe('campaign.rollback');
  });

  it('runs the repairs on a pre-contract snapshot (meta 1.0.0, missing a repaired field)', () => {
    const { state, id } = withCheckpoint((snapshot) => {
      snapshot.meta.schemaVersion = '1.0.0';
      delete firstMap(snapshot).climate;
      delete firstMap(snapshot).visionMode;
    });
    const prepared = prepareCheckpointRestore(state, id);
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    const restored = campaignReducer(state, prepared.action);
    const map = Object.values(restored.maps.mapsById)[0];
    expect(map.climate).toBe('temperate');
    expect(map.visionMode).toBe('lineOfSight');
    expect(restored.meta.schemaVersion).toBe('1.7.0');
  });

  it('refuses a snapshot from a newer build, so state stays unchanged', () => {
    const { state, id } = withCheckpoint((snapshot) => { snapshot.meta.schemaVersion = '1.99.0'; });
    expect(prepareCheckpointRestore(state, id)).toEqual({ ok: false, error: expect.stringContaining('newer version') });
  });

  it('refuses a malformed snapshot', () => {
    const { state, id } = withCheckpoint((snapshot) => { snapshot.combat.reveal = 'x'; });
    expect(prepareCheckpointRestore(state, id)).toEqual({ ok: false, error: expect.any(String) });
  });

  it('refuses a snapshot that cannot be serialized', () => {
    const state = createCampaignState();
    const circular: Json = { ...toCampaignDTO(state) };
    circular.self = circular;
    state.checkpoints.entries.push({ id: 'bad-cp', label: 'bad', createdAt: 0, snapshot: circular as CampaignDTO });
    expect(prepareCheckpointRestore(state, 'bad-cp')).toEqual({ ok: false, error: expect.any(String) });
  });

  it('refuses an unknown checkpoint id', () => {
    expect(prepareCheckpointRestore(createCampaignState(), 'missing')).toEqual({ ok: false, error: expect.any(String) });
  });

  it('the reducer ignores a restore whose checkpoint is gone', () => {
    const { state, id } = withCheckpoint();
    const prepared = prepareCheckpointRestore(state, id);
    if (!prepared.ok) throw new Error(prepared.error);
    const pruned = { ...state, checkpoints: { ...state.checkpoints, entries: [] } };
    expect(campaignReducer(pruned, prepared.action)).toBe(pruned);
  });
});

describe('decoder ownership', () => {
  it('no production file except decodeCampaign.ts calls hydrateCampaignState', () => {
    const srcRoot = resolve(__dirname, '../..');
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) {
          if (name !== '__tests__' && name !== 'test') walk(path);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(name) || /\.test\.tsx?$/.test(name)) continue;
        const rel = relative(srcRoot, path).split(sep).join('/');
        if (rel === 'persistence/decodeCampaign.ts' || rel === 'persistence/campaignRepair.ts') {
          // campaignRepair.ts defines it; decodeCampaign.ts is its one caller.
          if (rel === 'persistence/campaignRepair.ts' && /hydrateCampaignState\(/.test(
            readFileSync(path, 'utf8').replace(/export const hydrateCampaignState = \(/, ''),
          )) offenders.push(rel);
          continue;
        }
        if (/hydrateCampaignState\(/.test(readFileSync(path, 'utf8'))) offenders.push(rel);
      }
    };
    walk(srcRoot);
    expect(offenders).toEqual([]);
  });

  it.each([
    'components/DebugPanel.tsx',
    'net/SyncProvider.tsx',
    'components/ConnectionDialog.tsx',
    'utils/campaignImport.ts',
    'persistence/campaignStorage.ts',
    'state/campaignStore.tsx',
  ])('%s never calls JSON.parse (the decoder parses)', (rel) => {
    expect(readFileSync(resolve(__dirname, '../..', rel), 'utf8')).not.toMatch(/JSON\.parse\(/);
  });
});
