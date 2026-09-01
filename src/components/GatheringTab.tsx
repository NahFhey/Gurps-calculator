import React, { useState, useMemo, memo } from 'react';
import { Fish, Users, Target, Package, CheckCircle, XCircle } from 'lucide-react';
import { DiceRoller } from './DiceRoller';
import {
  GATHERING_MODES,
  FISHING_METHODS,
  DEFAULT_FISH_ST,
  FORAGING_SKILLS,
  FORAGING_RARITIES
} from '../constants';
import {
  evaluateFishingRoll,
  calculateEffectiveFishingSkill,
  determineDynamicEventType,
  rollOnCatchTable,
  rollNetCatch,
  generateGroupKey,
  hasDailyEventBeenRolled,
  filterToolsForMethod,
  createGatheringSession,
  parseDiceFormula,
  roll3d6,
  calculateEffectiveForagingSkill,
  evaluateForagingRoll,
  determineForageFind
} from '../utils/gathering';
import type {
  ForageFind,
  GatheringSession,
  TableEntry as RolledTableEntry,
} from '../utils/gathering';

// ============================================================================
// Types
// ============================================================================

export interface GatheringSpecies {
  id: string;
  name: string;
  type?: string;
  tags?: string[];
  st?: number;
  yieldMeatFormula?: string;
  yieldSecondaryFormula?: string;
  secondaryMaterialType?: string;
  secondaryNameOverride?: string;
}

export interface GatheringTool {
  id: string;
  name: string;
  allowedModes?: string[];
  bonuses?: Array<{ type: string; skill?: string; value?: number }>;
}

export interface GatheringTable {
  id: string;
  name: string;
  entries: Array<{
    id: string;
    rollValue: number;
    resultType: 'species' | 'item' | 'nothing' | 'event' | 'special' | 'category';
    speciesId: string | null;
    itemId?: string | null;
    categoryId?: string | null;
    text: string;
  }>;
  rollMethod: '1d6' | '2d6' | '3d6';
}

export interface GatheringEnvironment {
  id: string;
  name: string;
  supportedModes?: string[];
  mode?: string;
  skillMod?: number;
  defaultsByMode?: Record<string, {
    randomCatchTableId?: string;
    mildEventTableId?: string;
    rareEventTableId?: string;
  }>;
  defaultTables?: {
    randomCatchTableId?: string;
    mildEventTableId?: string;
    rareEventTableId?: string;
  };
}

export interface GatheringBait {
  id: string;
  name: string;
  quantity?: number;
  attractsSpeciesIds?: string[];
  rollBonus?: number;
}

export interface GatheringCategory {
  id: string;
  name: string;
  description?: string;
  yieldFormula?: string;
  inventoryOutput?: {
    inventoryKind?: 'food' | 'material';
    typeId?: string;
  };
}

export interface GatheringItem {
  id: string;
  name: string;
  categoryId?: string;
  rarity?: string;
  description?: string;
  yieldFormula?: string;
}

export interface Worker {
  id: string;
  name: string;
  skills?: Record<string, number>;
  st?: number;
}

export interface FoodItem {
  id: string;
  name: string;
  types?: string[];
  quantity?: number;
  source?: string;
}

export interface MaterialItem {
  id: string;
  name: string;
  type?: string;
  quantity?: number;
  source?: string;
}

export interface FoodType {
  name: string;
  color?: string;
}

export interface MaterialType {
  name: string;
  [key: string]: unknown;
}

export interface DiceRoll {
  dice: number[];
  total: number;
}

export interface EventResult {
  rolled: boolean;
  roll: number;
  resultType: 'rare' | 'mild' | 'none';
  eventEntryId?: string;
  eventText?: string | null;
}

export interface FishingResult {
  success: boolean;
  critSuccess?: boolean;
  critFailure?: boolean;
  fish: number;
  margin: number;
  description: string;
}

export interface ForagingResult {
  success: boolean;
  critSuccess?: boolean;
  critFailure?: boolean;
  margin: number;
  description: string;
  yieldMultiplier: number;
  hazard?: string;
}

export interface CaughtFish {
  index: number;
  entry: unknown;
  species: GatheringSpecies | null;
  isLarge: boolean;
  struggled: boolean;
  struggleSuccess: boolean | null;
  struggleDetails?: {
    charRoll: number;
    charMargin: number;
    fishRoll: number;
    fishMargin: number;
  };
  yields: FishYields | null;
  baitRollBonus?: number;
}

export interface FishYields {
  meatUnits?: number;
  meatDice?: number[];
  secondaryUnits?: number;
  secondaryDice?: number[];
  secondaryType?: string;
  foodType?: string;
}

export interface ForageYields {
  units: number;
  dice?: number[];
  baseFormula?: string;
  modifiedFormula?: string;
  rawTotal?: number;
  multiplier?: number;
}

export interface YieldResult {
  fishIndex?: number;
  species?: GatheringSpecies;
  category?: GatheringCategory;
  item?: GatheringItem;
  yields: FishYields | ForageYields;
}

export interface EffectiveSkillResult {
  effectiveSkill: number;
  breakdown: {
    base?: number;
    tool?: number;
    bait?: number;
    largeFish?: number;
    environment?: number;
    context?: number;
    rarity?: number;
  };
}

export interface GatheringTabProps {
  species: GatheringSpecies[];
  tools: GatheringTool[];
  tables: GatheringTable[];
  environments: GatheringEnvironment[];
  sessions: GatheringSession[];
  dailyEvents: Record<number, Record<string, EventResult>>;
  bait: GatheringBait[];
  categories: GatheringCategory[];
  items: GatheringItem[];
  workers: Worker[];
  foods: FoodItem[];
  materials: MaterialItem[];
  foodTypes: FoodType[];
  materialTypes: MaterialType[];
  currentDay: number;
  saveSessions: (sessions: GatheringSession[]) => void;
  saveDailyEvents: (events: Record<number, Record<string, EventResult>>) => void;
  saveFoods: (foods: FoodItem[]) => void;
  saveMaterials: (materials: MaterialItem[]) => void;
}

type SessionPhase = 'setup' | 'event' | 'fishing' | 'catch' | 'yield' | 'complete';

// ============================================================================
// Component
// ============================================================================

/**
 * GatheringTab Component - Manages gathering activities like Fishing
 * Memoized to prevent re-renders from unrelated tab changes
 */
