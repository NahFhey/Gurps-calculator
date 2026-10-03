/**
 * Player-safe projection of a serialized campaign.
 *
 * Used wherever campaign data leaves the GM: the public half of a locked export
 * and the server's campaign GET for non-GM roles. It keeps the CampaignState
 * shape (the player client loads it as a campaign) and removes what the UI
 * already hides from players. Client-side visibility checks cannot protect data
 * that has been transmitted, so this runs before transmission.
 *
 * Shared by client and server: plain JSON in, plain JSON out, no imports.
 *
 * Not covered yet (needs typed player DTOs, see docs/REFACTOR_HANDOFF.md):
 * combat sessions and history, fog of war, persistent condition reveal state,
 * and the asset route.
 */

type Json = Record<string, unknown>;

const isObj = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const objectValues = (value: unknown): Json[] =>
  isObj(value) ? Object.values(value).filter(isObj) : [];

const arrayItems = (value: unknown): Json[] =>
  Array.isArray(value) ? value.filter(isObj) : [];

/** Roles a player can see on any reagent without identification (mirrors getVisibleReagentInfo). */
const PHYSICAL_ROLES = ['Solvent', 'Binder', 'Tool'];

/**
 * Reagent fields shown only at identification level 4, read from the false profile when present.
 * `effectFamily` and `potency` are not shown by the reagent UI at all; they are gated the same way
 * so a disguised reagent never carries its real values.
 */
const FULLY_IDENTIFIED_FIELDS = [
  'basePotency', 'hazards', 'primaryRole', 'refinement', 'concentrationSteps', 'processingNotes',
  'effectFamily', 'potency',
] as const;

function redactReagent(reagent: Json, showObviousRoles: boolean): void {
  const level = Number(reagent.identificationLevel) || 0;
  const profile = isObj(reagent.falseProfile) ? reagent.falseProfile : reagent;
  const aspects = isObj(profile.aspects) ? profile.aspects : {};

  if (level >= 4) {
    if (isObj(profile.aspects)) reagent.aspects = profile.aspects;
    else delete reagent.aspects;
  } else if (level >= 1) {
    const visible: Json = {};
    const keys = ['primary', 'secondary', 'tertiary'].slice(0, level);
    for (const key of keys) if (aspects[key] !== undefined) visible[key] = aspects[key];
    reagent.aspects = visible;
  } else {
    delete reagent.aspects;
  }

  for (const field of FULLY_IDENTIFIED_FIELDS) {
    if (level >= 4 && profile[field] !== undefined) reagent[field] = profile[field];
    else delete reagent[field];
  }

  if (level >= 4) {
    if (profile.roles !== undefined) reagent.roles = profile.roles;
    else delete reagent.roles;
  } else {
    const realRoles = Array.isArray(reagent.roles) ? reagent.roles : [];
    const obvious = showObviousRoles ? realRoles.filter((role) => PHYSICAL_ROLES.includes(role as string)) : [];
    if (obvious.length > 0) reagent.roles = obvious;
    else delete reagent.roles;
  }

  delete reagent.notes;
  delete reagent.falseProfile;
}

function redactFormula(formula: Json): void {
  delete formula.notes;
  delete formula.hazardEvaluation;
  delete formula.hazards;
}

function redactBatch(batch: Json): void {
  delete batch.gmHazards;
  delete batch.hazardDetails;
  delete batch.gmNotes;
}

function redactEffectFamilyMap(map: unknown): void {
  for (const pair of objectValues(map)) {
    for (const effect of arrayItems(pair.effects)) {
      if (effect.gmNotesVisible !== true) delete effect.gmNotes;
    }
  }
}

/** Alchemy and effect secrets, for either the campaign (records) or the legacy flat layout (arrays). */
function redactAlchemy(container: Json, items: (value: unknown) => Json[]): void {
  const settings = isObj(container.alchemySettings) ? container.alchemySettings : {};
  const showObviousRoles = settings.showObviousRoles !== false;
  for (const reagent of items(container.alchemyReagents)) redactReagent(reagent, showObviousRoles);
  for (const formula of items(container.alchemyFormulas)) redactFormula(formula);
  for (const batch of items(container.alchemyBatches)) redactBatch(batch);
  redactEffectFamilyMap(container.effectFamilyMap);
}

function redactLogs(logs: unknown): void {
  if (!isObj(logs) || !Array.isArray(logs.entries)) return;
  logs.entries = logs.entries.filter((entry) => !(isObj(entry) && entry.visibility === 'gmOnly'));
  for (const entry of arrayItems(logs.entries)) {
    if (entry.visibility !== 'mixed') continue;
    const payload = isObj(entry.payload) ? entry.payload : {};
    const masked = typeof payload.maskedMessage === 'string' ? payload.maskedMessage : undefined;
    // Players see only the masked text (ChangelogTab); title and meta (names, quantities) stay with the GM.
    entry.payload = {
      message: masked ?? 'Details hidden in player mode.',
      ...(masked !== undefined ? { maskedMessage: masked } : {}),
    };
    delete entry.meta;
  }
}

