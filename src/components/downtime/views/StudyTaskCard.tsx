import { BookOpen, GraduationCap } from 'lucide-react';
import { getCharacterSkills } from '../../../types/characterSheet';
import { computeStudyHours } from '../../../utils/study';
import { StatusBadge, getStatusBorderColor } from './shared';
import type { Character } from '../../../types/campaign';
import type { DowntimeTask, StudyData } from '../../../types/downtime';

export type StudyTask = DowntimeTask & { activityData: StudyData };

interface StudyTaskCardProps {
  task: StudyTask;
  leader?: Character;
  teacher?: Character | null;
  onComplete?: () => void;
  onCancel?: () => void;
  readonly?: boolean;
}

function getTeacherLevel(teacher: Character, data: StudyData): number {
  const skills = getCharacterSkills(teacher);
  const names = data.specialization
    ? [`${data.skillName} (${data.specialization})`, data.skillName]
    : [data.skillName];
  for (const name of names) {
    const entry = Object.entries(skills).find(([key]) => key.trim().toLowerCase() === name.trim().toLowerCase());
    if (entry) return entry[1];
  }
  return 0;
}

export function StudyTaskCard({ task, leader, teacher, onComplete, onCancel, readonly = false }: StudyTaskCardProps) {
  const isPending = !readonly && (task.status === 'pending' || task.status === 'in_progress');
  const displaySkill = task.activityData.specialization
    ? `${task.activityData.skillName} (${task.activityData.specialization})`
    : task.activityData.skillName;
  const hours = computeStudyHours(Boolean(teacher), task.activityData.goodMaterials);

  return (
    <div className={`rounded-lg border-2 bg-surface-1/60 p-3 ${getStatusBorderColor(task.status)}`} data-testid="study-task-card" data-task-id={task.id}>
      <div className="mb-2 flex items-start justify-between">
        <div className="flex items-center gap-2"><GraduationCap className="h-4 w-4 text-cyan-400" /><span className="font-medium text-fg-bright">{displaySkill}</span></div>
        <StatusBadge status={task.status} />
      </div>
      <div className="mb-3 space-y-1 text-sm text-fg-secondary">
        <p><span className="font-medium text-fg-primary">Student:</span> {leader?.name ?? task.leaderId}</p>
        {teacher && <p><span className="font-medium text-fg-primary">Teacher:</span> {teacher.name} <span className="rounded bg-cyan-900/50 px-1.5 py-0.5 text-xs text-cyan-300">{displaySkill}-{getTeacherLevel(teacher, task.activityData)}</span></p>}
        {task.activityData.goodMaterials && <p className="flex items-center gap-1 text-emerald-300"><BookOpen className="h-3 w-3" /> Good materials</p>}
        <p><span className="font-medium text-fg-primary">This slot:</span> {hours}h</p>
      </div>
      {task.results && <div className="rounded bg-cyan-900/30 p-2 text-sm text-cyan-100" data-testid="task-results">{task.results.message}</div>}
      {isPending && (
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={onComplete} data-testid="complete-button" className="flex-1 rounded bg-cyan-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-cyan-700">Complete</button>
          {onCancel && <button type="button" onClick={onCancel} className="rounded border border-danger-500/50 px-3 py-1.5 text-sm text-danger-400 hover:bg-danger-900/30">Cancel</button>}
        </div>
      )}
    </div>
  );
}
