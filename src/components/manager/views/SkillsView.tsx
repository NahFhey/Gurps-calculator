import { useState } from 'react';
import { Plus, Save, X, Trash2 } from 'lucide-react';
import type { SkillsViewProps } from '../../../types/views';

/**
 * SkillsView - Manages cooking skills table
 *
 * GM-only view for managing the list of cooking skills available
 * to workers. Non-GM users can view but not edit.
 */
export function SkillsView({ cookingSkills, saveCookingSkills, gmMode, onDelete }: SkillsViewProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [newSkillName, setNewSkillName] = useState('');

  function addSkill() {
    if (!newSkillName.trim()) {
      alert('Enter a skill name');
      return;
    }

    if (cookingSkills.some(s => s.name.toLowerCase() === newSkillName.trim().toLowerCase())) {
      alert('Skill already exists');
      return;
    }

    const newSkill = {
      id: crypto.randomUUID(),
      name: newSkillName.trim()
    };

    saveCookingSkills([...cookingSkills, newSkill]);
    setNewSkillName('');
    setShowAdd(false);
  }

  return (
    <div>
      <div className="flex justify-between mb-4">
        <h2 className="text-xl font-bold">Cooking Skills Table</h2>
        {gmMode && (
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="bg-green-600 px-4 py-2 rounded"
          >
            <Plus size={20} className="inline" /> Add Skill
          </button>
        )}
      </div>

      {!gmMode && (
        <div className="bg-yellow-900 bg-opacity-30 border border-yellow-600 p-4 rounded mb-4">
          <p className="text-yellow-200">⚠️ GM Mode required to add/edit cooking skills</p>
        </div>
      )}

      {showAdd && gmMode && (
        <div className="bg-gray-700 p-4 rounded mb-4 space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Skill Name</label>
            <input
              value={newSkillName}
              onChange={(e) => setNewSkillName(e.target.value)}
              placeholder="e.g., Cooking, Baking, Brewing, etc."
              className="w-full bg-gray-600 px-3 py-2 rounded"
            />
            <p className="text-xs text-gray-500 mt-1">Any GURPS skill can be added</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={addSkill}
              className="flex-1 bg-green-600 px-4 py-2 rounded"
            >
              <Save size={20} className="inline" /> Save
            </button>
            <button
              onClick={() => {
                setShowAdd(false);
                setNewSkillName('');
              }}
              className="bg-red-600 px-4 py-2 rounded"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      {cookingSkills.length === 0 ? (
        <div className="text-gray-500 text-center py-8">
          No cooking skills defined yet. {gmMode ? 'Add skills to the table.' : 'Ask GM to add skills.'}
        </div>
      ) : (
        <div className="space-y-2">
          {cookingSkills.map(skill => (
            <div key={skill.id} className="bg-gray-700 rounded p-3 flex items-center gap-3">
              <span className="flex-1 font-semibold">{skill.name}</span>
              {gmMode && (
                <button
                  onClick={() => onDelete('cookingSkill', skill.name, { id: skill.id })}
                  className="text-red-400 hover:text-red-300"
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
