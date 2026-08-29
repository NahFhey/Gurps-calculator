import type { CampaignState } from '../campaignReducer';
import type { ContactEntry } from '../../types/campaign';

export const selectContacts = (state: CampaignState): Record<string, ContactEntry> =>
  state.entities.contacts ?? {};

export const selectContactByName = (
  state: CampaignState,
  name: string
): ContactEntry | undefined => {
  const normalizedName = name.trim().toLowerCase();
  return Object.values(selectContacts(state)).find(
    (contact) => contact.name.trim().toLowerCase() === normalizedName
  );
};
