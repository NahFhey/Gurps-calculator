import { useState, useMemo } from 'react';
import { History, Plus, ChevronDown, ChevronUp, TrendingUp } from 'lucide-react';
import type { Skill, SkillAdvancementEntry, SkillDifficulty, PrimaryAttributes, SecondaryAttributes, SkillAttribute } from '../../types/characterSheet';
import { calculateSkillLevel } from '../../types/characterSheet';

interface SkillHistorySectionProps {
  skills: Skill[];
  skillHistory: SkillAdvancementEntry[];
  primaryAttributes: PrimaryAttributes;
  secondaryAttributes: SecondaryAttributes;
  editMode: boolean;
  onHistoryChange: (history: SkillAdvancementEntry[]) => void;
  onSkillsChange: (skills: Skill[]) => void;
}

export function SkillHistorySection({
  skills,
  skillHistory,
  primaryAttributes,
  secondaryAttributes,
  editMode,
  onHistoryChange,
  onSkillsChange,
}: SkillHistorySectionProps) {
  const [expanded, setExpanded] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Form state for new advancement
  const [selectedSkillId, setSelectedSkillId] = useState('');
  const [pointsToAdd, setPointsToAdd] = useState(1);
  const [sessionLabel, setSessionLabel] = useState('');
  const [advanceNotes, setAdvanceNotes] = useState('');

  const getAttributeValue = (attr: SkillAttribute): number => {
    if (attr === 'Will') return secondaryAttributes.will.value;
    if (attr === 'Per') return secondaryAttributes.per.value;
    return primaryAttributes[attr as keyof PrimaryAttributes];
  };

  // Sort history newest first
  const sortedHistory = useMemo(
    () => [...skillHistory].sort((a, b) => b.date.localeCompare(a.date)),
    [skillHistory]
  );

  const handleRecordAdvancement = () => {
    const skill = skills.find((s) => s.id === selectedSkillId);
    if (!skill) return;

    const previousPoints = skill.points;
    const newPoints = previousPoints + pointsToAdd;
    const difficulty = skill.difficulty || 'A';
    const attrValue = getAttributeValue(skill.attribute);
    const previousLevel = skill.level;
    const newLevel = calculateSkillLevel(attrValue, difficulty as SkillDifficulty, newPoints);

    // Create history entry
    const entry: SkillAdvancementEntry = {
      id: `adv-${Date.now()}`,
      skillId: skill.id,
      skillName: skill.specialization
        ? `${skill.name} (${skill.specialization})`
        : skill.name,
      date: new Date().toISOString(),
      sessionLabel: sessionLabel || undefined,
      pointsAdded: pointsToAdd,
      previousPoints,
      newPoints,
      previousLevel,
      newLevel,
      notes: advanceNotes || undefined,
    };

    // Update history
    onHistoryChange([...skillHistory, entry]);

    // Update the skill's points (and level will recalculate)
    onSkillsChange(
      skills.map((s) => {
        if (s.id !== selectedSkillId) return s;
        return {
          ...s,
          points: newPoints,
          level: newLevel,
          relativeLevel: newLevel - attrValue,
        };
      })
    );

    // Reset form
    setSelectedSkillId('');
    setPointsToAdd(1);
    setSessionLabel('');
    setAdvanceNotes('');
    setShowAddForm(false);
  };

  const selectedSkill = skills.find((s) => s.id === selectedSkillId);
  const previewNewPoints = selectedSkill ? selectedSkill.points + pointsToAdd : 0;
  const previewNewLevel = selectedSkill
    ? calculateSkillLevel(
        getAttributeValue(selectedSkill.attribute),
        (selectedSkill.difficulty || 'A') as SkillDifficulty,
        previewNewPoints
      )
    : 0;

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-gray-300 hover:text-gray-100"
        >
          <History size={18} className="text-purple-400" />
          <h3 className="text-lg font-semibold">
            Skill History
            <span className="text-sm text-gray-400 ml-2">({skillHistory.length} entries)</span>
          </h3>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {editMode && expanded && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1 px-2 py-1 bg-purple-600 hover:bg-purple-700 rounded text-sm"
          >
            <Plus size={14} />
            Record Advancement
          </button>
        )}
      </div>

      {expanded && (
        <div className="mt-2">
          {/* Add advancement form */}
          {editMode && showAddForm && (
            <div className="bg-gray-700 rounded p-3 mb-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Skill</label>
                  <select
                    value={selectedSkillId}
                    onChange={(e) => setSelectedSkillId(e.target.value)}
                    className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-sm text-gray-100"
                  >
                    <option value="">Select skill...</option>
                    {skills.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}{s.specialization ? ` (${s.specialization})` : ''} — Lvl {s.level} [{s.points} pts]
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Points to Add</label>
                  <input
                    type="number"
                    value={pointsToAdd}
                    onChange={(e) => setPointsToAdd(Math.max(1, parseInt(e.target.value) || 1))}
                    min={1}
                    className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-sm text-gray-100"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Session Label</label>
                  <input
                    type="text"
                    value={sessionLabel}
                    onChange={(e) => setSessionLabel(e.target.value)}
                    placeholder="Session 12"
                    className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-sm text-gray-100"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Notes</label>
                  <input
                    type="text"
                    value={advanceNotes}
                    onChange={(e) => setAdvanceNotes(e.target.value)}
                    placeholder="Optional notes..."
                    className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-sm text-gray-100"
                  />
                </div>
              </div>

              {/* Preview */}
              {selectedSkill && (
                <div className="flex items-center gap-2 text-sm bg-gray-800 rounded px-3 py-2">
                  <TrendingUp size={14} className="text-green-400" />
                  <span className="text-gray-300">
                    {selectedSkill.name}: {selectedSkill.points} → {previewNewPoints} pts,
                    Level {selectedSkill.level} → {previewNewLevel}
                    {previewNewLevel > selectedSkill.level && (
                      <span className="text-green-400 ml-1">(+{previewNewLevel - selectedSkill.level})</span>
                    )}
                  </span>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-1 text-sm bg-gray-600 hover:bg-gray-500 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRecordAdvancement}
                  disabled={!selectedSkillId}
                  className="px-3 py-1 text-sm bg-purple-600 hover:bg-purple-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Record
                </button>
              </div>
            </div>
          )}

          {/* History entries */}
          {sortedHistory.length === 0 ? (
            <div className="text-gray-500 italic text-sm">No skill advancements recorded yet.</div>
          ) : (
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {sortedHistory.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between text-sm bg-gray-700/50 rounded px-3 py-1.5">
                  <div className="flex items-center gap-2">
                    <TrendingUp size={12} className="text-green-400 flex-shrink-0" />
                    <span className="text-gray-200 font-medium">{entry.skillName}</span>
                    {entry.sessionLabel && (
                      <span className="text-xs px-1.5 py-0.5 bg-gray-600 rounded text-gray-400">
                        {entry.sessionLabel}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span>+{entry.pointsAdded} pts</span>
                    <span>
                      Lvl {entry.previousLevel} → {entry.newLevel}
                      {entry.newLevel > entry.previousLevel && (
                        <span className="text-green-400"> (+{entry.newLevel - entry.previousLevel})</span>
                      )}
                    </span>
                    <span>{new Date(entry.date).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
