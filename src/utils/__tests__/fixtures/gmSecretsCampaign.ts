/**
 * A campaign carrying one GM secret of every kind the player projection
 * redacts, next to player-visible data that must survive. Every secret string
 * contains `SECRET` so a test can sweep a serialized payload for leftovers.
 */
import { imageLayer, imageState } from '../../../assets/__tests__/fixtures';
import type { CampaignState } from '../../../state/campaignReducer';
import type { CombatState, Participant } from '../../../types/combatTracker';
import { participantToken } from '../../mapTokenSpatial';
import { createDefaultLocation } from '../../weatherSystem';

export const SECRET_MARKER = 'SECRET';

export function gmSecretsCampaign() {
  const { state, map } = imageState([
    imageLayer({ id: 'public-layer', name: 'Terrain', src: 'data:image/jpeg;base64,AQID' }),
    imageLayer({ id: 'gm-layer', name: 'SECRET trap overlay', src: 'data:image/png;base64,BAUG', gmOnly: true }),
  ]);
  state.ui = { ...state.ui, gmModeEnabled: true, gmSessionUnlocked: true };
  state.time = { ...state.time, day: 42 };

  state.entities.alchemyReagents = {
    unknown: {
      id: 'unknown', name: 'Grey Dust', quantity: 2, identificationLevel: 0,
      aspects: { primary: 'SECRET-fire', secondary: 'SECRET-ash', tertiary: 'SECRET-smoke' },
      roles: ['Solvent', 'SECRET-Catalyst'], primaryRole: 'SECRET-Catalyst', hazards: ['SECRET volatile'],
      basePotency: 'SECRET-P3', refinement: 'refined', concentrationSteps: 2, processingNotes: 'SECRET process',
      effectFamily: 'SECRET-family', potency: 7, notes: 'SECRET harvested under a new moon',
    },
    disguised: {
      id: 'disguised', name: 'Blue Petal', quantity: 1, identificationLevel: 2,
      aspects: { primary: 'SECRET-true-primary', secondary: 'SECRET-true-secondary', tertiary: 'SECRET-true-tertiary' },
      falseProfile: { aspects: { primary: 'Water', secondary: 'Ice', tertiary: 'Mist-SECRET' }, hazards: ['SECRET fake hazard'] },
      roles: ['Binder'], effectFamily: 'SECRET-true-family', potency: 9,
    },
    identified: {
      id: 'identified', name: 'Ember Moss', quantity: 3, identificationLevel: 4,
      aspects: { primary: 'Fire', secondary: 'Heat', tertiary: 'Light' },
      hazards: ['Burns when wet'], roles: ['Catalyst'], primaryRole: 'Catalyst', basePotency: 'P2',
      refinement: 'prepared', concentrationSteps: 1, processingNotes: 'Dry first', effectFamily: 'Flame', potency: 2,
    },
  };
  state.entities.alchemyFormulas = {
    tonic: {
      id: 'tonic', name: 'Warming Tonic', tier: 2,
      notes: 'SECRET formula note', hazards: ['SECRET hazard'],
      // Fields the alchemy engine writes that AlchemyFormula / AlchemyBatch do not declare.
      ...{ hazardEvaluation: { count: 1, details: ['SECRET evaluation'] } },
    },
  };
  state.entities.alchemyBatches = {
    brew: {
      id: 'brew', formulaId: 'tonic', status: 'brewing', worker: 'Ada', startDate: 'Day 40', startDay: 40, tier: 2,
      ...{ gmHazards: ['SECRET gm hazard'], hazardDetails: ['SECRET detail'], gmNotes: 'SECRET batch note', hazardsPublic: ['Smells odd'] },
    },
  };
  state.entities.effectFamilyMap = {
    'Fire|Water': {
      summary: 'Steam',
      effects: [
        { id: 'hidden', name: 'Scald', keywords: 'heat', notes: 'Player note', gmNotes: 'SECRET effect note', gmNotesVisible: false },
        { id: 'shared', name: 'Mist', keywords: 'fog', notes: 'Player note', gmNotes: 'Shared GM note', gmNotesVisible: true },
      ],
    },
  };

  const location = { ...createDefaultLocation({ day: 1, slot: 0 }), id: 'loc', name: 'Thornwood', gmNotes: 'SECRET bandit camp' };
  state.locations = { ...state.locations, locations: { ...state.locations.locations, loc: location } };

  state.logs = {
    entries: [
      { id: 'gm', timestamp: 3, type: 'combat.defeated', visibility: 'gmOnly', payload: { message: 'SECRET ambush prepared' } },
      { id: 'mixed', timestamp: 2, type: 'combat.injured', visibility: 'mixed',
        payload: { message: 'SECRET Baron Vex lost 6 HP', maskedMessage: 'A combatant was injured', title: 'Combat: injured', characterName: 'SECRET Baron Vex' },
        meta: { characterNames: ['SECRET Baron Vex'], characterIds: ['SECRET-npc'], quantity: 6 } },
      { id: 'public', timestamp: 1, type: 'travel.departed', visibility: 'player', payload: { message: 'The party set out' },
        meta: { characterNames: ['Ada'] } },
    ],
  };

  const gmTile = map.grid[0][0];
  const playerTile = map.grid[0][1];
  map.markersById = {
    trap: { id: 'trap', tileId: gmTile, type: 'danger', label: 'SECRET pit trap', visibility: 'gm' },
    inn: { id: 'inn', tileId: playerTile, type: 'settlement', label: 'Inn', visibility: 'player' },
  };
  map.tilesById[gmTile].markerIds = ['trap'];
  map.tilesById[playerTile].markerIds = ['inn'];

  const npc = (instanceId: string): Participant => ({ instanceId, id: instanceId, name: `NPC ${instanceId}`, category: 'enemy',
    st: 10, dx: 10, iq: 10, ht: 10, hp: 10, fp: 10, mp: 0, basicSpeed: 5, basicMove: 5 });
  const hidden = { ...participantToken(npc('hidden'), 'placed', { col: 2, row: 2 }), id: 'hidden-token',
    label: 'SECRET Assassin', playerDisplay: { visible: false, label: 'Token' } };
  const masked = { ...participantToken(npc('masked'), 'placed', { col: 3, row: 2 }), id: 'masked-token',
    label: 'SECRET Baron Vex', playerDisplay: { visible: true, label: 'Hooded figure' } };
  const fighting = { ...participantToken(npc('fighting'), 'placed', { col: 4, row: 2 }), id: 'fighting-token',
    playerDisplay: { visible: false, label: 'Token' } };
  map.tokens = { ...map.tokens, [hidden.id]: hidden, [masked.id]: masked, [fighting.id]: fighting };
  const fighter = { ...npc('fighting'), tokenRef: { mapId: map.id, tokenId: fighting.id } };
  const combat: CombatState = { id: 'fight', name: 'Ambush', startTime: 1, mapId: map.id, participants: [fighter],
    currentRound: 1, currentTurnIndex: 0, turnOrder: ['fighting'], turnDecisions: {}, log: [] };
  state.combat = { ...state.combat, activeSession: combat };

  state.legacy = { appState: {
    gmNotes: 'SECRET legacy notes',
    gmCustomRules: ['SECRET rule'],
    alchemyReagents: [{ id: 'old', name: 'Old Root', identificationLevel: 0, aspects: { primary: 'SECRET-old' }, notes: 'SECRET old note' }],
  } };

  const snapshot: CampaignState = JSON.parse(JSON.stringify({ ...state, checkpoints: { ...state.checkpoints, entries: [] } }));
  state.checkpoints = { ...state.checkpoints, entries: [{ id: 'cp', label: 'Before SECRET reveal', createdAt: 1, snapshot }] };

  return { state, map, gmTile, playerTile };
}

/** JSON paths of every key or string value that contains SECRET_MARKER; [] when the payload is clean. */
export function secretPaths(value: unknown, path = '$'): string[] {
  if (typeof value === 'string') return value.includes(SECRET_MARKER) ? [path] : [];
  if (value instanceof Set) return secretPaths(Array.from(value), path);
  if (Array.isArray(value)) return value.flatMap((item, index) => secretPaths(item, `${path}[${index}]`));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, item]) => [
      ...(key.includes(SECRET_MARKER) ? [`${path}.${key}`] : []),
      ...secretPaths(item, `${path}.${key}`),
    ]);
  }
  return [];
}
