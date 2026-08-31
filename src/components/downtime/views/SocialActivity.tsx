import { useCallback, useMemo, useState } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { useCampaignStore } from '../../../state/campaignStore';
import { generateTaskId, selectTasksForSlot, validateTaskCreation } from '../../../state/downtime';
import { DowntimeValidationError } from '../../../state/downtime/downtimeErrors';
import { selectContactByName, selectContacts } from '../../../state/selectors';
import { isSocialTask } from '../../../types/downtime';
import { INFLUENCE_SKILLS } from '../../../utils/social';
import { socialLog } from '../../../utils/activityLogger';
import { useDowntimeContext } from '../DowntimeContext';
import { SocialResolutionPanel } from './SocialResolutionPanel';
import { SocialTaskCard } from './SocialTaskCard';
import { SocialTaskForm } from './SocialTaskForm';
import type { ContactEntry, ContactKind } from '../../../types/campaign';
import type { CreateTaskPayload } from '../../../state/downtime/downtimeActions';
import type { SocialData, TaskResults } from '../../../types/downtime';
import type { SocialAttemptResult } from '../../../utils/social';
import type { NewContactInput } from './SocialTaskForm';
import type { SocialTask } from './SocialTaskCard';
import type { Location } from '../../../types/location';

interface SocialActivityProps {
  currentDayKey: number;
  currentSlot: number;
}

function formatSigned(value: number): string {
  return `${value >= 0 ? '+' : '−'}${Math.abs(value)}`;
}

function modifierClass(value: number): string {
  return value > 0 ? 'bg-emerald-900/60 text-emerald-300' : value < 0 ? 'bg-red-900/60 text-red-300' : 'bg-gray-700 text-gray-300';
}

interface ContactCardProps {
  contact: ContactEntry;
  onSave: (contact: ContactEntry, modifier: number) => void;
  onDelete: (contact: ContactEntry) => void;
  locations: Location[];
}

