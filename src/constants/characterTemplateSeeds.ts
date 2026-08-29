import type { CharacterTemplateEntity } from '../types/campaign';
import type {
  Advantage,
  Disadvantage,
  Equipment,
  PrimaryAttributes,
  Skill,
  SkillAttribute,
  SkillDifficulty,
  Spell,
} from '../types/characterSheet';
import { calculateRelativeLevel, calculateSkillLevel, createDefaultGCSData } from '../types/characterSheet';
import { ATTRIBUTE_COSTS, calculateTotalPoints } from '../utils/characterPoints';

type SkillSeed = [name: string, attribute: SkillAttribute, difficulty: SkillDifficulty, points: number];
type TraitSeed = [name: string, points: number];
type EquipmentSeed = [name: string, weight: number, cost: number, category: Equipment['category']];

interface BuildSeed {
  id: string;
  name: string;
  description: string;
  attributes: PrimaryAttributes;
  skills: SkillSeed[];
  advantages: TraitSeed[];
  disadvantages: TraitSeed[];
  spells?: Array<[name: string, points: number, college: string]>;
  equipment: EquipmentSeed[];
}

function attributeValue(attribute: SkillAttribute, attributes: PrimaryAttributes): number {
  if (attribute === 'Will' || attribute === 'Per') return attributes.IQ;
  return attributes[attribute];
}

function makeSkill(seedId: string, attributes: PrimaryAttributes, seed: SkillSeed, index: number): Skill {
  const [name, attribute, difficulty, points] = seed;
  return {
    id: `${seedId}-skill-${index + 1}`,
    name,
    attribute,
    difficulty,
    points,
    relativeLevel: calculateRelativeLevel(difficulty, points),
    level: calculateSkillLevel(attributeValue(attribute, attributes), difficulty, points),
  };
}

function makeSpell(seedId: string, iq: number, seed: [string, number, string], index: number): Spell {
  const [name, points, college] = seed;
  const relativeLevel = calculateRelativeLevel('H', points);
  return {
    id: `${seedId}-spell-${index + 1}`,
    name,
    attribute: 'IQ',
    relativeLevel,
    level: iq + relativeLevel,
    points,
    spellClass: 'Regular',
    castingCost: 'Varies',
    maintenanceCost: 'Varies',
    castingTime: '1 sec',
    duration: 'Varies',
    college,
  };
}

function buildTemplate(seed: BuildSeed): CharacterTemplateEntity {
  const gcsData = createDefaultGCSData();
  gcsData.attributes = { ...seed.attributes };
  gcsData.attributePoints = {
    ST: (seed.attributes.ST - 10) * ATTRIBUTE_COSTS.ST,
    DX: (seed.attributes.DX - 10) * ATTRIBUTE_COSTS.DX,
    IQ: (seed.attributes.IQ - 10) * ATTRIBUTE_COSTS.IQ,
    HT: (seed.attributes.HT - 10) * ATTRIBUTE_COSTS.HT,
  };
  const basicSpeed = (seed.attributes.DX + seed.attributes.HT) / 4;
  gcsData.secondaryAttributes = {
    will: { value: seed.attributes.IQ, points: 0 },
    frightCheck: { value: seed.attributes.IQ, points: 0 },
    per: { value: seed.attributes.IQ, points: 0 },
    vision: { value: seed.attributes.IQ, points: 0 },
    hearing: { value: seed.attributes.IQ, points: 0 },
    tasteSmell: { value: seed.attributes.IQ, points: 0 },
    touch: { value: seed.attributes.IQ, points: 0 },
    basicSpeed: { value: basicSpeed, points: 0 },
    basicMove: { value: Math.floor(basicSpeed), points: 0 },
  };
  gcsData.pools = {
    HP: { current: seed.attributes.ST, max: seed.attributes.ST, points: 0 },
    FP: { current: seed.attributes.HT, max: seed.attributes.HT, points: 0 },
  };
  gcsData.skills = seed.skills.map((skill, index) => makeSkill(seed.id, seed.attributes, skill, index));
  gcsData.advantages = seed.advantages.map<Advantage>(([name, points], index) => ({
    id: `${seed.id}-advantage-${index + 1}`, name, points, type: 'advantage',
  }));
  gcsData.disadvantages = seed.disadvantages.map<Disadvantage>(([name, points], index) => ({
    id: `${seed.id}-disadvantage-${index + 1}`, name, points, type: 'disadvantage',
  }));
  gcsData.spells = (seed.spells ?? []).map((spell, index) => makeSpell(seed.id, seed.attributes.IQ, spell, index));
  gcsData.equipment = seed.equipment.map(([name, weight, cost, category], index) => ({
    id: `${seed.id}-equipment-${index + 1}`, name, quantity: 1, weight, cost, category, equipped: true,
  }));
  gcsData.totalPoints = calculateTotalPoints(gcsData);
  return {
    id: seed.id,
    name: seed.name,
    description: seed.description,
    builtin: true,
    gcsData,
    createdAt: 0,
    updatedAt: 0,
  };
}

