import { useCallback, useMemo, useState } from 'react';
import { AlertCircle, GraduationCap, Plus, Trash2 } from 'lucide-react';
import { useCampaignStore } from '../../../state/campaignStore';
import { generateTaskId, selectTasksForSlot, validateTaskCreation } from '../../../state/downtime';
import { DowntimeValidationError } from '../../../state/downtime/downtimeErrors';
import { selectStudyConfig, selectStudyProjects } from '../../../state/selectors';
import { isStudyTask } from '../../../types/downtime';
import { computeStudyAward, computeStudyHours } from '../../../utils/study';
import { studyLog } from '../../../utils/activityLogger';
import { useDowntimeContext } from '../DowntimeContext';
import { StudyTaskCard } from './StudyTaskCard';
import { StudyTaskForm } from './StudyTaskForm';
import type { StudyProject } from '../../../types/campaign';
import type { CreateTaskPayload } from '../../../state/downtime/downtimeActions';
import type { StudyData } from '../../../types/downtime';
import type { StudyTask } from './StudyTaskCard';

interface StudyActivityProps {
  currentDayKey: number;
  currentSlot: number;
}

const normalized = (value: string | undefined): string => value?.trim().toLowerCase() ?? '';
const displaySkillName = (name: string, specialization?: string): string =>
  specialization?.trim() ? `${name} (${specialization.trim()})` : name;

