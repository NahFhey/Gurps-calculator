import { useState } from 'react';
import type { ItemInstance } from '../../types/campaign';
import type { Equipment, EquipmentCategory } from '../../types/characterSheet';
import { Modal } from '../ui/Modal';

export interface EquipItemModalProps {
  item: ItemInstance;
  currencyUnit: string;
  onConfirm: (equipment: Omit<Equipment, 'id' | 'sourceItem'>) => void;
  onCancel: () => void;
}

const EQUIPMENT_CATEGORIES: Array<{ value: EquipmentCategory; label: string }> = [
  { value: 'general', label: 'General' },
  { value: 'weapon', label: 'Weapon' },
  { value: 'armor', label: 'Armor' },
  { value: 'shield', label: 'Shield' },
  { value: 'ammo', label: 'Ammo' },
];

const HIT_LOCATIONS = [
  'skull', 'face', 'neck', 'torso', 'vitals', 'groin',
  'right arm', 'left arm', 'right leg', 'left leg',
  'right hand', 'left hand', 'right foot', 'left foot',
];

function clampQuantity(value: number, stackQuantity: number): number {
  const finiteValue = Number.isFinite(value) ? value : 1;
  return Math.max(1, Math.min(Math.trunc(finiteValue), stackQuantity));
}

function createInitialEquipment(item: ItemInstance): Omit<Equipment, 'id' | 'sourceItem'> {
  const stackQuantity = Math.max(1, item.quantity ?? 1);
  const cargo = item.equipmentData;
  return {
    ...cargo,
    name: item.name ?? 'Unnamed item',
    quantity: stackQuantity,
    weight: cargo?.weight ?? 0,
    cost: item.value ?? 0,
    category: cargo?.category ?? 'general',
    equipped: true,
    ...(item.notes !== undefined ? { notes: item.notes } : {}),
  };
}

