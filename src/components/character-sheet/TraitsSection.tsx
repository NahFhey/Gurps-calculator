import { useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import type { Advantage, Perk, Disadvantage, Quirk } from '../../types/characterSheet';

interface TraitsSectionProps {
  advantages: Advantage[];
  perks: Perk[];
  disadvantages: Disadvantage[];
  quirks: Quirk[];
  editMode: boolean;
  onAdvantagesChange: (advantages: Advantage[]) => void;
  onPerksChange: (perks: Perk[]) => void;
  onDisadvantagesChange: (disadvantages: Disadvantage[]) => void;
  onQuirksChange: (quirks: Quirk[]) => void;
}

interface TraitListProps<T extends Advantage | Perk | Disadvantage | Quirk> {
  title: string;
  traits: T[];
  type: T['type'];
  editMode: boolean;
  onChange: (traits: T[]) => void;
  defaultPoints: number;
  colorClass: string;
}

function TraitList<T extends Advantage | Perk | Disadvantage | Quirk>({
  title,
  traits,
  type,
  editMode,
  onChange,
  defaultPoints,
  colorClass,
}: TraitListProps<T>) {
  const [expanded, setExpanded] = useState(true);

  const totalPoints = traits.reduce((sum, t) => sum + t.points, 0);

  const handleAdd = () => {
    const newTrait = {
      id: `${type}-${Date.now()}`,
      type,
      name: '',
      points: defaultPoints,
    } as T;
    onChange([...traits, newTrait]);
  };

  const handleRemove = (id: string) => {
    onChange(traits.filter((t) => t.id !== id));
  };

  const handleChange = (id: string, field: keyof T, value: unknown) => {
    onChange(
      traits.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    );
  };

  return (
    <div className="bg-surface-2 rounded p-3">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <span className={`font-semibold ${colorClass}`}>{title}</span>
          <span className="text-sm text-fg-muted">
            ({traits.length}) [{totalPoints >= 0 ? '+' : ''}{totalPoints}]
          </span>
        </div>
        {editMode && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleAdd();
            }}
            className="p-1 hover:bg-surface-3 rounded"
            title={`Add ${title.slice(0, -1)}`}
          >
            <Plus size={16} className="text-fg-muted" />
          </button>
        )}
      </div>

      {expanded && (
        <div className="mt-2 space-y-1">
          {traits.length === 0 ? (
            <div className="text-sm text-fg-faint italic">No {title.toLowerCase()}</div>
          ) : (
            traits.map((trait) => (
              <div
                key={trait.id}
                className="flex items-center gap-2 bg-surface-3 rounded px-2 py-1"
              >
                {editMode ? (
                  <>
                    <input
                      type="text"
                      value={trait.name}
                      onChange={(e) => handleChange(trait.id, 'name', e.target.value)}
                      placeholder="Trait name"
                      className="flex-1 bg-surface-4 border border-edge-bright rounded px-2 py-0.5 text-sm text-fg-bright"
                    />
                    {trait.level !== undefined && (
                      <input
                        type="number"
                        value={trait.level}
                        onChange={(e) => handleChange(trait.id, 'level', parseInt(e.target.value) || 0)}
                        className="w-12 bg-surface-4 border border-edge-bright rounded px-1 py-0.5 text-sm text-fg-bright text-center"
                        placeholder="Lvl"
                      />
                    )}
                    <input
                      type="number"
                      value={trait.points}
                      onChange={(e) => handleChange(trait.id, 'points', parseInt(e.target.value) || 0)}
                      className="w-16 bg-surface-4 border border-edge-bright rounded px-1 py-0.5 text-sm text-fg-bright text-center"
                    />
                    <button
                      onClick={() => handleRemove(trait.id)}
                      className="p-0.5 hover:bg-surface-4 rounded text-danger-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm text-fg-primary">
                      {trait.name}
                      {trait.level !== undefined && trait.level > 0 && ` ${trait.level}`}
                      {trait.specialization && ` (${trait.specialization})`}
                    </span>
                    <span className={`text-sm font-medium ${trait.points >= 0 ? 'text-success-400' : 'text-danger-400'}`}>
                      [{trait.points >= 0 ? '+' : ''}{trait.points}]
                    </span>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function TraitsSection({
  advantages,
  perks,
  disadvantages,
  quirks,
  editMode,
  onAdvantagesChange,
  onPerksChange,
  onDisadvantagesChange,
  onQuirksChange,
}: TraitsSectionProps) {
  return (
    <div className="bg-surface-1 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-fg-bright mb-3">Traits</h3>

      <div className="space-y-3">
        <TraitList
          title="Advantages"
          traits={advantages}
          type="advantage"
          editMode={editMode}
          onChange={onAdvantagesChange}
          defaultPoints={10}
          colorClass="text-success-400"
        />

        <TraitList
          title="Perks"
          traits={perks}
          type="perk"
          editMode={editMode}
          onChange={onPerksChange}
          defaultPoints={1}
          colorClass="text-success-300"
        />

        <TraitList
          title="Disadvantages"
          traits={disadvantages}
          type="disadvantage"
          editMode={editMode}
          onChange={onDisadvantagesChange}
          defaultPoints={-10}
          colorClass="text-danger-400"
        />

        <TraitList
          title="Quirks"
          traits={quirks}
          type="quirk"
          editMode={editMode}
          onChange={onQuirksChange}
          defaultPoints={-1}
          colorClass="text-danger-300"
        />
      </div>
    </div>
  );
}