export function StudyActivity({ currentDayKey, currentSlot }: StudyActivityProps) {
  const { state, characters, createDowntimeTask, beginResolve, resolve, cancel } = useDowntimeContext();
  const { state: campaignState, actions: campaignActions } = useCampaignStore();
  const [isCreating, setIsCreating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const studyConfig = selectStudyConfig(campaignState);
  const projects = useMemo(() => {
    const characterIds = new Set(characters.map((character) => character.id));
    return Object.values(selectStudyProjects(campaignState))
      .filter((project) => characterIds.has(project.characterId))
      .sort((left, right) => left.createdAt - right.createdAt);
  }, [campaignState, characters]);
  const tasks = useMemo(
    () => selectTasksForSlot(state, currentDayKey, currentSlot).filter(isStudyTask),
    [currentDayKey, currentSlot, state]
  );
  const pendingTasks = tasks.filter((task) => task.status === 'pending' || task.status === 'in_progress');
  const completedTasks = tasks.filter((task) => task.status === 'resolved' || task.status === 'cancelled');

  const handleCreate = useCallback((data: { leaderId: string; helperIds: string[]; activityData: StudyData }) => {
    const matchingProject = Object.values(selectStudyProjects(campaignState)).find((project) =>
      project.characterId === data.leaderId
      && normalized(project.skillName) === normalized(data.activityData.skillName)
      && normalized(project.specialization) === normalized(data.activityData.specialization)
    );
    const timestamp = Date.now();
    const project: StudyProject = matchingProject ?? {
      id: `study-${timestamp}-${Math.random().toString(16).slice(2)}`,
      characterId: data.leaderId,
      skillName: data.activityData.skillName.trim(),
      ...(data.activityData.specialization?.trim() ? { specialization: data.activityData.specialization.trim() } : {}),
      attribute: data.activityData.attribute,
      difficulty: data.activityData.difficulty,
      accumulatedHours: 0,
      pointsAwarded: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const payload: CreateTaskPayload = {
      id: generateTaskId(),
      activityType: 'study',
      dayKey: currentDayKey,
      slot: currentSlot,
      ...data,
      activityData: { ...data.activityData, projectId: project.id },
    };
    const validation = validateTaskCreation(state, payload);
    if (!validation.valid) {
      setValidationError(validation.message ?? 'Validation failed');
      return;
    }
    try {
      if (!matchingProject) campaignActions.upsertStudyProject(project);
      createDowntimeTask(payload);
      setIsCreating(false);
      setValidationError(null);
    } catch (error) {
      setValidationError(error instanceof DowntimeValidationError ? error.message : 'Failed to create study task');
    }
  }, [campaignActions, campaignState, createDowntimeTask, currentDayKey, currentSlot, state]);

  const completeTask = useCallback((task: StudyTask, baseHours?: number): number => {
    const project = selectStudyProjects(campaignState)[task.activityData.projectId];
    if (!project) {
      setValidationError('The study project for this task no longer exists');
      return baseHours ?? 0;
    }
    const hours = computeStudyHours(task.helperIds.length > 0, task.activityData.goodMaterials);
    const totalHours = (baseHours ?? project.accumulatedHours) + hours;
    const leader = characters.find((character) => character.id === task.leaderId);
    const skillName = displaySkillName(task.activityData.skillName, task.activityData.specialization);
    beginResolve(task.id);
    campaignActions.creditStudyHours(project.id, hours);
    resolve(task.id, {
      success: true,
      message: `Studied ${skillName} ${hours}h (${totalHours}/${studyConfig.hoursPerPoint}h)`,
    });
    campaignActions.addLogEntry(studyLog.sessionLogged(
      leader?.name ?? task.leaderId,
      skillName,
      hours,
      totalHours,
      { characterIds: [task.leaderId], taskId: task.id, quantity: hours }
    ));
    return totalHours;
  }, [beginResolve, campaignActions, campaignState, characters, resolve, studyConfig.hoursPerPoint]);

  const handleCompleteAll = useCallback(() => {
    const runningHours = new Map<string, number>();
    for (const task of pendingTasks) {
      const project = selectStudyProjects(campaignState)[task.activityData.projectId];
      const baseHours = runningHours.get(task.activityData.projectId) ?? project?.accumulatedHours;
      const total = completeTask(task, baseHours);
      runningHours.set(task.activityData.projectId, total);
    }
  }, [campaignState, completeTask, pendingTasks]);

  const handleAward = useCallback((project: StudyProject) => {
    const character = characters.find((candidate) => candidate.id === project.characterId);
    if (!character?.gcsData || project.accumulatedHours < studyConfig.hoursPerPoint) return;
    const award = computeStudyAward({ ...character, gcsData: character.gcsData }, project, currentDayKey);
    campaignActions.updateCharacter(character.id, {
      gcsData: {
        ...character.gcsData,
        skills: award.updatedSkills,
        skillHistory: [...(character.gcsData.skillHistory ?? []), award.historyEntry],
      },
    });
    campaignActions.awardStudyPoint(project.id);
    campaignActions.addLogEntry(studyLog.pointAwarded(
      character.name,
      displaySkillName(project.skillName, project.specialization),
      award.newLevel,
      { characterIds: [character.id], quantity: 1 }
    ));
  }, [campaignActions, characters, currentDayKey, studyConfig.hoursPerPoint]);

  return (
    <div data-testid="study-activity">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2"><GraduationCap className="h-5 w-5 text-cyan-400" /><h3 className="text-lg font-semibold text-gray-100">Study</h3></div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-gray-300">
            Hours per point
            <input type="number" min={1} value={studyConfig.hoursPerPoint} onChange={(event) => campaignActions.setStudyConfig({ hoursPerPoint: Math.max(1, Number(event.target.value) || 1) })} data-testid="hours-per-point-input" className="w-20 rounded border border-gray-600 bg-gray-900 px-2 py-1 text-gray-100" />
          </label>
          {pendingTasks.length > 1 && <button type="button" onClick={handleCompleteAll} data-testid="complete-all-button" className="rounded bg-emerald-700 px-3 py-1.5 text-sm text-white hover:bg-emerald-600">Complete all pending study</button>}
          {!isCreating && <button type="button" onClick={() => setIsCreating(true)} data-testid="new-study-task-button" className="flex items-center gap-1 rounded bg-cyan-600 px-3 py-1.5 text-sm text-white hover:bg-cyan-700"><Plus className="h-4 w-4" /> New Study Task</button>}
        </div>
      </header>

      {validationError && <div role="alert" data-testid="validation-error" className="mb-4 flex items-center gap-2 rounded border border-red-500 bg-red-900/30 px-3 py-2 text-sm text-red-300"><AlertCircle className="h-4 w-4" /> {validationError}</div>}

      {isCreating && <div className="mb-4"><StudyTaskForm characters={characters} state={state} currentDayKey={currentDayKey} currentSlot={currentSlot} onSubmit={handleCreate} onCancel={() => { setIsCreating(false); setValidationError(null); }} /></div>}

      <section className="mb-6" data-testid="study-projects-section">
        <h4 className="mb-2 font-medium text-gray-200">Projects ({projects.length})</h4>
        {projects.length === 0 ? <p className="text-sm italic text-gray-400">No active study projects</p> : (
          <div className="space-y-2">{projects.map((project) => {
            const character = characters.find((candidate) => candidate.id === project.characterId);
            const ready = project.accumulatedHours >= studyConfig.hoursPerPoint;
            const progress = Math.min(100, (project.accumulatedHours / studyConfig.hoursPerPoint) * 100);
            return (
              <article key={project.id} className="rounded-lg border border-gray-700 bg-gray-800/60 p-3" data-testid="study-project-card">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div><p className="font-medium text-gray-100">{character?.name ?? project.characterId} — {displaySkillName(project.skillName, project.specialization)}</p><p className="text-xs text-gray-400">Points awarded: {project.pointsAwarded}</p></div>
                  <div className="flex items-center gap-2">
                    {ready && <><span className="rounded-full bg-emerald-900/60 px-2 py-0.5 text-xs text-emerald-300">Ready to award</span><button type="button" onClick={() => handleAward(project)} disabled={!character?.gcsData} data-testid="award-point-button" className="rounded bg-emerald-700 px-2 py-1 text-xs text-white hover:bg-emerald-600 disabled:opacity-50">Award point</button></>}
                    <button type="button" onClick={() => { if (window.confirm(`Abandon study of ${project.skillName}?`)) campaignActions.removeStudyProject(project.id); }} aria-label={`Abandon ${project.skillName} study project`} className="text-red-400 hover:text-red-300"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
                <div className="h-2 overflow-hidden rounded bg-gray-900"><div className="h-full bg-cyan-500" style={{ width: `${progress}%` }} /></div>
                <p className="mt-1 text-right text-xs text-gray-400">{project.accumulatedHours}/{studyConfig.hoursPerPoint}h</p>
              </article>
            );
          })}</div>
        )}
      </section>

      <section className="mb-6" data-testid="pending-tasks-section">
        <h4 className="mb-2 font-medium text-gray-200">Pending ({pendingTasks.length})</h4>
        {pendingTasks.length === 0 ? <p className="text-sm italic text-gray-400">No pending study tasks</p> : <div className="space-y-2">{pendingTasks.map((task) => <StudyTaskCard key={task.id} task={task} leader={characters.find((character) => character.id === task.leaderId)} teacher={task.helperIds[0] ? characters.find((character) => character.id === task.helperIds[0]) ?? null : null} onComplete={() => completeTask(task)} onCancel={() => cancel(task.id)} />)}</div>}
      </section>
      <section data-testid="completed-tasks-section">
        <h4 className="mb-2 font-medium text-gray-200">Completed ({completedTasks.length})</h4>
        {completedTasks.length === 0 ? <p className="text-sm italic text-gray-400">No completed study tasks</p> : <div className="space-y-2">{completedTasks.map((task) => <StudyTaskCard key={task.id} task={task} leader={characters.find((character) => character.id === task.leaderId)} teacher={task.helperIds[0] ? characters.find((character) => character.id === task.helperIds[0]) ?? null : null} readonly />)}</div>}
      </section>
    </div>
  );
}
