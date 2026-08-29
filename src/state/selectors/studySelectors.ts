import { DEFAULT_STUDY_CONFIG } from '../../constants';
import type { CampaignState } from '../campaignReducer';
import type { StudyConfig, StudyProject } from '../../types/campaign';

export const selectStudyConfig = (state: CampaignState): StudyConfig =>
  state.entities.studyConfig ?? DEFAULT_STUDY_CONFIG;

export const selectStudyProjects = (state: CampaignState): Record<string, StudyProject> =>
  state.entities.studyProjects ?? {};

export const selectStudyProjectsForCharacter = (
  state: CampaignState,
  characterId: string
): StudyProject[] => Object.values(selectStudyProjects(state)).filter(
  (project) => project.characterId === characterId
);