/** `mapId|tokenId` keys of tokens that stand for a participant in the running combat. */
function activeCombatTokenKeys(state: Json): Set<string> {
  const keys = new Set<string>();
  const combat = isObj(state.combat) ? state.combat : {};
  const session = isObj(combat.activeSession) ? combat.activeSession : {};
  for (const participant of arrayItems(session.participants)) {
    const ref = participant.tokenRef;
    if (isObj(ref)) keys.add(`${String(ref.mapId)}|${String(ref.tokenId)}`);
  }
  return keys;
}

function redactMaps(state: Json): void {
  const maps = isObj(state.maps) ? state.maps : {};
  const combatTokens = activeCombatTokenKeys(state);

  // The stamp library is GM-only (MapPanel shows it in GM mode); keep the key for the shape.
  if (maps.stamps !== undefined) maps.stamps = {};

  for (const [mapId, map] of Object.entries(isObj(maps.mapsById) ? maps.mapsById : {})) {
    if (!isObj(map)) continue;

    if (isObj(map.markersById)) {
      const hidden = new Set<string>();
      for (const [markerId, marker] of Object.entries(map.markersById)) {
        if (isObj(marker) && marker.visibility === 'gm') hidden.add(markerId);
      }
      for (const markerId of hidden) delete map.markersById[markerId];
      if (hidden.size > 0) {
        for (const tile of objectValues(map.tilesById)) {
          if (Array.isArray(tile.markerIds)) tile.markerIds = tile.markerIds.filter((id) => !hidden.has(id as string));
        }
      }
    }

    if (Array.isArray(map.imageLayers)) {
      map.imageLayers = map.imageLayers.filter((layer) => !(isObj(layer) && layer.gmOnly === true));
    }

    if (isObj(map.tokens)) {
      for (const [tokenId, token] of Object.entries(map.tokens)) {
        if (!isObj(token) || !isObj(token.playerDisplay)) continue;
        const display = token.playerDisplay;
        if (display.visible === false && !combatTokens.has(`${mapId}|${tokenId}`)) {
          delete map.tokens[tokenId];
          continue;
        }
        if (typeof display.label === 'string') token.label = display.label;
      }
    }
  }
}

/**
 * Returns a deep copy of `state` with GM-only content removed. Sets are
 * serialized as arrays (the export format). Input that is not a campaign-shaped
 * object passes through as a copy with only the fields it has redacted.
 */
export function projectCampaignForPlayers<T extends object>(state: T): T {
  const projected = JSON.parse(JSON.stringify(state, (_key, value: unknown) =>
    value instanceof Set ? Array.from(value) : value)) as Json;

  // (A) GM mode never travels.
  if (isObj(projected.ui)) {
    projected.ui.gmModeEnabled = false;
    projected.ui.gmSessionUnlocked = false;
    projected.ui.pendingIntent = null;
  }

  // (B) Checkpoint snapshots embed every secret; import ignores them anyway.
  if (isObj(projected.checkpoints) && Array.isArray(projected.checkpoints.entries)) {
    projected.checkpoints.entries = [];
  }

  // (C)-(E) Alchemy identification, formula/batch GM fields, effect GM notes.
  if (isObj(projected.entities)) redactAlchemy(projected.entities, objectValues);
  // (I) Pre-campaign data kept under legacy.appState uses the flat array layout.
  if (isObj(projected.legacy) && isObj(projected.legacy.appState)) {
    const appState = projected.legacy.appState;
    redactAlchemy(appState, arrayItems);
    delete appState.gmNotes;
    delete appState.gmCustomRules;
  }

  // (F) Location GM notes.
  if (isObj(projected.locations)) {
    for (const location of objectValues(projected.locations.locations)) delete location.gmNotes;
  }

  // (G) Log visibility.
  redactLogs(projected.logs);

  // (H) GM markers, layers and stamps, hidden tokens, player-facing token labels.
  redactMaps(projected);

  return projected as T;
}

/**
 * Content present in `state` that the projection does not hide yet, as short
 * labels for a warning. Empty when the projection covers everything present.
 */
export function playerProjectionGaps(state: object): string[] {
  const root = state as Json;
  const combat = isObj(root.combat) ? root.combat : {};
  const entities = isObj(root.entities) ? root.entities : {};
  const gaps: string[] = [];
  if (isObj(combat.activeSession)) gaps.push('the running combat encounter');
  const history = Array.isArray(entities.combatHistory) ? entities.combatHistory : [];
  const tombstones = Array.isArray(entities.combatTombstones) ? entities.combatTombstones : [];
  if (history.length > 0 || tombstones.length > 0) gaps.push('past combat records (history and defeated combatants)');
  return gaps;
}
