import { X } from 'lucide-react';
import { useCampaignStore } from '../../../state/campaignStore';
import type { LocationPin } from '../../../state/selectors';
import type { Id } from '../../../types/campaign';
import { CLIMATE_LABELS, TERRAIN_LABELS } from '../../../types/location';

interface LocationDetailPanelProps {
  locationId: Id;
  pin: LocationPin;
  onClose: () => void;
}

export function LocationDetailPanel({ locationId, pin, onClose }: LocationDetailPanelProps) {
  const { state, actions } = useCampaignStore();
  const location = state.locations.locations[locationId];
  if (!location) return null;

  const attached = [
    ...Object.values(state.entities.facilities).map((facility) => ({ ...facility, kindLabel: facility.facilityType })),
    ...Object.values(state.entities.kitchens).map((facility) => ({ ...facility, kindLabel: 'kitchen' })),
    ...Object.values(state.entities.alchemyLabs).map((facility) => ({ ...facility, kindLabel: 'lab' })),
  ].filter((facility) => facility.attachment?.kind === 'location'
    && facility.attachment.locationId === locationId);
  const contacts = Object.values(state.entities.contacts ?? {}).filter(
    (contact) => contact.locationId === locationId
  );
  const reveal = pin.visibility === 'gm';

  const handleToggle = () => {
    actions.mapUpdateMarker(pin.mapId, pin.markerId, {
      visibility: reveal ? 'player' : 'gm',
      ...(reveal && !pin.discoveredAt
        ? { discoveredAt: { day: state.time.day, slot: state.time.slot } }
        : {}),
    });
  };

  return (
    <aside className="absolute bottom-12 right-4 z-40 w-72 rounded-lg border border-edge-strong bg-surface-0/95 shadow-2xl">
      <header className="flex items-center justify-between border-b border-edge px-4 py-3">
        <h2 className="font-semibold text-fg-bright">{location.name}</h2>
        <button aria-label="Close location" onClick={onClose} className="text-fg-muted hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </header>
      <div className="max-h-[65vh] space-y-3 overflow-y-auto px-4 py-3 text-sm text-fg-primary">
        <div className="text-xs text-fg-muted">
          {TERRAIN_LABELS[location.terrain] ?? location.terrain} · {CLIMATE_LABELS[location.climate] ?? location.climate}
        </div>
        {location.description && <p>{location.description}</p>}
        {state.ui.gmModeEnabled && location.gmNotes && (
          <div className="rounded bg-purple-950/40 p-2 text-purple-200">{location.gmNotes}</div>
        )}
        <div className="text-xs text-fg-muted">
          {pin.discoveredAt ? `Discovered day ${pin.discoveredAt.day}` : 'Undiscovered'}
        </div>

        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">Facilities</h3>
          {attached.length === 0
            ? <div className="text-xs text-fg-faint">None</div>
            : attached.map((facility) => (
              <div key={`${facility.kindLabel}-${facility.id}`}>{facility.name} <span className="text-xs text-fg-faint">({facility.kindLabel})</span></div>
            ))}
        </section>

        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">Contacts</h3>
          {contacts.length === 0
            ? <div className="text-xs text-fg-faint">None</div>
            : contacts.map((contact) => (
              <div key={contact.id} className="flex items-center justify-between">
                <span>{contact.name}</span>
                <span className={`rounded px-1.5 py-0.5 text-xs ${contact.modifier >= 0 ? 'bg-emerald-900 text-emerald-200' : 'bg-danger-900 text-danger-200'}`}>
                  {contact.modifier >= 0 ? '+' : ''}{contact.modifier}
                </span>
              </div>
            ))}
        </section>

        {state.ui.gmModeEnabled && (
          <section className="space-y-2 border-t border-edge pt-3">
            <button
              type="button"
              onClick={handleToggle}
              className="w-full rounded bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600"
            >
              {pin.visibility === 'player' ? 'Revealed' : 'Hidden'}
            </button>
            <p className="text-xs text-fg-faint">Edit location details in Manager.</p>
          </section>
        )}
      </div>
    </aside>
  );
}
