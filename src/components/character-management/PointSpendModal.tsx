import { useMemo, useState } from 'react';
import { Minus, Plus, ShoppingCart, Trash2, X } from 'lucide-react';
import { useCampaignStore } from '../../state/campaignStore';
import { calculateRelativeLevel, calculateSkillLevel, createDefaultGCSData, syncWorkSkillsFromGCS } from '../../types/characterSheet';
import { characterLog } from '../../utils/activityLogger';
import { ATTRIBUTE_COSTS, POOL_COSTS, SECONDARY_COSTS } from '../../utils/characterPoints';
import {
  applyPointSpend,
  pointSpendCartTotal,
  pointSpendLineCost,
} from '../../utils/pointSpend';
import type { Character } from '../../types/campaign';
import type { PrimaryAttributes, SecondaryAttributes, SkillAttribute, SkillDifficulty } from '../../types/characterSheet';
import type { PointSpendLine, TraitSpendType } from '../../utils/pointSpend';

interface PointSpendModalProps {
  character: Character;
  campaignDay: number;
  onClose: () => void;
}

type Tab = 'skills' | 'attributes' | 'traits';

const secondaryLabels: Record<keyof SecondaryAttributes, string> = {
  will: 'Will', frightCheck: 'Fright Check', per: 'Perception', vision: 'Vision',
  hearing: 'Hearing', tasteSmell: 'Taste & Smell', touch: 'Touch',
  basicSpeed: 'Basic Speed', basicMove: 'Basic Move',
};

const lineLabel = (line: PointSpendLine, character: Character): string => {
  if (line.kind === 'skill') return character.gcsData?.skills.find((skill) => skill.id === line.skillId)?.name ?? 'Skill';
  if (line.kind === 'newSkill') return `New skill: ${line.name}`;
  if (line.kind === 'spell') return character.gcsData?.spells.find((spell) => spell.id === line.spellId)?.name ?? 'Spell';
  if (line.kind === 'primary') return `${line.attribute} +${line.increments}`;
  if (line.kind === 'secondary') return `${secondaryLabels[line.attribute]} +${line.increments}${line.attribute === 'basicSpeed' ? ' step' : ''}`;
  if (line.kind === 'pool') return `${line.pool} +${line.increments}`;
  return `${line.name} (${line.traitType})`;
};

const skillPointsInCart = (lines: PointSpendLine[], skillId: string): number => {
  for (const line of lines) if (line.kind === 'skill' && line.skillId === skillId) return line.points;
  return 0;
};

const spellPointsInCart = (lines: PointSpendLine[], spellId: string): number => {
  for (const line of lines) if (line.kind === 'spell' && line.spellId === spellId) return line.points;
  return 0;
};

const primaryIncrementsInCart = (lines: PointSpendLine[], attribute: keyof PrimaryAttributes): number => {
  for (const line of lines) if (line.kind === 'primary' && line.attribute === attribute) return line.increments;
  return 0;
};

const secondaryIncrementsInCart = (lines: PointSpendLine[], attribute: keyof SecondaryAttributes): number => {
  for (const line of lines) if (line.kind === 'secondary' && line.attribute === attribute) return line.increments;
  return 0;
};

const poolIncrementsInCart = (lines: PointSpendLine[], pool: 'HP' | 'FP'): number => {
  for (const line of lines) if (line.kind === 'pool' && line.pool === pool) return line.increments;
  return 0;
};

