import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useCampaignStore } from '../../../state/campaignStore';
import type { TravelMode } from '../../../types/map';
import type { Vehicle, VehicleTypeDef } from '../../../types/party';
import { eligibleVehicleCarriers, vehiclePositionReadout } from '../../../utils/vehicleManagement';

const MODES: TravelMode[] = ['foot', 'boat', 'airship'];

export function VehiclesView() {
  const { state, actions } = useCampaignStore();
  const [dockingVehicleId, setDockingVehicleId] = useState<string | null>(null);
  const types = useMemo(
    () => Object.values(state.entities.vehicleTypes ?? {}).sort((a, b) => a.name.localeCompare(b.name)),
    [state.entities.vehicleTypes]
  );
  const vehicles = useMemo(
    () => Object.values(state.entities.vehicles ?? {}).sort((a, b) => a.name.localeCompare(b.name)),
    [state.entities.vehicles]
  );

  const updateType = (type: VehicleTypeDef, changes: Partial<VehicleTypeDef>) => {
    actions.partyUpsertVehicleType({ ...type, ...changes });
  };
  const updateVehicle = (vehicle: Vehicle, changes: Partial<Vehicle>) => {
    actions.partyUpsertVehicle({ ...vehicle, ...changes, modifiedAt: Date.now() });
  };

  const addType = () => {
    const id = crypto.randomUUID();
    actions.partyUpsertVehicleType({
      id,
      name: 'New vehicle type',
      mode: 'foot',
      minCrew: 1,
      hangarSlots: 0,
      icon: '🚙',
    });
  };
  const addVehicle = () => {
    const type = types[0];
    if (!type) return;
    const now = Date.now();
    actions.partyUpsertVehicle({
      id: crypto.randomUUID(),
      name: 'New vehicle',
      typeId: type.id,
      position: null,
      createdAt: now,
      modifiedAt: now,
    });
  };

  return (
    <section data-testid="vehicles-view" className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-100">Vehicles</h2>
          <p className="text-sm text-gray-400">Manage the vehicle catalog and campaign instances.</p>
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-200">Vehicle types</h3>
          <button type="button" onClick={addType} className="flex items-center gap-1 rounded bg-cyan-700 px-3 py-1.5 text-sm text-white hover:bg-cyan-600">
            <Plus className="h-4 w-4" /> Add type
          </button>
        </div>
        <div className="overflow-x-auto rounded border border-gray-700">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-900/60 text-xs uppercase text-gray-500">
              <tr><th className="p-2">Name</th><th>Mode</th><th>Speed (mi/slot)</th><th>Min crew</th><th>Hangar</th><th>Icon</th><th /></tr>
            </thead>
            <tbody>
              {types.map((type) => (
                <tr key={type.id} data-testid={`vehicle-type-row-${type.id}`} className="border-t border-gray-700 bg-gray-800/60">
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      <input aria-label={`${type.name} type name`} defaultValue={type.name} onBlur={(event) => {
                        const name = event.target.value.trim();
                        if (name && name !== type.name) updateType(type, { name });
                      }} className="w-40 rounded bg-gray-900 px-2 py-1" />
                      {type.builtin && <span className="rounded bg-blue-500/15 px-2 py-0.5 text-xs text-blue-300">Built-in</span>}
                    </div>
                  </td>
                  <td><select aria-label={`${type.name} mode`} value={type.mode} onChange={(event) => updateType(type, { mode: event.target.value as TravelMode })} className="rounded bg-gray-900 px-2 py-1">{MODES.map((mode) => <option key={mode}>{mode}</option>)}</select></td>
                  <td><input aria-label={`${type.name} speed`} type="number" min={0} value={type.speedMilesPerSlot ?? ''} placeholder="mode default" onChange={(event) => updateType(type, { speedMilesPerSlot: event.target.value === '' ? undefined : Math.max(0, event.target.valueAsNumber || 0) })} className="w-28 rounded bg-gray-900 px-2 py-1" /></td>
                  <td><input aria-label={`${type.name} minimum crew`} type="number" min={1} value={type.minCrew} onChange={(event) => updateType(type, { minCrew: Math.max(1, event.target.valueAsNumber || 1) })} className="w-16 rounded bg-gray-900 px-2 py-1" /></td>
                  <td><input aria-label={`${type.name} hangar slots`} type="number" min={0} value={type.hangarSlots} onChange={(event) => updateType(type, { hangarSlots: Math.max(0, event.target.valueAsNumber || 0) })} className="w-16 rounded bg-gray-900 px-2 py-1" /></td>
                  <td><input aria-label={`${type.name} icon`} value={type.icon ?? ''} onChange={(event) => updateType(type, { icon: event.target.value })} className="w-14 rounded bg-gray-900 px-2 py-1" /></td>
                  <td className="p-2"><button type="button" data-testid={`delete-vehicle-type-${type.id}`} aria-label={`Delete ${type.name} type`} onClick={() => {
                    if (window.confirm(`Delete vehicle type “${type.name}”?`)) actions.partyRemoveVehicleType(type.id);
                  }} className="rounded p-1.5 text-red-400 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-200">Vehicle instances</h3>
          <button type="button" disabled={types.length === 0} onClick={addVehicle} className="flex items-center gap-1 rounded bg-amber-700 px-3 py-1.5 text-sm text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-40"><Plus className="h-4 w-4" /> Add vehicle</button>
        </div>
        <div className="space-y-2">
          {vehicles.map((vehicle) => {
            const carriers = eligibleVehicleCarriers(state, vehicle.id);
            const aboard = Object.values(state.entities.travelGroups ?? {}).filter((group) => group.vehicleId === vehicle.id);
            const isDocked = vehicle.position?.kind === 'docked';
            return (
              <article key={vehicle.id} data-testid={`vehicle-row-${vehicle.id}`} className="rounded border border-gray-700 bg-gray-800/60 p-3">
                <div className="grid gap-3 lg:grid-cols-[1fr_1fr_2fr_1.4fr_auto]">
                  <input aria-label={`${vehicle.name} vehicle name`} defaultValue={vehicle.name} onBlur={(event) => {
                    const name = event.target.value.trim();
                    if (name && name !== vehicle.name) updateVehicle(vehicle, { name });
                  }} className="rounded bg-gray-900 px-2 py-1" />
                  <select aria-label={`${vehicle.name} vehicle type`} value={vehicle.typeId} onChange={(event) => updateVehicle(vehicle, { typeId: event.target.value })} className="rounded bg-gray-900 px-2 py-1">{types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select>
                  <textarea aria-label={`${vehicle.name} notes`} defaultValue={vehicle.notes ?? ''} onBlur={(event) => updateVehicle(vehicle, { notes: event.target.value.trim() || undefined })} rows={2} className="rounded bg-gray-900 px-2 py-1 text-sm" />
                  <div className="text-xs text-gray-300">
                    <div>{vehiclePositionReadout(state, vehicle)}</div>
                    <div className="mt-1 text-gray-500">{aboard.length > 0 ? `Aboard: ${aboard.map((group) => group.name).join(', ')}` : 'No groups aboard'}</div>
                  </div>
                  <div className="flex items-start gap-1">
                    {isDocked ? (
                      <button type="button" data-testid={`undock-vehicle-${vehicle.id}`} onClick={() => actions.partyUndockVehicle(vehicle.id)} className="rounded bg-cyan-800 px-2 py-1 text-xs text-white">Undock</button>
                    ) : (
                      <div className="relative">
                        <button type="button" data-testid={`dock-vehicle-${vehicle.id}`} disabled={carriers.length === 0} onClick={() => setDockingVehicleId((current) => current === vehicle.id ? null : vehicle.id)} className="rounded bg-cyan-800 px-2 py-1 text-xs text-white disabled:opacity-35">Dock…</button>
                        {dockingVehicleId === vehicle.id && carriers.length > 0 && (
                          <select aria-label={`Dock ${vehicle.name} to carrier`} defaultValue="" onChange={(event) => {
                            if (event.target.value) actions.partyDockVehicle(vehicle.id, event.target.value);
                            setDockingVehicleId(null);
                          }} className="absolute right-0 top-full z-10 mt-1 rounded bg-gray-900 p-1 text-xs"><option value="" disabled>Choose carrier</option>{carriers.map((carrier) => <option key={carrier.id} value={carrier.id}>{carrier.name}</option>)}</select>
                        )}
                      </div>
                    )}
                    <button type="button" data-testid={`delete-vehicle-${vehicle.id}`} aria-label={`Delete ${vehicle.name}`} onClick={() => {
                      if (window.confirm(`Delete vehicle “${vehicle.name}”?`)) actions.partyRemoveVehicle(vehicle.id);
                    }} className="rounded p-1.5 text-red-400 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              </article>
            );
          })}
          {vehicles.length === 0 && <div className="rounded border border-gray-700 p-5 text-sm text-gray-500">No vehicle instances.</div>}
        </div>
      </section>
    </section>
  );
}
