import { useState, useCallback } from 'react';
import { ArrowLeft, Edit2, Save, X } from 'lucide-react';
import { useCampaignStore } from '../../state/campaignStore';
import { SkillsSection } from '../character-sheet/SkillsSection';
import { SpellsSection } from '../character-sheet/SpellsSection';
import { createDefaultGCSData } from '../../types/characterSheet';
import type { Character } from '../../types/campaign';

interface CharacterSkillsPanelProps {
  character: Character;
}

export function CharacterSkillsPanel({ character }: CharacterSkillsPanelProps) {
  const { actions } = useCampaignStore();
  const [editMode, setEditMode] = useState(false);

  const gcsData = character.gcsData || createDefaultGCSData();
  const [draftGcsData, setDraftGcsData] = useState(gcsData);

  const handleBack = () => {
    actions.setCharacterPanelView('sheet');
  };

  const handleSave = useCallback(() => {
    actions.updateCharacter(character.id, {
      gcsData: draftGcsData,
    });
    setEditMode(false);
  }, [actions, character.id, draftGcsData]);

  const handleCancel = useCallback(() => {
    setDraftGcsData(character.gcsData || createDefaultGCSData());
    setEditMode(false);
  }, [character.gcsData]);

  const displayData = editMode ? draftGcsData : gcsData;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200"
            title="Back to character sheet"
          >
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-lg font-semibold text-gray-100">
            {character.name} - Skills & Spells
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {editMode ? (
            <>
              <button
                onClick={handleCancel}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm"
              >
                <X size={16} />
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-sm"
              >
                <Save size={16} />
                Save
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditMode(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm"
            >
              <Edit2 size={16} />
              Edit
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        <SkillsSection
          skills={displayData.skills}
          primaryAttributes={displayData.attributes}
          secondaryAttributes={displayData.secondaryAttributes}
          editMode={editMode}
          onChange={(skills) =>
            setDraftGcsData((prev) => ({ ...prev, skills }))
          }
        />

        <SpellsSection
          spells={displayData.spells}
          iq={displayData.attributes.IQ}
          editMode={editMode}
          onChange={(spells) =>
            setDraftGcsData((prev) => ({ ...prev, spells }))
          }
        />
      </div>
    </div>
  );
}
