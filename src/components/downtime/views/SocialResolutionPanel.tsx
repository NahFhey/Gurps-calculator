import { useState } from 'react';
import { Users } from 'lucide-react';
import { getInfluenceSkill, INFLUENCE_SKILLS, resolveSocialAttempt } from '../../../utils/social';
import type { Character, ContactEntry } from '../../../types/campaign';
import type { TaskResults } from '../../../types/downtime';
import type { SocialAttemptResult } from '../../../utils/social';
import type { SocialTask } from './SocialTaskCard';

interface SocialResolutionPanelProps {
  task: SocialTask;
  leader: Character;
  contact: ContactEntry;
  onFinalize: (results: TaskResults, attempt: SocialAttemptResult) => void;
  onCancel: () => void;
}

function formatSigned(value: number): string {
  return `${value >= 0 ? '+' : '−'}${Math.abs(value)}`;
}

export function SocialResolutionPanel({ task, leader, contact, onFinalize, onCancel }: SocialResolutionPanelProps) {
  const def = INFLUENCE_SKILLS.find((entry) => entry.key === task.activityData.skillKey) ?? INFLUENCE_SKILLS[0];
  const skill = getInfluenceSkill(leader, def);
  const effectiveTarget = skill.level + contact.modifier;
  const [attempt, setAttempt] = useState<SocialAttemptResult | null>(null);
  const wouldBeModifier = attempt ? Math.max(-4, Math.min(4, contact.modifier + attempt.delta)) : contact.modifier;
  const clampBites = attempt !== null && wouldBeModifier - contact.modifier !== attempt.delta;
  const outcome = !attempt ? '' : attempt.critSuccess ? 'Critical success' : attempt.critFailure ? 'Critical failure' : attempt.roll.success ? 'Success' : 'Failure';

  const apply = () => {
    if (!attempt) return;
    const dice = attempt.roll.dice.join(' + ');
    onFinalize({
      success: attempt.roll.success && !attempt.critFailure,
      message: `${def.gcsName}: rolled ${attempt.roll.total} (${dice}) vs ${attempt.effectiveTarget} — ${outcome}; standing ${formatSigned(contact.modifier)} → ${formatSigned(wouldBeModifier)}`,
    }, attempt);
  };

  return (
    <div className="rounded-lg border border-rose-500/50 bg-surface-1 p-4" data-testid="social-resolution-panel">
      <h3 className="mb-3 flex items-center gap-2 font-medium text-fg-bright"><Users className="h-4 w-4 text-rose-400" /> Resolve influence attempt</h3>
      <div className="mb-4 space-y-1 text-sm text-fg-secondary">
        <p><span className="font-medium text-fg-primary">Contact:</span> {contact.name} ({formatSigned(contact.modifier)})</p>
        <p><span className="font-medium text-fg-primary">Leader:</span> {leader.name}</p>
        <p><span className="font-medium text-fg-primary">Skill:</span> {def.gcsName}-{skill.level}{skill.isDefault ? ` (default ${def.defaultAttribute}${formatSigned(def.defaultPenalty)})` : ''}</p>
        <p data-testid="effective-target"><span className="font-medium text-fg-primary">Effective target:</span> {skill.level} + {formatSigned(contact.modifier)} = {effectiveTarget}</p>
      </div>
      {!attempt ? <button type="button" onClick={() => setAttempt(resolveSocialAttempt(skill.level, contact.modifier))} data-testid="roll-social-button" className="rounded bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700">Roll</button> : (
        <div className="mb-4 rounded bg-surface-0/70 p-3 text-sm text-fg-primary" data-testid="social-roll-result">
          <p>Rolled {attempt.roll.total} ({attempt.roll.dice.join(' + ')}) vs {attempt.effectiveTarget}: <span className="font-medium">{outcome}</span></p>
          <p>Standing change: {formatSigned(attempt.delta)}; new standing {formatSigned(wouldBeModifier)}</p>
          {clampBites && <p className="mt-1 text-warning-300" data-testid="social-cap-note">Already at the cap; only {formatSigned(wouldBeModifier - contact.modifier)} can be applied.</p>}
        </div>
      )}
      <div className="mt-3 flex gap-2"><button type="button" onClick={apply} disabled={!attempt} data-testid="apply-social-button" className="rounded bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:bg-surface-2 disabled:text-fg-faint">Apply</button><button type="button" onClick={onCancel} className="rounded border border-edge-strong px-4 py-2 text-sm text-fg-secondary hover:bg-surface-2">Cancel</button></div>
    </div>
  );
}
