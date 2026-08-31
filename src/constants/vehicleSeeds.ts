import type { VehicleTypeDef } from '../types/party';

export const VEHICLE_TYPE_SEEDS: VehicleTypeDef[] = [
  {
    id: 'vt-lancer',
    name: 'Lancer',
    mode: 'airship',
    speedMilesPerSlot: 600,
    minCrew: 1,
    hangarSlots: 0,
    icon: '🛩',
    builtin: true,
  },
  {
    id: 'vt-skyship',
    name: 'Skyship',
    mode: 'airship',
    speedMilesPerSlot: 457,
    minCrew: 3,
    hangarSlots: 2,
    icon: '🚢',
    builtin: true,
  },
  {
    id: 'vt-riverboat',
    name: 'Riverboat',
    mode: 'boat',
    minCrew: 1,
    hangarSlots: 0,
    icon: '🛶',
    builtin: true,
  },
  {
    id: 'vt-sailer',
    name: 'Sailing Ship',
    mode: 'boat',
    minCrew: 3,
    hangarSlots: 1,
    icon: '⛵',
    builtin: true,
  },
];
