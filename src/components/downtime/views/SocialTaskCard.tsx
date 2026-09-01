import { Users } from 'lucide-react';
import { getInfluenceSkill, INFLUENCE_SKILLS } from '../../../utils/social';
import { StatusBadge, getStatusBorderColor } from './shared';
import type { Character, ContactEntry } from '../../../types/campaign';
import type { DowntimeTask, SocialData } from '../../../types/downtime';

export type SocialTask = DowntimeTask & { activityData: SocialData };

interface SocialTaskCardProps {
  task: SocialTask;
  leader?: Character;
  contact?: ContactEntry;
  onResolve?: () => void;
  onCancel?: () => void;
  readonly?: boolean;
}

export function SocialTaskCard({ task, leader, contact, onResolve, onCancel, readonly = false }: SocialTaskCardProps) {
  const def = INFLUENCE_SKILLS.find((entry) => entry.key === task.activityData.skillKey) ?? INFLUENCE_SKILLS[0];
  const skill = leader ? getInfluenceSkill(leader, def) : null;
  const isPending = !readonly && (task.status === 'pending' || task.status === 'in_progress');
  return (
    <div className={`rounded-lg border-2 bg-surface-1/60 p-3 ${getStatusBorderColor(task.status)}`} data-testid="social-task-card" data-task-id={task.id}>
      <div className="mb-2 flex items-start justify-between"><div className="flex items-center gap-2"><Users className="h-4 w-4 text-rose-400" /><span className="font-medium text-fg-bright">{task.activityData.contactName}</span>{contact && <span className="rounded bg-surface-2 px-1.5 py-0.5 text-xs capitalize text-fg-secondary">{contact.kind}</span>}</div><StatusBadge status={task.status} /></div>
      <div className="mb-3 space-y-1 text-sm text-fg-secondary">
        <p><span className="font-medium text-fg-primary">Leader:</span> {leader?.name ?? task.leaderId}</p>
        <p><span className="font-medium text-fg-primary">Approach:</span> {def.gcsName}{skill ? `-${skill.level}` : ''}{skill?.isDefault && <span className="ml-1 rounded bg-rose-900/40 px-1.5 py-0.5 text-xs text-rose-300">default</span>}</p>
      </div>
      {task.results && <div className="rounded bg-rose-900/20 p-2 text-sm text-rose-100" data-testid="task-results">{task.results.message}</div>}
      {isPending && <div className="mt-3 flex gap-2"><button type="button" onClick={onResolve} data-testid="resolve-button" className="flex-1 rounded bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700">Resolve</button>{onCancel && <button type="button" onClick={onCancel} className="rounded border border-danger-500/50 px-3 py-1.5 text-sm text-danger-400 hover:bg-danger-900/30">Cancel</button>}</div>}
    </div>
  );
}
