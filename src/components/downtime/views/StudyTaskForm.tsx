import { useEffect, useMemo, useState } from 'react';
import { GraduationCap, X } from 'lucide-react';
import { selectAvailableCharacterIdsForSlot } from '../../../state/downtime/downtimeSelectors';
import { computeStudyHours, isEligibleTeacher } from '../../../utils/study';
import type { Character } from '../../../types/campaign';
import type { SkillAttribute, SkillDifficulty } from '../../../types/characterSheet';
import type { DowntimeState, StudyData } from '../../../types/downtime';

interface StudyTaskFormProps {
  characters: Character[];
  state: DowntimeState;
  currentDayKey: number;
  currentSlot: number;
  onSubmit: (data: { leaderId: string; helperIds: string[]; activityData: StudyData }) => void;
  onCancel: () => void;
}

const NEW_SKILL = '__new__';
const ATTRIBUTES: SkillAttribute[] = ['ST', 'DX', 'IQ', 'HT', 'Will', 'Per'];
const DIFFICULTIES: SkillDifficulty[] = ['E', 'A', 'H', 'VH'];

export function StudyTaskForm({
  characters,
  state,
  currentDayKey,
  currentSlot,
  onSubmit,
  onCancel,
}: StudyTaskFormProps) {
  const [leaderId, setLeaderId] = useState('');
  const [skillId, setSkillId] = useState('');
  const [newSkillName, setNewSkillName] = useState('');
  const [attribute, setAttribute] = useState<SkillAttribute>('IQ');
  const [difficulty, setDifficulty] = useState<SkillDifficulty>('A');
  const [teacherId, setTeacherId] = useState('');
  const [goodMaterials, setGoodMaterials] = useState(false);

  const availableCharacters = useMemo(() => {
    const ids = selectAvailableCharacterIdsForSlot(
      state,
      currentDayKey,
      currentSlot,
      characters.map((character) => character.id)
    );
    return characters.filter((character) => ids.includes(character.id));
  }, [characters, currentDayKey, currentSlot, state]);
  const leader = characters.find((character) => character.id === leaderId);
  const existingSkills = leader?.gcsData?.skills ?? [];
  const selectedSkill = existingSkills.find((skill) => skill.id === skillId);
  const isNewSkill = skillId === NEW_SKILL;
  const skillName = selectedSkill?.name ?? newSkillName;
  const specialization = selectedSkill?.specialization;

  useEffect(() => {
    setSkillId('');
    setNewSkillName('');
    setAttribute('IQ');
    setDifficulty('A');
    setTeacherId('');
  }, [leaderId]);

  useEffect(() => {
    if (!selectedSkill) {
      if (isNewSkill) {
        setAttribute('IQ');
        setDifficulty('A');
      }
      return;
    }
    setAttribute(selectedSkill.attribute);
    setDifficulty(selectedSkill.difficulty ?? 'A');
    setTeacherId('');
  }, [isNewSkill, selectedSkill]);

  const teacherCandidates = availableCharacters.filter((character) => character.id !== leaderId);
  const hasTeacher = teacherId !== '';
  const rate = computeStudyHours(hasTeacher, goodMaterials);
  const rateReason = hasTeacher ? 'taught' : goodMaterials ? 'good materials' : 'self-study';
  const canSubmit = Boolean(
    leader && (selectedSkill || (isNewSkill && newSkillName.trim()))
  );

  const handleSubmit = () => {
    if (!leader || !canSubmit) return;
    onSubmit({
      leaderId,
      helperIds: teacherId ? [teacherId] : [],
      activityData: {
        type: 'study',
        skillName: skillName.trim(),
        ...(specialization?.trim() ? { specialization: specialization.trim() } : {}),
        attribute,
        difficulty,
        goodMaterials,
        projectId: '',
      },
    });
  };

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800/60 p-4" data-testid="study-task-form">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-medium text-gray-100">
          <GraduationCap className="h-4 w-4 text-cyan-400" /> New Study Task
        </h3>
        <button type="button" onClick={onCancel} aria-label="Close form" className="text-gray-400 hover:text-gray-200">
          <X className="h-5 w-5" />
        </button>
      </div>

      <label className="mb-3 block text-sm text-gray-300">
        <span className="mb-1 block font-medium">Student</span>
        <select value={leaderId} onChange={(event) => setLeaderId(event.target.value)} data-testid="leader-select" className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-gray-100">
          <option value="">Select a student...</option>
          {availableCharacters.map((character) => <option key={character.id} value={character.id}>{character.name}</option>)}
        </select>
      </label>

      {leader && (
        <>
          <label className="mb-3 block text-sm text-gray-300">
            <span className="mb-1 block font-medium">Skill</span>
            <select value={skillId} onChange={(event) => setSkillId(event.target.value)} data-testid="skill-select" className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-gray-100">
              <option value="">Select a skill...</option>
              {existingSkills.map((skill) => (
                <option key={skill.id} value={skill.id}>
                  {skill.name}{skill.specialization ? ` (${skill.specialization})` : ''} — {skill.level}, {skill.attribute}
                </option>
              ))}
              <option value={NEW_SKILL}>New skill…</option>
            </select>
          </label>

          {isNewSkill && (
            <label className="mb-3 block text-sm text-gray-300">
              <span className="mb-1 block font-medium">New skill name</span>
              <input value={newSkillName} onChange={(event) => setNewSkillName(event.target.value)} data-testid="new-skill-name-input" className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-gray-100" />
            </label>
          )}

          {(selectedSkill || isNewSkill) && (
            <div className="mb-3 grid grid-cols-2 gap-3">
              <label className="block text-sm text-gray-300">
                <span className="mb-1 block font-medium">Difficulty</span>
                <select value={difficulty} onChange={(event) => setDifficulty(event.target.value as SkillDifficulty)} disabled={Boolean(selectedSkill)} data-testid="difficulty-select" className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-gray-100 disabled:text-gray-400">
                  {DIFFICULTIES.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
              <label className="block text-sm text-gray-300">
                <span className="mb-1 block font-medium">Attribute</span>
                <select value={attribute} onChange={(event) => setAttribute(event.target.value as SkillAttribute)} disabled={Boolean(selectedSkill)} data-testid="attribute-select" className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-gray-100 disabled:text-gray-400">
                  {ATTRIBUTES.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
            </div>
          )}

          {(selectedSkill || (isNewSkill && newSkillName.trim())) && (
            <label className="mb-3 block text-sm text-gray-300">
              <span className="mb-1 block font-medium">Teacher (optional)</span>
              <select value={teacherId} onChange={(event) => setTeacherId(event.target.value)} data-testid="teacher-select" className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-gray-100">
                <option value="">No teacher</option>
                {teacherCandidates.map((character) => {
                  const eligible = isEligibleTeacher(character, leader, skillName, specialization);
                  return <option key={character.id} value={character.id} disabled={!eligible}>{character.name}{eligible ? '' : " (can't teach — level too low)"}</option>;
                })}
              </select>
            </label>
          )}
        </>
      )}

      <label className="mb-2 flex items-center gap-2 text-sm text-gray-300">
        <input type="checkbox" checked={goodMaterials} onChange={(event) => setGoodMaterials(event.target.checked)} data-testid="good-materials-checkbox" />
        Good study materials
      </label>
      <p className="mb-4 text-xs text-cyan-300" data-testid="rate-preview">{rate}h/slot ({rateReason})</p>

      <div className="flex gap-2">
        <button type="button" onClick={handleSubmit} disabled={!canSubmit} data-testid="submit-button" className="rounded bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-500">Create Study Task</button>
        <button type="button" onClick={onCancel} className="rounded border border-gray-600 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700">Cancel</button>
      </div>
    </div>
  );
}
