import { useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import type { Skill, SkillAttribute, PrimaryAttributes, SecondaryAttributes } from '../../types/characterSheet';

interface SkillsSectionProps {
  skills: Skill[];
  primaryAttributes: PrimaryAttributes;
  secondaryAttributes: SecondaryAttributes;
  editMode: boolean;
  onChange: (skills: Skill[]) => void;
}

type SortField = 'name' | 'attribute' | 'level' | 'points';
type SortDir = 'asc' | 'desc';

const SKILL_ATTRIBUTES: SkillAttribute[] = ['ST', 'DX', 'IQ', 'HT', 'Will', 'Per'];

export function SkillsSection({
  skills,
  primaryAttributes,
  secondaryAttributes,
  editMode,
  onChange,
}: SkillsSectionProps) {
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const getAttributeValue = (attr: SkillAttribute): number => {
    if (attr === 'Will') return secondaryAttributes.will.value;
    if (attr === 'Per') return secondaryAttributes.per.value;
    return primaryAttributes[attr as keyof PrimaryAttributes];
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const sortedSkills = [...skills].sort((a, b) => {
    let cmp = 0;
    switch (sortField) {
      case 'name':
        cmp = a.name.localeCompare(b.name);
        break;
      case 'attribute':
        cmp = a.attribute.localeCompare(b.attribute);
        break;
      case 'level':
        cmp = a.level - b.level;
        break;
      case 'points':
        cmp = a.points - b.points;
        break;
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const handleAdd = () => {
    const newSkill: Skill = {
      id: `skill-${Date.now()}`,
      name: '',
      attribute: 'IQ',
      relativeLevel: 0,
      points: 1,
      level: primaryAttributes.IQ,
    };
    onChange([...skills, newSkill]);
  };

  const handleRemove = (id: string) => {
    onChange(skills.filter((s) => s.id !== id));
  };

  const handleChange = (id: string, updates: Partial<Skill>) => {
    onChange(
      skills.map((s) => {
        if (s.id !== id) return s;
        const updated = { ...s, ...updates };

        // Recalculate level if attribute or relative level changed
        if (updates.attribute !== undefined || updates.relativeLevel !== undefined) {
          const attrValue = getAttributeValue(updated.attribute);
          updated.level = attrValue + updated.relativeLevel;
        }

        return updated;
      })
    );
  };

  const totalPoints = skills.reduce((sum, s) => sum + s.points, 0);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-100">
          Skills <span className="text-sm text-gray-400">({skills.length}) [{totalPoints}]</span>
        </h3>
        {editMode && (
          <button
            onClick={handleAdd}
            className="flex items-center gap-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
          >
            <Plus size={14} />
            Add Skill
          </button>
        )}
      </div>

      {skills.length === 0 ? (
        <div className="text-gray-500 italic">No skills</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-700">
                <th
                  className="pb-2 cursor-pointer hover:text-gray-200"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-1">
                    Skill <SortIcon field="name" />
                  </div>
                </th>
                <th
                  className="pb-2 cursor-pointer hover:text-gray-200 w-20"
                  onClick={() => handleSort('attribute')}
                >
                  <div className="flex items-center gap-1">
                    Attr <SortIcon field="attribute" />
                  </div>
                </th>
                <th className="pb-2 w-24">Rel. Lvl</th>
                <th
                  className="pb-2 cursor-pointer hover:text-gray-200 w-16 text-center"
                  onClick={() => handleSort('level')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Level <SortIcon field="level" />
                  </div>
                </th>
                <th
                  className="pb-2 cursor-pointer hover:text-gray-200 w-16 text-center"
                  onClick={() => handleSort('points')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Pts <SortIcon field="points" />
                  </div>
                </th>
                {editMode && <th className="pb-2 w-10"></th>}
              </tr>
            </thead>
            <tbody>
              {sortedSkills.map((skill) => (
                <tr key={skill.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="py-1.5">
                    {editMode ? (
                      <div className="flex gap-1">
                        <input
                          type="text"
                          value={skill.name}
                          onChange={(e) => handleChange(skill.id, { name: e.target.value })}
                          placeholder="Skill name"
                          className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-0.5 text-gray-100"
                        />
                        {skill.techLevel !== undefined && (
                          <span className="text-gray-400">/TL{skill.techLevel}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-200">
                        {skill.name}
                        {skill.techLevel !== undefined && (
                          <span className="text-gray-500">/TL{skill.techLevel}</span>
                        )}
                        {skill.specialization && (
                          <span className="text-gray-400"> ({skill.specialization})</span>
                        )}
                      </span>
                    )}
                  </td>
                  <td className="py-1.5">
                    {editMode ? (
                      <select
                        value={skill.attribute}
                        onChange={(e) => handleChange(skill.id, { attribute: e.target.value as SkillAttribute })}
                        className="bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-gray-100"
                      >
                        {SKILL_ATTRIBUTES.map((attr) => (
                          <option key={attr} value={attr}>
                            {attr}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-gray-400">{skill.attribute}</span>
                    )}
                  </td>
                  <td className="py-1.5">
                    {editMode ? (
                      <input
                        type="number"
                        value={skill.relativeLevel}
                        onChange={(e) => handleChange(skill.id, { relativeLevel: parseInt(e.target.value) || 0 })}
                        className="w-16 bg-gray-700 border border-gray-600 rounded px-2 py-0.5 text-gray-100 text-center"
                      />
                    ) : (
                      <span className="text-gray-400">
                        {skill.attribute}{skill.relativeLevel >= 0 ? '+' : ''}{skill.relativeLevel}
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 text-center">
                    <span className="font-bold text-gray-100">{skill.level}</span>
                  </td>
                  <td className="py-1.5 text-center">
                    {editMode ? (
                      <input
                        type="number"
                        value={skill.points}
                        onChange={(e) => handleChange(skill.id, { points: parseInt(e.target.value) || 0 })}
                        className="w-14 bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-gray-100 text-center"
                        min={0}
                      />
                    ) : (
                      <span className="text-gray-400">[{skill.points}]</span>
                    )}
                  </td>
                  {editMode && (
                    <td className="py-1.5">
                      <button
                        onClick={() => handleRemove(skill.id)}
                        className="p-1 hover:bg-gray-600 rounded text-red-400"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