function ContactCard({ contact, onSave, onDelete, locations }: ContactCardProps) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(contact.name);
  const [kind, setKind] = useState<ContactKind>(contact.kind);
  const [notes, setNotes] = useState(contact.notes ?? '');
  const [modifier, setModifier] = useState(contact.modifier);
  const [locationId, setLocationId] = useState(contact.locationId ?? '');
  const save = () => {
    if (!name.trim()) return;
    onSave({ ...contact, name: name.trim(), kind, notes: notes.trim() || undefined, locationId: locationId || null }, modifier);
    setEditing(false);
  };
  return (
    <article className="rounded-lg border border-gray-700 bg-gray-800/60 p-3" data-testid="contact-card">
      {editing ? (
        <div data-testid="contact-edit-form">
          <div className="mb-2 grid grid-cols-2 gap-2"><input aria-label="Contact name" value={name} onChange={(event) => setName(event.target.value)} className="rounded border border-gray-600 bg-gray-900 px-2 py-1.5 text-sm text-gray-100" /><select aria-label="Contact kind" value={kind} onChange={(event) => setKind(event.target.value as ContactKind)} className="rounded border border-gray-600 bg-gray-900 px-2 py-1.5 text-sm text-gray-100"><option value="person">Person</option><option value="faction">Faction</option><option value="settlement">Settlement</option></select></div>
          <textarea aria-label="Contact notes" value={notes} onChange={(event) => setNotes(event.target.value)} className="mb-2 w-full rounded border border-gray-600 bg-gray-900 px-2 py-1.5 text-sm text-gray-100" />
          <select aria-label="Contact location" value={locationId} onChange={(event) => setLocationId(event.target.value)} className="mb-2 w-full rounded border border-gray-600 bg-gray-900 px-2 py-1.5 text-sm text-gray-100">
            <option value="">— nowhere in particular —</option>
            {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
          </select>
          <label className="mb-3 block text-sm text-gray-300">Standing <input aria-label="Contact modifier" type="number" min={-4} max={4} value={modifier} onChange={(event) => setModifier(Number(event.target.value))} className="ml-2 w-20 rounded border border-gray-600 bg-gray-900 px-2 py-1 text-gray-100" /></label>
          <div className="flex gap-2"><button type="button" onClick={save} data-testid="save-contact-button" className="rounded bg-rose-600 px-3 py-1.5 text-sm text-white">Save</button><button type="button" onClick={() => setEditing(false)} className="rounded border border-gray-600 px-3 py-1.5 text-sm text-gray-300">Cancel</button></div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h5 className="font-medium text-gray-100">{contact.name}</h5><span className="rounded bg-gray-700 px-1.5 py-0.5 text-xs capitalize text-gray-300">{contact.kind}</span><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${modifierClass(contact.modifier)}`} data-testid="contact-modifier-badge">{formatSigned(contact.modifier)}</span></div>{contact.notes && <p className="mt-1 line-clamp-2 text-sm text-gray-400">{contact.notes}</p>}</div><div className="flex gap-2"><button type="button" onClick={() => setEditing(true)} aria-label={`Edit ${contact.name}`} className="text-gray-400 hover:text-gray-200"><Pencil className="h-4 w-4" /></button><button type="button" onClick={() => onDelete(contact)} aria-label={`Delete ${contact.name}`} className="text-red-400 hover:text-red-300"><Trash2 className="h-4 w-4" /></button></div></div>
          <button type="button" onClick={() => setHistoryOpen((open) => !open)} className="mt-3 flex items-center gap-1 text-xs text-gray-400" data-testid="contact-history-toggle">{historyOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />} History ({contact.history.length})</button>
          {historyOpen && <ul className="mt-2 space-y-1 border-l border-gray-700 pl-3 text-xs text-gray-400" data-testid="contact-history">{contact.history.length === 0 ? <li>No shifts recorded</li> : [...contact.history].reverse().map((shift) => <li key={shift.id}>Day {shift.dayKey}: {formatSigned(shift.delta)} → {formatSigned(shift.newModifier)} — {shift.cause}</li>)}</ul>}
        </>
      )}
    </article>
  );
}

export function SocialActivity({ currentDayKey, currentSlot }: SocialActivityProps) {
  const { state, characters, createDowntimeTask, beginResolve, resolve, cancel } = useDowntimeContext();
  const { state: campaignState, actions: campaignActions } = useCampaignStore();
  const [isCreating, setIsCreating] = useState(false);
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [newName, setNewName] = useState('');
  const [newKind, setNewKind] = useState<ContactKind>('person');
  const [newNotes, setNewNotes] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [resolvingTask, setResolvingTask] = useState<SocialTask | null>(null);
  const contacts = useMemo(() => Object.values(selectContacts(campaignState)).sort((left, right) => left.name.localeCompare(right.name)), [campaignState]);
  const locations = useMemo(() => Object.values(campaignState.locations.locations).sort((a, b) => a.name.localeCompare(b.name)), [campaignState.locations.locations]);
  const tasks = useMemo(() => selectTasksForSlot(state, currentDayKey, currentSlot).filter(isSocialTask), [currentDayKey, currentSlot, state]);
  const pendingTasks = tasks.filter((task) => task.status === 'pending' || task.status === 'in_progress');
  const completedTasks = tasks.filter((task) => task.status === 'resolved' || task.status === 'cancelled');

  const makeContact = useCallback((input: NewContactInput, notes?: string): ContactEntry => {
    const timestamp = Date.now();
    return { id: `contact-${timestamp}-${Math.random().toString(16).slice(2)}`, name: input.name.trim(), kind: input.kind, modifier: 0, ...(notes?.trim() ? { notes: notes.trim() } : {}), history: [], createdAt: timestamp, updatedAt: timestamp };
  }, []);

  const handleAddContact = () => {
    if (!newName.trim()) return;
    const existing = selectContactByName(campaignState, newName);
    if (!existing) campaignActions.upsertContact(makeContact({ name: newName, kind: newKind }, newNotes));
    setNewName(''); setNewNotes(''); setNewKind('person'); setIsAddingContact(false);
  };

  const handleCreate = useCallback((data: { leaderId: string; helperIds: string[]; activityData: SocialData }, newContact?: NewContactInput) => {
    const existing = data.activityData.contactId ? selectContacts(campaignState)[data.activityData.contactId] : selectContactByName(campaignState, newContact?.name ?? data.activityData.contactName);
    const contact = existing ?? (newContact ? makeContact(newContact) : undefined);
    if (!contact) { setValidationError('Select or create a contact'); return; }
    const payload: CreateTaskPayload = { id: generateTaskId(), activityType: 'social', dayKey: currentDayKey, slot: currentSlot, ...data, activityData: { ...data.activityData, contactId: contact.id, contactName: contact.name } };
    const validation = validateTaskCreation(state, payload);
    if (!validation.valid) { setValidationError(validation.message ?? 'Validation failed'); return; }
    try {
      if (!existing) campaignActions.upsertContact(contact);
      createDowntimeTask(payload);
      setIsCreating(false); setValidationError(null);
    } catch (error) {
      setValidationError(error instanceof DowntimeValidationError ? error.message : 'Failed to create social task');
    }
  }, [campaignActions, campaignState, createDowntimeTask, currentDayKey, currentSlot, makeContact, state]);

  const handleSaveContact = useCallback((contact: ContactEntry, requestedModifier: number) => {
    const current = selectContacts(campaignState)[contact.id];
    if (!current) return;
    campaignActions.upsertContact({ ...contact, modifier: current.modifier, updatedAt: Date.now() });
    const clamped = Math.max(-4, Math.min(4, requestedModifier));
    campaignActions.shiftContactModifier(contact.id, clamped - current.modifier, 'GM adjustment', currentDayKey);
    campaignActions.addLogEntry(socialLog.contactAdjusted(contact.name, clamped));
  }, [campaignActions, campaignState, currentDayKey]);

  const handleFinalize = useCallback((results: TaskResults, attempt: SocialAttemptResult) => {
    if (!resolvingTask) return;
    const contact = selectContacts(campaignState)[resolvingTask.activityData.contactId];
    if (!contact) { setValidationError('The contact for this task no longer exists'); return; }
    const leader = characters.find((character) => character.id === resolvingTask.leaderId);
    const def = INFLUENCE_SKILLS.find((entry) => entry.key === resolvingTask.activityData.skillKey) ?? INFLUENCE_SKILLS[0];
    const outcome = attempt.critSuccess ? 'critical success' : attempt.critFailure ? 'critical failure' : attempt.roll.success ? 'success' : 'failure';
    const cause = `${def.gcsName} ${outcome} by ${leader?.name ?? resolvingTask.leaderId}`;
    const newModifier = Math.max(-4, Math.min(4, contact.modifier + attempt.delta));
    const appliedDelta = newModifier - contact.modifier;
    const finalResults = { ...results, message: `${results.message}; applied ${formatSigned(appliedDelta)}, now ${formatSigned(newModifier)}` };
    beginResolve(resolvingTask.id);
    campaignActions.shiftContactModifier(contact.id, attempt.delta, cause, currentDayKey);
    resolve(resolvingTask.id, finalResults);
    const verb = appliedDelta > 0 ? "raised the party's standing with" : appliedDelta < 0 ? "lowered the party's standing with" : "left the party's standing with";
    const message = `${leader?.name ?? resolvingTask.leaderId} ${verb} ${contact.name} at ${formatSigned(newModifier)} (${def.gcsName} ${outcome})`;
    campaignActions.addLogEntry(socialLog.attemptResolved(leader?.name ?? resolvingTask.leaderId, contact.name, message, newModifier, { characterIds: [resolvingTask.leaderId], taskId: resolvingTask.id, quantity: attempt.delta }));
    setResolvingTask(null);
  }, [beginResolve, campaignActions, campaignState, characters, currentDayKey, resolve, resolvingTask]);

  const resolvingContact = resolvingTask ? selectContacts(campaignState)[resolvingTask.activityData.contactId] : undefined;
  const resolvingLeader = resolvingTask ? characters.find((character) => character.id === resolvingTask.leaderId) : undefined;

  return (
    <div data-testid="social-activity">
      <header className="mb-4 flex items-center justify-between"><div className="flex items-center gap-2"><Users className="h-5 w-5 text-rose-400" /><h3 className="text-lg font-semibold text-gray-100">Social</h3></div>{!isCreating && !resolvingTask && <button type="button" onClick={() => setIsCreating(true)} data-testid="new-social-task-button" className="flex items-center gap-1 rounded bg-rose-600 px-3 py-1.5 text-sm text-white hover:bg-rose-700"><Plus className="h-4 w-4" /> New Task</button>}</header>
      {validationError && <div role="alert" data-testid="validation-error" className="mb-4 flex items-center gap-2 rounded border border-red-500 bg-red-900/30 px-3 py-2 text-sm text-red-300"><AlertCircle className="h-4 w-4" /> {validationError}</div>}
      <section className="mb-6" data-testid="contact-ledger"><div className="mb-2 flex items-center justify-between"><h4 className="font-medium text-gray-200">Ledger ({contacts.length})</h4>{!isAddingContact && <button type="button" onClick={() => setIsAddingContact(true)} data-testid="add-contact-button" className="flex items-center gap-1 rounded border border-rose-500/50 px-2 py-1 text-sm text-rose-300"><Plus className="h-3 w-3" /> Add contact</button>}</div>
        {isAddingContact && <div className="mb-3 rounded border border-gray-700 bg-gray-800/60 p-3" data-testid="add-contact-form"><div className="grid grid-cols-2 gap-2"><input aria-label="New contact name" value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Contact name" className="rounded border border-gray-600 bg-gray-900 px-2 py-1.5 text-sm text-gray-100" /><select aria-label="New contact kind" value={newKind} onChange={(event) => setNewKind(event.target.value as ContactKind)} className="rounded border border-gray-600 bg-gray-900 px-2 py-1.5 text-sm text-gray-100"><option value="person">Person</option><option value="faction">Faction</option><option value="settlement">Settlement</option></select></div><textarea aria-label="New contact notes" value={newNotes} onChange={(event) => setNewNotes(event.target.value)} placeholder="Notes (optional)" className="my-2 w-full rounded border border-gray-600 bg-gray-900 px-2 py-1.5 text-sm text-gray-100" /><div className="flex gap-2"><button type="button" onClick={handleAddContact} disabled={!newName.trim()} data-testid="save-new-contact-button" className="rounded bg-rose-600 px-3 py-1.5 text-sm text-white disabled:bg-gray-700">Add</button><button type="button" onClick={() => setIsAddingContact(false)} className="rounded border border-gray-600 px-3 py-1.5 text-sm text-gray-300">Cancel</button></div></div>}
        {contacts.length === 0 ? <p className="text-sm italic text-gray-400">No contacts in the ledger</p> : <div className="space-y-2">{contacts.map((contact) => <ContactCard key={contact.id} contact={contact} locations={locations} onSave={handleSaveContact} onDelete={(entry) => { if (window.confirm(`Delete ${entry.name}?`)) campaignActions.removeContact(entry.id); }} />)}</div>}
      </section>
      {resolvingTask && resolvingLeader && resolvingContact && <div className="mb-4"><SocialResolutionPanel task={resolvingTask} leader={resolvingLeader} contact={resolvingContact} onFinalize={handleFinalize} onCancel={() => setResolvingTask(null)} /></div>}
      {isCreating && !resolvingTask && <div className="mb-4"><SocialTaskForm characters={characters} contacts={contacts} state={state} currentDayKey={currentDayKey} currentSlot={currentSlot} locations={locations} currentLocationId={campaignState.locations.currentLocationId} onSubmit={handleCreate} onCancel={() => { setIsCreating(false); setValidationError(null); }} /></div>}
      {!resolvingTask && <><section className="mb-6" data-testid="pending-tasks-section"><h4 className="mb-2 font-medium text-gray-200">Pending ({pendingTasks.length})</h4>{pendingTasks.length === 0 ? <p className="text-sm italic text-gray-400">No pending social tasks</p> : <div className="space-y-2">{pendingTasks.map((task) => <SocialTaskCard key={task.id} task={task} leader={characters.find((character) => character.id === task.leaderId)} contact={selectContacts(campaignState)[task.activityData.contactId]} onResolve={() => setResolvingTask(task)} onCancel={() => cancel(task.id)} />)}</div>}</section><section data-testid="completed-tasks-section"><h4 className="mb-2 font-medium text-gray-200">Completed ({completedTasks.length})</h4>{completedTasks.length === 0 ? <p className="text-sm italic text-gray-400">No completed social tasks</p> : <div className="space-y-2">{completedTasks.map((task) => <SocialTaskCard key={task.id} task={task} leader={characters.find((character) => character.id === task.leaderId)} contact={selectContacts(campaignState)[task.activityData.contactId]} readonly />)}</div>}</section></>}
    </div>
  );
}
