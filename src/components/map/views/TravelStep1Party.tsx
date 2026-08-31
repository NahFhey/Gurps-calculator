import { useMemo } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import type { Character, Id } from '../../../types/campaign';
import type { MapScale } from '../../../types/map';
import type { TravelGroup, Vehicle, VehicleTypeDef } from '../../../types/party';
import { SCALE_TO_MODES } from '../../../constants/map';
import { nameInitials } from '../../../utils/mapTokens';

export type PartyColumn = 'traveling' | 'staying';

export interface TravelPartySource {
  group: TravelGroup;
  members: Character[];
}

export interface TravelVehicleOption {
  vehicle: Vehicle;
  type: VehicleTypeDef;
}

interface TravelStep1PartyProps {
  mapScale: MapScale;
  sources: TravelPartySource[];
  travelingMemberIds: Id[];
  selectedVehicleId: Id | null;
  vehicles: TravelVehicleOption[];
  onMoveChip: (memberId: Id, to: PartyColumn) => void;
  onSelectVehicle: (vehicleId: Id | null) => void;
}

function MemberChip({
  character,
  column,
  onMove,
}: {
  character: Character;
  column: PartyColumn;
  onMove: (memberId: Id, to: PartyColumn) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `member:${character.id}`,
  });
  const destination: PartyColumn = column === 'traveling' ? 'staying' : 'traveling';
  const image = character.images?.token ?? character.images?.portrait;
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
      }}
      {...listeners}
      {...attributes}
      data-testid={`travel-member-${character.id}`}
      className={`flex items-center gap-1.5 rounded border border-gray-600 bg-gray-800 p-1.5 ${isDragging ? 'opacity-50' : ''}`}
    >
      {image ? (
        <img src={image} alt={character.name} className="h-7 w-7 rounded-full object-cover" />
      ) : (
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-700 text-[10px] font-bold text-white">
          {nameInitials(character.name)}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate text-[11px] text-gray-200">{character.name}</span>
      <button
        type="button"
        aria-label={`Move ${character.name} to ${destination === 'traveling' ? 'Traveling' : 'Staying behind'}`}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => onMove(character.id, destination)}
        className="rounded px-1 text-xs text-gray-400 hover:bg-gray-700 hover:text-white"
      >
        {destination === 'traveling' ? '←' : '→'}
      </button>
    </div>
  );
}

function PartyDropColumn({
  column,
  label,
  sources,
  travelingIds,
  onMove,
}: {
  column: PartyColumn;
  label: string;
  sources: TravelPartySource[];
  travelingIds: Set<Id>;
  onMove: (memberId: Id, to: PartyColumn) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: `column:${column}` });
  const includes = (id: Id) => column === 'traveling' ? travelingIds.has(id) : !travelingIds.has(id);
  return (
    <section
      ref={setNodeRef}
      data-testid={`${column}-column`}
      className={`min-h-28 rounded border p-1.5 ${isOver ? 'border-blue-400 bg-blue-950/30' : 'border-gray-700 bg-gray-900/40'}`}
    >
      <h4 className="mb-1.5 text-[11px] font-semibold text-gray-200">{label}</h4>
      <div className="space-y-2">
        {sources.map(({ group, members }) => {
          const visibleMembers = members.filter((member) => includes(member.id));
          if (visibleMembers.length === 0) return null;
          return (
            <div key={group.id}>
              <div className="mb-1 truncate text-[9px] uppercase tracking-wide text-gray-500">{group.name}</div>
              <div className="space-y-1">
                {visibleMembers.map((member) => (
                  <MemberChip key={member.id} character={member} column={column} onMove={onMove} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function TravelStep1Party({
  mapScale,
  sources,
  travelingMemberIds,
  selectedVehicleId,
  vehicles,
  onMoveChip,
  onSelectVehicle,
}: TravelStep1PartyProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );
  const travelingIds = useMemo(() => new Set(travelingMemberIds), [travelingMemberIds]);
  const footAllowed = SCALE_TO_MODES[mapScale].includes('foot');

  const handleDragEnd = (event: DragEndEvent) => {
    const memberId = String(event.active.id).replace(/^member:/, '');
    const overId = event.over ? String(event.over.id) : '';
    if (overId === 'column:traveling') onMoveChip(memberId, 'traveling');
    if (overId === 'column:staying') onMoveChip(memberId, 'staying');
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400">Choose who travels and how they go.</p>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-2 gap-2">
          <PartyDropColumn column="traveling" label="Traveling" sources={sources} travelingIds={travelingIds} onMove={onMoveChip} />
          <PartyDropColumn column="staying" label="Staying behind" sources={sources} travelingIds={travelingIds} onMove={onMoveChip} />
        </div>
      </DndContext>

      {travelingMemberIds.length === 0 && (
        <p role="alert" className="text-xs text-red-300">Someone has to travel</p>
      )}

      <fieldset className="space-y-1.5">
        <legend className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Conveyance</legend>
        <label className={`rounded bg-gray-900/40 p-2 text-xs ${footAllowed ? 'block cursor-pointer text-gray-200' : 'block text-gray-500'}`}>
          <span className="flex items-center gap-2">
            <input type="radio" name="travel-conveyance" checked={selectedVehicleId === null} disabled={!footAllowed} onChange={() => onSelectVehicle(null)} />
            On foot
          </span>
          {!footAllowed && <span className="ml-5 block text-[10px] text-amber-400">Unavailable at {mapScale} mi/tile</span>}
        </label>
        {vehicles.map(({ vehicle, type }) => {
          const allowed = SCALE_TO_MODES[mapScale].includes(type.mode);
          return (
            <label key={vehicle.id} className={`block rounded bg-gray-900/40 p-2 text-xs ${allowed ? 'cursor-pointer text-gray-200' : 'text-gray-500'}`}>
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="travel-conveyance"
                  value={vehicle.id}
                  checked={selectedVehicleId === vehicle.id}
                  disabled={!allowed}
                  onChange={() => onSelectVehicle(vehicle.id)}
                />
                <span>{type.icon ? `${type.icon} ` : ''}{vehicle.name}</span>
              </span>
              <span className="ml-5 block text-[10px] text-gray-500">{type.name} · {type.mode} · min crew {type.minCrew}</span>
              {!allowed && <span className="ml-5 block text-[10px] text-amber-400">Unavailable at {mapScale} mi/tile</span>}
            </label>
          );
        })}
      </fieldset>
    </div>
  );
}

export type { TravelStep1PartyProps };
