import React, { useEffect } from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CampaignStoreProvider, useCampaignStore } from '../../state/campaignStore';
import { UnifiedShell } from '../UnifiedShell';
import { PartyToolContainer } from '../../components/party-tool/PartyToolContainer';

const modules = [
  { id: 'activities', label: 'Activities', content: <PartyToolContainer /> }
];

function ActivateActivities() {
  const { actions } = useCampaignStore();
  useEffect(() => {
    actions.setActiveModule('activities');
  }, [actions]);
  return null;
}

function SelectedSkillDisplay() {
  const { state } = useCampaignStore();
  return <div data-testid="selected-skill">{state.activities.selectedSkill}</div>;
}

describe('UnifiedShell activities integration', () => {
  it('updates store state when activity skill changes', () => {
    render(
      <CampaignStoreProvider>
        <ActivateActivities />
        <UnifiedShell modules={modules} />
        <SelectedSkillDisplay />
      </CampaignStoreProvider>
    );

    const skillSelect = screen.getByLabelText('Activity Skill');
    fireEvent.change(skillSelect, { target: { value: 'alchemy' } });

    expect(screen.getByTestId('selected-skill')).toHaveTextContent('alchemy');
  });
});
