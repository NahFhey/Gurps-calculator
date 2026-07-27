import { useState, useMemo } from 'react';
import { Plus, Save, X, Trash2, Edit2, ChevronDown, ChevronRight } from 'lucide-react';
import { GATHERING_MODES } from '../../../constants';
import { FORAGE_CATEGORY_IDS, FORAGE_CATEGORY_META } from '../../../constants/foraging';
import type {
  EnvironmentsViewProps,
  GatheringEnvironmentExtended,
  GatheringItemExtended,
  ModeDefaults,
} from '../../../types/gathering';
import type {
  ForageZoneProfile,
  ZoneTierCategory,
  WeightedItem,
  ForageCategoryId,
} from '../../../types/foraging';

// ============================================================================
// ZONE PROFILE EDITOR (inline sub-component)
// ============================================================================

interface ZoneProfileEditorProps {
  environmentId: string;
  locationId?: string;
  profile: ForageZoneProfile | null;
  items: GatheringItemExtended[];
  onSave: (profile: ForageZoneProfile) => void;
  onRemove: (id: string) => void;
}

const TIER_LABELS: Array<{ key: 'commonCategories' | 'uncommonCategories' | 'rareCategories'; label: string }> = [
  { key: 'commonCategories', label: 'Common' },
  { key: 'uncommonCategories', label: 'Uncommon' },
  { key: 'rareCategories', label: 'Rare' },
];

