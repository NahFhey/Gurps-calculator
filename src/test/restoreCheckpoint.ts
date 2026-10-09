/**
 * Test helper: restore checkpoint `id` the way the store does (decode outside
 * the reducer, then dispatch), throwing where the store would refuse.
 */
import { prepareCheckpointRestore } from '../persistence/decodeCampaign';
import { campaignReducer, type CampaignState } from '../state/campaignReducer';

export function restoreCheckpoint(state: CampaignState, id: string): CampaignState {
  const prepared = prepareCheckpointRestore(state, id);
  if (!prepared.ok) throw new Error(prepared.error);
  return campaignReducer(state, prepared.action);
}
