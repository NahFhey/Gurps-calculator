import type { MapModel } from '../../../types/map';
import type { TravelGroup } from '../../../types/party';
import { computeRouteMiles } from '../../../utils/mapRouter';

interface JourneyStatusPanelProps {
  map: MapModel;
  group: TravelGroup;
  onPause: () => void;
  onResume: () => void;
  onAbort: () => void;
  onAdvanceSlot: () => void;
}

const PAUSE_LABELS = {
  crewBelowMinimum: 'crew below minimum',
  noRoute: 'no route',
  encounter: 'encounter',
  manual: 'manual',
} as const;

export function JourneyStatusPanel({
  map,
  group,
  onPause,
  onResume,
  onAbort,
  onAdvanceSlot,
}: JourneyStatusPanelProps) {
  const journey = group.journey;
  if (!journey) return null;
  const destination = Object.values(map.markersById)
    .find((marker) => marker.tileId === journey.destinationTileId)?.label
    ?? journey.destinationTileId;
  const remaining = Math.max(
    0,
    computeRouteMiles(map, journey.routeTileIds, journey.mode) - journey.legProgressMiles
  );
  const status = journey.status === 'active'
    ? 'Traveling'
    : `Paused: ${PAUSE_LABELS[journey.pauseReason ?? 'manual']}`;

  return (
    <div className="absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-gray-600 bg-gray-900/95 px-3 py-2 text-xs text-gray-200 shadow-lg">
      <span className="font-semibold">{status}</span>
      <span>to {destination}</span>
      <span>{journey.milesTraveled.toFixed(1)} mi done / {remaining.toFixed(1)} mi remaining</span>
      {journey.status === 'active' ? (
        <button type="button" onClick={onPause} className="rounded bg-gray-700 px-2 py-1 hover:bg-gray-600">Pause</button>
      ) : (
        <>
          <button type="button" onClick={onResume} className="rounded bg-blue-700 px-2 py-1 hover:bg-blue-600">Resume</button>
          <span className="text-[10px] text-gray-400">open Travel to plot a new route</span>
        </>
      )}
      <button
        type="button"
        onClick={() => {
          if (window.confirm('Abort this journey?')) onAbort();
        }}
        className="rounded bg-red-800 px-2 py-1 hover:bg-red-700"
      >
        Abort
      </button>
      <button type="button" onClick={onAdvanceSlot} className="rounded bg-green-700 px-2 py-1 hover:bg-green-600">
        Advance slot
      </button>
    </div>
  );
}