export function PointSpendModal({ character, campaignDay, onClose }: PointSpendModalProps) {
  const { actions } = useCampaignStore();
  const gcsData = useMemo(() => character.gcsData ?? createDefaultGCSData(), [character.gcsData]);
  const [tab, setTab] = useState<Tab>('skills');
  const [lines, setLines] = useState<PointSpendLine[]>([]);
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillSpecialization, setNewSkillSpecialization] = useState('');
  const [newSkillAttribute, setNewSkillAttribute] = useState<SkillAttribute>('IQ');
  const [newSkillDifficulty, setNewSkillDifficulty] = useState<SkillDifficulty>('A');
  const [traitName, setTraitName] = useState('');
  const [traitType, setTraitType] = useState<TraitSpendType>('advantage');
  const [traitPoints, setTraitPoints] = useState(1);

  const balance = gcsData?.unspentPoints ?? 0;
  const total = useMemo(() => pointSpendCartTotal(lines), [lines]);
  const remaining = balance - total;
  const insufficient = total > balance;

  const addIncrement = (line: PointSpendLine) => {
    setLines((current) => {
      const existing = current.find((candidate) => candidate.id === line.id);
      if (!existing) return [...current, line];
      return current.map((candidate): PointSpendLine => {
        if (candidate.id !== line.id) return candidate;
        if (candidate.kind === 'skill' || candidate.kind === 'newSkill' || candidate.kind === 'spell') {
          return { ...candidate, points: candidate.points + 1 };
        }
        if (candidate.kind === 'primary' || candidate.kind === 'secondary' || candidate.kind === 'pool') {
          return { ...candidate, increments: candidate.increments + 1 };
        }
        return candidate;
      });
    });
  };

  const decrementLine = (id: string) => {
    setLines((current) => current.flatMap((line): PointSpendLine[] => {
      if (line.id !== id) return [line];
      if (line.kind === 'skill' || line.kind === 'newSkill' || line.kind === 'spell') {
        return line.points > 1 ? [{ ...line, points: line.points - 1 }] : [];
      }
      if (line.kind === 'primary' || line.kind === 'secondary' || line.kind === 'pool') {
        return line.increments > 1 ? [{ ...line, increments: line.increments - 1 }] : [];
      }
      return [];
    }));
  };

  const addNewSkill = () => {
    const name = newSkillName.trim();
    if (!name) return;
    addIncrement({
      id: `new-skill-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      kind: 'newSkill', name,
      ...(newSkillSpecialization.trim() ? { specialization: newSkillSpecialization.trim() } : {}),
      attribute: newSkillAttribute, difficulty: newSkillDifficulty, points: 1,
    });
    setNewSkillName('');
    setNewSkillSpecialization('');
  };

  const addTrait = () => {
    const name = traitName.trim();
    if (!name) return;
    setLines((current) => [...current, {
      id: `trait-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      kind: 'trait', traitType, name, points: traitPoints,
    }]);
    setTraitName('');
    setTraitPoints(traitType === 'disadvantage' || traitType === 'quirk' ? -1 : 1);
  };

  const handleConfirm = () => {
    if (lines.length === 0 || insufficient) return;
    const applied = applyPointSpend(gcsData, lines, campaignDay);
    actions.updateCharacter(character.id, {
      gcsData: applied.gcsData,
      st: applied.gcsData.attributes.ST,
      work: { ...character.work, skills: syncWorkSkillsFromGCS(applied.gcsData) },
    });
    actions.addLogEntry(characterLog.pointsSpent(
      character.name,
      applied.total,
      applied.summary,
      { characterIds: [character.id], quantity: applied.total }
    ));
    onClose();
  };

  const primaryIncrement = (attribute: keyof PrimaryAttributes): number =>
    primaryIncrementsInCart(lines, attribute);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="spend-points-title" className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-gray-600 bg-gray-800">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-700 px-5 py-4">
          <div><h2 id="spend-points-title" className="text-lg font-semibold text-gray-100">Spend Points — {character.name}</h2><p className="text-sm text-gray-400">Pool {balance} · Cart {total} · Remaining <span className={remaining < 0 ? 'text-red-400' : 'text-emerald-400'}>{remaining}</span></p></div>
          <button type="button" onClick={onClose} aria-label="Close spend points" className="text-gray-400 hover:text-gray-200"><X className="h-5 w-5" /></button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <main className="min-h-0 flex-1 overflow-y-auto p-5">
            <nav className="mb-5 flex gap-2 border-b border-gray-700 pb-3">
              {([['skills', 'Skills & Spells'], ['attributes', 'Attributes'], ['traits', 'Traits']] as const).map(([key, label]) => <button key={key} type="button" onClick={() => setTab(key)} className={`rounded px-3 py-2 text-sm ${tab === key ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>{label}</button>)}
            </nav>

            {tab === 'skills' && <div className="space-y-5">
              <section><h3 className="mb-2 font-medium text-gray-200">Existing skills</h3><div className="space-y-2">{gcsData.skills.map((skill) => {
                const points = skillPointsInCart(lines, skill.id);
                const attr = skill.attribute === 'Will' ? gcsData.secondaryAttributes.will.value : skill.attribute === 'Per' ? gcsData.secondaryAttributes.per.value : gcsData.attributes[skill.attribute];
                const level = calculateSkillLevel(attr, skill.difficulty ?? 'A', skill.points + points);
                return <div key={skill.id} className="flex items-center justify-between rounded bg-gray-900/70 p-3"><div><span className="text-gray-100">{skill.name}</span><span className="ml-2 text-xs text-gray-400">Level {skill.level} → {level}; +{points} point{points === 1 ? '' : 's'}</span></div><button data-testid={`add-skill-point-${skill.id}`} type="button" onClick={() => addIncrement({ id: `skill-${skill.id}`, kind: 'skill', skillId: skill.id, points: 1 })} className="rounded bg-emerald-700 p-1.5 text-white hover:bg-emerald-600"><Plus className="h-4 w-4" /></button></div>;
              })}</div></section>
              <section><h3 className="mb-2 font-medium text-gray-200">Spells</h3><div className="space-y-2">{gcsData.spells.map((spell) => {
                const points = spellPointsInCart(lines, spell.id);
                const level = gcsData.attributes.IQ + calculateRelativeLevel('H', spell.points + points);
                return <div key={spell.id} className="flex items-center justify-between rounded bg-gray-900/70 p-3"><div><span className="text-gray-100">{spell.name}</span><span className="ml-2 text-xs text-gray-400">Level {spell.level} → {level}; +{points} points</span></div><button data-testid={`add-spell-point-${spell.id}`} type="button" onClick={() => addIncrement({ id: `spell-${spell.id}`, kind: 'spell', spellId: spell.id, points: 1 })} className="rounded bg-emerald-700 p-1.5 text-white"><Plus className="h-4 w-4" /></button></div>;
              })}</div></section>
              <section className="rounded border border-gray-700 p-3"><h3 className="mb-3 font-medium text-gray-200">Add new skill</h3><div className="grid gap-2 sm:grid-cols-4"><input aria-label="New skill name" value={newSkillName} onChange={(event) => setNewSkillName(event.target.value)} placeholder="Skill name" className="rounded border border-gray-600 bg-gray-900 px-3 py-2 text-gray-100" /><input aria-label="New skill specialization" value={newSkillSpecialization} onChange={(event) => setNewSkillSpecialization(event.target.value)} placeholder="Specialization (optional)" className="rounded border border-gray-600 bg-gray-900 px-3 py-2 text-gray-100" /><select aria-label="New skill attribute" value={newSkillAttribute} onChange={(event) => setNewSkillAttribute(event.target.value as SkillAttribute)} className="rounded border border-gray-600 bg-gray-900 px-2 text-gray-100">{(['ST', 'DX', 'IQ', 'HT', 'Will', 'Per'] as const).map((value) => <option key={value}>{value}</option>)}</select><select aria-label="New skill difficulty" value={newSkillDifficulty} onChange={(event) => setNewSkillDifficulty(event.target.value as SkillDifficulty)} className="rounded border border-gray-600 bg-gray-900 px-2 text-gray-100">{(['E', 'A', 'H', 'VH'] as const).map((value) => <option key={value}>{value}</option>)}</select></div><button type="button" onClick={addNewSkill} className="mt-2 rounded bg-blue-600 px-3 py-2 text-sm text-white">Add skill to cart</button></section>
            </div>}

            {tab === 'attributes' && <div className="space-y-5">
              <section><h3 className="mb-2 font-medium text-gray-200">Primary attributes</h3><div className="grid gap-2 sm:grid-cols-2">{(Object.keys(ATTRIBUTE_COSTS) as Array<keyof PrimaryAttributes>).map((attribute) => {
                const increments = primaryIncrement(attribute); return <div key={attribute} className="flex items-center justify-between rounded bg-gray-900/70 p-3"><span>{attribute} {gcsData.attributes[attribute]} → {gcsData.attributes[attribute] + increments} <small className="text-gray-400">({ATTRIBUTE_COSTS[attribute]} pts)</small></span><button data-testid={`add-attribute-${attribute}`} type="button" onClick={() => addIncrement({ id: `primary-${attribute}`, kind: 'primary', attribute, increments: 1 })} className="rounded bg-emerald-700 p-1.5"><Plus className="h-4 w-4" /></button></div>;
              })}</div></section>
              <section><h3 className="mb-2 font-medium text-gray-200">Secondary characteristics</h3><div className="grid gap-2 sm:grid-cols-2">{(Object.keys(SECONDARY_COSTS) as Array<keyof SecondaryAttributes>).map((attribute) => {
                const increments = secondaryIncrementsInCart(lines, attribute); const step = attribute === 'basicSpeed' ? 0.25 : 1; return <div key={attribute} className="flex items-center justify-between rounded bg-gray-900/70 p-3"><span>{secondaryLabels[attribute]} {gcsData.secondaryAttributes[attribute].value} → {gcsData.secondaryAttributes[attribute].value + increments * step} <small className="text-gray-400">({SECONDARY_COSTS[attribute]} pts)</small></span><button data-testid={`add-secondary-${attribute}`} type="button" onClick={() => addIncrement({ id: `secondary-${attribute}`, kind: 'secondary', attribute, increments: 1 })} className="rounded bg-emerald-700 p-1.5"><Plus className="h-4 w-4" /></button></div>;
              })}</div></section>
              <section><h3 className="mb-2 font-medium text-gray-200">Point pools</h3><div className="grid gap-2 sm:grid-cols-2">{(['HP', 'FP'] as const).map((pool) => { const increments = poolIncrementsInCart(lines, pool); return <div key={pool} className="flex items-center justify-between rounded bg-gray-900/70 p-3"><span>{pool} max {gcsData.pools[pool].max} → {gcsData.pools[pool].max + increments} <small className="text-gray-400">({POOL_COSTS[pool]} pts)</small></span><button data-testid={`add-pool-${pool}`} type="button" onClick={() => addIncrement({ id: `pool-${pool}`, kind: 'pool', pool, increments: 1 })} className="rounded bg-emerald-700 p-1.5"><Plus className="h-4 w-4" /></button></div>; })}</div></section>
              {(primaryIncrement('DX') > 0 || primaryIncrement('IQ') > 0) && <section data-testid="dependent-skill-preview" className="rounded border border-blue-800 bg-blue-950/30 p-3"><h3 className="mb-1 text-sm font-medium text-blue-200">Dependent skill preview</h3>{gcsData.skills.filter((skill) => skill.attribute === 'DX' || skill.attribute === 'IQ').map((skill) => { const increase = primaryIncrement(skill.attribute as 'DX' | 'IQ'); return <p key={skill.id} className="text-xs text-gray-300">{skill.name}: {skill.level} → {skill.level + increase}</p>; })}{primaryIncrement('IQ') > 0 && gcsData.spells.map((spell) => <p key={spell.id} className="text-xs text-gray-300">{spell.name}: {spell.level} → {spell.level + primaryIncrement('IQ')}</p>)}</section>}
            </div>}

            {tab === 'traits' && <section className="rounded border border-gray-700 p-4"><h3 className="mb-3 font-medium text-gray-200">Add GM-priced trait</h3><div className="grid gap-2 sm:grid-cols-3"><input aria-label="Trait name" value={traitName} onChange={(event) => setTraitName(event.target.value)} placeholder="Trait name" className="rounded border border-gray-600 bg-gray-900 px-3 py-2 text-gray-100" /><select aria-label="Trait type" value={traitType} onChange={(event) => { const value = event.target.value as TraitSpendType; setTraitType(value); setTraitPoints(value === 'disadvantage' || value === 'quirk' ? -1 : 1); }} className="rounded border border-gray-600 bg-gray-900 px-3 py-2 text-gray-100"><option value="advantage">Advantage</option><option value="perk">Perk</option><option value="disadvantage">Disadvantage</option><option value="quirk">Quirk</option></select><input aria-label="Trait point cost" type="number" value={traitPoints} onChange={(event) => setTraitPoints(Number(event.target.value) || 0)} className="rounded border border-gray-600 bg-gray-900 px-3 py-2 text-gray-100" /></div><p className="mt-2 text-xs text-gray-400">Negative costs credit the point pool.</p><button data-testid="add-trait-to-cart" type="button" onClick={addTrait} className="mt-3 rounded bg-blue-600 px-3 py-2 text-sm text-white">Add trait to cart</button></section>}
          </main>

          <aside className="w-full border-t border-gray-700 bg-gray-900/50 p-4 lg:w-80 lg:border-l lg:border-t-0"><h3 className="mb-3 flex items-center gap-2 font-medium text-gray-100"><ShoppingCart className="h-4 w-4" /> Cart</h3>{lines.length === 0 ? <p className="text-sm italic text-gray-500">No changes yet.</p> : <div className="space-y-2">{lines.map((line) => <div key={line.id} data-testid="spend-cart-line" className="rounded bg-gray-800 p-2 text-sm"><div className="flex items-start justify-between gap-2"><span className="text-gray-200">{lineLabel(line, character)}</span><strong className={pointSpendLineCost(line) < 0 ? 'text-emerald-400' : 'text-gray-100'}>{pointSpendLineCost(line)}</strong></div><div className="mt-2 flex justify-end gap-1">{line.kind !== 'trait' && <><button type="button" aria-label={`Decrease ${lineLabel(line, character)}`} onClick={() => decrementLine(line.id)} className="rounded bg-gray-700 p-1"><Minus className="h-3 w-3" /></button><button type="button" aria-label={`Increase ${lineLabel(line, character)}`} onClick={() => addIncrement(line)} className="rounded bg-gray-700 p-1"><Plus className="h-3 w-3" /></button></>}<button type="button" aria-label={`Remove ${lineLabel(line, character)}`} onClick={() => setLines((current) => current.filter((candidate) => candidate.id !== line.id))} className="rounded bg-red-950 p-1 text-red-300"><Trash2 className="h-3 w-3" /></button></div></div>)}</div>}{insufficient && <p data-testid="insufficient-points-notice" className="mt-4 rounded border border-red-800 bg-red-950/40 p-2 text-sm text-red-300">Insufficient points: remove {total - balance} points from the cart.</p>}</aside>
        </div>
        <footer className="flex items-center justify-between border-t border-gray-700 px-5 py-4"><span className="text-sm text-gray-400">Cart total: {total}</span><div className="flex gap-2"><button type="button" onClick={onClose} className="rounded border border-gray-600 px-4 py-2 text-gray-300">Cancel</button><button data-testid="confirm-spend-button" type="button" onClick={handleConfirm} disabled={lines.length === 0 || insufficient} className="rounded bg-emerald-600 px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Confirm spend</button></div></footer>
      </div>
    </div>
  );
}
