import { useMemo, useState } from 'react';
import { Coins, X } from 'lucide-react';
import { selectAvailableCharacterIdsForSlot } from '../../../state/downtime/downtimeSelectors';
import { useCampaignStore } from '../../../state/campaignStore';
import { selectContactByName } from '../../../state/selectors';
import { getMerchantSkill } from '../../../utils/trading';
import { useOptionalDowntimeContext } from '../DowntimeContext';
import type { Character } from '../../../types/campaign';
import type { DowntimeState, TradingData } from '../../../types/downtime';

interface TradingTaskFormProps {
  characters: Character[];
  state: DowntimeState;
  currentDayKey: number;
  currentSlot: number;
  onSubmit: (data: { leaderId: string; helperIds: string[]; activityData: TradingData }) => void;
  onCancel: () => void;
}

export function TradingTaskForm({
  characters,
  state,
  currentDayKey,
  currentSlot,
  onSubmit,
  onCancel,
}: TradingTaskFormProps) {
  const { state: campaignState } = useCampaignStore();
  const downtimeContext = useOptionalDowntimeContext();
  const [leaderId, setLeaderId] = useState('');
  const [merchantName, setMerchantName] = useState(downtimeContext?.currentLocationName ?? '');
  const [opposingSkill, setOpposingSkill] = useState(12);
  const matchingContact = selectContactByName(campaignState, merchantName);
  const contactLocation = matchingContact?.locationId
    ? campaignState.locations.locations[matchingContact.locationId]
    : undefined;
  const availableCharacters = useMemo(() => {
    const ids = selectAvailableCharacterIdsForSlot(
      state,
      currentDayKey,
      currentSlot,
      characters.map((character) => character.id)
    );
    return characters.filter((character) => ids.includes(character.id));
  }, [characters, currentDayKey, currentSlot, state]);

  const handleSubmit = () => {
    if (!leaderId || !merchantName.trim()) return;
    onSubmit({
      leaderId,
      helperIds: [],
      activityData: {
        type: 'trading',
        merchantName: merchantName.trim(),
        opposingSkill,
        locationId: downtimeContext?.currentLocationId ?? null,
      },
    });
  };

  return (
    <div className="rounded-lg border border-edge bg-surface-1/60 p-4" data-testid="trading-task-form">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-medium text-fg-bright">
          <Coins className="h-4 w-4 text-warning-400" /> New Trip
        </h3>
        <button type="button" onClick={onCancel} aria-label="Close form" className="text-fg-muted hover:text-fg-primary">
          <X className="h-5 w-5" />
        </button>
      </div>

      <label className="mb-3 block text-sm text-fg-secondary">
        <span className="mb-1 block font-medium">Leader</span>
        <select
          value={leaderId}
          onChange={(event) => setLeaderId(event.target.value)}
          data-testid="leader-select"
          className="w-full rounded border border-edge-strong bg-surface-0 px-3 py-2 text-fg-bright"
        >
          <option value="">Select a leader...</option>
          {availableCharacters.map((character) => {
            const merchant = getMerchantSkill(character);
            return (
              <option key={character.id} value={character.id}>
                {character.name} ({merchant.isDefault ? `default IQ−5 = ${merchant.level}` : `Merchant-${merchant.level}`})
              </option>
            );
          })}
        </select>
      </label>

      <label className="mb-3 block text-sm text-fg-secondary">
        <span className="mb-1 block font-medium">Merchant or market</span>
        <input
          value={merchantName}
          onChange={(event) => setMerchantName(event.target.value)}
          data-testid="merchant-name-input"
          className="w-full rounded border border-edge-strong bg-surface-0 px-3 py-2 text-fg-bright"
        />
        {matchingContact && <span className="mt-1 inline-block rounded bg-surface-2 px-2 py-0.5 text-xs text-fg-secondary" data-testid="merchant-standing-badge">{matchingContact.name}: {matchingContact.modifier >= 0 ? '+' : ''}{matchingContact.modifier}</span>}
        {contactLocation && <span className="mt-1 block text-xs text-fg-faint" data-testid="contact-presence-hint">at {contactLocation.name}{contactLocation.id !== campaignState.locations.currentLocationId ? ' — party elsewhere' : ''}</span>}
      </label>

      <label className="mb-4 block text-sm text-fg-secondary">
        <span className="mb-1 block font-medium">Opposing Merchant skill</span>
        <input
          type="number"
          value={opposingSkill}
          onChange={(event) => setOpposingSkill(Number(event.target.value))}
          data-testid="opposing-skill-input"
          className="w-full rounded border border-edge-strong bg-surface-0 px-3 py-2 text-fg-bright"
        />
      </label>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!leaderId || !merchantName.trim()}
          data-testid="submit-button"
          className="rounded bg-warning-600 px-4 py-2 text-sm font-medium text-white hover:bg-warning-700 disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-fg-faint"
        >
          Create Trip
        </button>
        <button type="button" onClick={onCancel} className="rounded border border-edge-strong px-4 py-2 text-sm text-fg-secondary hover:bg-surface-2">
          Cancel
        </button>
      </div>
    </div>
  );
}
