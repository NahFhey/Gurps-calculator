import type { TravelEventEntry, TravelEventTable, TravelEventTableSet } from '../types/travelEvents';

function entry(
  id: string,
  kind: TravelEventEntry['kind'],
  weight: number,
  name: string,
  description: string,
  extra: Partial<TravelEventEntry> = {}
): TravelEventEntry {
  return { id, kind, weight, name, description, ...extra };
}

function table(
  terrain: string,
  name: string,
  flavor: [string, string, string, string],
  hazards: [TravelEventEntry, TravelEventEntry],
  encounterName: string
): TravelEventTable {
  const id = `travel-events-${terrain}`;
  return {
    id,
    name: `${name} Travel Events`,
    description: `Roadside events for ${name.toLowerCase()} terrain.`,
    builtin: true,
    entries: [
      entry(`${id}-nothing`, 'nothing', 65, 'Uneventful passage', 'The journey continues without incident.'),
      entry(`${id}-flavor-1`, 'flavor', 10, flavor[0], flavor[1]),
      entry(`${id}-flavor-2`, 'flavor', 9, flavor[2], flavor[3]),
      hazards[0],
      hazards[1],
      entry(`${id}-encounter`, 'encounter', 4, encounterName, 'Someone or something bars the way.', {
        encounterTemplateId: null,
      }),
    ],
  };
}

