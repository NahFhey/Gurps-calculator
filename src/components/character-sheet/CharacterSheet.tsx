import React, { useState, useCallback } from 'react';
import { Edit2, Save, X } from 'lucide-react';
import { useCampaignStore } from '../../state/campaignStore';
import type { Character } from '../../types/campaign';
import type { GCSCharacterData, CharacterImages } from '../../types/characterSheet';
import { createDefaultGCSData, syncWorkSkillsFromGCS, DEFAULT_HIT_LOCATION_PROFILE } from '../../types/characterSheet';
import { PortraitSection } from './PortraitSection';
import { IdentitySection } from './IdentitySection';
import { AttributesSection } from './AttributesSection';
import { SecondaryAttributesSection } from './SecondaryAttributesSection';
import { PointPoolsSection } from './PointPoolsSection';
import { TraitsSection } from './TraitsSection';
import { SkillsSection } from './SkillsSection';
import { SpellsSection } from './SpellsSection';
import { SkillHistorySection } from './SkillHistorySection';
import { EquipmentSection } from './EquipmentSection';
import { EncumbranceSection } from './EncumbranceSection';
import { ModifiersSection } from './ModifiersSection';
import { NotesSection } from './NotesSection';
import { DietSection } from './DietSection';
import { calculateTotalPoints } from '../../utils/characterPoints';

interface CharacterSheetProps {
  character: Character;
  editRequestToken?: number;
  onSpendPoints?: () => void;
}

