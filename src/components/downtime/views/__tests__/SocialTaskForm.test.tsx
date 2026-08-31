import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createDefaultGCSData } from '../../../../types/characterSheet';
import { downtimeInitialState } from '../../../../state/downtime';
import { SocialTaskForm } from '../SocialTaskForm';
import type { Character, ContactEntry } from '../../../../types/campaign';

const contact: ContactEntry = { id: 'guild', name: "Dockworkers' Guild", kind: 'faction', modifier: -2, history: [], createdAt: 1, updatedAt: 1 };
const trained: Character = { id: 'rina', name: 'Rina', work: { skills: { diplomacy: 14 } } };
const defaultedData = createDefaultGCSData();
defaultedData.attributes.HT = 10;
const defaulted: Character = { id: 'soren', name: 'Soren', work: { skills: {} }, gcsData: defaultedData };

function renderForm(onSubmit = vi.fn()) {
  render(<SocialTaskForm characters={[trained, defaulted]} contacts={[contact]} state={downtimeInitialState} currentDayKey={1} currentSlot={0} onSubmit={onSubmit} onCancel={vi.fn()} />);
  return onSubmit;
}

describe('SocialTaskForm', () => {
  it('submits the selected contact and approach payload', () => {
    const onSubmit = renderForm();
    fireEvent.change(screen.getByTestId('leader-select'), { target: { value: 'rina' } });
    fireEvent.change(screen.getByTestId('contact-select'), { target: { value: 'guild' } });
    expect(screen.getByTestId('social-roll-preview')).toHaveTextContent('Roll vs 14 + current standing (−2) = 12');
    fireEvent.click(screen.getByTestId('submit-button'));
    expect(onSubmit).toHaveBeenCalledWith({ leaderId: 'rina', helperIds: [], activityData: { type: 'social', contactId: 'guild', contactName: "Dockworkers' Guild", skillKey: 'diplomacy' } }, undefined);
  });

  it('shows default attribute labeling for every untrained approach', () => {
    renderForm();
    fireEvent.change(screen.getByTestId('leader-select'), { target: { value: 'soren' } });
    expect(screen.getByRole('option', { name: 'Carousing (default HT−4 = 6)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Intimidation (default Will−5 = 5)' })).toBeInTheDocument();
  });

  it('offers the New contact path and returns its name and kind', () => {
    const onSubmit = renderForm();
    fireEvent.change(screen.getByTestId('leader-select'), { target: { value: 'rina' } });
    fireEvent.change(screen.getByTestId('contact-select'), { target: { value: '__new__' } });
    fireEvent.change(screen.getByTestId('new-contact-name-input'), { target: { value: 'Harbor Watch' } });
    fireEvent.change(screen.getByTestId('new-contact-kind-select'), { target: { value: 'faction' } });
    fireEvent.click(screen.getByTestId('submit-button'));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ activityData: { type: 'social', contactId: '', contactName: 'Harbor Watch' } });
    expect(onSubmit.mock.calls[0]?.[1]).toEqual({ name: 'Harbor Watch', kind: 'faction' });
  });

  it('shows a contact at the active location without an elsewhere warning', () => {
    const placed = { ...contact, locationId: 'town' };
    render(<SocialTaskForm characters={[trained]} contacts={[placed]} state={downtimeInitialState} currentDayKey={1} currentSlot={0} locations={[{ id: 'town', name: 'Town', climate: 'temperate', terrain: 'urban', modifiers: { gathering: 0, hunting: 0, foraging: 0, travel: 0 }, createdAt: 1, modifiedAt: 1 }]} currentLocationId="town" onSubmit={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByTestId('contact-select'), { target: { value: 'guild' } });
    expect(screen.getByTestId('contact-presence-hint')).toHaveTextContent('at Town');
    expect(screen.getByTestId('contact-presence-hint')).not.toHaveTextContent('party elsewhere');
  });

  it('marks a placed contact when the party is elsewhere', () => {
    const placed = { ...contact, locationId: 'town' };
    render(<SocialTaskForm characters={[trained]} contacts={[placed]} state={downtimeInitialState} currentDayKey={1} currentSlot={0} locations={[{ id: 'town', name: 'Town', climate: 'temperate', terrain: 'urban', modifiers: { gathering: 0, hunting: 0, foraging: 0, travel: 0 }, createdAt: 1, modifiedAt: 1 }]} currentLocationId="camp" onSubmit={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByTestId('contact-select'), { target: { value: 'guild' } });
    expect(screen.getByTestId('contact-presence-hint')).toHaveTextContent('at Town — party elsewhere');
  });

  it('shows no presence hint for a contact without a location', () => {
    renderForm();
    fireEvent.change(screen.getByTestId('contact-select'), { target: { value: 'guild' } });
    expect(screen.queryByTestId('contact-presence-hint')).not.toBeInTheDocument();
  });
});