function GatheringTabBase({
  species,
  tools,
  tables,
  environments,
  sessions,
  dailyEvents,
  bait,
  categories,
  items,
  workers,
  foods,
  materials,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  foodTypes: _foodTypes,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  materialTypes: _materialTypes,
  currentDay,
  saveSessions,
  saveDailyEvents,
  saveFoods,
  saveMaterials
}: GatheringTabProps): React.ReactElement {
  // Mode and environment selection
  const [selectedMode, setSelectedMode] = useState('Fishing');
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('Line');

  // Party selection
  const [leaderId, setLeaderId] = useState(workers[0]?.id || '');
  const [helperIds, setHelperIds] = useState<string[]>([]);

  // Intent
  const [targetedSpeciesId, setTargetedSpeciesId] = useState('');
  const [isRandomCatch, setIsRandomCatch] = useState(true);

  // Equipment
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>([]);
  const [selectedBaitId, setSelectedBaitId] = useState('');

  // Session state
  const [activeSession, setActiveSession] = useState<GatheringSession | null>(null);
  const [sessionPhase, setSessionPhase] = useState<SessionPhase>('setup');

  // Roll inputs
  const [eventRoll, setEventRoll] = useState<DiceRoll>({ dice: [], total: 0 });
  const [fishingRoll, setFishingRoll] = useState<DiceRoll>({ dice: [], total: 0 });
  const [_catchRolls, setCatchRolls] = useState<string[]>([]);
  const [struggleRoll, setStruggleRoll] = useState('');
  const [yieldResults, setYieldResults] = useState<YieldResult[]>([]);

  // Results
  const [eventResult, setEventResult] = useState<EventResult | null>(null);
  const [fishingResult, setFishingResult] = useState<FishingResult | null>(null);
  const [caughtFish, setCaughtFish] = useState<CaughtFish[]>([]);
  const [retryCount, setRetryCount] = useState(0);

  // Foraging-specific state
  const [selectedSkill, setSelectedSkill] = useState('Survival');
  const [isRandomForage, setIsRandomForage] = useState(true);
  const [targetCategoryId, setTargetCategoryId] = useState('');
  const [targetItemId, setTargetItemId] = useState('');
  const [targetRarity, setTargetRarity] = useState('Common');
  const [hasMapGuide, setHasMapGuide] = useState(false);
  const [isUnfamiliar, setIsUnfamiliar] = useState(false);
  const [isPeakSeason, setIsPeakSeason] = useState(false);
  const [isDenseTerrain, setIsDenseTerrain] = useState(false);
  const [isStormDamaged, setIsStormDamaged] = useState(false);
  const [forageRoll, setForageRoll] = useState<DiceRoll>({ dice: [], total: 0 });
  const [forageResult, setForageResult] = useState<ForagingResult | null>(null);
  const [forageFind, setForageFind] = useState<ForageFind | null>(null);

  // Get filtered environments for selected mode
  const availableEnvironments = useMemo(() => {
    return environments.filter(env =>
      env.supportedModes?.includes(selectedMode) || env.mode === selectedMode
    );
  }, [environments, selectedMode]);

  // Get selected environment
  const selectedEnvironment = useMemo(() => {
    return environments.find(e => e.id === selectedEnvironmentId);
  }, [environments, selectedEnvironmentId]);

  // Get tables for selected environment
  const resolvedTables = useMemo(() => {
    if (!selectedEnvironment) return { randomCatch: null, mildEvent: null, rareEvent: null };

    const defaults = selectedEnvironment.defaultsByMode?.[selectedMode] || selectedEnvironment.defaultTables || {};

    return {
      randomCatch: tables.find(t => t.id === defaults.randomCatchTableId) || null,
      mildEvent: tables.find(t => t.id === defaults.mildEventTableId) || null,
      rareEvent: tables.find(t => t.id === defaults.rareEventTableId) || null
    };
  }, [selectedEnvironment, selectedMode, tables]);

  // Get filtered tools for selected method/mode
  const availableTools = useMemo(() => {
    if (selectedMode === 'Foraging') {
      return tools.filter(tool => tool.allowedModes?.includes('Foraging'));
    }
    return filterToolsForMethod(tools, selectedMode, selectedMethod) as GatheringTool[];
  }, [tools, selectedMode, selectedMethod]);

  // Get leader worker
  const leader = useMemo(() => {
    return workers.find(w => w.id === leaderId);
  }, [workers, leaderId]);

  // Get targeted species
  const targetedSpecies = useMemo(() => {
    return species.find(s => s.id === targetedSpeciesId);
  }, [species, targetedSpeciesId]);

  // Calculate tool bonus
  const toolBonus = useMemo(() => {
    return selectedToolIds.reduce((sum, toolId) => {
      const tool = tools.find(t => t.id === toolId);
      if (!tool) return sum;
      const skillBonus = tool.bonuses?.find(b => b.type === 'skill_bonus' && b.skill === 'Fishing');
      return sum + (skillBonus?.value || 0);
    }, 0);
  }, [selectedToolIds, tools]);

  // Check if bait is correct for target
  const selectedBaitItem = useMemo(() => {
    return bait.find(b => b.id === selectedBaitId);
  }, [bait, selectedBaitId]);

  const baitStatus = useMemo(() => {
    if (!selectedBaitItem || !targetedSpecies) return { correct: false, inappropriate: false };

    const attractsTarget = selectedBaitItem.attractsSpeciesIds?.includes(targetedSpeciesId);
    return {
      correct: !!attractsTarget,
      inappropriate: !attractsTarget && !!targetedSpeciesId
    };
  }, [selectedBaitItem, targetedSpecies, targetedSpeciesId]);

  // Generate group key for daily event tracking
  const groupKey = useMemo(() => {
    return generateGroupKey(leaderId, helperIds) as string;
  }, [leaderId, helperIds]);

  // Check if daily event already rolled
  const dailyEventRolled = useMemo(() => {
    return hasDailyEventBeenRolled(dailyEvents, currentDay, groupKey) as boolean;
  }, [dailyEvents, currentDay, groupKey]);

  // Calculate effective fishing skill
  const effectiveSkill = useMemo((): EffectiveSkillResult => {
    if (!leader) return { effectiveSkill: 10, breakdown: {} };

    const isLargeFish = targetedSpecies?.tags?.includes('LargeFish');

    return calculateEffectiveFishingSkill({
      baseFishingSkill: leader.skills?.fishing || 10,
      toolBonus,
      hasCorrectBait: baitStatus.correct,
      hasInappropriateBait: baitStatus.inappropriate,
      targetingLargeFish: isLargeFish && !isRandomCatch,
      retryPenalty: -retryCount,
      environmentMod: selectedEnvironment?.skillMod || 0
    }) as EffectiveSkillResult;
  }, [leader, toolBonus, baitStatus, targetedSpecies, isRandomCatch, retryCount, selectedEnvironment]);

  // Calculate effective foraging skill
  const effectiveForagingSkill = useMemo((): EffectiveSkillResult => {
    if (!leader || selectedMode !== 'Foraging') return { effectiveSkill: 10, breakdown: {} };

    const baseSkill = leader.skills?.[selectedSkill.toLowerCase()] || 10;

    return calculateEffectiveForagingSkill({
      baseForagingSkill: baseSkill,
      toolBonus,
      hasMapGuide,
      isUnfamiliar,
      isPeakSeason,
      targetRarity: !isRandomForage ? targetRarity : null,
      environmentMod: selectedEnvironment?.skillMod || 0
    }) as EffectiveSkillResult;
  }, [leader, selectedSkill, toolBonus, hasMapGuide, isUnfamiliar, isPeakSeason, targetRarity, isRandomForage, selectedEnvironment, selectedMode]);

  // Start a new gathering session
  function startSession(): void {
    if (!selectedEnvironmentId || !leaderId) {
      alert('Please select an environment and leader');
      return;
    }

    const session = createGatheringSession({
      mode: selectedMode,
      environmentId: selectedEnvironmentId,
      method: selectedMethod,
      leaderCharacterId: leaderId,
      helperCharacterIds: helperIds,
      intent: {
        targetedSpeciesId: !isRandomCatch ? targetedSpeciesId : null,
        randomCatch: isRandomCatch
      },
      selectedToolIds,
      selectedConsumableIds: selectedBaitId ? [selectedBaitId] : [],
      currentDay
    });

    session.tablesResolved = {
      randomCatchTableId: resolvedTables.randomCatch?.id,
      mildEventTableId: resolvedTables.mildEvent?.id,
      rareEventTableId: resolvedTables.rareEvent?.id
    };

    session.modifiers = effectiveSkill;

    setActiveSession(session);
    setSessionPhase(dailyEventRolled ? 'fishing' : 'event');
    setFishingResult(null);
    setCaughtFish([]);
    setYieldResults([]);
    setRetryCount(0);
  }

  // Roll for daily event
  function rollDailyEvent(): void {
    if (!eventRoll.total) {
      alert('Please enter or roll 3d6 for the daily event check');
      return;
    }

    const roll = eventRoll.total;
    const eventType = determineDynamicEventType(roll) as 'rare' | 'mild' | 'none';

    let eventEntry: RolledTableEntry | null = null;
    let eventText: string | null = null;

    if (eventType === 'rare' && resolvedTables.rareEvent) {
      eventEntry = rollOnCatchTable(resolvedTables.rareEvent);
      eventText = eventEntry?.text || 'Rare event occurred!';
    } else if (eventType === 'mild' && resolvedTables.mildEvent) {
      eventEntry = rollOnCatchTable(resolvedTables.mildEvent);
      eventText = eventEntry?.text || 'Mild event occurred!';
    }

    const result: EventResult = {
      rolled: true,
      roll,
      resultType: eventType,
      eventEntryId: eventEntry?.id,
      eventText
    };

    setEventResult(result);

    // Save daily event to prevent re-rolling
    const updatedDailyEvents = {
      ...dailyEvents,
      [currentDay]: {
        ...(dailyEvents[currentDay] || {}),
        [groupKey]: result
      }
    };
    saveDailyEvents(updatedDailyEvents);

    // Update session
    setActiveSession(prev => prev ? { ...prev, dailyEvent: result } : null);
    setSessionPhase('fishing');
  }

  // Roll for fishing
  function rollFishing(): void {
    if (!fishingRoll.total) {
      alert('Please enter or roll 3d6 for the fishing check');
      return;
    }

    const roll = fishingRoll.total;
    const result = evaluateFishingRoll(roll, effectiveSkill.effectiveSkill, selectedMethod) as FishingResult;

    setFishingResult(result);

    if (result.success && result.fish > 0) {
      setCatchRolls(new Array(result.fish).fill(''));
      setSessionPhase('catch');
    } else if (!result.success && !result.critFailure && retryCount < 3) {
      setRetryCount(prev => prev + 1);
      setFishingRoll({ dice: [], total: 0 });
    } else {
      setSessionPhase('complete');
    }
  }

  // Roll for foraging
  function rollForaging(): void {
    if (!forageRoll.total) {
      alert('Please enter or roll 3d6 for the foraging check');
      return;
    }

    const roll = forageRoll.total;
    const result = evaluateForagingRoll(roll, effectiveForagingSkill.effectiveSkill, !isRandomForage) as ForagingResult;

    setForageResult(result);

    const targetCategory = targetCategoryId ? categories.find(c => c.id === targetCategoryId) : null;
    const targetItem = targetItemId ? items.find(i => i.id === targetItemId) : null;

    const findResult = determineForageFind({
      rollResult: result,
      findTable: resolvedTables.randomCatch,
      _targetCategory: targetCategory?.id || undefined,
      targetItem
    });

    setForageFind(findResult);
    setSessionPhase('yield');
  }

  // Roll for random catch
  function rollCatch(index: number): void {
    if (!resolvedTables.randomCatch) {
      alert('No catch table configured for this environment');
      return;
    }

    const baitRollBonus = (selectedMethod === 'Line' && isRandomCatch && selectedBaitItem)
      ? (selectedBaitItem.rollBonus || 0)
      : 0;

    let entry: RolledTableEntry;
    try {
      if (selectedMethod === 'Net') {
        entry = rollNetCatch(resolvedTables.randomCatch, species);
      } else {
        entry = rollOnCatchTable(resolvedTables.randomCatch, baitRollBonus);
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unknown error');
      return;
    }

    const caughtSpecies = entry.resultType === 'species'
      ? species.find(s => s.id === entry.speciesId) || null
      : null;

    const newCatch: CaughtFish = {
      index,
      entry,
      species: caughtSpecies,
      isLarge: caughtSpecies?.tags?.includes('LargeFish') || false,
      struggled: false,
      struggleSuccess: null,
      yields: null,
      baitRollBonus
    };

    setCaughtFish(prev => [...prev, newCatch]);
  }

  // Roll for large fish struggle
  function rollStruggle(fishIndex: number): void {
    if (!struggleRoll) {
      alert('Please enter your struggle roll');
      return;
    }

    const fish = caughtFish[fishIndex];
    if (!fish || !fish.isLarge) return;

    const characterST = leader?.st || 10;
    const fishST = fish.species?.st || DEFAULT_FISH_ST;

    const charRoll = parseInt(struggleRoll);
    const fishRollResult = roll3d6() as { total: number };

    const charMargin = characterST - charRoll;
    const fishMargin = fishST - fishRollResult.total;

    const success = charMargin > fishMargin ||
      (charMargin === fishMargin && characterST >= fishST);

    setCaughtFish(prev => prev.map((f, i) =>
      i === fishIndex
        ? { ...f, struggled: true, struggleSuccess: success, struggleDetails: { charRoll, charMargin, fishRoll: fishRollResult.total, fishMargin } }
        : f
    ));

    setStruggleRoll('');
  }

  // Proceed to yield phase
  function proceedToYields(): void {
    const unresolvedLarge = caughtFish.filter(f => f.isLarge && !f.struggled);
    if (unresolvedLarge.length > 0) {
      alert('Please resolve all large fish struggles first');
      return;
    }
    setSessionPhase('yield');
  }

  // Commit results to inventory
  function commitToInventory(): void {
    const foodItems: Record<string, { speciesName: string; foodType: string; units: number }> = {};
    const materialItems: Record<string, { name: string; type: string; units: number }> = {};

    if (selectedMode === 'Fishing') {
      yieldResults.forEach(({ species: sp, yields }) => {
        if (!yields || !sp) return;
        const fishYields = yields as FishYields;

        const foodType = fishYields.foodType || 'fish';
        const foodKey = `${sp.name}|${foodType}`;
        if (!foodItems[foodKey]) {
          foodItems[foodKey] = { speciesName: sp.name, foodType, units: 0 };
        }
        foodItems[foodKey].units += fishYields.meatUnits || 0;

        if (fishYields.secondaryType && (fishYields.secondaryUnits || 0) > 0) {
          const materialName = sp.secondaryNameOverride || `${sp.name} ${fishYields.secondaryType}`;
          if (!materialItems[materialName]) {
            materialItems[materialName] = { name: materialName, type: fishYields.secondaryType, units: 0 };
          }
          materialItems[materialName].units += fishYields.secondaryUnits || 0;
        }
      });
    } else if (selectedMode === 'Foraging') {
      yieldResults.forEach(({ category, item, yields }) => {
        const forageYields = yields as ForageYields;
        if (!forageYields || forageYields.units === 0) return;

        const cat = category || categories.find(c => c.id === item?.categoryId);
        if (!cat) return;

        const inventoryKind = cat.inventoryOutput?.inventoryKind || 'food';
        const typeId = cat.inventoryOutput?.typeId || cat.name.toLowerCase().replace(/\s+/g, '_');

        const itemName = item?.name || cat.name;

        if (inventoryKind === 'food') {
          const foodKey = `${itemName}|${typeId}`;
          if (!foodItems[foodKey]) {
            foodItems[foodKey] = { speciesName: itemName, foodType: typeId, units: 0 };
          }
          foodItems[foodKey].units += forageYields.units;
        } else {
          if (!materialItems[itemName]) {
            materialItems[itemName] = { name: itemName, type: typeId, units: 0 };
          }
          materialItems[itemName].units += forageYields.units;
        }
      });
    }

    const updatedFoods = [...foods];
    Object.values(foodItems).forEach(({ speciesName, foodType, units }) => {
      const itemName = `${speciesName} ${foodType.charAt(0).toUpperCase() + foodType.slice(1)}`;
      const existing = updatedFoods.find(f => f.name === itemName);

      if (existing) {
        existing.quantity = (existing.quantity || 0) + units;
      } else {
        updatedFoods.push({
          id: crypto.randomUUID(),
          name: itemName,
          types: [foodType],
          quantity: units,
          source: 'gathering'
        });
      }
    });
    saveFoods(updatedFoods);

    const updatedMaterials = [...materials];
    Object.values(materialItems).forEach(({ name, type, units }) => {
      const existing = updatedMaterials.find(m => m.name === name);

      if (existing) {
        existing.quantity = (existing.quantity || 0) + units;
      } else {
        updatedMaterials.push({
          id: crypto.randomUUID(),
          name: name,
          type: type,
          quantity: units,
          source: 'gathering'
        });
      }
    });
    saveMaterials(updatedMaterials);

    const foodTotals: Record<string, number> = {};
    const materialTotals: Record<string, number> = {};
    Object.values(foodItems).forEach(({ foodType, units }) => {
      foodTotals[foodType] = (foodTotals[foodType] || 0) + units;
    });
    Object.values(materialItems).forEach(({ type, units }) => {
      materialTotals[type] = (materialTotals[type] || 0) + units;
    });

    const completedSession: GatheringSession = {
      ...activeSession!,
      resolution: {
        fishingRoll: fishingResult || undefined,
        fishCaught: caughtFish,
        yields: yieldResults,
        inventoryDelta: { foods: foodTotals, materials: materialTotals }
      },
      committedToInventory: true,
      completedAt: new Date().toISOString()
    };

    saveSessions([...sessions, completedSession]);
    setSessionPhase('complete');
  }

  // Reset session
  function resetSession(): void {
    setActiveSession(null);
    setSessionPhase('setup');
    setEventRoll({ dice: [], total: 0 });
    setFishingRoll({ dice: [], total: 0 });
    setForageRoll({ dice: [], total: 0 });
    setCatchRolls([]);
    setStruggleRoll('');
    setEventResult(null);
    setFishingResult(null);
    setForageResult(null);
    setForageFind(null);
    setCaughtFish([]);
    setYieldResults([]);
    setRetryCount(0);
  }

  return (
    <div className="space-y-6">
      <div className="bg-surface-1 p-4 rounded-lg">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <Fish size={28} /> General Gathering
        </h2>

        {/* Setup Panel */}
        {sessionPhase === 'setup' && (
          <div className="space-y-4">
            {/* Mode Selection */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-fg-muted mb-2">Gathering Mode</label>
                <select
                  value={selectedMode}
                  onChange={(e) => {
                    setSelectedMode(e.target.value);
                    setSelectedEnvironmentId('');
                  }}
                  className="w-full bg-surface-2 px-3 py-2 rounded"
                >
                  {GATHERING_MODES.map(mode => (
                    <option key={mode} value={mode}>{mode}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-fg-muted mb-2">Environment</label>
                <select
                  value={selectedEnvironmentId}
                  onChange={(e) => setSelectedEnvironmentId(e.target.value)}
                  className="w-full bg-surface-2 px-3 py-2 rounded"
                >
                  <option value="">-- Select Environment --</option>
                  {availableEnvironments.map(env => (
                    <option key={env.id} value={env.id}>{env.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Method Selection (Fishing) */}
            {selectedMode === 'Fishing' && (
              <div>
                <label className="block text-sm text-fg-muted mb-2">Fishing Method</label>
                <div className="flex gap-4">
                  {Object.entries(FISHING_METHODS).map(([key, method]) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="method"
                        value={key}
                        checked={selectedMethod === key}
                        onChange={(e) => {
                          setSelectedMethod(e.target.value);
                          setSelectedToolIds([]);
                          if (!(method as { canTarget?: boolean }).canTarget) {
                            setIsRandomCatch(true);
                            setTargetedSpeciesId('');
                          }
                        }}
                        className="w-4 h-4"
                      />
                      <span>{(method as { label: string }).label}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-fg-faint mt-1">
                  {(FISHING_METHODS[selectedMethod as keyof typeof FISHING_METHODS] as { description?: string })?.description}
                </p>
              </div>
            )}

            {/* Skill Selection (Foraging) */}
            {selectedMode === 'Foraging' && (
              <div>
                <label className="block text-sm text-fg-muted mb-2">Foraging Skill</label>
                <div className="flex gap-4">
                  {Object.entries(FORAGING_SKILLS).map(([key, skill]) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="skill"
                        value={key}
                        checked={selectedSkill === key}
                        onChange={(e) => setSelectedSkill(e.target.value)}
                        className="w-4 h-4"
                      />
                      <span>{(skill as { label: string; attribute: string }).label} ({(skill as { label: string; attribute: string }).attribute})</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-fg-faint mt-1">
                  Choose the skill to use for foraging
                </p>
              </div>
            )}

            {/* Party Selection */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-fg-muted mb-2">
                  <Users size={16} className="inline mr-1" /> Leader
                </label>
                <select
                  value={leaderId}
                  onChange={(e) => setLeaderId(e.target.value)}
                  className="w-full bg-surface-2 px-3 py-2 rounded"
                >
                  {workers.map(w => (
                    <option key={w.id} value={w.id}>
                      {w.name} (Fishing: {w.skills?.fishing || 10})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-fg-muted mb-2">Helpers</label>
                <select
                  multiple
                  value={helperIds}
                  onChange={(e) => setHelperIds(Array.from(e.target.selectedOptions, opt => opt.value))}
                  className="w-full bg-surface-2 px-3 py-2 rounded h-20"
                >
                  {workers.filter(w => w.id !== leaderId).map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Intent (Fishing) */}
            {selectedMode === 'Fishing' && (FISHING_METHODS[selectedMethod as keyof typeof FISHING_METHODS] as { canTarget?: boolean })?.canTarget && (
              <div className="bg-surface-2 p-3 rounded">
                <label className="block text-sm text-fg-muted mb-2">
                  <Target size={16} className="inline mr-1" /> Fishing Intent
                </label>
                <div className="flex gap-4 mb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={isRandomCatch}
                      onChange={() => {
                        setIsRandomCatch(true);
                        setTargetedSpeciesId('');
                      }}
                      className="w-4 h-4"
                    />
                    <span>Random Catch</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={!isRandomCatch}
                      onChange={() => setIsRandomCatch(false)}
                      className="w-4 h-4"
                    />
                    <span>Target Specific Species</span>
                  </label>
                </div>

                {!isRandomCatch && (
                  <select
                    value={targetedSpeciesId}
                    onChange={(e) => setTargetedSpeciesId(e.target.value)}
                    className="w-full bg-surface-3 px-3 py-2 rounded"
                  >
                    <option value="">-- Select Target --</option>
                    {species.filter(s => s.type === 'fish').map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.tags?.includes('LargeFish') ? '(Large - penalty)' : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Intent (Foraging) */}
            {selectedMode === 'Foraging' && (
              <div className="bg-surface-2 p-3 rounded">
                <label className="block text-sm text-fg-muted mb-2">
                  <Target size={16} className="inline mr-1" /> Foraging Intent
                </label>
                <div className="flex gap-4 mb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={isRandomForage}
                      onChange={() => {
                        setIsRandomForage(true);
                        setTargetCategoryId('');
                        setTargetItemId('');
                      }}
                      className="w-4 h-4"
                    />
                    <span>Random Forage</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={!isRandomForage}
                      onChange={() => setIsRandomForage(false)}
                      className="w-4 h-4"
                    />
                    <span>Targeted Search</span>
                  </label>
                </div>

                {!isRandomForage && (
                  <div className="space-y-2">
                    <select
                      value={targetCategoryId}
                      onChange={(e) => {
                        setTargetCategoryId(e.target.value);
                        setTargetItemId('');
                      }}
                      className="w-full bg-surface-3 px-3 py-2 rounded"
                    >
                      <option value="">-- Select Category --</option>
                      {categories?.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>

                    {targetCategoryId && items?.filter(i => i.categoryId === targetCategoryId).length > 0 && (
                      <select
                        value={targetItemId}
                        onChange={(e) => setTargetItemId(e.target.value)}
                        className="w-full bg-surface-3 px-3 py-2 rounded"
                      >
                        <option value="">-- Or Select Specific Item --</option>
                        {items?.filter(i => i.categoryId === targetCategoryId).map(i => (
                          <option key={i.id} value={i.id}>
                            {i.name} ({i.rarity})
                          </option>
                        ))}
                      </select>
                    )}

                    {(targetCategoryId || targetItemId) && (
                      <select
                        value={targetRarity}
                        onChange={(e) => setTargetRarity(e.target.value)}
                        className="w-full bg-surface-3 px-3 py-2 rounded"
                      >
                        {Object.entries(FORAGING_RARITIES).map(([key, rarity]) => (
                          <option key={key} value={key}>
                            {(rarity as { label: string; penalty: number }).label} ({(rarity as { label: string; penalty: number }).penalty >= 0 ? '+' : ''}{(rarity as { label: string; penalty: number }).penalty})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Context Modifiers (Foraging) */}
            {selectedMode === 'Foraging' && (
              <div className="bg-surface-2 p-3 rounded">
                <label className="block text-sm text-fg-muted mb-2">Context Modifiers</label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasMapGuide}
                      onChange={(e) => setHasMapGuide(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Map/Local Guide (+1)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isUnfamiliar}
                      onChange={(e) => setIsUnfamiliar(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Unfamiliar/Hostile (-2)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isPeakSeason}
                      onChange={(e) => setIsPeakSeason(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Peak Season (+2)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isDenseTerrain}
                      onChange={(e) => setIsDenseTerrain(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Dense/Dangerous Terrain</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isStormDamaged}
                      onChange={(e) => setIsStormDamaged(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Storm Damaged (-1d yield)</span>
                  </label>
                </div>
              </div>
            )}

            {/* Equipment Selection */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-fg-muted mb-2">Tools</label>
                <select
                  multiple
                  value={selectedToolIds}
                  onChange={(e) => setSelectedToolIds(Array.from(e.target.selectedOptions, opt => opt.value))}
                  className="w-full bg-surface-2 px-3 py-2 rounded h-24"
                >
                  {availableTools.map(tool => (
                    <option key={tool.id} value={tool.id}>
                      {tool.name} {tool.bonuses?.find(b => b.type === 'skill_bonus')?.value && tool.bonuses.find(b => b.type === 'skill_bonus')!.value! > 0 ? `(+${tool.bonuses.find(b => b.type === 'skill_bonus')!.value})` : ''}
                    </option>
                  ))}
                </select>
                {availableTools.length === 0 && (
                  <p className="text-xs text-yellow-400 mt-1">No tools configured for this {selectedMode === 'Fishing' ? 'method' : 'mode'}</p>
                )}
              </div>

              {selectedMode === 'Fishing' && (
                <div>
                  <label className="block text-sm text-fg-muted mb-2">Bait</label>
                  <select
                    value={selectedBaitId}
                    onChange={(e) => setSelectedBaitId(e.target.value)}
                    className="w-full bg-surface-2 px-3 py-2 rounded"
                  >
                    <option value="">-- No Bait --</option>
                    {bait.filter(b => (b.quantity || 0) > 0).map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.quantity || 0} available)
                      </option>
                    ))}
                  </select>
                  {baitStatus.correct && (
                    <p className="text-xs text-success-400 mt-1">✓ Correct bait for target (+1)</p>
                  )}
                  {baitStatus.inappropriate && (
                    <p className="text-xs text-danger-400 mt-1">✗ Wrong bait for target (-2)</p>
                  )}
                </div>
              )}
            </div>

            {/* Skill Summary */}
            <div className="bg-surface-2 p-3 rounded">
              {selectedMode === 'Fishing' && (
                <>
                  <h4 className="font-semibold mb-2">Effective Skill: {effectiveSkill.effectiveSkill}</h4>
                  <div className="text-sm text-fg-muted grid grid-cols-3 gap-2">
                    <span>Base: {effectiveSkill.breakdown.base}</span>
                    <span>Tool: {(effectiveSkill.breakdown.tool || 0) >= 0 ? '+' : ''}{effectiveSkill.breakdown.tool}</span>
                    <span>Bait: {(effectiveSkill.breakdown.bait || 0) >= 0 ? '+' : ''}{effectiveSkill.breakdown.bait}</span>
                    {effectiveSkill.breakdown.largeFish !== 0 && (
                      <span>Large Fish: {effectiveSkill.breakdown.largeFish}</span>
                    )}
                    {effectiveSkill.breakdown.environment !== 0 && (
                      <span>Environment: {(effectiveSkill.breakdown.environment || 0) >= 0 ? '+' : ''}{effectiveSkill.breakdown.environment}</span>
                    )}
                  </div>
                </>
              )}
              {selectedMode === 'Foraging' && (
                <>
                  <h4 className="font-semibold mb-2">Effective Skill: {effectiveForagingSkill.effectiveSkill} ({selectedSkill})</h4>
                  <div className="text-sm text-fg-muted grid grid-cols-3 gap-2">
                    <span>Base: {effectiveForagingSkill.breakdown.base}</span>
                    <span>Tool: {(effectiveForagingSkill.breakdown.tool || 0) >= 0 ? '+' : ''}{effectiveForagingSkill.breakdown.tool}</span>
                    <span>Context: {(effectiveForagingSkill.breakdown.context || 0) >= 0 ? '+' : ''}{effectiveForagingSkill.breakdown.context}</span>
                    {effectiveForagingSkill.breakdown.rarity !== 0 && (
                      <span>Rarity: {(effectiveForagingSkill.breakdown.rarity || 0) >= 0 ? '+' : ''}{effectiveForagingSkill.breakdown.rarity}</span>
                    )}
                    {effectiveForagingSkill.breakdown.environment !== 0 && (
                      <span>Environment: {(effectiveForagingSkill.breakdown.environment || 0) >= 0 ? '+' : ''}{effectiveForagingSkill.breakdown.environment}</span>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Tables Info */}
            {selectedEnvironment && (
              <div className="bg-surface-2 p-3 rounded text-sm">
                <h4 className="font-semibold mb-2">Resolved Tables</h4>
                <div className="grid grid-cols-3 gap-2 text-fg-muted">
                  <span>Catch: {resolvedTables.randomCatch?.name || 'Not set'}</span>
                  <span>Mild: {resolvedTables.mildEvent?.name || 'Not set'}</span>
                  <span>Rare: {resolvedTables.rareEvent?.name || 'Not set'}</span>
                </div>
              </div>
            )}

            {/* Start Button */}
            <button
              onClick={startSession}
              disabled={!selectedEnvironmentId || !leaderId}
              className="w-full bg-accent-600 hover:bg-accent-700 disabled:bg-surface-3 disabled:cursor-not-allowed py-3 rounded font-semibold"
            >
              Start Gathering Session
            </button>
          </div>
        )}

        {/* Event Phase */}
        {sessionPhase === 'event' && (
          <div className="space-y-4">
            <div className="bg-yellow-900 p-4 rounded">
              <h3 className="text-lg font-semibold mb-2">Daily Dynamic Event Check</h3>
              <p className="text-sm text-fg-secondary mb-4">
                Roll 3d6 to check for daily events. This only happens once per day per group.
              </p>
              <div className="text-xs text-fg-muted mb-2">
                3-6: Rare Event | 7-10: Mild Event | 11-18: No Event
              </div>

              <div className="flex items-center gap-2 mb-4">
                <input
                  type="number"
                  value={eventRoll.total || ''}
                  onChange={(e) => setEventRoll({ dice: [], total: parseInt(e.target.value) || 0 })}
                  placeholder="3-18"
                  min="3"
                  max="18"
                  className="flex-1 bg-surface-2 px-3 py-2 rounded"
                />
                <DiceRoller
                  dice={eventRoll.dice}
                  total={eventRoll.total}
                  onRoll={(dice, total) => setEventRoll({ dice, total })}
                  onTotalChange={(total) => setEventRoll({ dice: [], total })}
                />
              </div>

              <button
                onClick={rollDailyEvent}
                disabled={!eventRoll.total}
                className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:bg-surface-3 py-2 rounded font-semibold"
              >
                Resolve Daily Event
              </button>
            </div>

            {eventResult && (
              <div className={`p-4 rounded ${
                eventResult.resultType === 'rare' ? 'bg-danger-900' :
                eventResult.resultType === 'mild' ? 'bg-orange-900' : 'bg-success-900'
              }`}>
                <h4 className="font-semibold">
                  {eventResult.resultType === 'rare' ? '⚠ Rare Event!' :
                   eventResult.resultType === 'mild' ? '⚡ Mild Event' : '✓ No Event'}
                </h4>
                {eventResult.eventText && (
                  <p className="text-sm mt-2">{eventResult.eventText}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Fishing Phase */}
        {sessionPhase === 'fishing' && selectedMode === 'Fishing' && (
          <div className="space-y-4">
            <div className="bg-accent-900 p-4 rounded">
              <h3 className="text-lg font-semibold mb-2">Fishing Roll</h3>
              <p className="text-sm text-fg-secondary mb-2">
                Target: {effectiveSkill.effectiveSkill}
                {retryCount > 0 && ` (Retry ${retryCount}/3, penalty applied)`}
              </p>

              <div className="flex items-center gap-2 mb-4">
                <input
                  type="number"
                  value={fishingRoll.total || ''}
                  onChange={(e) => setFishingRoll({ dice: [], total: parseInt(e.target.value) || 0 })}
                  placeholder="3-18"
                  min="3"
                  max="18"
                  className="flex-1 bg-surface-2 px-3 py-2 rounded"
                />
                <DiceRoller
                  dice={fishingRoll.dice}
                  total={fishingRoll.total}
                  onRoll={(dice, total) => setFishingRoll({ dice, total })}
                  onTotalChange={(total) => setFishingRoll({ dice: [], total })}
                />
              </div>

              <button
                onClick={rollFishing}
                disabled={!fishingRoll.total}
                className="w-full bg-accent-600 hover:bg-accent-700 disabled:bg-surface-3 py-2 rounded font-semibold"
              >
                Roll Fishing
              </button>
            </div>

            {fishingResult && (
              <div className={`p-4 rounded ${fishingResult.success ? 'bg-success-900' : 'bg-danger-900'}`}>
                <h4 className="font-semibold flex items-center gap-2">
                  {fishingResult.success ? <CheckCircle size={20} /> : <XCircle size={20} />}
                  {fishingResult.description}
                </h4>
                <p className="text-sm mt-1">
                  Roll: {fishingRoll.total} vs {effectiveSkill.effectiveSkill} (Margin: {fishingResult.margin})
                </p>
                {!fishingResult.success && !fishingResult.critFailure && retryCount < 3 && (
                  <p className="text-sm text-yellow-400 mt-2">
                    You can retry (attempt {retryCount + 1}/3 at -{retryCount + 1} penalty)
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Foraging Roll Phase */}
        {sessionPhase === 'fishing' && selectedMode === 'Foraging' && (
          <div className="space-y-4">
            <div className="bg-success-900 p-4 rounded">
              <h3 className="text-lg font-semibold mb-2">Foraging Roll</h3>
              <p className="text-sm text-fg-secondary mb-2">
                Target: {effectiveForagingSkill.effectiveSkill} ({selectedSkill})
              </p>

              <div className="flex items-center gap-2 mb-4">
                <input
                  type="number"
                  value={forageRoll.total || ''}
                  onChange={(e) => setForageRoll({ dice: [], total: parseInt(e.target.value) || 0 })}
                  placeholder="3-18"
                  min="3"
                  max="18"
                  className="flex-1 bg-surface-2 px-3 py-2 rounded"
                />
                <DiceRoller
                  dice={forageRoll.dice}
                  total={forageRoll.total}
                  onRoll={(dice, total) => setForageRoll({ dice, total })}
                  onTotalChange={(total) => setForageRoll({ dice: [], total })}
                />
              </div>

              <button
                onClick={rollForaging}
                disabled={!forageRoll.total}
                className="w-full bg-success-600 hover:bg-success-700 disabled:bg-surface-3 py-2 rounded font-semibold"
              >
                Roll Foraging
              </button>
            </div>

            {forageResult && (
              <div className={`p-4 rounded ${forageResult.success ? 'bg-success-900' : 'bg-danger-900'}`}>
                <h4 className="font-semibold flex items-center gap-2">
                  {forageResult.success ? <CheckCircle size={20} /> : <XCircle size={20} />}
                  {forageResult.description}
                </h4>
                <p className="text-sm mt-1">
                  Roll: {forageRoll.total} vs {effectiveForagingSkill.effectiveSkill} (Margin: {forageResult.margin})
                </p>
                {forageResult.hazard && (
                  <p className="text-sm text-orange-400 mt-2">
                    ⚠ Hazard: {forageResult.hazard}
                  </p>
                )}
                <p className="text-sm text-purple-400 mt-2">
                  Yield Multiplier: {Math.floor(forageResult.yieldMultiplier * 100)}%
                </p>
              </div>
            )}
          </div>
        )}

        {/* Catch Phase */}
        {sessionPhase === 'catch' && (
          <div className="space-y-4">
            <div className="bg-success-900 p-4 rounded">
              <h3 className="text-lg font-semibold mb-2">
                Determine Catch ({fishingResult?.fish || 0} fish)
              </h3>

              {Array.from({ length: fishingResult?.fish || 0 }, (_, i) => {
                const caught = caughtFish.find(f => f.index === i);
                return (
                  <div key={i} className="bg-surface-1 p-3 rounded mb-2">
                    <div className="flex justify-between items-center">
                      <span>Fish #{i + 1}</span>
                      {caught ? (
                        <span className="text-success-400">
                          {caught.species?.name || 'Nothing'} {caught.isLarge && '(Large!)'}
                        </span>
                      ) : (
                        <button
                          onClick={() => rollCatch(i)}
                          className="bg-success-600 hover:bg-success-700 px-3 py-1 rounded text-sm"
                        >
                          Roll Catch
                        </button>
                      )}
                    </div>

                    {/* Large Fish Struggle */}
                    {caught?.isLarge && selectedMethod === 'Line' && !caught.struggled && (
                      <div className="mt-2 p-2 bg-orange-900 rounded">
                        <p className="text-sm mb-2">Large fish! Roll ST vs Fish ST ({caught.species?.st || DEFAULT_FISH_ST})</p>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={struggleRoll}
                            onChange={(e) => setStruggleRoll(e.target.value)}
                            placeholder="Your roll"
                            className="flex-1 bg-surface-2 px-2 py-1 rounded"
                          />
                          <button
                            onClick={() => rollStruggle(caughtFish.indexOf(caught))}
                            className="bg-orange-600 px-3 py-1 rounded text-sm"
                          >
                            Struggle
                          </button>
                        </div>
                      </div>
                    )}

                    {caught?.struggled && (
                      <div className={`mt-2 text-sm ${caught.struggleSuccess ? 'text-success-400' : 'text-danger-400'}`}>
                        {caught.struggleSuccess ? '✓ You landed the fish!' : '✗ The fish escaped!'}
                      </div>
                    )}
                  </div>
                );
              })}

              {caughtFish.length === (fishingResult?.fish || 0) && (
                <button
                  onClick={proceedToYields}
                  className="w-full bg-success-600 hover:bg-success-700 py-2 rounded font-semibold mt-4"
                >
                  Calculate Yields
                </button>
              )}
            </div>
          </div>
        )}

        {/* Yield Phase - Fishing */}
        {sessionPhase === 'yield' && selectedMode === 'Fishing' && (
          <div className="space-y-4">
            <div className="bg-purple-900 p-4 rounded">
              <h3 className="text-lg font-semibold mb-2">Calculate Yields</h3>

              {caughtFish.filter(f => !f.isLarge || f.struggleSuccess).map((fish) => {
                if (!fish.species) return null;

                const meatFormula = fish.species.yieldMeatFormula || '1d';
                const meatParsed = parseDiceFormula(meatFormula) as { count?: number; sides?: number; modifier?: number };

                const hasSecondary = fish.species.yieldSecondaryFormula && fish.species.secondaryMaterialType;
                let secondaryParsed: { count?: number; sides?: number; modifier?: number } | undefined;
                if (hasSecondary) {
                  secondaryParsed = parseDiceFormula(fish.species.yieldSecondaryFormula!) as { count?: number; sides?: number; modifier?: number };
                }

                return (
                  <div key={fish.index} className="bg-surface-1 p-3 rounded mb-3 space-y-3">
                    <div className="font-medium text-accent-200">{fish.species.name}</div>

                    <div>
                      <div className="text-xs text-fg-muted mb-2">
                        Meat Yield: {meatFormula}
                      </div>
                      <DiceRoller
                        label="Meat Yield"
                        diceCount={meatParsed.count || 1}
                        diceSides={meatParsed.sides || 6}
                        modifier={meatParsed.modifier || 0}
                        dice={fish.yields?.meatDice || []}
                        total={fish.yields?.meatUnits || 0}
                        onRoll={(dice, total) => {
                          setCaughtFish(prev => prev.map((f, i) =>
                            i === fish.index ? {
                              ...f,
                              yields: {
                                ...(f.yields || {}),
                                meatUnits: total,
                                meatDice: dice
                              }
                            } : f
                          ));
                        }}
                        onTotalChange={(total) => {
                          setCaughtFish(prev => prev.map((f, i) =>
                            i === fish.index ? {
                              ...f,
                              yields: {
                                ...(f.yields || {}),
                                meatUnits: total,
                                meatDice: []
                              }
                            } : f
                          ));
                        }}
                      />
                    </div>

                    {hasSecondary && secondaryParsed && (
                      <div>
                        <div className="text-xs text-fg-muted mb-2">
                          {fish.species.secondaryMaterialType}: {fish.species.yieldSecondaryFormula}
                        </div>
                        <DiceRoller
                          label={fish.species.secondaryMaterialType || 'Secondary'}
                          diceCount={secondaryParsed.count || 1}
                          diceSides={secondaryParsed.sides || 6}
                          modifier={secondaryParsed.modifier || 0}
                          dice={fish.yields?.secondaryDice || []}
                          total={fish.yields?.secondaryUnits || 0}
                          onRoll={(dice, total) => {
                            setCaughtFish(prev => prev.map((f, i) =>
                              i === fish.index ? {
                                ...f,
                                yields: {
                                  ...(f.yields || {}),
                                  secondaryUnits: total,
                                  secondaryDice: dice,
                                  secondaryType: fish.species!.secondaryMaterialType
                                }
                              } : f
                            ));
                          }}
                          onTotalChange={(total) => {
                            setCaughtFish(prev => prev.map((f, i) =>
                              i === fish.index ? {
                                ...f,
                                yields: {
                                  ...(f.yields || {}),
                                  secondaryUnits: total,
                                  secondaryDice: [],
                                  secondaryType: fish.species!.secondaryMaterialType
                                }
                              } : f
                            ));
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}

              {caughtFish.filter(f => (!f.isLarge || f.struggleSuccess) && f.yields).length === caughtFish.filter(f => !f.isLarge || f.struggleSuccess).length &&
               caughtFish.filter(f => !f.isLarge || f.struggleSuccess).length > 0 && (
                <button
                  onClick={() => {
                    const results = caughtFish
                      .filter(f => (!f.isLarge || f.struggleSuccess) && f.yields)
                      .map(f => ({
                        fishIndex: f.index,
                        species: f.species!,
                        yields: f.yields!
                      }));
                    setYieldResults(results);
                    commitToInventory();
                  }}
                  className="w-full bg-purple-600 hover:bg-purple-700 py-2 rounded font-semibold mt-4"
                >
                  <Package size={18} className="inline mr-2" />
                  Add to Inventory
                </button>
              )}
            </div>
          </div>
        )}

        {/* Yield Phase - Foraging */}
        {sessionPhase === 'yield' && selectedMode === 'Foraging' && (
          <div className="space-y-4">
            <div className="bg-purple-900 p-4 rounded">
              <h3 className="text-lg font-semibold mb-2">Foraging Results</h3>

              <div className="bg-surface-1 p-3 rounded mb-3">
                <h4 className="font-semibold mb-2">What You Found:</h4>
                {forageFind?.type === 'category' && (
                  <div>
                    <span className="text-success-400">
                      {categories.find(c => c.id === forageFind.categoryId)?.name || 'Unknown Category'}
                    </span>
                    <p className="text-xs text-fg-muted mt-1">
                      {categories.find(c => c.id === forageFind.categoryId)?.description}
                    </p>
                  </div>
                )}
                {forageFind?.type === 'item' && (
                  <div>
                    <span className="text-success-400">
                      {items.find(i => i.id === forageFind.itemId)?.name || 'Unknown Item'}
                    </span>
                    <p className="text-xs text-fg-muted mt-1">
                      {items.find(i => i.id === forageFind.itemId)?.description}
                    </p>
                  </div>
                )}
                {forageFind?.type === 'nothing' && (
                  <span className="text-fg-muted">Nothing found</span>
                )}
                {forageFind?.type === 'special' && (
                  <span className="text-yellow-400">{forageFind.text}</span>
                )}
              </div>

              {(forageFind?.type === 'category' || forageFind?.type === 'item') && (() => {
                const category = categories.find(c => c.id === forageFind.categoryId);
                const item = items.find(i => i.id === forageFind.itemId);

                if (!category && !item) return null;

                const yieldFormula = item?.yieldFormula || category?.yieldFormula || '1d';
                const parsed = parseDiceFormula(yieldFormula) as { count?: number; sides?: number; modifier?: number };

                const currentYield = (yieldResults[0]?.yields as ForageYields)?.units || 0;
                const currentDice = (yieldResults[0]?.yields as ForageYields)?.dice || [];

                return (
                  <div className="bg-surface-1 p-3 rounded mb-3">
                    <h4 className="font-semibold mb-2">Calculate Yield:</h4>
                    <div className="text-xs text-fg-muted mb-2">
                      Formula: {yieldFormula} × {Math.floor((forageResult?.yieldMultiplier || 1) * 100)}%
                    </div>
                    <DiceRoller
                      label="Roll for Yield"
                      diceCount={parsed.count || 1}
                      diceSides={parsed.sides || 6}
                      modifier={parsed.modifier || 0}
                      dice={currentDice}
                      total={currentYield}
                      onRoll={(dice, total) => {
                        const finalUnits = Math.floor(total * (forageResult?.yieldMultiplier || 1.0));
                        setYieldResults([{
                          category: category || undefined,
                          item: item || undefined,
                          yields: {
                            units: finalUnits,
                            dice,
                            baseFormula: yieldFormula,
                            modifiedFormula: yieldFormula,
                            rawTotal: total,
                            multiplier: forageResult?.yieldMultiplier || 1.0
                          }
                        }]);
                      }}
                      onTotalChange={(total) => {
                        const finalUnits = Math.floor(total * (forageResult?.yieldMultiplier || 1.0));
                        setYieldResults([{
                          category: category || undefined,
                          item: item || undefined,
                          yields: {
                            units: finalUnits,
                            dice: [],
                            baseFormula: yieldFormula,
                            modifiedFormula: yieldFormula,
                            rawTotal: total,
                            multiplier: forageResult?.yieldMultiplier || 1.0
                          }
                        }]);
                      }}
                    />
                    {currentYield > 0 && (
                      <div className="text-sm text-purple-300 mt-2">
                        Final Yield: {currentYield} units
                      </div>
                    )}
                  </div>
                );
              })()}

              {yieldResults.length > 0 && (
                <button
                  onClick={commitToInventory}
                  className="w-full bg-purple-600 hover:bg-purple-700 py-2 rounded font-semibold mt-4"
                >
                  <Package size={18} className="inline mr-2" />
                  Add to Inventory
                </button>
              )}
            </div>
          </div>
        )}

        {/* Complete Phase */}
        {sessionPhase === 'complete' && (
          <div className="space-y-4">
            <div className="bg-surface-2 p-4 rounded">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <CheckCircle size={24} className="text-success-400" />
                Session Complete
              </h3>

              {selectedMode === 'Fishing' && yieldResults.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-semibold mb-2">Catches:</h4>
                  {yieldResults.map((result, i) => {
                    const fishYields = result.yields as FishYields;
                    return (
                      <div key={i} className="text-sm">
                        {result.species?.name}: {fishYields?.meatUnits}U meat
                        {(fishYields?.secondaryUnits || 0) > 0 && `, ${fishYields.secondaryUnits}U ${fishYields.secondaryType}`}
                      </div>
                    );
                  })}
                </div>
              )}

              {selectedMode === 'Foraging' && yieldResults.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-semibold mb-2">Foraged:</h4>
                  {yieldResults.map((result, i) => {
                    const forageYields = result.yields as ForageYields;
                    const itemName = result.item?.name || result.category?.name || 'Unknown';
                    return (
                      <div key={i} className="text-sm">
                        {itemName}: {forageYields?.units}U
                      </div>
                    );
                  })}
                </div>
              )}

              {fishingResult && !fishingResult.success && selectedMode === 'Fishing' && (
                <p className="text-fg-muted">No fish caught this session.</p>
              )}

              {forageResult && !forageResult.success && selectedMode === 'Foraging' && (
                <p className="text-fg-muted">Nothing foraged this session.</p>
              )}

              <button
                onClick={resetSession}
                className="w-full bg-accent-600 hover:bg-accent-700 py-2 rounded font-semibold mt-4"
              >
                Start New Session
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Session History (compact) */}
      <div className="bg-surface-1 p-4 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">Recent Sessions</h3>
        {sessions.length === 0 ? (
          <p className="text-fg-muted text-sm">No sessions recorded yet.</p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {sessions.slice(-5).reverse().map(session => (
              <div key={session.id} className="bg-surface-2 p-2 rounded text-sm">
                <div className="flex justify-between">
                  <span>Day {session.dateKey} - {session.mode}</span>
                  <span className="text-fg-muted">
                    {session.resolution?.fishCaught?.length || 0} fish
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export const GatheringTab = memo(GatheringTabBase);
