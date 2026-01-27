import React, { useState, useCallback, useMemo } from 'react';
import { Edit2, Save, X } from 'lucide-react';
import { useCampaignStore } from '../../state/campaignStore';
import type { Character } from '../../types/campaign';
import type { GCSCharacterData } from '../../types/characterSheet';
import { createDefaultGCSData, syncWorkSkillsFromGCS } from '../../types/characterSheet';
import { IdentitySection } from './IdentitySection';
import { AttributesSection } from './AttributesSection';
import { SecondaryAttributesSection } from './SecondaryAttributesSection';
import { PointPoolsSection } from './PointPoolsSection';
import { TraitsSection } from './TraitsSection';
import { SkillsSection } from './SkillsSection';
import { SpellsSection } from './SpellsSection';
import { EquipmentSection } from './EquipmentSection';
import { ModifiersSection } from './ModifiersSection';
import { NotesSection } from './NotesSection';

interface CharacterSheetProps {
  character: Character;
}

export function CharacterSheet({ character }: CharacterSheetProps) {
  const { actions } = useCampaignStore();
  const [editMode, setEditMode] = useState(false);

  // Local draft state for editing
  const [draftName, setDraftName] = useState(character.name);
  const [draftGcsData, setDraftGcsData] = useState<GCSCharacterData>(
    character.gcsData || createDefaultGCSData()
  );

  // Reset draft when character changes
  React.useEffect(() => {
    setDraftName(character.name);
    setDraftGcsData(character.gcsData || createDefaultGCSData());
  }, [character.id, character.name, character.gcsData]);

  const handleSave = useCallback(() => {
    // Sync work.skills from the updated GCS data
    const workSkills = syncWorkSkillsFromGCS(draftGcsData);

    actions.updateCharacter(character.id, {
      name: draftName,
      gcsData: draftGcsData,
      st: draftGcsData.attributes.ST,
      work: {
        ...character.work,
        skills: workSkills,
      },
    });
    setEditMode(false);
  }, [actions, character.id, character.work, draftName, draftGcsData]);

  const handleCancel = useCallback(() => {
    setDraftName(character.name);
    setDraftGcsData(character.gcsData || createDefaultGCSData());
    setEditMode(false);
  }, [character.name, character.gcsData]);

  // GCS data to display (draft when editing, actual when viewing)
  const displayData = editMode ? draftGcsData : (character.gcsData || createDefaultGCSData());
  const displayName = editMode ? draftName : character.name;

  // Calculate total points
  const totalPoints = useMemo(() => {
    let total = 0;

    // Attribute points
    total += displayData.attributePoints.ST;
    total += displayData.attributePoints.DX;
    total += displayData.attributePoints.IQ;
    total += displayData.attributePoints.HT;

    // Secondary attribute points
    total += displayData.secondaryAttributes.will.points;
    total += displayData.secondaryAttributes.per.points;
    total += displayData.secondaryAttributes.basicSpeed.points;
    total += displayData.secondaryAttributes.basicMove.points;

    // Pool points
    total += displayData.pools.HP.points;
    total += displayData.pools.FP.points;

    // Trait points
    total += displayData.advantages.reduce((sum, t) => sum + t.points, 0);
    total += displayData.perks.reduce((sum, t) => sum + t.points, 0);
    total += displayData.disadvantages.reduce((sum, t) => sum + t.points, 0);
    total += displayData.quirks.reduce((sum, t) => sum + t.points, 0);

    // Skill points
    total += displayData.skills.reduce((sum, s) => sum + s.points, 0);

    // Spell points
    total += displayData.spells.reduce((sum, s) => sum + s.points, 0);

    return total;
  }, [displayData]);

  return (
    <div className="h-full overflow-y-auto bg-gray-900 p-4">
      {/* Header with Edit Controls */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {editMode ? (
            <input
              type="text"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              className="text-2xl font-bold bg-gray-800 border border-gray-600 rounded px-2 py-1 text-gray-100"
            />
          ) : (
            <h1 className="text-2xl font-bold text-gray-100">{displayName}</h1>
          )}
          <span className="text-gray-400">({totalPoints} pts)</span>
        </div>

        <div className="flex gap-2">
          {editMode ? (
            <>
              <button
                onClick={handleSave}
                className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded"
              >
                <Save size={16} />
                Save
              </button>
              <button
                onClick={handleCancel}
                className="flex items-center gap-1 px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white rounded"
              >
                <X size={16} />
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditMode(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded"
            >
              <Edit2 size={16} />
              Edit
            </button>
          )}
        </div>
      </div>

      {/* Character Sheet Sections */}
      <div className="space-y-4">
        {/* Identity Section */}
        <IdentitySection
          name={displayName}
          totalPoints={totalPoints}
          isPlayer={character.isPlayer}
          editMode={editMode}
          onNameChange={setDraftName}
        />

        {/* Primary Attributes */}
        <AttributesSection
          attributes={displayData.attributes}
          attributePoints={displayData.attributePoints}
          editMode={editMode}
          onChange={(attrs, points) => {
            setDraftGcsData((prev) => ({
              ...prev,
              attributes: attrs,
              attributePoints: points,
            }));
          }}
        />

        {/* Secondary Attributes */}
        <SecondaryAttributesSection
          primaryAttributes={displayData.attributes}
          secondaryAttributes={displayData.secondaryAttributes}
          editMode={editMode}
          onChange={(secondary) => {
            setDraftGcsData((prev) => ({
              ...prev,
              secondaryAttributes: secondary,
            }));
          }}
        />

        {/* Point Pools (HP/FP) */}
        <PointPoolsSection
          pools={displayData.pools}
          attributes={displayData.attributes}
          editMode={editMode}
          onChange={(pools) => {
            setDraftGcsData((prev) => ({ ...prev, pools }));
          }}
        />

        {/* Reactions & Conditional Modifiers */}
        <ModifiersSection
          reactions={displayData.reactions}
          conditionalModifiers={displayData.conditionalModifiers}
          editMode={editMode}
          onReactionsChange={(reactions) => {
            setDraftGcsData((prev) => ({ ...prev, reactions }));
          }}
          onModifiersChange={(conditionalModifiers) => {
            setDraftGcsData((prev) => ({ ...prev, conditionalModifiers }));
          }}
        />

        {/* Traits (Advantages, Perks, Disadvantages, Quirks) */}
        <TraitsSection
          advantages={displayData.advantages}
          perks={displayData.perks}
          disadvantages={displayData.disadvantages}
          quirks={displayData.quirks}
          editMode={editMode}
          onAdvantagesChange={(advantages) => {
            setDraftGcsData((prev) => ({ ...prev, advantages }));
          }}
          onPerksChange={(perks) => {
            setDraftGcsData((prev) => ({ ...prev, perks }));
          }}
          onDisadvantagesChange={(disadvantages) => {
            setDraftGcsData((prev) => ({ ...prev, disadvantages }));
          }}
          onQuirksChange={(quirks) => {
            setDraftGcsData((prev) => ({ ...prev, quirks }));
          }}
        />

        {/* Skills */}
        <SkillsSection
          skills={displayData.skills}
          primaryAttributes={displayData.attributes}
          secondaryAttributes={displayData.secondaryAttributes}
          editMode={editMode}
          onChange={(skills) => {
            setDraftGcsData((prev) => ({ ...prev, skills }));
          }}
        />

        {/* Spells */}
        <SpellsSection
          spells={displayData.spells}
          iq={displayData.attributes.IQ}
          editMode={editMode}
          onChange={(spells) => {
            setDraftGcsData((prev) => ({ ...prev, spells }));
          }}
        />

        {/* Equipment */}
        <EquipmentSection
          equipment={displayData.equipment}
          otherEquipment={displayData.otherEquipment}
          editMode={editMode}
          onEquipmentChange={(equipment) => {
            setDraftGcsData((prev) => ({ ...prev, equipment }));
          }}
          onOtherEquipmentChange={(otherEquipment) => {
            setDraftGcsData((prev) => ({ ...prev, otherEquipment }));
          }}
        />

        {/* Notes */}
        <NotesSection
          notes={displayData.notes}
          editMode={editMode}
          onChange={(notes) => {
            setDraftGcsData((prev) => ({ ...prev, notes }));
          }}
        />
      </div>
    </div>
  );
}