const BUILDS: BuildSeed[] = [
  {
    id: 'builtin-fighter', name: 'Fighter', description: 'A durable front-line warrior skilled with sword, shield, and bow.',
    attributes: { ST: 13, DX: 13, IQ: 10, HT: 12 },
    skills: [['Broadsword','DX','A',8],['Shield','DX','E',8],['Bow','DX','A',4],['Brawling','DX','E',2],['Wrestling','DX','A',2],['Armoury','IQ','A',2],['First Aid','IQ','E',1],['Hiking','HT','A',1],['Intimidation','Will','A',1],['Riding','DX','A',1]],
    advantages: [['Combat Reflexes',15],['High Pain Threshold',10],['Fit',5]], disadvantages: [['Sense of Duty (Companions)',-10],['Code of Honor (Soldier)',-10]],
    equipment: [['Broadsword',3,500,'weapon'],['Medium Shield',15,60,'shield'],['Mail Shirt',16,150,'armor'],['Backpack',3,60,'general']],
  },
  {
    id: 'builtin-wizard', name: 'Wizard', description: 'A learned arcane caster with broad magical and scholarly training.',
    attributes: { ST: 10, DX: 11, IQ: 14, HT: 10 },
    skills: [['Thaumatology','IQ','VH',4],['Occultism','IQ','A',4],['Research','IQ','A',2],['Hidden Lore','IQ','A',2],['Meditation','Will','H',2],['Staff','DX','A',2],['Teaching','IQ','A',2],['First Aid','IQ','E',2]],
    advantages: [['Magery 3',30],['Eidetic Memory',5]], disadvantages: [['Curious',-5],['Obsession (Master magic)',-15]],
    spells: [['Ignite Fire',4,'Fire'],['Fireball',4,'Fire'],['Light',4,'Light'],['Minor Healing',4,'Healing']],
    equipment: [['Quarterstaff',4,10,'weapon'],['Spellbook',3,200,'general'],['Robes',2,40,'general'],['Component pouch',1,100,'general']],
  },
  {
    id: 'builtin-rogue', name: 'Rogue', description: 'A nimble infiltrator, scout, and lock specialist.',
    attributes: { ST: 9, DX: 14, IQ: 11, HT: 10 },
    skills: [['Stealth','DX','A',8],['Lockpicking','IQ','A',8],['Traps','IQ','A',8],['Shortsword','DX','A',8],['Pickpocket','DX','H',4],['Acrobatics','DX','H',4],['Climbing','DX','A',4],['Observation','Per','A',2],['Streetwise','IQ','A',2],['Fast-Talk','IQ','A',2]],
    advantages: [['Flexibility',5],['Perfect Balance',15],['Night Vision 5',5]], disadvantages: [['Kleptomania',-15]],
    equipment: [['Shortsword',2,400,'weapon'],['Lockpicks',0.5,50,'general'],['Leather armor',10,100,'armor'],['Rope',3,10,'general']],
  },
  {
    id: 'builtin-cleric', name: 'Cleric', description: 'A resilient healer and protector backed by divine gifts.',
    attributes: { ST: 11, DX: 10, IQ: 13, HT: 11 },
    skills: [['Theology','IQ','H',4],['Religious Ritual','IQ','H',4],['First Aid','IQ','E',4],['Diagnosis','IQ','H',4],['Physician','IQ','H',4],['Meditation','Will','H',2],['Mace','DX','A',2],['Shield','DX','E',2],['Public Speaking','IQ','A',1],['Leadership','IQ','A',1]],
    advantages: [['Clerical Investment',5],['Power Investiture 3',30],['Blessed',10]], disadvantages: [['Pacifism (Cannot Harm Innocents)',-10],['Vow (Aid the needy)',-5]],
    spells: [['Minor Healing',4,'Healing'],['Major Healing',8,'Healing'],['Lend Energy',4,'Healing'],['Sense Life',4,'Knowledge']],
    equipment: [['Mace',5,50,'weapon'],['Small Shield',8,40,'shield'],['Healer kit',2,100,'general'],['Holy symbol',0.5,50,'general']],
  },
  {
    id: 'builtin-ranger', name: 'Ranger', description: 'A wilderness scout, hunter, and precise archer.',
    attributes: { ST: 11, DX: 13, IQ: 11, HT: 11 },
    skills: [['Bow','DX','A',12],['Survival','Per','A',8],['Tracking','Per','A',8],['Stealth','DX','A',4],['Naturalist','IQ','H',4],['Animal Handling','IQ','A',2],['Camouflage','IQ','E',2],['Knife','DX','E',2],['Hiking','HT','A',2],['First Aid','IQ','E',1]],
    advantages: [['Combat Reflexes',15],['Absolute Direction',5]], disadvantages: [['Sense of Duty (Nature)',-10],['Loner',-5]],
    equipment: [['Longbow',3,200,'weapon'],['Hunting knife',1,40,'weapon'],['Leather armor',10,100,'armor'],['Wilderness pack',6,80,'general']],
  },
  {
    id: 'builtin-bard', name: 'Bard', description: 'A charismatic performer, negotiator, and versatile adventurer.',
    attributes: { ST: 10, DX: 12, IQ: 13, HT: 10 },
    skills: [['Musical Instrument','IQ','H',8],['Public Speaking','IQ','A',8],['Diplomacy','IQ','H',4],['Fast-Talk','IQ','A',4],['Singing','HT','E',4],['Acting','IQ','A',4],['Savoir-Faire','IQ','E',2],['Streetwise','IQ','A',2],['Rapier','DX','A',2],['Carousing','HT','E',2]],
    advantages: [['Charisma 2',10],['Voice',10],['Bardic Talent 2',10]], disadvantages: [['Compulsive Carousing',-5],['Sense of Duty (Companions)',-10],['Curious',-5]],
    equipment: [['Rapier',2.75,500,'weapon'],['Lute',3,150,'general'],['Fine clothes',2,120,'general'],['Travel pack',5,60,'general']],
  },
];

export const CHARACTER_TEMPLATE_SEEDS: CharacterTemplateEntity[] = BUILDS.map(buildTemplate);
