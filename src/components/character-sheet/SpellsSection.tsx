import React, { useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import type { Spell, SpellClass } from '../../types/characterSheet';

interface SpellsSectionProps {
  spells: Spell[];
  iq: number;
  editMode: boolean;
  onChange: (spells: Spell[]) => void;
}

type SortField = 'name' | 'level' | 'class' | 'points';
type SortDir = 'asc' | 'desc';

const SPELL_CLASSES: SpellClass[] = [
  'Regular',
  'Missile',
  'Blocking',
  'Area',
  'Special',
  'Melee',
  'Info',
  'Info/Area',
  'Enchantment',
];

export function SpellsSection({
  spells,
  iq,
  editMode,
  onChange,
}: SpellsSectionProps) {
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [expandedSpell, setExpandedSpell] = useState<string | null>(null);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const sortedSpells = [...spells].sort((a, b) => {
    let cmp = 0;
    switch (sortField) {
      case 'name':
        cmp = a.name.localeCompare(b.name);
        break;
      case 'level':
        cmp = a.level - b.level;
        break;
      case 'class':
        cmp = a.spellClass.localeCompare(b.spellClass);
        break;
      case 'points':
        cmp = a.points - b.points;
        break;
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const handleAdd = () => {
    const newSpell: Spell = {
      id: `spell-${Date.now()}`,
      name: '',
      level: iq,
      attribute: 'IQ',
      relativeLevel: 0,
      points: 1,
      spellClass: 'Regular',
      castingCost: '1',
      maintenanceCost: '-',
      castingTime: '1 sec',
      duration: '1 min',
    };
    onChange([...spells, newSpell]);
  };

  const handleRemove = (id: string) => {
    onChange(spells.filter((s) => s.id !== id));
  };

  const handleChange = (id: string, updates: Partial<Spell>) => {
    onChange(
      spells.map((s) => {
        if (s.id !== id) return s;
        const updated = { ...s, ...updates };

        // Recalculate level if relative level changed
        if (updates.relativeLevel !== undefined) {
          updated.level = iq + updated.relativeLevel;
        }

        return updated;
      })
    );
  };

  const totalPoints = spells.reduce((sum, s) => sum + s.points, 0);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles size={20} className="text-purple-400" />
          <h3 className="text-lg font-semibold text-gray-100">
            Spells <span className="text-sm text-gray-400">({spells.length}) [{totalPoints}]</span>
          </h3>
        </div>
        {editMode && (
          <button
            onClick={handleAdd}
            className="flex items-center gap-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
          >
            <Plus size={14} />
            Add Spell
          </button>
        )}
      </div>

      {spells.length === 0 ? (
        <div className="text-gray-500 italic">No spells</div>
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
                    Spell <SortIcon field="name" />
                  </div>
                </th>
                <th
                  className="pb-2 cursor-pointer hover:text-gray-200 w-16 text-center"
                  onClick={() => handleSort('level')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Level <SortIcon field="level" />
                  </div>
                </th>
                <th className="pb-2 w-20">Rel. Lvl</th>
                <th
                  className="pb-2 cursor-pointer hover:text-gray-200 w-24"
                  onClick={() => handleSort('class')}
                >
                  <div className="flex items-center gap-1">
                    Class <SortIcon field="class" />
                  </div>
                </th>
                <th className="pb-2 w-16">Cost</th>
                <th className="pb-2 w-16">Maint</th>
                <th className="pb-2 w-20">Time</th>
                <th className="pb-2 w-24">Duration</th>
                <th
                  className="pb-2 cursor-pointer hover:text-gray-200 w-14 text-center"
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
              {sortedSpells.map((spell) => (
                <React.Fragment key={spell.id}>
                  <tr
                    className="border-b border-gray-700/50 hover:bg-gray-700/30 cursor-pointer"
                    onClick={() => setExpandedSpell(expandedSpell === spell.id ? null : spell.id)}
                  >
                    <td className="py-1.5">
                      {editMode ? (
                        <input
                          type="text"
                          value={spell.name}
                          onChange={(e) => handleChange(spell.id, { name: e.target.value })}
                          onClick={(e) => e.stopPropagation()}
                          placeholder="Spell name"
                          className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-0.5 text-gray-100"
                        />
                      ) : (
                        <span className="text-purple-300">{spell.name}</span>
                      )}
                    </td>
                    <td className="py-1.5 text-center">
                      <span className="font-bold text-gray-100">{spell.level}</span>
                    </td>
                    <td className="py-1.5">
                      {editMode ? (
                        <input
                          type="number"
                          value={spell.relativeLevel}
                          onChange={(e) => handleChange(spell.id, { relativeLevel: parseInt(e.target.value) || 0 })}
                          onClick={(e) => e.stopPropagation()}
                          className="w-14 bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-gray-100 text-center"
                        />
                      ) : (
                        <span className="text-gray-400">
                          IQ{spell.relativeLevel >= 0 ? '+' : ''}{spell.relativeLevel}
                        </span>
                      )}
                    </td>
                    <td className="py-1.5">
                      {editMode ? (
                        <select
                          value={spell.spellClass}
                          onChange={(e) => handleChange(spell.id, { spellClass: e.target.value as SpellClass })}
                          onClick={(e) => e.stopPropagation()}
                          className="bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-gray-100 text-xs"
                        >
                          {SPELL_CLASSES.map((cls) => (
                            <option key={cls} value={cls}>
                              {cls}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-gray-400 text-xs">{spell.spellClass}</span>
                      )}
                    </td>
                    <td className="py-1.5">
                      {editMode ? (
                        <input
                          type="text"
                          value={spell.castingCost}
                          onChange={(e) => handleChange(spell.id, { castingCost: e.target.value })}
                          onClick={(e) => e.stopPropagation()}
                          className="w-14 bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-gray-100 text-xs"
                        />
                      ) : (
                        <span className="text-gray-400 text-xs">{spell.castingCost}</span>
                      )}
                    </td>
                    <td className="py-1.5">
                      {editMode ? (
                        <input
                          type="text"
                          value={spell.maintenanceCost}
                          onChange={(e) => handleChange(spell.id, { maintenanceCost: e.target.value })}
                          onClick={(e) => e.stopPropagation()}
                          className="w-14 bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-gray-100 text-xs"
                        />
                      ) : (
                        <span className="text-gray-400 text-xs">{spell.maintenanceCost}</span>
                      )}
                    </td>
                    <td className="py-1.5">
                      {editMode ? (
                        <input
                          type="text"
                          value={spell.castingTime}
                          onChange={(e) => handleChange(spell.id, { castingTime: e.target.value })}
                          onClick={(e) => e.stopPropagation()}
                          className="w-16 bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-gray-100 text-xs"
                        />
                      ) : (
                        <span className="text-gray-400 text-xs">{spell.castingTime}</span>
                      )}
                    </td>
                    <td className="py-1.5">
                      {editMode ? (
                        <input
                          type="text"
                          value={spell.duration}
                          onChange={(e) => handleChange(spell.id, { duration: e.target.value })}
                          onClick={(e) => e.stopPropagation()}
                          className="w-20 bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-gray-100 text-xs"
                        />
                      ) : (
                        <span className="text-gray-400 text-xs">{spell.duration}</span>
                      )}
                    </td>
                    <td className="py-1.5 text-center">
                      {editMode ? (
                        <input
                          type="number"
                          value={spell.points}
                          onChange={(e) => handleChange(spell.id, { points: parseInt(e.target.value) || 0 })}
                          onClick={(e) => e.stopPropagation()}
                          className="w-12 bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-gray-100 text-center"
                          min={0}
                        />
                      ) : (
                        <span className="text-gray-400">[{spell.points}]</span>
                      )}
                    </td>
                    {editMode && (
                      <td className="py-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemove(spell.id);
                          }}
                          className="p-1 hover:bg-gray-600 rounded text-red-400"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                  {expandedSpell === spell.id && (
                    <tr className="bg-gray-700/30">
                      <td colSpan={editMode ? 10 : 9} className="px-4 py-2">
                        <div className="text-xs text-gray-400">
                          {spell.college && <div>College: {spell.college}</div>}
                          {spell.notes && <div className="mt-1">{spell.notes}</div>}
                          {spell.reference && <div className="mt-1 text-gray-500">Ref: {spell.reference}</div>}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
