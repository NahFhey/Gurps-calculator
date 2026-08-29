import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StudyActivity } from '../StudyActivity';
import { CampaignStoreProvider, useCampaignStore } from '../../../../state/campaignStore';
import { createCampaignState } from '../../../../state/campaignReducer';
import { DowntimeProvider } from '../../DowntimeContext';
import { createDefaultGCSData } from '../../../../types/characterSheet';
import type { CampaignState } from '../../../../state/campaignReducer';
import type { Character, StudyProject } from '../../../../types/campaign';
import type { DowntimeTask, StudyData } from '../../../../types/downtime';

function makeCharacter(id: string, name: string): Character {
  const gcsData = createDefaultGCSData();
  gcsData.attributes.IQ = 12;
  gcsData.skills = [{ id: `${id}-research`, name: 'Research', attribute: 'IQ', difficulty: 'A', points: 1, level: 11, relativeLevel: -1 }];
  return { id, name, work: { skills: { Research: 11 } }, gcsData };
}

function makeProject(characterId: string, id = `project-${characterId}`, accumulatedHours = 10): StudyProject {
  return { id, characterId, skillName: 'Research', attribute: 'IQ', difficulty: 'A', accumulatedHours, pointsAwarded: 0, createdAt: 1, updatedAt: 1 };
}

function makeTask(characterId: string, projectId: string, id = `task-${characterId}`): DowntimeTask & { activityData: StudyData } {
  return {
    id, activityType: 'study', dayKey: 1, slot: 0, leaderId: characterId, helperIds: [], status: 'pending',
    activityData: { type: 'study', skillName: 'Research', attribute: 'IQ', difficulty: 'A', goodMaterials: false, projectId },
    createdAt: 1, updatedAt: 1,
  };
}

function Observer() {
  const { state } = useCampaignStore();
  const projects = Object.values(state.entities.studyProjects ?? {}).map((project) => `${project.id}:${project.accumulatedHours}:${project.pointsAwarded}`).join('|');
  const tasks = Object.values(state.downtime.tasksById).map((task) => `${task.id}:${task.status}`).join('|');
  const character = state.entities.characters.student;
  return <div data-testid="observer">{projects};{tasks};history:{character?.gcsData?.skillHistory?.length ?? 0};points:{character?.gcsData?.skills[0]?.points ?? 0};logs:{state.logs.entries.map((entry) => entry.type).join(',')};threshold:{state.entities.studyConfig?.hoursPerPoint ?? 200}</div>;
}

function renderActivity(configure: (state: CampaignState) => void) {
  const campaign = createCampaignState();
  campaign.entities.characters = {};
  campaign.downtime = { tasksById: {}, taskOrder: [], pendingDayLedger: null };
  configure(campaign);
  return render(
    <CampaignStoreProvider initialCampaignState={campaign}>
      <DowntimeProvider currentDayKey={1} currentSlot={0}>
        <StudyActivity currentDayKey={1} currentSlot={0} />
        <Observer />
      </DowntimeProvider>
    </CampaignStoreProvider>
  );
}

describe('StudyActivity', () => {
  it('credits hours, resolves the task, and logs completion', async () => {
    renderActivity((campaign) => {
      const character = makeCharacter('student', 'Rina');
      const project = makeProject(character.id);
      const task = makeTask(character.id, project.id);
      campaign.entities.characters[character.id] = character;
      campaign.entities.studyProjects = { [project.id]: project };
      campaign.downtime.tasksById[task.id] = task;
      campaign.downtime.taskOrder = [task.id];
    });
    fireEvent.click(screen.getByTestId('complete-button'));
    await waitFor(() => expect(screen.getByTestId('observer')).toHaveTextContent('project-student:12:0'));
    expect(screen.getByTestId('observer')).toHaveTextContent('task-student:resolved');
    expect(screen.getByTestId('observer')).toHaveTextContent('study.session_logged');
  });

  it('bulk completes every pending task', async () => {
    renderActivity((campaign) => {
      for (const [id, name] of [['student', 'Rina'], ['student-2', 'Soren']]) {
        const character = makeCharacter(id, name);
        const project = makeProject(id);
        const task = makeTask(id, project.id);
        campaign.entities.characters[id] = character;
        campaign.entities.studyProjects = { ...(campaign.entities.studyProjects ?? {}), [project.id]: project };
        campaign.downtime.tasksById[task.id] = task;
        campaign.downtime.taskOrder.push(task.id);
      }
    });
    fireEvent.click(screen.getByTestId('complete-all-button'));
    await waitFor(() => {
      expect(screen.getByTestId('observer')).toHaveTextContent('project-student:12:0');
      expect(screen.getByTestId('observer')).toHaveTextContent('project-student-2:12:0');
      expect(screen.getByTestId('observer')).toHaveTextContent('task-student:resolved');
      expect(screen.getByTestId('observer')).toHaveTextContent('task-student-2:resolved');
    });
  });

  it('awards a skill point, appends history, and rolls project hours over', async () => {
    renderActivity((campaign) => {
      const character = makeCharacter('student', 'Rina');
      const project = makeProject(character.id, 'project-student', 205);
      campaign.entities.characters[character.id] = character;
      campaign.entities.studyProjects = { [project.id]: project };
    });
    fireEvent.click(screen.getByTestId('award-point-button'));
    await waitFor(() => expect(screen.getByTestId('observer')).toHaveTextContent('project-student:5:1'));
    expect(screen.getByTestId('observer')).toHaveTextContent('history:1');
    expect(screen.getByTestId('observer')).toHaveTextContent('points:2');
    expect(screen.getByTestId('observer')).toHaveTextContent('study.point_awarded');
  });

  it('edits the configured hours per point', async () => {
    renderActivity((campaign) => { campaign.entities.characters.student = makeCharacter('student', 'Rina'); });
    fireEvent.change(screen.getByTestId('hours-per-point-input'), { target: { value: '120' } });
    await waitFor(() => expect(screen.getByTestId('observer')).toHaveTextContent('threshold:120'));
  });
});
