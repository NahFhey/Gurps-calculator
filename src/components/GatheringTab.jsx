import React, { useState, useMemo, memo } from 'react';
import PropTypes from 'prop-types';
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
  calculateFishYields,
  generateGroupKey,
  hasDailyEventBeenRolled,
  filterToolsForMethod,
  createGatheringSession,
  parseDiceFormula,
  roll3d6,
  calculateEffectiveForagingSkill,
  evaluateForagingRoll,
  determineForageFind,
  calculateForageYields,
  getToolYieldBonus
} from '../utils/gathering';

/**
 * GatheringTab Component - Manages gathering activities like Fishing
 * Memoized to prevent re-renders from unrelated tab changes
 *
 * This component implements the general gathering system with Fishing as the first mode.
 * Key features:
 * - Mode/Environment/Method selection
 * - Leader and helper selection
 * - Tool and bait selection with filtering
 * - Dynamic event system (once per day per group)
 * - Fishing roll resolution
 * - Random catch with net reroll for large fish
 * - Large fish struggle quick contest
 * - Yield calculation and inventory integration
 *
 * @param {Object} props - Component props
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
  foodTypes,
  materialTypes,
  currentDay,
  saveSessions,
  saveDailyEvents,
  saveFoods,
  saveMaterials
}) {
  // Mode and environment selection
  const [selectedMode, setSelectedMode] = useState('Fishing');
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('Line');

  // Party selection
  const [leaderId, setLeaderId] = useState(workers[0]?.id || '');
  const [helperIds, setHelperIds] = useState([]);

  // Intent
  const [targetedSpeciesId, setTargetedSpeciesId] = useState('');
  const [isRandomCatch, setIsRandomCatch] = useState(true);

  // Equipment
  const [selectedToolIds, setSelectedToolIds] = useState([]);
  const [selectedBaitId, setSelectedBaitId] = useState('');

  // Session state
  const [activeSession, setActiveSession] = useState(null);
  const [sessionPhase, setSessionPhase] = useState('setup'); // setup, event, fishing, catch, yield, complete

  // Roll inputs
  const [eventRoll, setEventRoll] = useState({ dice: [], total: 0 });
  const [fishingRoll, setFishingRoll] = useState({ dice: [], total: 0 });
  const [catchRolls, setCatchRolls] = useState([]);
  const [struggleRoll, setStruggleRoll] = useState('');
  const [yieldResults, setYieldResults] = useState([]);

  // Results
  const [eventResult, setEventResult] = useState(null);
  const [fishingResult, setFishingResult] = useState(null);
  const [caughtFish, setCaughtFish] = useState([]);
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
  const [forageRoll, setForageRoll] = useState({ dice: [], total: 0 });
  const [forageResult, setForageResult] = useState(null);
  const [forageFind, setForageFind] = useState(null);

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
      randomCatch: tables.find(t => t.id === defaults.randomCatchTableId),
      mildEvent: tables.find(t => t.id === defaults.mildEventTableId),
      rareEvent: tables.find(t => t.id === defaults.rareEventTableId)
    };
  }, [selectedEnvironment, selectedMode, tables]);

  // Get filtered tools for selected method/mode
  const availableTools = useMemo(() => {
    if (selectedMode === 'Foraging') {
      // Foraging doesn't use methods, just filter by mode
      return tools.filter(tool => tool.allowedModes?.includes('Foraging'));
    }
    return filterToolsForMethod(tools, selectedMode, selectedMethod);
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
      correct: attractsTarget,
      inappropriate: !attractsTarget && targetedSpeciesId
    };
  }, [selectedBaitItem, targetedSpecies, targetedSpeciesId]);

  // Generate group key for daily event tracking
  const groupKey = useMemo(() => {
    return generateGroupKey(leaderId, helperIds);
  }, [leaderId, helperIds]);

  // Check if daily event already rolled
  const dailyEventRolled = useMemo(() => {
    return hasDailyEventBeenRolled(dailyEvents, currentDay, groupKey);
  }, [dailyEvents, currentDay, groupKey]);

  // Calculate effective fishing skill
  const effectiveSkill = useMemo(() => {
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
    });
  }, [leader, toolBonus, baitStatus, targetedSpecies, isRandomCatch, retryCount, selectedEnvironment]);

  // Calculate effective foraging skill
  const effectiveForagingSkill = useMemo(() => {
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
    });
  }, [leader, selectedSkill, toolBonus, hasMapGuide, isUnfamiliar, isPeakSeason, targetRarity, isRandomForage, selectedEnvironment, selectedMode]);

  // Start a new gathering session
  function startSession() {
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
  function rollDailyEvent() {
    if (!eventRoll) {
      alert('Please enter or roll 3d6 for the daily event check');
      return;
    }

    const roll = eventRoll.total;
    const eventType = determineDynamicEventType(roll);

    let eventEntry = null;
    let eventText = null;

    if (eventType === 'rare' && resolvedTables.rareEvent) {
      eventEntry = rollOnCatchTable(resolvedTables.rareEvent);
      eventText = eventEntry?.text || 'Rare event occurred!';
    } else if (eventType === 'mild' && resolvedTables.mildEvent) {
      eventEntry = rollOnCatchTable(resolvedTables.mildEvent);
      eventText = eventEntry?.text || 'Mild event occurred!';
    }

    const result = {
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
    setActiveSession(prev => ({
      ...prev,
      dailyEvent: result
    }));

    setSessionPhase('fishing');
  }

  // Roll for fishing
  function rollFishing() {
    if (!fishingRoll) {
      alert('Please enter or roll 3d6 for the fishing check');
      return;
    }

    const roll = fishingRoll.total;
    const result = evaluateFishingRoll(roll, effectiveSkill.effectiveSkill, selectedMethod);

    setFishingResult(result);

    // Consume bait on attempt
    if (selectedBaitId) {
      const updatedBait = bait.map(b =>
        b.id === selectedBaitId ? { ...b, quantity: Math.max(0, (b.quantity || 1) - 1) } : b
      );
      // Note: bait is managed through gatheringBait, would need saveGatheringBait
    }

    if (result.success && result.fish > 0) {
      // Move to catch phase
      setCatchRolls(new Array(result.fish).fill(''));
      setSessionPhase('catch');
    } else if (!result.success && !result.critFailure && retryCount < 3) {
      // Allow retry
      setRetryCount(prev => prev + 1);
      setFishingRoll('');
    } else {
      // No catch, session complete
      setSessionPhase('complete');
    }
  }

  // Roll for foraging
  function rollForaging() {
    if (!forageRoll) {
      alert('Please enter or roll 3d6 for the foraging check');
      return;
    }

    const roll = forageRoll.total;
    const result = evaluateForagingRoll(roll, effectiveForagingSkill.effectiveSkill, !isRandomForage);

    setForageResult(result);

    // Determine what was found
    const targetCategory = targetCategoryId ? categories.find(c => c.id === targetCategoryId) : null;
    const targetItem = targetItemId ? items.find(i => i.id === targetItemId) : null;

    const findResult = determineForageFind({
      rollResult: result,
      findTable: resolvedTables.randomCatch, // Using randomCatch slot for find table
      targetCategory,
      targetItem
    });

    setForageFind(findResult);

    // Move to yield phase
    setSessionPhase('yield');
  }

  // Roll for random catch
  function rollCatch(index) {
    if (!resolvedTables.randomCatch) {
      alert('No catch table configured for this environment');
      return;
    }

    // Calculate bait roll bonus for Line fishing with random catch
    const baitRollBonus = (selectedMethod === 'Line' && isRandomCatch && selectedBaitItem)
      ? (selectedBaitItem.rollBonus || 0)
      : 0;

    let entry;
    try {
      if (selectedMethod === 'Net') {
        entry = rollNetCatch(resolvedTables.randomCatch, species);
      } else {
        // Apply bait roll bonus to the catch table roll
        entry = rollOnCatchTable(resolvedTables.randomCatch, baitRollBonus);
      }
    } catch (error) {
      alert(error.message);
      return;
    }

    const caughtSpecies = entry.resultType === 'species'
      ? species.find(s => s.id === entry.speciesId)
      : null;

    const newCatch = {
      index,
      entry,
      species: caughtSpecies,
      isLarge: caughtSpecies?.tags?.includes('LargeFish'),
      struggled: false,
      struggleSuccess: null,
      yields: null,
      baitRollBonus // Track for display
    };

    setCaughtFish(prev => [...prev, newCatch]);

    // Check if we need struggle for large fish on Line
    if (newCatch.isLarge && selectedMethod === 'Line') {
      // Will need struggle roll
    }
  }

  // Roll for large fish struggle
  function rollStruggle(fishIndex) {
    if (!struggleRoll) {
      alert('Please enter your struggle roll');
      return;
    }

    const fish = caughtFish[fishIndex];
    if (!fish || !fish.isLarge) return;

    const characterST = leader?.st || 10;
    const fishST = fish.species?.st || DEFAULT_FISH_ST;

    // Manual roll input - use quick contest logic
    const charRoll = parseInt(struggleRoll);
    const fishRollResult = roll3d6();

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

  // Roll yields for a caught fish
  function rollYields(fishIndex) {
    const fish = caughtFish[fishIndex];
    if (!fish?.species) return;

    // Skip if struggle failed
    if (fish.isLarge && fish.struggled && !fish.struggleSuccess) {
      return;
    }

    const yields = calculateFishYields(fish.species);

    setCaughtFish(prev => prev.map((f, i) =>
      i === fishIndex ? { ...f, yields } : f
    ));

    setYieldResults(prev => [...prev, { fishIndex, species: fish.species, yields }]);
  }

  // Roll yields for foraging
  function rollForageYields() {
    if (!forageFind) return;

    const category = categories.find(c => c.id === forageFind.categoryId);
    const item = items.find(i => i.id === forageFind.itemId);

    if (!category && !item) return;

    // Calculate yield bonuses/penalties
    const selectedToolObjects = tools.filter(t => selectedToolIds.includes(t.id));
    const yieldDiceBonus = getToolYieldBonus(selectedToolObjects, category?.id);

    let yieldDicePenalty = 0;
    if (isStormDamaged) yieldDicePenalty += 1;
    if (isDenseTerrain && selectedToolIds.length === 0) yieldDicePenalty += 1;

    const yields = calculateForageYields({
      category,
      item,
      yieldMultiplier: forageResult?.yieldMultiplier || 1.0,
      yieldDiceBonus,
      yieldDicePenalty
    });

    setYieldResults([{ category, item, yields }]);
  }

  // Proceed to yield phase
  function proceedToYields() {
    // Check all large fish have been struggled
    const unresolvedLarge = caughtFish.filter(f => f.isLarge && !f.struggled);
    if (unresolvedLarge.length > 0) {
      alert('Please resolve all large fish struggles first');
      return;
    }

    setSessionPhase('yield');
  }

  // Commit results to inventory
  function commitToInventory() {
    // Calculate totals by species+type combination for proper naming
    // Format: "Species Name Food/Material Type" (e.g., "Trout Fish" or "Salmon Scales")
    const foodItems = {}; // { "speciesName|foodType": { speciesName, foodType, units } }
    const materialItems = {}; // { "name": { name, type, units } }

    if (selectedMode === 'Fishing') {
      yieldResults.forEach(({ species: sp, yields }) => {
        if (!yields || !sp) return;

        // Add meat - named as "SpeciesName FoodType"
        const foodType = yields.foodType || 'fish';
        const foodKey = `${sp.name}|${foodType}`;
        if (!foodItems[foodKey]) {
          foodItems[foodKey] = { speciesName: sp.name, foodType, units: 0 };
        }
        foodItems[foodKey].units += yields.meatUnits;

        // Add secondary material - use secondaryNameOverride if set, else "SpeciesName MaterialType"
        if (yields.secondaryType && yields.secondaryUnits > 0) {
          const materialName = sp.secondaryNameOverride || `${sp.name} ${yields.secondaryType}`;
          if (!materialItems[materialName]) {
            materialItems[materialName] = { name: materialName, type: yields.secondaryType, units: 0 };
          }
          materialItems[materialName].units += yields.secondaryUnits;
        }
      });
    } else if (selectedMode === 'Foraging') {
      // Handle foraging yields
      yieldResults.forEach(({ category, item, yields }) => {
        if (!yields || yields.units === 0) return;

        const cat = category || categories.find(c => c.id === item?.categoryId);
        if (!cat) return;

        const inventoryKind = cat.inventoryOutput?.inventoryKind || 'food';
        const typeId = cat.inventoryOutput?.typeId || cat.name.toLowerCase().replace(/\s+/g, '_');

        // Get item name or use category name
        const itemName = item?.name || cat.name;

        if (inventoryKind === 'food') {
          const foodKey = `${itemName}|${typeId}`;
          if (!foodItems[foodKey]) {
            foodItems[foodKey] = { speciesName: itemName, foodType: typeId, units: 0 };
          }
          foodItems[foodKey].units += yields.units;
        } else {
          // Material
          if (!materialItems[itemName]) {
            materialItems[itemName] = { name: itemName, type: typeId, units: 0 };
          }
          materialItems[itemName].units += yields.units;
        }
      });
    }

    // Update foods inventory with proper naming
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

    // Update materials inventory with proper naming
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

    // For session logging, aggregate totals by type
    const foodTotals = {};
    const materialTotals = {};
    Object.values(foodItems).forEach(({ foodType, units }) => {
      foodTotals[foodType] = (foodTotals[foodType] || 0) + units;
    });
    Object.values(materialItems).forEach(({ type, units }) => {
      materialTotals[type] = (materialTotals[type] || 0) + units;
    });

    // Save session
    const completedSession = {
      ...activeSession,
      resolution: {
        fishingRoll: fishingResult,
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
  function resetSession() {
    setActiveSession(null);
    setSessionPhase('setup');
    setEventRoll('');
    setFishingRoll('');
    setForageRoll('');
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
      <div className="bg-gray-800 p-4 rounded-lg">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <Fish size={28} /> General Gathering
        </h2>

        {/* Setup Panel */}
        {sessionPhase === 'setup' && (
          <div className="space-y-4">
            {/* Mode Selection */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Gathering Mode</label>
                <select
                  value={selectedMode}
                  onChange={(e) => {
                    setSelectedMode(e.target.value);
                    setSelectedEnvironmentId('');
                  }}
                  className="w-full bg-gray-700 px-3 py-2 rounded"
                >
                  {GATHERING_MODES.map(mode => (
                    <option key={mode} value={mode}>{mode}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Environment</label>
                <select
                  value={selectedEnvironmentId}
                  onChange={(e) => setSelectedEnvironmentId(e.target.value)}
                  className="w-full bg-gray-700 px-3 py-2 rounded"
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
                <label className="block text-sm text-gray-400 mb-2">Fishing Method</label>
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
                          if (!method.canTarget) {
                            setIsRandomCatch(true);
                            setTargetedSpeciesId('');
                          }
                        }}
                        className="w-4 h-4"
                      />
                      <span>{method.label}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {FISHING_METHODS[selectedMethod]?.description}
                </p>
              </div>
            )}

            {/* Skill Selection (Foraging) */}
            {selectedMode === 'Foraging' && (
              <div>
                <label className="block text-sm text-gray-400 mb-2">Foraging Skill</label>
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
                      <span>{skill.label} ({skill.attribute})</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Choose the skill to use for foraging
                </p>
              </div>
            )}

            {/* Party Selection */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  <Users size={16} className="inline mr-1" /> Leader
                </label>
                <select
                  value={leaderId}
                  onChange={(e) => setLeaderId(e.target.value)}
                  className="w-full bg-gray-700 px-3 py-2 rounded"
                >
                  {workers.map(w => (
                    <option key={w.id} value={w.id}>
                      {w.name} (Fishing: {w.skills?.fishing || 10})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Helpers</label>
                <select
                  multiple
                  value={helperIds}
                  onChange={(e) => setHelperIds(Array.from(e.target.selectedOptions, opt => opt.value))}
                  className="w-full bg-gray-700 px-3 py-2 rounded h-20"
                >
                  {workers.filter(w => w.id !== leaderId).map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Intent (Fishing) */}
            {selectedMode === 'Fishing' && FISHING_METHODS[selectedMethod]?.canTarget && (
              <div className="bg-gray-700 p-3 rounded">
                <label className="block text-sm text-gray-400 mb-2">
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
                    className="w-full bg-gray-600 px-3 py-2 rounded"
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
              <div className="bg-gray-700 p-3 rounded">
                <label className="block text-sm text-gray-400 mb-2">
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
                      className="w-full bg-gray-600 px-3 py-2 rounded"
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
                        className="w-full bg-gray-600 px-3 py-2 rounded"
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
                        className="w-full bg-gray-600 px-3 py-2 rounded"
                      >
                        {Object.entries(FORAGING_RARITIES).map(([key, rarity]) => (
                          <option key={key} value={key}>
                            {rarity.label} ({rarity.penalty >= 0 ? '+' : ''}{rarity.penalty})
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
              <div className="bg-gray-700 p-3 rounded">
                <label className="block text-sm text-gray-400 mb-2">Context Modifiers</label>
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
                <label className="block text-sm text-gray-400 mb-2">Tools</label>
                <select
                  multiple
                  value={selectedToolIds}
                  onChange={(e) => setSelectedToolIds(Array.from(e.target.selectedOptions, opt => opt.value))}
                  className="w-full bg-gray-700 px-3 py-2 rounded h-24"
                >
                  {availableTools.map(tool => (
                    <option key={tool.id} value={tool.id}>
                      {tool.name} {tool.bonuses?.find(b => b.type === 'skill_bonus')?.value > 0 ? `(+${tool.bonuses.find(b => b.type === 'skill_bonus').value})` : ''}
                    </option>
                  ))}
                </select>
                {availableTools.length === 0 && (
                  <p className="text-xs text-yellow-400 mt-1">No tools configured for this {selectedMode === 'Fishing' ? 'method' : 'mode'}</p>
                )}
              </div>

              {selectedMode === 'Fishing' && (
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Bait</label>
                  <select
                    value={selectedBaitId}
                    onChange={(e) => setSelectedBaitId(e.target.value)}
                    className="w-full bg-gray-700 px-3 py-2 rounded"
                  >
                    <option value="">-- No Bait --</option>
                    {bait.filter(b => (b.quantity || 0) > 0).map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.quantity || 0} available)
                      </option>
                    ))}
                  </select>
                  {baitStatus.correct && (
                    <p className="text-xs text-green-400 mt-1">✓ Correct bait for target (+1)</p>
                  )}
                  {baitStatus.inappropriate && (
                    <p className="text-xs text-red-400 mt-1">✗ Wrong bait for target (-2)</p>
                  )}
                </div>
              )}
            </div>

            {/* Skill Summary */}
            <div className="bg-gray-700 p-3 rounded">
              {selectedMode === 'Fishing' && (
                <>
                  <h4 className="font-semibold mb-2">Effective Skill: {effectiveSkill.effectiveSkill}</h4>
                  <div className="text-sm text-gray-400 grid grid-cols-3 gap-2">
                    <span>Base: {effectiveSkill.breakdown.base}</span>
                    <span>Tool: {effectiveSkill.breakdown.tool >= 0 ? '+' : ''}{effectiveSkill.breakdown.tool}</span>
                    <span>Bait: {effectiveSkill.breakdown.bait >= 0 ? '+' : ''}{effectiveSkill.breakdown.bait}</span>
                    {effectiveSkill.breakdown.largeFish !== 0 && (
                      <span>Large Fish: {effectiveSkill.breakdown.largeFish}</span>
                    )}
                    {effectiveSkill.breakdown.environment !== 0 && (
                      <span>Environment: {effectiveSkill.breakdown.environment >= 0 ? '+' : ''}{effectiveSkill.breakdown.environment}</span>
                    )}
                  </div>
                </>
              )}
              {selectedMode === 'Foraging' && (
                <>
                  <h4 className="font-semibold mb-2">Effective Skill: {effectiveForagingSkill.effectiveSkill} ({selectedSkill})</h4>
                  <div className="text-sm text-gray-400 grid grid-cols-3 gap-2">
                    <span>Base: {effectiveForagingSkill.breakdown.base}</span>
                    <span>Tool: {effectiveForagingSkill.breakdown.tool >= 0 ? '+' : ''}{effectiveForagingSkill.breakdown.tool}</span>
                    <span>Context: {effectiveForagingSkill.breakdown.context >= 0 ? '+' : ''}{effectiveForagingSkill.breakdown.context}</span>
                    {effectiveForagingSkill.breakdown.rarity !== 0 && (
                      <span>Rarity: {effectiveForagingSkill.breakdown.rarity >= 0 ? '+' : ''}{effectiveForagingSkill.breakdown.rarity}</span>
                    )}
                    {effectiveForagingSkill.breakdown.environment !== 0 && (
                      <span>Environment: {effectiveForagingSkill.breakdown.environment >= 0 ? '+' : ''}{effectiveForagingSkill.breakdown.environment}</span>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Tables Info */}
            {selectedEnvironment && (
              <div className="bg-gray-700 p-3 rounded text-sm">
                <h4 className="font-semibold mb-2">Resolved Tables</h4>
                <div className="grid grid-cols-3 gap-2 text-gray-400">
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
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed py-3 rounded font-semibold"
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
              <p className="text-sm text-gray-300 mb-4">
                Roll 3d6 to check for daily events. This only happens once per day per group.
              </p>
              <div className="text-xs text-gray-400 mb-2">
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
                  className="flex-1 bg-gray-700 px-3 py-2 rounded"
                />
                <DiceRoller
                  dice={eventRoll.dice}
                  total={eventRoll.total}
                  onRoll={(dice, total) => setEventRoll({ dice, total })}
                />
              </div>

              <button
                onClick={rollDailyEvent}
                disabled={!eventRoll.total}
                className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 py-2 rounded font-semibold"
              >
                Resolve Daily Event
              </button>
            </div>

            {eventResult && (
              <div className={`p-4 rounded ${
                eventResult.resultType === 'rare' ? 'bg-red-900' :
                eventResult.resultType === 'mild' ? 'bg-orange-900' : 'bg-green-900'
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
            <div className="bg-blue-900 p-4 rounded">
              <h3 className="text-lg font-semibold mb-2">Fishing Roll</h3>
              <p className="text-sm text-gray-300 mb-2">
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
                  className="flex-1 bg-gray-700 px-3 py-2 rounded"
                />
                <DiceRoller
                  dice={fishingRoll.dice}
                  total={fishingRoll.total}
                  onRoll={(dice, total) => setFishingRoll({ dice, total })}
                />
              </div>

              <button
                onClick={rollFishing}
                disabled={!fishingRoll.total}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 py-2 rounded font-semibold"
              >
                Roll Fishing
              </button>
            </div>

            {fishingResult && (
              <div className={`p-4 rounded ${fishingResult.success ? 'bg-green-900' : 'bg-red-900'}`}>
                <h4 className="font-semibold flex items-center gap-2">
                  {fishingResult.success ? <CheckCircle size={20} /> : <XCircle size={20} />}
                  {fishingResult.description}
                </h4>
                <p className="text-sm mt-1">
                  Roll: {fishingRoll} vs {effectiveSkill.effectiveSkill} (Margin: {fishingResult.margin})
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
            <div className="bg-green-900 p-4 rounded">
              <h3 className="text-lg font-semibold mb-2">Foraging Roll</h3>
              <p className="text-sm text-gray-300 mb-2">
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
                  className="flex-1 bg-gray-700 px-3 py-2 rounded"
                />
                <DiceRoller
                  dice={forageRoll.dice}
                  total={forageRoll.total}
                  onRoll={(dice, total) => setForageRoll({ dice, total })}
                />
              </div>

              <button
                onClick={rollForaging}
                disabled={!forageRoll.total}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 py-2 rounded font-semibold"
              >
                Roll Foraging
              </button>
            </div>

            {forageResult && (
              <div className={`p-4 rounded ${forageResult.success ? 'bg-green-900' : 'bg-red-900'}`}>
                <h4 className="font-semibold flex items-center gap-2">
                  {forageResult.success ? <CheckCircle size={20} /> : <XCircle size={20} />}
                  {forageResult.description}
                </h4>
                <p className="text-sm mt-1">
                  Roll: {forageRoll} vs {effectiveForagingSkill.effectiveSkill} (Margin: {forageResult.margin})
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
            <div className="bg-green-900 p-4 rounded">
              <h3 className="text-lg font-semibold mb-2">
                Determine Catch ({fishingResult?.fish || 0} fish)
              </h3>

              {Array.from({ length: fishingResult?.fish || 0 }, (_, i) => {
                const caught = caughtFish.find(f => f.index === i);
                return (
                  <div key={i} className="bg-gray-800 p-3 rounded mb-2">
                    <div className="flex justify-between items-center">
                      <span>Fish #{i + 1}</span>
                      {caught ? (
                        <span className="text-green-400">
                          {caught.species?.name || 'Nothing'} {caught.isLarge && '(Large!)'}
                        </span>
                      ) : (
                        <button
                          onClick={() => rollCatch(i)}
                          className="bg-green-600 hover:bg-green-700 px-3 py-1 rounded text-sm"
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
                            className="flex-1 bg-gray-700 px-2 py-1 rounded"
                          />
                          <button
                            onClick={() => rollStruggle(i)}
                            className="bg-orange-600 px-3 py-1 rounded text-sm"
                          >
                            Struggle
                          </button>
                        </div>
                      </div>
                    )}

                    {caught?.struggled && (
                      <div className={`mt-2 text-sm ${caught.struggleSuccess ? 'text-green-400' : 'text-red-400'}`}>
                        {caught.struggleSuccess ? '✓ You landed the fish!' : '✗ The fish escaped!'}
                      </div>
                    )}
                  </div>
                );
              })}

              {caughtFish.length === (fishingResult?.fish || 0) && (
                <button
                  onClick={proceedToYields}
                  className="w-full bg-green-600 hover:bg-green-700 py-2 rounded font-semibold mt-4"
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

              {caughtFish.filter(f => !f.isLarge || f.struggleSuccess).map((fish, fishIdx) => {
                if (!fish.species) return null;

                // Parse meat yield formula
                const meatFormula = fish.species.yieldMeatFormula || '1d';
                const meatParsed = parseDiceFormula(meatFormula);

                // Parse secondary yield formula if exists
                const hasSecondary = fish.species.yieldSecondaryFormula && fish.species.secondaryMaterialType;
                let secondaryParsed;
                if (hasSecondary) {
                  secondaryParsed = parseDiceFormula(fish.species.yieldSecondaryFormula);
                }

                return (
                  <div key={fishIdx} className="bg-gray-800 p-3 rounded mb-3 space-y-3">
                    <div className="font-medium text-blue-200">{fish.species.name}</div>

                    {/* Meat Yield Roller */}
                    <div>
                      <div className="text-xs text-gray-400 mb-2">
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
                          // Update fish with new meat yield
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

                    {/* Secondary Material Yield Roller */}
                    {hasSecondary && (
                      <div>
                        <div className="text-xs text-gray-400 mb-2">
                          {fish.species.secondaryMaterialType}: {fish.species.yieldSecondaryFormula}
                        </div>
                        <DiceRoller
                          label={fish.species.secondaryMaterialType}
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
                                  secondaryType: fish.species.secondaryMaterialType
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
                                  secondaryType: fish.species.secondaryMaterialType
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
                    // Update yield results with current fish yields
                    const results = caughtFish
                      .filter(f => (!f.isLarge || f.struggleSuccess) && f.yields)
                      .map(f => ({
                        fishIndex: f.index,
                        species: f.species,
                        yields: f.yields
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

              {/* Find Result */}
              <div className="bg-gray-800 p-3 rounded mb-3">
                <h4 className="font-semibold mb-2">What You Found:</h4>
                {forageFind?.type === 'category' && (
                  <div>
                    <span className="text-green-400">
                      {categories.find(c => c.id === forageFind.categoryId)?.name || 'Unknown Category'}
                    </span>
                    <p className="text-xs text-gray-400 mt-1">
                      {categories.find(c => c.id === forageFind.categoryId)?.description}
                    </p>
                  </div>
                )}
                {forageFind?.type === 'item' && (
                  <div>
                    <span className="text-green-400">
                      {items.find(i => i.id === forageFind.itemId)?.name || 'Unknown Item'}
                    </span>
                    <p className="text-xs text-gray-400 mt-1">
                      {items.find(i => i.id === forageFind.itemId)?.description}
                    </p>
                  </div>
                )}
                {forageFind?.type === 'nothing' && (
                  <span className="text-gray-400">Nothing found</span>
                )}
                {forageFind?.type === 'special' && (
                  <span className="text-yellow-400">{forageFind.text}</span>
                )}
              </div>

              {/* Yield Calculation */}
              {(forageFind?.type === 'category' || forageFind?.type === 'item') && (() => {
                const category = categories.find(c => c.id === forageFind.categoryId);
                const item = items.find(i => i.id === forageFind.itemId);

                if (!category && !item) return null;

                // Get yield formula
                const yieldFormula = item?.yieldFormula || category?.yieldFormula || '1d';
                const parsed = parseDiceFormula(yieldFormula);

                // Get current yield from results if already rolled
                const currentYield = yieldResults[0]?.yields?.units || 0;
                const currentDice = yieldResults[0]?.yields?.dice || [];

                return (
                  <div className="bg-gray-800 p-3 rounded mb-3">
                    <h4 className="font-semibold mb-2">Calculate Yield:</h4>
                    <div className="text-xs text-gray-400 mb-2">
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
                        // Apply yield multiplier
                        const finalUnits = Math.floor(total * (forageResult?.yieldMultiplier || 1.0));
                        setYieldResults([{
                          category,
                          item,
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
                        // Apply yield multiplier
                        const finalUnits = Math.floor(total * (forageResult?.yieldMultiplier || 1.0));
                        setYieldResults([{
                          category,
                          item,
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
            <div className="bg-gray-700 p-4 rounded">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <CheckCircle size={24} className="text-green-400" />
                Session Complete
              </h3>

              {selectedMode === 'Fishing' && yieldResults.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-semibold mb-2">Catches:</h4>
                  {yieldResults.map((result, i) => (
                    <div key={i} className="text-sm">
                      {result.species?.name}: {result.yields?.meatUnits}U meat
                      {result.yields?.secondaryUnits > 0 && `, ${result.yields.secondaryUnits}U ${result.yields.secondaryType}`}
                    </div>
                  ))}
                </div>
              )}

              {selectedMode === 'Foraging' && yieldResults.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-semibold mb-2">Foraged:</h4>
                  {yieldResults.map((result, i) => {
                    const itemName = result.item?.name || result.category?.name || 'Unknown';
                    return (
                      <div key={i} className="text-sm">
                        {itemName}: {result.yields?.units}U
                      </div>
                    );
                  })}
                </div>
              )}

              {fishingResult && !fishingResult.success && selectedMode === 'Fishing' && (
                <p className="text-gray-400">No fish caught this session.</p>
              )}

              {forageResult && !forageResult.success && selectedMode === 'Foraging' && (
                <p className="text-gray-400">Nothing foraged this session.</p>
              )}

              <button
                onClick={resetSession}
                className="w-full bg-blue-600 hover:bg-blue-700 py-2 rounded font-semibold mt-4"
              >
                Start New Session
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Session History (compact) */}
      <div className="bg-gray-800 p-4 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">Recent Sessions</h3>
        {sessions.length === 0 ? (
          <p className="text-gray-400 text-sm">No sessions recorded yet.</p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {sessions.slice(-5).reverse().map(session => (
              <div key={session.id} className="bg-gray-700 p-2 rounded text-sm">
                <div className="flex justify-between">
                  <span>Day {session.dateKey} - {session.mode}</span>
                  <span className="text-gray-400">
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

GatheringTab.propTypes = {
  species: PropTypes.arrayOf(PropTypes.object).isRequired,
  tools: PropTypes.arrayOf(PropTypes.object).isRequired,
  tables: PropTypes.arrayOf(PropTypes.object).isRequired,
  environments: PropTypes.arrayOf(PropTypes.object).isRequired,
  sessions: PropTypes.arrayOf(PropTypes.object).isRequired,
  dailyEvents: PropTypes.object.isRequired,
  bait: PropTypes.arrayOf(PropTypes.object).isRequired,
  categories: PropTypes.arrayOf(PropTypes.object).isRequired,
  items: PropTypes.arrayOf(PropTypes.object).isRequired,
  workers: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    skills: PropTypes.object
  })).isRequired,
  foods: PropTypes.arrayOf(PropTypes.object).isRequired,
  materials: PropTypes.arrayOf(PropTypes.object).isRequired,
  foodTypes: PropTypes.arrayOf(PropTypes.shape({
    name: PropTypes.string,
    color: PropTypes.string
  })).isRequired,
  materialTypes: PropTypes.arrayOf(PropTypes.object).isRequired,
  currentDay: PropTypes.number.isRequired,
  saveSessions: PropTypes.func.isRequired,
  saveDailyEvents: PropTypes.func.isRequired,
  saveFoods: PropTypes.func.isRequired,
  saveMaterials: PropTypes.func.isRequired
};
