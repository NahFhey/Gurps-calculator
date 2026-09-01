import type { FacilityAttachment } from '../../../types/campaign';
import type { Location } from '../../../types/location';
import type { Vehicle } from '../../../types/party';

interface FacilityAttachmentControlProps {
  value?: FacilityAttachment;
  onChange: (attachment: FacilityAttachment | undefined) => void;
  locations?: Location[];
  vehicles?: Vehicle[];
}

export function FacilityAttachmentControl({ value, onChange, locations = [], vehicles = [] }: FacilityAttachmentControlProps) {
  const kind = value?.kind ?? 'party';

  return (
    <div className="grid grid-cols-2 gap-3">
      <label className="block text-xs text-fg-muted">
        Attachment
        <select
          aria-label="Attachment"
          value={kind}
          onChange={(event) => {
            if (event.target.value === 'location' && locations[0]) onChange({ kind: 'location', locationId: locations[0].id });
            else if (event.target.value === 'vehicle' && vehicles[0]) onChange({ kind: 'vehicle', vehicleId: vehicles[0].id });
            else onChange(undefined);
          }}
          className="mt-1 w-full rounded bg-surface-3 px-3 py-2 text-fg-bright"
        >
          <option value="party">Party</option>
          <option value="location" disabled={locations.length === 0}>Location</option>
          <option value="vehicle" disabled={vehicles.length === 0}>Vehicle</option>
        </select>
      </label>
      {kind === 'location' && value?.kind === 'location' && (
        <label className="block text-xs text-fg-muted">
          Location
          <select aria-label="Attached location" value={value.locationId} onChange={(event) => onChange({ kind: 'location', locationId: event.target.value })} className="mt-1 w-full rounded bg-surface-3 px-3 py-2 text-fg-bright">
            {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
          </select>
        </label>
      )}
      {kind === 'vehicle' && value?.kind === 'vehicle' && (
        <label className="block text-xs text-fg-muted">
          Vehicle
          <select aria-label="Attached vehicle" value={value.vehicleId} onChange={(event) => onChange({ kind: 'vehicle', vehicleId: event.target.value })} className="mt-1 w-full rounded bg-surface-3 px-3 py-2 text-fg-bright">
            {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.name}</option>)}
          </select>
        </label>
      )}
    </div>
  );
}
