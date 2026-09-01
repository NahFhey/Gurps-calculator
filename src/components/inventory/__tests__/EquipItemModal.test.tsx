import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ItemInstance } from '../../../types/campaign';
import { EquipItemModal } from '../EquipItemModal';

describe('EquipItemModal', () => {
  it('prefills cargo and native inventory fields, then clamps quantity to the stack', () => {
    const onConfirm = vi.fn();
    const item: ItemInstance = {
      id: 'mail-1',
      name: 'Fine mail',
      quantity: 3,
      value: 850,
      notes: 'inventory notes',
      equipmentData: {
        weight: 16,
        cost: 999,
        category: 'armor',
        dr: 4,
        drLocations: ['torso', 'groin'],
        notes: 'cargo notes',
      },
    };
    render(
      <EquipItemModal
        item={item}
        currencyUnit="cp"
        onConfirm={onConfirm}
        onCancel={() => undefined}
      />
    );

    expect(screen.getByLabelText('Name')).toHaveValue('Fine mail');
    expect(screen.getByLabelText('Quantity')).toHaveValue(3);
    expect(screen.getByLabelText('Weight')).toHaveValue(16);
    expect(screen.getByLabelText('Cost (cp)')).toHaveValue(850);
    expect(screen.getByLabelText('Category')).toHaveValue('armor');
    expect(screen.getByLabelText('DR')).toHaveValue(4);
    expect(screen.getByLabelText('torso')).toBeChecked();
    expect(screen.getByLabelText('Notes')).toHaveValue('inventory notes');

    fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '99' } });
    expect(screen.getByLabelText('Quantity')).toHaveValue(3);
    fireEvent.click(screen.getByRole('button', { name: 'Equip' }));
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Fine mail',
      quantity: 3,
      weight: 16,
      cost: 850,
      category: 'armor',
      dr: 4,
      drLocations: ['torso', 'groin'],
      notes: 'inventory notes',
      equipped: true,
    }));
  });

  it('cancels without producing equipment', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <EquipItemModal
        item={{ id: 'rope-1', name: 'Rope', quantity: 1 }}
        currencyUnit="cp"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
