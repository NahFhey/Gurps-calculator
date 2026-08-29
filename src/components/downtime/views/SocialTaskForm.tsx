import { useMemo, useState } from 'react';
import { Users, X } from 'lucide-react';
import { selectAvailableCharacterIdsForSlot } from '../../../state/downtime/downtimeSelectors';
import { getInfluenceSkill, INFLUENCE_SKILLS } from '../../../utils/social';
import type { Character, ContactEntry, ContactKind } from '../../../types/campaign';
import type { DowntimeState, SocialData } from '../../../types/downtime';

export interface NewContactInput {
  name: string;
  kind: ContactKind;
}

interface SocialTaskFormProps {
  characters: Character[];
  contacts: ContactEntry[];
  state: DowntimeState;
  currentDayKey: number;
  currentSlot: number;
  onSubmit: (
    data: { leaderId: string; helperIds: string[]; activityData: SocialData },
    newContact?: NewContactInput
  ) => void;
  onCancel: () => void;
}

const NEW_CONTACT = '__new__';

function formatSigned(value: number): string {
  return `${value >= 0 ? '+' : '−'}${Math.abs(value)}`;
}

export function SocialTaskForm({
  characters,
  contacts,
  state,
  currentDayKey,
  currentSlot,
  onSubmit,
  onCancel,
}: SocialTaskFormProps) {
  const [leaderId, setLeaderId] = useState('');
  const [contactId, setContactId] = useState('');
  const [newContactName, setNewContactName] = useState('');
  const [newContactKind, setNewContactKind] = useState<ContactKind>('person');
  const [skillKey, setSkillKey] = useState(INFLUENCE_SKILLS[0].key);
  const availableCharacters = useMemo(() => {
    const ids = selectAvailableCharacterIdsForSlot(
      state,
      currentDayKey,
      currentSlot,
      characters.map((character) => character.id)
    );
    return characters.filter((character) => ids.includes(character.id));
  }, [characters, currentDayKey, currentSlot, state]);

  const leader = characters.find((character) => character.id === leaderId);
  const contact = contacts.find((entry) => entry.id === contactId);
  const skillDef = INFLUENCE_SKILLS.find((def) => def.key === skillKey) ?? INFLUENCE_SKILLS[0];
  const skill = leader ? getInfluenceSkill(leader, skillDef) : null;
  const isNewContact = contactId === NEW_CONTACT;
  const contactName = isNewContact ? newContactName.trim() : contact?.name ?? '';
  const currentModifier = contact?.modifier ?? 0;
  const canSubmit = Boolean(leader && contactName && (contact || isNewContact));

  const handleSubmit = () => {
    if (!leader || !canSubmit) return;
    onSubmit({
      leaderId,
      helperIds: [],
      activityData: {
        type: 'social',
        contactId: contact?.id ?? '',
        contactName,
        skillKey: skillDef.key,
      },
    }, isNewContact ? { name: contactName, kind: newContactKind } : undefined);
  };

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800/60 p-4" data-testid="social-task-form">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-medium text-gray-100"><Users className="h-4 w-4 text-rose-400" /> New Social Task</h3>
        <button type="button" onClick={onCancel} aria-label="Close form" className="text-gray-400 hover:text-gray-200"><X className="h-5 w-5" /></button>
      </div>

      <label className="mb-3 block text-sm text-gray-300">
        <span className="mb-1 block font-medium">Leader</span>
        <select value={leaderId} onChange={(event) => setLeaderId(event.target.value)} data-testid="leader-select" className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-gray-100">
          <option value="">Select a leader...</option>
          {availableCharacters.map((character) => <option key={character.id} value={character.id}>{character.name}</option>)}
        </select>
      </label>

      <label className="mb-3 block text-sm text-gray-300">
        <span className="mb-1 block font-medium">Contact</span>
        <select value={contactId} onChange={(event) => setContactId(event.target.value)} data-testid="contact-select" className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-gray-100">
          <option value="">Select a contact...</option>
          {contacts.map((entry) => <option key={entry.id} value={entry.id}>{entry.name} ({formatSigned(entry.modifier)})</option>)}
          <option value={NEW_CONTACT}>New contact…</option>
        </select>
      </label>

      {isNewContact && (
        <div className="mb-3 grid grid-cols-2 gap-3">
          <label className="block text-sm text-gray-300"><span className="mb-1 block font-medium">Name</span><input value={newContactName} onChange={(event) => setNewContactName(event.target.value)} data-testid="new-contact-name-input" className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-gray-100" /></label>
          <label className="block text-sm text-gray-300"><span className="mb-1 block font-medium">Kind</span><select value={newContactKind} onChange={(event) => setNewContactKind(event.target.value as ContactKind)} data-testid="new-contact-kind-select" className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-gray-100"><option value="person">Person</option><option value="faction">Faction</option><option value="settlement">Settlement</option></select></label>
        </div>
      )}

      <label className="mb-3 block text-sm text-gray-300">
        <span className="mb-1 block font-medium">Approach</span>
        <select value={skillKey} onChange={(event) => setSkillKey(event.target.value)} data-testid="approach-select" className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-gray-100">
          {INFLUENCE_SKILLS.map((def) => {
            const value = leader ? getInfluenceSkill(leader, def) : null;
            const label = value
              ? value.isDefault
                ? `${def.gcsName} (default ${def.defaultAttribute}${formatSigned(def.defaultPenalty)} = ${value.level})`
                : `${def.gcsName}-${value.level}`
              : def.gcsName;
            return <option key={def.key} value={def.key}>{label}</option>;
          })}
        </select>
      </label>

      {skill && <p className="mb-4 text-sm text-rose-300" data-testid="social-roll-preview">Roll vs {skill.level} + current standing ({formatSigned(currentModifier)}) = {skill.level + currentModifier}</p>}

      <div className="flex gap-2">
        <button type="button" onClick={handleSubmit} disabled={!canSubmit} data-testid="submit-button" className="rounded bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-500">Create Social Task</button>
        <button type="button" onClick={onCancel} className="rounded border border-gray-600 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700">Cancel</button>
      </div>
    </div>
  );
}