function ZoneProfileEditor({ environmentId, locationId, profile, items, onSave, onRemove }: ZoneProfileEditorProps) {
  const emptyProfile: ForageZoneProfile = {
    id: crypto.randomUUID(),
    name: '',
    environmentId,
    locationId,
    commonCategories: [],
    uncommonCategories: [],
    rareCategories: [],
    tags: [],
  };

  const [draft, setDraft] = useState<ForageZoneProfile>(profile ?? emptyProfile);
  const [expandedTier, setExpandedTier] = useState<string | null>('commonCategories');

  function updateTierCategories(tierKey: typeof TIER_LABELS[number]['key'], cats: ZoneTierCategory[]) {
    setDraft({ ...draft, [tierKey]: cats });
  }

  function addCategory(tierKey: typeof TIER_LABELS[number]['key']) {
    const cats = [...(draft[tierKey] as ZoneTierCategory[])];
    // Pick first category not already in this tier
    const usedIds = cats.map((c) => c.categoryId);
    const available = FORAGE_CATEGORY_IDS.filter((id) => !usedIds.includes(id));
    const catId = available[0] ?? FORAGE_CATEGORY_IDS[0];
    cats.push({ categoryId: catId, weight: 1, items: [] });
    updateTierCategories(tierKey, cats);
  }

  function removeCategory(tierKey: typeof TIER_LABELS[number]['key'], idx: number) {
    const cats = [...(draft[tierKey] as ZoneTierCategory[])];
    cats.splice(idx, 1);
    updateTierCategories(tierKey, cats);
  }

  function updateCategory(tierKey: typeof TIER_LABELS[number]['key'], idx: number, updates: Partial<ZoneTierCategory>) {
    const cats = [...(draft[tierKey] as ZoneTierCategory[])];
    cats[idx] = { ...cats[idx], ...updates };
    updateTierCategories(tierKey, cats);
  }

  function addItemToCategory(tierKey: typeof TIER_LABELS[number]['key'], catIdx: number) {
    const cats = [...(draft[tierKey] as ZoneTierCategory[])];
    const cat = { ...cats[catIdx], items: [...cats[catIdx].items] };
    // Pick first item not already in this category
    const usedItemIds = cat.items.map((i) => i.itemId);
    const available = items.filter((i) => !usedItemIds.includes(i.id));
    if (available.length === 0) return;
    cat.items.push({ itemId: available[0].id, weight: 1 });
    cats[catIdx] = cat;
    updateTierCategories(tierKey, cats);
  }

  function removeItemFromCategory(tierKey: typeof TIER_LABELS[number]['key'], catIdx: number, itemIdx: number) {
    const cats = [...(draft[tierKey] as ZoneTierCategory[])];
    const cat = { ...cats[catIdx], items: [...cats[catIdx].items] };
    cat.items.splice(itemIdx, 1);
    cats[catIdx] = cat;
    updateTierCategories(tierKey, cats);
  }

  function updateItemInCategory(
    tierKey: typeof TIER_LABELS[number]['key'],
    catIdx: number,
    itemIdx: number,
    updates: Partial<WeightedItem>
  ) {
    const cats = [...(draft[tierKey] as ZoneTierCategory[])];
    const cat = { ...cats[catIdx], items: [...cats[catIdx].items] };
    cat.items[itemIdx] = { ...cat.items[itemIdx], ...updates };
    cats[catIdx] = cat;
    updateTierCategories(tierKey, cats);
  }

  function handleSave() {
    if (!draft.name.trim()) {
      alert('Enter a zone profile name');
      return;
    }
    onSave({
      ...draft,
      environmentId,
      locationId,
    });
  }

  function handleDelete() {
    if (profile) {
      onRemove(profile.id);
    }
  }

  return (
    <div className="bg-gray-600/50 p-3 rounded mt-2 space-y-3">
      <div className="text-sm font-medium text-green-400 mb-2">Foraging Zone Profile</div>

      {/* Profile Name & Tags */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Profile Name *</label>
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="e.g., Forest Zone"
            className="w-full bg-gray-700 border border-gray-600 px-2 py-1 rounded text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Tags (comma-separated)</label>
          <input
            value={draft.tags.join(', ')}
            onChange={(e) =>
              setDraft({
                ...draft,
                tags: e.target.value
                  .split(',')
                  .map((t) => t.trim())
                  .filter(Boolean),
              })
            }
            placeholder="e.g., OldGrowth, Coastal"
            className="w-full bg-gray-700 border border-gray-600 px-2 py-1 rounded text-sm"
          />
        </div>
      </div>

      <div className="w-1/3">
        <label className="block text-xs text-gray-400 mb-1">Season</label>
        <select
          value={draft.currentSeason ?? ''}
          onChange={(e) => setDraft({ ...draft, currentSeason: e.target.value || undefined })}
          className="w-full bg-gray-700 border border-gray-600 px-2 py-1 rounded text-sm"
        >
          <option value="">-- Any --</option>
          <option value="spring">Spring</option>
          <option value="summer">Summer</option>
          <option value="autumn">Autumn</option>
          <option value="winter">Winter</option>
        </select>
      </div>

      {/* Tier Sections */}
      {TIER_LABELS.map(({ key, label }) => {
        const cats = draft[key] as ZoneTierCategory[];
        const isExpanded = expandedTier === key;

        return (
          <div key={key} className="border border-gray-600 rounded overflow-hidden">
            <button
              type="button"
              onClick={() => setExpandedTier(isExpanded ? null : key)}
              className="w-full flex items-center justify-between px-3 py-2 bg-gray-700 hover:bg-gray-650 text-sm font-medium"
            >
              <span>
                {label} Tier ({cats.length} {cats.length === 1 ? 'category' : 'categories'})
              </span>
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>

            {isExpanded && (
              <div className="p-2 space-y-2">
                {cats.map((cat, catIdx) => (
                  <div key={catIdx} className="bg-gray-700/50 p-2 rounded space-y-1">
                    <div className="flex items-center gap-2">
                      <select
                        value={cat.categoryId}
                        onChange={(e) =>
                          updateCategory(key, catIdx, { categoryId: e.target.value as ForageCategoryId })
                        }
                        className="flex-1 bg-gray-700 border border-gray-600 px-2 py-1 rounded text-xs"
                      >
                        {FORAGE_CATEGORY_IDS.map((id) => (
                          <option key={id} value={id}>
                            {FORAGE_CATEGORY_META[id].label}
                          </option>
                        ))}
                      </select>
                      <div className="flex items-center gap-1">
                        <label className="text-xs text-gray-400">Wt:</label>
                        <input
                          type="number"
                          value={cat.weight}
                          onChange={(e) =>
                            updateCategory(key, catIdx, { weight: Math.max(0, Number(e.target.value)) })
                          }
                          className="w-14 bg-gray-700 border border-gray-600 px-1 py-1 rounded text-xs text-center"
                          min={0}
                        />
                      </div>
                      <button
                        onClick={() => removeCategory(key, catIdx)}
                        className="text-red-400 hover:text-red-300"
                        title="Remove category"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    {/* Items within this category */}
                    <div className="ml-4 space-y-1">
                      {cat.items.map((wi, itemIdx) => (
                        <div key={itemIdx} className="flex items-center gap-2">
                          <select
                            value={wi.itemId}
                            onChange={(e) =>
                              updateItemInCategory(key, catIdx, itemIdx, { itemId: e.target.value })
                            }
                            className="flex-1 bg-gray-700 border border-gray-600 px-2 py-1 rounded text-xs"
                          >
                            {items.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name} ({item.inventoryKind}: {item.typeId})
                              </option>
                            ))}
                          </select>
                          <div className="flex items-center gap-1">
                            <label className="text-xs text-gray-400">Wt:</label>
                            <input
                              type="number"
                              value={wi.weight}
                              onChange={(e) =>
                                updateItemInCategory(key, catIdx, itemIdx, {
                                  weight: Math.max(0, Number(e.target.value)),
                                })
                              }
                              className="w-14 bg-gray-700 border border-gray-600 px-1 py-1 rounded text-xs text-center"
                              min={0}
                            />
                          </div>
                          <button
                            onClick={() => removeItemFromCategory(key, catIdx, itemIdx)}
                            className="text-red-400 hover:text-red-300"
                            title="Remove item"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}

                      <button
                        onClick={() => addItemToCategory(key, catIdx)}
                        className="text-xs text-blue-400 hover:text-blue-300"
                        disabled={items.length === 0}
                      >
                        + Add Item
                      </button>
                    </div>
                  </div>
                ))}

                <button
                  onClick={() => addCategory(key)}
                  className="text-xs text-green-400 hover:text-green-300"
                >
                  + Add Category
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button onClick={handleSave} className="flex-1 bg-green-600 hover:bg-green-700 px-3 py-1.5 rounded text-sm">
          <Save size={14} className="inline mr-1" /> {profile ? 'Update Zone Profile' : 'Create Zone Profile'}
        </button>
        {profile && (
          <button onClick={handleDelete} className="bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded text-sm">
            <Trash2 size={14} className="inline mr-1" /> Delete
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// ENVIRONMENTS VIEW (main component)
// ============================================================================

/**
 * EnvironmentsView - Manages gathering environments/locations
 *
 * Allows creating, editing, and deleting environments that link
 * to catch tables, event tables, and specify skill modifiers.
 * Environments can be linked to a Location for auto-selection in downtime activities.
 * When an environment supports Foraging, an inline zone profile editor is shown.
 */
export function EnvironmentsView({
  environments,
  tables,
  items,
  locations,
  forageZoneProfiles,
  saveEnvironments,
  saveForageZoneProfile,
  removeForageZoneProfile,
  onDelete,
}: EnvironmentsViewProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedEnvId, setExpandedEnvId] = useState<string | null>(null);

  // Form state
  const [newEnvName, setNewEnvName] = useState('');
  const [newEnvModes, setNewEnvModes] = useState<string[]>(['Fishing']);
  const [newEnvCatchTableId, setNewEnvCatchTableId] = useState('');
  const [newEnvMildTableId, setNewEnvMildTableId] = useState('');
  const [newEnvRareTableId, setNewEnvRareTableId] = useState('');
  const [newEnvForagingFindTableId, setNewEnvForagingFindTableId] = useState('');
  const [newEnvForagingMildTableId, setNewEnvForagingMildTableId] = useState('');
  const [newEnvForagingRareTableId, setNewEnvForagingRareTableId] = useState('');
  const [newEnvSkillMod, setNewEnvSkillMod] = useState('0');
  const [newEnvLocationId, setNewEnvLocationId] = useState('');

  // Index profiles by environmentId for quick lookup
  const profileByEnvId = useMemo(() => {
    const map: Record<string, ForageZoneProfile> = {};
    for (const p of forageZoneProfiles) {
      if (p.environmentId) {
        map[p.environmentId] = p;
      }
    }
    return map;
  }, [forageZoneProfiles]);

  function addEnvironment() {
    if (!newEnvName.trim()) {
      alert('Enter environment name');
      return;
    }

    const defaultsByMode: { Fishing?: ModeDefaults; Foraging?: ModeDefaults } = {};

    if (newEnvModes.includes('Fishing')) {
      defaultsByMode.Fishing = {
        randomCatchTableId: newEnvCatchTableId || null,
        mildEventTableId: newEnvMildTableId || null,
        rareEventTableId: newEnvRareTableId || null,
      };
    }

    if (newEnvModes.includes('Foraging')) {
      defaultsByMode.Foraging = {
        randomCatchTableId: newEnvForagingFindTableId || null,
        mildEventTableId: newEnvForagingMildTableId || null,
        rareEventTableId: newEnvForagingRareTableId || null,
      };
    }

    const entryData: Omit<GatheringEnvironmentExtended, 'id'> = {
      name: newEnvName.trim(),
      supportedModes: newEnvModes,
      defaultsByMode,
      skillMod: parseInt(newEnvSkillMod) || 0,
      locationId: newEnvLocationId || undefined,
    };

    if (editingId) {
      saveEnvironments(environments.map((e) => (e.id === editingId ? { ...e, ...entryData } : e)));
    } else {
      saveEnvironments([...environments, { id: crypto.randomUUID(), ...entryData }]);
    }
    resetForm();
  }

  function editEnvironment(e: GatheringEnvironmentExtended) {
    setEditingId(e.id);
    setNewEnvName(e.name);
    setNewEnvModes(e.supportedModes || ['Fishing']);

    const fishingDefaults = e.defaultsByMode?.Fishing;
    setNewEnvCatchTableId(fishingDefaults?.randomCatchTableId || '');
    setNewEnvMildTableId(fishingDefaults?.mildEventTableId || '');
    setNewEnvRareTableId(fishingDefaults?.rareEventTableId || '');

    const foragingDefaults = e.defaultsByMode?.Foraging;
    setNewEnvForagingFindTableId(foragingDefaults?.randomCatchTableId || '');
    setNewEnvForagingMildTableId(foragingDefaults?.mildEventTableId || '');
    setNewEnvForagingRareTableId(foragingDefaults?.rareEventTableId || '');

    setNewEnvSkillMod(String(e.skillMod || 0));
    setNewEnvLocationId(e.locationId || '');
    setShowAdd(true);
  }

  function resetForm() {
    setEditingId(null);
    setNewEnvName('');
    setNewEnvModes(['Fishing']);
    setNewEnvCatchTableId('');
    setNewEnvMildTableId('');
    setNewEnvRareTableId('');
    setNewEnvForagingFindTableId('');
    setNewEnvForagingMildTableId('');
    setNewEnvForagingRareTableId('');
    setNewEnvSkillMod('0');
    setNewEnvLocationId('');
    setShowAdd(false);
  }

  // Helper to find location name by ID
  const getLocationName = (locationId?: string) => {
    if (!locationId) return null;
    return locations.find((l) => l.id === locationId)?.name ?? null;
  };

  return (
    <div>
      <div className="flex justify-between mb-4">
        <h3 className="text-lg font-bold">Environments ({environments.length})</h3>
        <button onClick={() => setShowAdd(!showAdd)} className="bg-green-600 px-3 py-1 rounded text-sm">
          <Plus size={16} className="inline" /> Add Environment
        </button>
      </div>

      {showAdd && (
        <div className="bg-gray-700 p-4 rounded mb-4 space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Name *</label>
            <input
              value={newEnvName}
              onChange={(e) => setNewEnvName(e.target.value)}
              placeholder="e.g., Tuto Coastal Waters"
              className="w-full bg-gray-600 px-3 py-2 rounded"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Location</label>
            <select
              value={newEnvLocationId}
              onChange={(e) => setNewEnvLocationId(e.target.value)}
              className="w-full bg-gray-600 px-3 py-2 rounded"
            >
              <option value="">-- No Location (hidden from activities) --</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Environments must be linked to a location to appear in downtime activities.
            </p>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Supported Modes</label>
            <div className="flex flex-wrap gap-2">
              {GATHERING_MODES.map((mode) => (
                <label key={mode} className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={newEnvModes.includes(mode)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setNewEnvModes([...newEnvModes, mode]);
                      } else {
                        setNewEnvModes(newEnvModes.filter((m) => m !== mode));
                      }
                    }}
                    className="w-4 h-4"
                  />
                  {mode}
                </label>
              ))}
            </div>
          </div>

          {newEnvModes.includes('Fishing') && (
            <>
              <div className="text-sm font-medium text-gray-300 mt-4 mb-2">Fishing Tables</div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Catch Table</label>
                  <select
                    value={newEnvCatchTableId}
                    onChange={(e) => setNewEnvCatchTableId(e.target.value)}
                    className="w-full bg-gray-600 px-3 py-2 rounded"
                  >
                    <option value="">-- None --</option>
                    {tables
                      .filter((t) => t.tableType.includes('RandomCatch'))
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Mild Event Table</label>
                  <select
                    value={newEnvMildTableId}
                    onChange={(e) => setNewEnvMildTableId(e.target.value)}
                    className="w-full bg-gray-600 px-3 py-2 rounded"
                  >
                    <option value="">-- None --</option>
                    {tables
                      .filter((t) => t.tableType.includes('EventMild'))
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Rare Event Table</label>
                  <select
                    value={newEnvRareTableId}
                    onChange={(e) => setNewEnvRareTableId(e.target.value)}
                    className="w-full bg-gray-600 px-3 py-2 rounded"
                  >
                    <option value="">-- None --</option>
                    {tables
                      .filter((t) => t.tableType.includes('EventRare'))
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            </>
          )}

          {newEnvModes.includes('Foraging') && (
            <>
              <div className="text-sm font-medium text-gray-300 mt-4 mb-2">Foraging Tables</div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Find Table</label>
                  <select
                    value={newEnvForagingFindTableId}
                    onChange={(e) => setNewEnvForagingFindTableId(e.target.value)}
                    className="w-full bg-gray-600 px-3 py-2 rounded"
                  >
                    <option value="">-- None --</option>
                    {tables
                      .filter((t) => t.tableType.includes('ForagingRandomFind'))
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Mild Event Table</label>
                  <select
                    value={newEnvForagingMildTableId}
                    onChange={(e) => setNewEnvForagingMildTableId(e.target.value)}
                    className="w-full bg-gray-600 px-3 py-2 rounded"
                  >
                    <option value="">-- None --</option>
                    {tables
                      .filter((t) => t.tableType.includes('ForagingEventMild'))
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Rare Event Table</label>
                  <select
                    value={newEnvForagingRareTableId}
                    onChange={(e) => setNewEnvForagingRareTableId(e.target.value)}
                    className="w-full bg-gray-600 px-3 py-2 rounded"
                  >
                    <option value="">-- None --</option>
                    {tables
                      .filter((t) => t.tableType.includes('ForagingEventRare'))
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            </>
          )}

          <div className="w-1/3">
            <label className="block text-xs text-gray-400 mb-1">Skill Modifier</label>
            <input
              type="number"
              value={newEnvSkillMod}
              onChange={(e) => setNewEnvSkillMod(e.target.value)}
              placeholder="e.g., -1"
              className="w-full bg-gray-600 px-3 py-2 rounded"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={addEnvironment} className="flex-1 bg-green-600 px-4 py-2 rounded">
              <Save size={16} className="inline mr-1" /> {editingId ? 'Update' : 'Save'}
            </button>
            <button onClick={resetForm} className="bg-red-600 px-4 py-2 rounded">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {environments.length === 0 ? (
          <p className="text-gray-500 italic">No environments defined. Create gathering locations.</p>
        ) : (
          environments.map((e) => {
            const isExpanded = expandedEnvId === e.id;
            const hasForaging = e.supportedModes?.includes('Foraging');
            const zoneProfile = profileByEnvId[e.id] ?? null;

            return (
              <div key={e.id} className="bg-gray-700 p-3 rounded">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    {hasForaging && (
                      <button
                        onClick={() => setExpandedEnvId(isExpanded ? null : e.id)}
                        className="text-gray-400 hover:text-gray-200"
                        title={isExpanded ? 'Collapse' : 'Expand zone profile'}
                      >
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </button>
                    )}
                    <span className="font-medium">{e.name}</span>
                    {hasForaging && zoneProfile && (
                      <span className="text-xs text-green-400 bg-green-900/30 px-1.5 py-0.5 rounded">
                        Zone Profile
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => editEnvironment(e)} className="text-blue-400">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => onDelete('environment', e.id, e.name)} className="text-red-400">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="text-sm text-gray-400 mt-1">
                  Modes: {e.supportedModes?.join(', ') || 'All'}
                  {e.skillMod !== 0 && (
                    <span className="ml-2">
                      Skill: {e.skillMod >= 0 ? '+' : ''}
                      {e.skillMod}
                    </span>
                  )}
                  {e.locationId ? (
                    <span className="ml-2 text-blue-400">
                      @ {getLocationName(e.locationId) ?? 'Unknown location'}
                    </span>
                  ) : (
                    <span className="ml-2 text-yellow-500">No location (hidden from activities)</span>
                  )}
                </div>

                {/* Zone Profile Editor (expanded) */}
                {hasForaging && isExpanded && (
                  <ZoneProfileEditor
                    environmentId={e.id}
                    locationId={e.locationId}
                    profile={zoneProfile}
                    items={items}
                    onSave={saveForageZoneProfile}
                    onRemove={removeForageZoneProfile}
                  />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