export const TRAVEL_EVENT_TABLE_SEEDS: TravelEventTable[] = [
  table('plains', 'Plains', ['Distant herd', 'A herd moves across the horizon.', 'Open sky', 'The broad sky makes the miles feel small.'], [
    entry('travel-events-plains-squall', 'hazard', 7, 'Sudden squall', 'Driving rain slows the party.', { hazard: { lostMiles: 3 }, conditions: { weatherTypes: ['rain', 'heavyRain', 'thunderstorm'] } }),
    entry('travel-events-plains-dark-march', 'hazard', 5, 'Exhausting dark march', 'Broken ground is treacherous in darkness.', { hazard: { fpLossFormula: '1d6-2' }, conditions: { nightOnly: true } }),
  ], 'Figures on the horizon'),
  table('forest', 'Forest', ['Birdsign', 'A sudden chorus rolls through the canopy.', 'Ancient grove', 'Old trees crowd close around the trail.'], [
    entry('travel-events-forest-deadfall', 'hazard', 7, 'Deadfall detour', 'A fallen giant forces a long detour.', { hazard: { lostMiles: 4 } }),
    entry('travel-events-forest-thorns', 'hazard', 5, 'Thorn-choked path', 'Hooked briars sap the travelers strength.', { hazard: { fpLossFormula: '1d6-3' } }),
  ], 'Movement in the trees'),
  table('hills', 'Hills', ['Far-off bells', 'Faint bells carry between the ridges.', 'Wind-carved stones', 'Strange pillars mark an old path.'], [
    entry('travel-events-hills-washout', 'hazard', 7, 'Washed-out trail', 'A ravine consumes hard-won distance.', { hazard: { lostMiles: 5 } }),
    entry('travel-events-hills-dark-march', 'hazard', 5, 'Exhausting dark march', 'Every unseen slope steals more strength.', { hazard: { fpLossFormula: '1d6-2' }, conditions: { nightOnly: true } }),
  ], 'Ridge-line confrontation'),
  table('mountains', 'Mountains', ['Eagle shadow', 'A great bird circles on the thermals.', 'Echoing valley', 'Every sound returns from the stone.'], [
    entry('travel-events-mountains-rockslide', 'hazard', 7, 'Rockslide', 'Loose stone crashes across the route.', { hazard: { hpLossFormula: '1d6-3' } }),
    entry('travel-events-mountains-scree', 'hazard', 5, 'Scree traverse', 'Unstable footing costs precious distance.', { hazard: { lostMiles: 5 } }),
  ], 'Mountain ambush'),
  table('swamp', 'Swamp', ['Ghost lights', 'Pale lights dance over dark water.', 'Chorus of frogs', 'The marsh erupts into deafening song.'], [
    entry('travel-events-swamp-mire', 'hazard', 7, 'Sucking mire', 'Deep mud swallows hours of progress.', { hazard: { lostMiles: 6 } }),
    entry('travel-events-swamp-insects', 'hazard', 5, 'Biting swarm', 'Relentless insects drain the travelers.', { hazard: { fpLossFormula: '1d6-3' } }),
  ], 'Shapes in the reeds'),
  table('desert', 'Desert', ['Mirage', 'A silver city shimmers and fades.', 'Wind-carved glass', 'Colored glass glitters among the dunes.'], [
    entry('travel-events-desert-heat', 'hazard', 7, 'Scorching heat', 'The exposed march drains every traveler.', { hazard: { fpLossFormula: '1d6-3' }, conditions: { weatherTypes: ['clear', 'partlyCloudy', 'heatwave'] } }),
    entry('travel-events-desert-sand', 'hazard', 5, 'Shifting dunes', 'The route vanishes beneath fresh sand.', { hazard: { lostMiles: 5 }, conditions: { weatherTypes: ['wind', 'sandstorm'] } }),
  ], 'Duneside encounter'),
  table('water', 'Water', ['Dolphin wake', 'Sleek shapes pace the vessel.', 'Floating wreckage', 'Sun-bleached timbers drift past.'], [
    entry('travel-events-water-current', 'hazard', 7, 'Contrary current', 'The current steals distance from the voyage.', { hazard: { lostMiles: 6 } }),
    entry('travel-events-water-squall', 'hazard', 5, 'Deck-sweeping squall', 'A violent squall batters everyone aboard.', { hazard: { hpLossFormula: '1d6-3' }, conditions: { weatherTypes: ['heavyRain', 'thunderstorm', 'hail'] } }),
  ], 'Sails on the horizon'),
  table('urban', 'Urban', ['Market procession', 'A noisy procession fills the street.', 'Local festival', 'Music and banners brighten the route.'], [
    entry('travel-events-urban-gridlock', 'hazard', 7, 'Crowded streets', 'Congestion swallows valuable travel time.', { hazard: { lostMiles: 3 } }),
    entry('travel-events-urban-dark-march', 'hazard', 5, 'Exhausting dark march', 'Closed gates and dark alleys make for hard travel.', { hazard: { fpLossFormula: '1d6-2' }, conditions: { nightOnly: true } }),
  ], 'Street confrontation'),
  table('road', 'Road', ['Milestone', 'A weathered marker confirms the route.', 'Passing caravan', 'Friendly travelers exchange news in passing.'], [
    entry('travel-events-road-washout', 'hazard', 7, 'Bridge out', 'A missing bridge forces a detour.', { hazard: { lostMiles: 4 } }),
    entry('travel-events-road-mud', 'hazard', 5, 'Deep mud', 'Wheels and boots labor through the mire.', { hazard: { lostMiles: 3 }, conditions: { weatherTypes: ['lightRain', 'rain', 'heavyRain'] } }),
  ], 'Roadside encounter'),
];

export const TRAVEL_EVENT_SET_SEED: TravelEventTableSet = {
  id: 'travel-event-set-default',
  name: 'Standard Travel Events',
  builtin: true,
  byTerrain: {
    'terrain-plains': 'travel-events-plains',
    'terrain-forest': 'travel-events-forest',
    'terrain-hills': 'travel-events-hills',
    'terrain-mountains': 'travel-events-mountains',
    'terrain-swamp': 'travel-events-swamp',
    'terrain-desert': 'travel-events-desert',
    'terrain-water': 'travel-events-water',
    'terrain-urban': 'travel-events-urban',
    'terrain-road': 'travel-events-road',
  },
  fallbackTableId: 'travel-events-plains',
};
