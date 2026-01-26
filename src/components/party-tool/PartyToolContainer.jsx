import React, { useMemo } from 'react';
import { PartyToolApp } from './PartyToolApp';
import { useCampaignStore } from '../../state/campaignStore';

export function PartyToolContainer() {
  const { state, actions } = useCampaignStore();
  const activities = state.activities;
  const reservations = state.entities.toolReservations;

  const updateActivitiesField = useMemo(
    () => (field) => (valueOrUpdater) => {
      const currentValue = activities[field];
      const nextValue =
        typeof valueOrUpdater === 'function' ? valueOrUpdater(currentValue) : valueOrUpdater;
      actions.setActivitiesState({ [field]: nextValue });
    },
    [actions, activities]
  );

  const setPartyToolState = useMemo(
    () => (valueOrUpdater) => {
      const nextValue =
        typeof valueOrUpdater === 'function'
          ? valueOrUpdater(activities.partyToolState)
          : valueOrUpdater;
      actions.setPartyToolState(nextValue);
    },
    [actions, activities.partyToolState]
  );

  return (
    <PartyToolApp
      activeTab={activities.activeTab}
      setActiveTab={updateActivitiesField('activeTab')}
      partyToolState={activities.partyToolState}
      setPartyToolState={setPartyToolState}
      reservationMap={reservations}
      setReservationMap={actions.setToolReservations}
      activityLogs={activities.activityLogs}
      setActivityLogs={updateActivitiesField('activityLogs')}
      timeLogs={activities.timeLogs}
      setTimeLogs={updateActivitiesField('timeLogs')}
      currentSlot={activities.currentSlot}
      setCurrentSlot={updateActivitiesField('currentSlot')}
      selectedSkill={activities.selectedSkill}
      setSelectedSkill={updateActivitiesField('selectedSkill')}
      primaryWorkerId={activities.primaryWorkerId}
      setPrimaryWorkerId={updateActivitiesField('primaryWorkerId')}
      helperIds={activities.helperIds}
      setHelperIds={updateActivitiesField('helperIds')}
      toolSelections={activities.toolSelections}
      setToolSelections={updateActivitiesField('toolSelections')}
      selectedFacilityId={activities.selectedFacilityId}
      setSelectedFacilityId={updateActivitiesField('selectedFacilityId')}
      gmOverride={activities.gmOverride}
      setGmOverride={updateActivitiesField('gmOverride')}
      transferState={activities.transferState}
      setTransferState={updateActivitiesField('transferState')}
    />
  );
}