export function CharacterSheet({ character, editRequestToken = 0, onSpendPoints }: CharacterSheetProps) {
  const { actions } = useCampaignStore();
  const [editMode, setEditMode] = useState(false);

  // Local draft state for editing
  const [draftName, setDraftName] = useState(character.name);
  const [draftGcsData, setDraftGcsData] = useState<GCSCharacterData>(
    character.gcsData || createDefaultGCSData()
  );
  const [draftHitLocationProfileId, setDraftHitLocationProfileId] = useState(
    character.hitLocationProfileId || DEFAULT_HIT_LOCATION_PROFILE
  );
  const [draftImages, setDraftImages] = useState<CharacterImages>(
    character.images || {}
  );
  const [draftDietExcludedFoodTypes, setDraftDietExcludedFoodTypes] = useState<string[]>(
    character.dietExcludedFoodTypes || []
  );
  const [draftDietRequiredFoodTypes, setDraftDietRequiredFoodTypes] = useState<string[]>(
    character.dietRequiredFoodTypes || []
  );

  // Reset draft when character changes
  React.useEffect(() => {
    setDraftName(character.name);
    setDraftGcsData(character.gcsData || createDefaultGCSData());
    setDraftHitLocationProfileId(character.hitLocationProfileId || DEFAULT_HIT_LOCATION_PROFILE);
    setDraftImages(character.images || {});
    setDraftDietExcludedFoodTypes(character.dietExcludedFoodTypes || []);
    setDraftDietRequiredFoodTypes(character.dietRequiredFoodTypes || []);
  }, [character.id, character.name, character.gcsData, character.hitLocationProfileId, character.images, character.dietExcludedFoodTypes, character.dietRequiredFoodTypes]);

  React.useEffect(() => {
    if (editRequestToken > 0) setEditMode(true);
  }, [editRequestToken]);

  const handleSave = useCallback(() => {
    // Sync work.skills from the updated GCS data
    const workSkills = syncWorkSkillsFromGCS(draftGcsData);

    actions.updateCharacter(character.id, {
      name: draftName,
      gcsData: draftGcsData,
      st: draftGcsData.attributes.ST,
      hitLocationProfileId: draftHitLocationProfileId,
      images: draftImages,
      dietExcludedFoodTypes: draftDietExcludedFoodTypes,
      dietRequiredFoodTypes: draftDietRequiredFoodTypes,
      work: {
        ...character.work,
        skills: workSkills,
      },
    });
    setEditMode(false);
  }, [actions, character.id, character.work, draftName, draftGcsData, draftHitLocationProfileId, draftImages, draftDietExcludedFoodTypes, draftDietRequiredFoodTypes]);

  const handleCancel = useCallback(() => {
    setDraftName(character.name);
    setDraftGcsData(character.gcsData || createDefaultGCSData());
    setDraftHitLocationProfileId(character.hitLocationProfileId || DEFAULT_HIT_LOCATION_PROFILE);
    setDraftImages(character.images || {});
    setDraftDietExcludedFoodTypes(character.dietExcludedFoodTypes || []);
    setDraftDietRequiredFoodTypes(character.dietRequiredFoodTypes || []);
    setEditMode(false);
  }, [character.name, character.gcsData, character.hitLocationProfileId, character.images, character.dietExcludedFoodTypes, character.dietRequiredFoodTypes]);

  // GCS data to display (draft when editing, actual when viewing)
  const displayData = editMode ? draftGcsData : (character.gcsData || createDefaultGCSData());
  const displayName = editMode ? draftName : character.name;
  const displayImages = editMode ? draftImages : (character.images || {});

  // Calculate total points
  const totalPoints = calculateTotalPoints(displayData);

  return (
    <div className="h-full overflow-y-auto bg-surface-0 p-4">
      {/* Header with Portrait, Name, and Edit Controls */}
      <div className="flex items-start gap-4 mb-4">
        {/* Portrait / Token images */}
        <PortraitSection
          images={displayImages}
          editMode={editMode}
          onImagesChange={setDraftImages}
        />

        {/* Name + Points + Edit buttons */}
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {editMode ? (
                <input
                  type="text"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  className="text-2xl font-bold bg-surface-1 border border-edge-strong rounded px-2 py-1 text-fg-bright"
                />
              ) : (
                <h1 className="text-2xl font-bold text-fg-bright">{displayName}</h1>
              )}
              <span className="text-fg-muted">({totalPoints} pts)</span>
              {(displayData.unspentPoints ?? 0) > 0 && (
                <button
                  type="button"
                  onClick={onSpendPoints}
                  data-testid="unspent-points-badge"
                  className="rounded-full border border-emerald-500/70 bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25"
                >
                  {displayData.unspentPoints} unspent
                </button>
              )}
            </div>

            <div className="flex gap-2">
              {editMode ? (
                <>
                  <button
                    onClick={handleSave}
                    className="flex items-center gap-1 px-3 py-1.5 bg-success-600 hover:bg-success-700 text-white rounded"
                  >
                    <Save size={16} />
                    Save
                  </button>
                  <button
                    onClick={handleCancel}
                    className="flex items-center gap-1 px-3 py-1.5 bg-surface-3 hover:bg-surface-2 text-white rounded"
                  >
                    <X size={16} />
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setEditMode(true)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-accent-600 hover:bg-accent-700 text-white rounded"
                >
                  <Edit2 size={16} />
                  Edit
                </button>
              )}
            </div>
          </div>
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

        {/* Point Pools (HP/FP) & Hit Location Profile */}
        <PointPoolsSection
          pools={displayData.pools}
          attributes={displayData.attributes}
          editMode={editMode}
          onChange={(pools) => {
            setDraftGcsData((prev) => ({ ...prev, pools }));
          }}
          hitLocationProfileId={editMode ? draftHitLocationProfileId : (character.hitLocationProfileId || DEFAULT_HIT_LOCATION_PROFILE)}
          onHitLocationProfileChange={setDraftHitLocationProfileId}
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

        {/* Dietary Restrictions */}
        <DietSection
          character={{ ...character, gcsData: displayData }}
          excludedFoodTypes={editMode ? draftDietExcludedFoodTypes : (character.dietExcludedFoodTypes || [])}
          requiredFoodTypes={editMode ? draftDietRequiredFoodTypes : (character.dietRequiredFoodTypes || [])}
          editMode={editMode}
          onExcludedFoodTypesChange={setDraftDietExcludedFoodTypes}
          onRequiredFoodTypesChange={setDraftDietRequiredFoodTypes}
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

        {/* Skill Advancement History */}
        <SkillHistorySection
          skills={displayData.skills}
          gcsData={displayData}
          skillHistory={displayData.skillHistory || []}
          primaryAttributes={displayData.attributes}
          secondaryAttributes={displayData.secondaryAttributes}
          editMode={editMode}
          onHistoryChange={(skillHistory) => {
            setDraftGcsData((prev) => ({ ...prev, skillHistory }));
          }}
          onSkillsChange={(skills) => {
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

        {/* Equipment & Encumbrance */}
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

        {/* Encumbrance (derived from attributes + equipment, read-only) */}
        <EncumbranceSection
          attributes={displayData.attributes}
          secondaryAttributes={displayData.secondaryAttributes}
          equipment={displayData.equipment}
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