export function EquipItemModal({ item, currencyUnit, onConfirm, onCancel }: EquipItemModalProps) {
  const stackQuantity = Math.max(1, item.quantity ?? 1);
  const [equipment, setEquipment] = useState(() => createInitialEquipment(item));

  function update(changes: Partial<Omit<Equipment, 'id' | 'sourceItem'>>) {
    setEquipment(current => ({ ...current, ...changes }));
  }

  function toggleLocation(location: string) {
    const current = equipment.drLocations ?? [];
    update({
      drLocations: current.includes(location)
        ? current.filter(candidate => candidate !== location)
        : [...current, location],
    });
  }

  return (
    <Modal isOpen onClose={onCancel} title="Equip item" size="lg" bodyClassName="p-0">
      <form
        className="p-5"
        data-testid="equip-item-modal"
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm({
            ...equipment,
            quantity: clampQuantity(equipment.quantity, stackQuantity),
          });
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm text-fg-secondary">
            Name
            <input
              aria-label="Name"
              value={equipment.name}
              onChange={event => update({ name: event.target.value })}
              className="mt-1 w-full rounded border border-edge-strong bg-surface-2 px-3 py-2 text-fg-bright"
            />
          </label>
          <label className="text-sm text-fg-secondary">
            Quantity
            <input
              aria-label="Quantity"
              type="number"
              min={1}
              max={stackQuantity}
              value={equipment.quantity}
              onChange={event => update({
                quantity: clampQuantity(Number(event.target.value), stackQuantity),
              })}
              className="mt-1 w-full rounded border border-edge-strong bg-surface-2 px-3 py-2 text-fg-bright"
            />
          </label>
          <label className="text-sm text-fg-secondary">
            Weight (lb each)
            <input
              aria-label="Weight"
              type="number"
              min={0}
              step="0.1"
              value={equipment.weight}
              onChange={event => update({ weight: Math.max(0, Number(event.target.value) || 0) })}
              className="mt-1 w-full rounded border border-edge-strong bg-surface-2 px-3 py-2 text-fg-bright"
            />
          </label>
          <label className="text-sm text-fg-secondary">
            Cost ({currencyUnit})
            <input
              aria-label={`Cost (${currencyUnit})`}
              type="number"
              min={0}
              step="0.01"
              value={equipment.cost}
              onChange={event => update({ cost: Math.max(0, Number(event.target.value) || 0) })}
              className="mt-1 w-full rounded border border-edge-strong bg-surface-2 px-3 py-2 text-fg-bright"
            />
          </label>
          <label className="text-sm text-fg-secondary sm:col-span-2">
            Category
            <select
              aria-label="Category"
              value={equipment.category ?? 'general'}
              onChange={event => update({ category: event.target.value as EquipmentCategory })}
              className="mt-1 w-full rounded border border-edge-strong bg-surface-2 px-3 py-2 text-fg-bright"
            >
              {EQUIPMENT_CATEGORIES.map(category => (
                <option key={category.value} value={category.value}>{category.label}</option>
              ))}
            </select>
          </label>

          {equipment.category === 'weapon' && (
            <>
              <label className="text-sm text-fg-secondary">
                Damage
                <input
                  aria-label="Damage"
                  value={equipment.damage ?? ''}
                  onChange={event => update({ damage: event.target.value })}
                  className="mt-1 w-full rounded border border-edge-strong bg-surface-2 px-3 py-2 text-fg-bright"
                />
              </label>
              <label className="text-sm text-fg-secondary">
                Reach
                <input
                  aria-label="Reach"
                  value={equipment.reach ?? ''}
                  onChange={event => update({ reach: event.target.value })}
                  className="mt-1 w-full rounded border border-edge-strong bg-surface-2 px-3 py-2 text-fg-bright"
                />
              </label>
            </>
          )}

          {equipment.category === 'armor' && (
            <>
              <label className="text-sm text-fg-secondary sm:col-span-2">
                DR
                <input
                  aria-label="DR"
                  type="number"
                  min={0}
                  value={equipment.dr ?? 0}
                  onChange={event => update({ dr: Math.max(0, Number(event.target.value) || 0) })}
                  className="mt-1 w-full rounded border border-edge-strong bg-surface-2 px-3 py-2 text-fg-bright"
                />
              </label>
              <fieldset className="sm:col-span-2">
                <legend className="mb-2 text-sm text-fg-secondary">DR locations</legend>
                <div className="flex flex-wrap gap-2">
                  {HIT_LOCATIONS.map(location => (
                    <label key={location} className="flex items-center gap-1 text-xs text-fg-secondary">
                      <input
                        type="checkbox"
                        checked={(equipment.drLocations ?? []).includes(location)}
                        onChange={() => toggleLocation(location)}
                      />
                      {location}
                    </label>
                  ))}
                </div>
              </fieldset>
            </>
          )}

          {equipment.category === 'shield' && (
            <label className="text-sm text-fg-secondary sm:col-span-2">
              DB
              <input
                aria-label="DB"
                type="number"
                min={0}
                value={equipment.db ?? 0}
                onChange={event => update({ db: Math.max(0, Number(event.target.value) || 0) })}
                className="mt-1 w-full rounded border border-edge-strong bg-surface-2 px-3 py-2 text-fg-bright"
              />
            </label>
          )}

          <label className="text-sm text-fg-secondary sm:col-span-2">
            Notes
            <textarea
              aria-label="Notes"
              value={equipment.notes ?? ''}
              onChange={event => update({ notes: event.target.value })}
              className="mt-1 min-h-20 w-full rounded border border-edge-strong bg-surface-2 px-3 py-2 text-fg-bright"
            />
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded bg-surface-2 px-4 py-2 text-sm text-fg-bright hover:bg-surface-3"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded bg-accent-600 px-4 py-2 text-sm text-white hover:bg-accent-500"
          >
            Equip
          </button>
        </div>
      </form>
    </Modal>
  );
}
