import type { Id } from '../../types/campaign';
import type { MapId } from '../../types/map';
import type { CampaignState } from '../campaignReducer';
import { groupsOnMap, resolveGroupPosition, vehiclesOnMap } from '../../utils/partyPosition';
export { resolveTravelEventTable } from '../../utils/travelEvents';

export const selectTravelGroups = (state: CampaignState) => state.entities.travelGroups ?? {};

export const selectActiveTravelGroup = (state: CampaignState) => {
  const groups = selectTravelGroups(state);
  return (state.ui.activeTravelGroupId ? groups[state.ui.activeTravelGroupId] : undefined)
    ?? Object.values(groups)[0]
    ?? null;
};

export const selectGroupPosition = (state: CampaignState, groupId: Id) => {
  const group = selectTravelGroups(state)[groupId];
  return group ? resolveGroupPosition(state, group) : null;
};

export const selectVehicles = (state: CampaignState) => state.entities.vehicles ?? {};

export const selectVehicleTypes = (state: CampaignState) => state.entities.vehicleTypes ?? {};

export const selectTravelEventTables = (state: CampaignState) => state.entities.travelEventTables ?? {};

export const selectTravelEventTableSets = (state: CampaignState) => state.entities.travelEventTableSets ?? {};

export const selectGroupsAboardVehicle = (state: CampaignState, vehicleId: Id) =>
  Object.values(selectTravelGroups(state)).filter((group) => group.vehicleId === vehicleId);

export const selectGroupsOnMap = (state: CampaignState, mapId: MapId) => groupsOnMap(state, mapId);

export const selectVehiclesOnMap = (state: CampaignState, mapId: MapId) => vehiclesOnMap(state, mapId);

export const selectActiveJourneys = (state: CampaignState) =>
  Object.values(selectTravelGroups(state)).flatMap((group) =>
    group.journey?.status === 'active' ? [{ group, journey: group.journey }] : []
  );

export const selectGroupJourney = (state: CampaignState, groupId: Id) =>
  selectTravelGroups(state)[groupId]?.journey ?? null;
