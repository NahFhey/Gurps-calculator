import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Shield, ShieldOff } from 'lucide-react';
import { refundMaterialsFromProject } from '../utils/helpers';
import { unlockGMData, mergeGM } from '../utils/exportImport';
import { useCampaignStore } from '../state/campaignStore';
import { denormalizeObject, normalizeArray } from '../state/campaignUtils';
import { selectOwnerMaterialHoldings } from '../state/selectors/inventorySelectors';
import type { GMLockData } from '../types/views';
import type { Id, FoodType, MaterialType, Material, AlchemyLab, Kitchen, CookingSkill, AlchemyReagent, AlchemyFormula, CustomTemplates, Craft } from '../types/campaign';

// View components
import { FoodTypesView } from './manager/views/FoodTypesView';
import { SkillsView } from './manager/views/SkillsView';
import { ProjectsView } from './manager/views/ProjectsView';
import { AlchemySettingsView } from './manager/views/AlchemySettingsView';
import { LabsView } from './manager/views/LabsView';
import { KitchensView } from './manager/views/KitchensView';
import { MaterialTypesView } from './manager/views/MaterialTypesView';
import { EffectFamilyMapView } from './manager/views/EffectFamilyMapView';
import { TemplatesView } from './manager/views/TemplatesView';
import { ReagentsView } from './manager/views/ReagentsView';
import { FormulasView } from './manager/views/FormulasView';
import { ToolTemplatesView } from './manager/views/ToolTemplatesView';
import { FacilitiesView } from './manager/views/FacilitiesView';

// Shared components
import { ImportExportPanel } from './ImportExportPanel';
import { GMLockModal } from './GMLockModal';
import { GatheringManager } from './GatheringManager';
import { DebugPanel } from './DebugPanel';

// View types for the navigation tabs
type ManagerView =
  | 'importExport'
  | 'foodTypes'
  | 'materialTypes'
  | 'labs'
  | 'kitchens'
  | 'skills'
  | 'projects'
  | 'templates'
  | 'reagents'
  | 'formulas'
  | 'effectFamilyMap'
  | 'alchemySettings'
  | 'gathering'
  | 'toolTemplates'
  | 'facilities'
  | 'debug';

// Delete confirmation state type
interface DeleteConfirmState {
  type: string;
  value: string;
  id?: Id;
  name?: string;
  templateType?: string;
}

/**
 * ManagerTab - Campaign management interface
 *
 * REFACTORED in Phase 3: Now uses useCampaignStore directly instead of props.
 * This fixes the broken state where legacyAppState.managerTabProps was empty.
 */
export function ManagerTab() {
  const [view, setView] = useState<ManagerView>('foodTypes');
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState | null>(null);
  const [showGMLockModal, setShowGMLockModal] = useState(false);
  const [gmLockError, setGmLockError] = useState<string | null>(null);
  const [gmLockData, setGmLockData] = useState<GMLockData | null>(null);
  const { state: campaignState, actions: campaignActions } = useCampaignStore();
  const [initialPromotionSourceNames, setInitialPromotionSourceNames] = useState<string[] | undefined>();
  const consumedIntentRef = useRef<typeof campaignState.ui.pendingIntent>(null);

  useEffect(() => {
    const intent = campaignState.ui.pendingIntent;
    if (intent?.kind !== 'promote' || consumedIntentRef.current === intent) return;

    consumedIntentRef.current = intent;
    setInitialPromotionSourceNames(intent.sourceNames);
    setView('reagents');
    campaignActions.clearPendingIntent();
  }, [campaignActions, campaignState.ui.pendingIntent]);

  useEffect(() => {
    if (view === 'reagents' && initialPromotionSourceNames !== undefined) {
      setInitialPromotionSourceNames(undefined);
    }
  }, [initialPromotionSourceNames, view]);

  // Derive data from campaign store
  const gmMode = campaignState.ui.gmModeEnabled;
  const setGmMode = campaignActions.setGmMode;

  // Food & Material types
  const foodTypes = campaignState.entities.foodTypes as FoodType[];
  const materialTypes = campaignState.entities.materialTypes as MaterialType[];

  // Crafting
  const crafts = useMemo(() =>
    denormalizeObject(campaignState.entities.crafts) as Craft[],
    [campaignState.entities.crafts]
  );
  const customTemplates = campaignState.entities.customTemplates;
  const materials = useMemo(() => selectOwnerMaterialHoldings(campaignState, 'party'), [campaignState]);

  // Alchemy
  const effectFamilyMap = campaignState.entities.effectFamilyMap;
  const alchemySettings = campaignState.entities.alchemySettings;
  const alchemyReagents = useMemo(() =>
    denormalizeObject(campaignState.entities.alchemyReagents) as AlchemyReagent[],
    [campaignState.entities.alchemyReagents]
  );
  const alchemyFormulas = useMemo(() =>
    denormalizeObject(campaignState.entities.alchemyFormulas) as AlchemyFormula[],
    [campaignState.entities.alchemyFormulas]
  );
  const alchemyLabs = useMemo(() =>
    denormalizeObject(campaignState.entities.alchemyLabs) as AlchemyLab[],
    [campaignState.entities.alchemyLabs]
  );

  // Cooking
  const kitchens = useMemo(() =>
    denormalizeObject(campaignState.entities.kitchens) as Kitchen[],
    [campaignState.entities.kitchens]
  );
  const cookingSkills = campaignState.entities.cookingSkills as CookingSkill[];

  // Gathering is managed by GatheringManager directly

  // Save callbacks
  const saveFoodTypes = useCallback((types: (FoodType | string)[]) => {
    campaignActions.setFoodTypes(types as FoodType[]);
  }, [campaignActions]);

  const saveMaterialTypes = useCallback((types: MaterialType[]) => {
    campaignActions.setMaterialTypes(types);
  }, [campaignActions]);


  const saveMaterials = useCallback((mats: Material[]) => {
    for (const current of materials) if (!mats.some(entry => entry.id === current.id)) campaignActions.removeMaterial(current.id);
    for (const material of mats) {
      if (materials.some(entry => entry.id === material.id)) campaignActions.updateMaterial(material.id, material);
      else campaignActions.addMaterial(material);
    }
  }, [campaignActions, materials]);

  const saveCrafts = useCallback((craftsList: Craft[]) => {
    campaignActions.setCrafts(normalizeArray(craftsList));
  }, [campaignActions]);

  const saveCustomTemplates = useCallback((templates: CustomTemplates) => {
    campaignActions.setCustomTemplates(templates);
  }, [campaignActions]);

  const saveEffectFamilyMap = useCallback((map: typeof effectFamilyMap) => {
    campaignActions.setEffectFamilyMap(map);
  }, [campaignActions]);

  const saveAlchemySettings = useCallback((settings: typeof alchemySettings) => {
    campaignActions.updateAlchemySettings(settings);
  }, [campaignActions]);

  const saveAlchemyReagents = useCallback((reagents: AlchemyReagent[]) => {
    campaignActions.setAlchemyReagents(normalizeArray(reagents));
  }, [campaignActions]);

  const saveAlchemyFormulas = useCallback((formulas: AlchemyFormula[]) => {
    campaignActions.setAlchemyFormulas(normalizeArray(formulas));
  }, [campaignActions]);

  const saveAlchemyLabs = useCallback((labs: AlchemyLab[]) => {
    campaignActions.setAlchemyLabs(normalizeArray(labs));
  }, [campaignActions]);

  const saveKitchens = useCallback((kitchensList: Kitchen[]) => {
    campaignActions.setKitchens(normalizeArray(kitchensList));
  }, [campaignActions]);

  const saveCookingSkills = useCallback((skills: CookingSkill[]) => {
    campaignActions.setCookingSkills(skills);
  }, [campaignActions]);

  const renameMaterialType = useCallback((oldName: string, newName: string) => {
    // Update material type name in types list
    const updatedTypes = materialTypes.map(t =>
      t.name === oldName ? { ...t, name: newName } : t
    );
    saveMaterialTypes(updatedTypes);

    // Update all materials that use this type
    const updatedMaterials = materials.map(m =>
      m.type === oldName ? { ...m, type: newName } : m
    );
    saveMaterials(updatedMaterials);
  }, [materialTypes, materials, saveMaterialTypes, saveMaterials]);

  // Gathering save callbacks removed — GatheringManager handles its own state

  // Delete handler for all views
  function handleDelete(type: string, value: string, extra: { id?: Id; templateType?: string } = {}) {
    setDeleteConfirm({ type, value, ...extra });
  }

  // Handle GM mode toggle
  const handleGMModeToggle = () => {
    if (!gmMode) {
      // Entering GM mode
      if (gmLockData) {
        // Locked import - show password modal
        setShowGMLockModal(true);
      } else {
        // No lock - enable GM mode with warning
        if (confirm('No password lock detected. GM mode will be accessible to anyone with this file. Continue?')) {
          setGmMode(true);
        }
      }
    } else {
      // Exiting GM mode
      setGmMode(false);
    }
  };

  // Handle GM unlock with password
  const handleGMUnlock = (password: string) => {
    if (!password) {
      setGmLockError('Password is required');
      return;
    }

    if (!gmLockData || !gmLockData.encryptedData) {
      setGmLockError('No encrypted data found');
      return;
    }

    try {
      const decryptedState = unlockGMData(gmLockData as GMLockData, password);
      if (decryptedState) {
        // Merge GM data into campaign state
        mergeGM(campaignActions, decryptedState);
        setGmMode(true);
        setShowGMLockModal(false);
        setGmLockError(null);
      } else {
        setGmLockError('Incorrect password');
      }
    } catch (error) {
      setGmLockError('Decryption failed: ' + (error as Error).message);
    }
  };

  // Handle import
  const handleImport = () => {
    // The import is handled by ImportExportPanel, which calls campaignActions.importState
    // Just close GM lock modal if it's open
    setShowGMLockModal(false);
    setGmLockError(null);
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      {/* GM Lock Modal */}
      <GMLockModal
        isOpen={showGMLockModal}
        onClose={() => {
          setShowGMLockModal(false);
          setGmLockError(null);
        }}
        onUnlock={handleGMUnlock}
        error={gmLockError}
      />

      {/* GM/Player Mode Toggle */}
      <div className="mb-6 flex items-center justify-between bg-gray-700 border border-gray-600 rounded-lg p-4">
        <div className="flex items-center gap-3">
          {gmMode ? (
            <Shield className="text-yellow-400" size={24} />
          ) : (
            <ShieldOff className="text-gray-400" size={24} />
          )}
          <div>
            <h3 className="text-lg font-semibold text-gray-100">
              {gmMode ? 'GM Mode Active' : 'Player Mode'}
            </h3>
            <p className="text-sm text-gray-400">
              {gmMode
                ? 'Full access to all features, hazards, and GM content'
                : 'Limited access - GM content hidden'}
            </p>
          </div>
        </div>
        <button
          onClick={handleGMModeToggle}
          className={`px-6 py-3 rounded-lg font-semibold transition flex items-center gap-2 ${
            gmMode
              ? 'bg-yellow-600 hover:bg-yellow-500 text-white'
              : 'bg-blue-600 hover:bg-blue-500 text-white'
          }`}
        >
          {gmMode ? (
            <>
              <ShieldOff size={18} />
              Exit GM Mode
            </>
          ) : (
            <>
              <Shield size={18} />
              Enable GM Mode
            </>
          )}
        </button>
      </div>

      {/* Checkpoints (GM Only) */}
      {gmMode && (
        <div className="mb-6 rounded-lg border border-gray-700 bg-gray-700/40 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-100">Checkpoints</h3>
              <p className="text-sm text-gray-400">
                Snapshots are created before major changes. Restore to roll back campaign state.
              </p>
            </div>
            <span className="text-xs text-gray-400">
              {(campaignState.checkpoints?.entries?.length ?? 0)}/{campaignState.checkpoints?.maxSize ?? 10}
            </span>
          </div>
          {(campaignState.checkpoints?.entries?.length ?? 0) === 0 ? (
            <div className="mt-3 text-sm text-gray-500">No checkpoints yet.</div>
          ) : (
            <div className="mt-3 space-y-2">
              {(campaignState.checkpoints?.entries ?? []).map((checkpoint) => (
                <div
                  key={checkpoint.id}
                  className="flex items-center justify-between rounded-lg bg-gray-800 px-3 py-2"
                >
                  <div>
                    <div className="text-sm font-semibold text-gray-100">{checkpoint.label}</div>
                    <div className="text-xs text-gray-500">
                      {new Date(checkpoint.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => campaignActions.restoreCheckpoint(checkpoint.id)}
                    className="rounded-md bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-500"
                  >
                    Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg max-w-md border-2 border-gray-600">
            <h3 className="text-xl font-bold mb-4">Confirm Delete</h3>
            <p className="mb-6">
              {deleteConfirm.type === 'foodType' ? `Delete type "${deleteConfirm.value}"?` :
               deleteConfirm.type === 'materialType' ? `Delete type "${deleteConfirm.value}"?` :
               deleteConfirm.type === 'worker' ? `Delete worker "${deleteConfirm.value}"?` :
               deleteConfirm.type === 'lab' ? `Delete lab "${deleteConfirm.value}"?` :
               deleteConfirm.type === 'kitchen' ? `Delete kitchen "${deleteConfirm.value}"?` :
               deleteConfirm.type === 'cookingSkill' ? `Delete cooking skill "${deleteConfirm.value}"?` :
               deleteConfirm.type === 'project' ? `Delete project "${deleteConfirm.name}"?` :
               deleteConfirm.type === 'reagent' ? `Delete reagent "${deleteConfirm.value}"?` :
               deleteConfirm.type === 'formula' ? `Delete formula "${deleteConfirm.value}"?` :
               `Delete template "${deleteConfirm.value}"?`}
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 bg-gray-600 rounded">
                Cancel
              </button>
              <button
                onClick={() => {
                  if (deleteConfirm.type === 'foodType') {
                    saveFoodTypes(foodTypes.filter(t => {
                      const typeName = typeof t === 'string' ? t : t.name;
                      return typeName !== deleteConfirm.value;
                    }));
                  } else if (deleteConfirm.type === 'materialType') {
                    saveMaterialTypes(materialTypes.filter(t => t.name !== deleteConfirm.value));
                  } else if (deleteConfirm.type === 'lab') {
                    saveAlchemyLabs(alchemyLabs.filter(l => l.id !== deleteConfirm.id));
                  } else if (deleteConfirm.type === 'kitchen') {
                    saveKitchens(kitchens.filter(k => k.id !== deleteConfirm.id));
                  } else if (deleteConfirm.type === 'cookingSkill') {
                    saveCookingSkills(cookingSkills.filter(s => s.id !== deleteConfirm.id));
                  } else if (deleteConfirm.type === 'reagent') {
                    saveAlchemyReagents((alchemyReagents || []).filter(r => r.id !== deleteConfirm.id));
                  } else if (deleteConfirm.type === 'formula') {
                    saveAlchemyFormulas(alchemyFormulas.filter(f => f.id !== deleteConfirm.id));
                  } else if (deleteConfirm.type === 'project') {
                    const proj = crafts.find(c => c.id === deleteConfirm.id);
                    if (proj && !proj.completed) {
                      const refunded = refundMaterialsFromProject(proj, materials);
                      saveMaterials(refunded);
                    }
                    saveCrafts(crafts.filter(c => c.id !== deleteConfirm.id));
                  } else if (deleteConfirm.type === 'template' && deleteConfirm.templateType) {
                    const templateType = deleteConfirm.templateType as keyof typeof customTemplates;
                    const typeTemplates = { ...customTemplates[templateType] };
                    delete typeTemplates[deleteConfirm.value];
                    saveCustomTemplates({
                      ...customTemplates,
                      [deleteConfirm.templateType]: typeTemplates
                    });
                  }
                  setDeleteConfirm(null);
                }}
                className="px-4 py-2 bg-red-600 rounded"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-700 flex-wrap">
        <button onClick={() => setView('importExport')} className={`px-4 py-2 ${view === 'importExport' ? 'border-b-2 border-green-500 text-green-400' : 'text-gray-400'}`}>
          Import/Export
        </button>
        <button onClick={() => setView('foodTypes')} className={`px-4 py-2 ${view === 'foodTypes' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400'}`}>
          Food Types
        </button>
        <button onClick={() => setView('materialTypes')} className={`px-4 py-2 ${view === 'materialTypes' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400'}`}>
          Material Types
        </button>
        <button onClick={() => setView('labs')} className={`px-4 py-2 ${view === 'labs' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400'}`}>
          Labs
        </button>
        <button onClick={() => setView('kitchens')} className={`px-4 py-2 ${view === 'kitchens' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400'}`}>
          Kitchens
        </button>
        <button onClick={() => setView('skills')} className={`px-4 py-2 ${view === 'skills' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400'}`}>
          Skills
        </button>
        <button onClick={() => setView('projects')} className={`px-4 py-2 ${view === 'projects' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400'}`}>
          Projects
        </button>
        <button onClick={() => setView('templates')} className={`px-4 py-2 ${view === 'templates' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400'}`}>
          Templates
        </button>
        <button onClick={() => setView('reagents')} className={`px-4 py-2 ${view === 'reagents' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400'}`}>
          Reagents
        </button>
        <button onClick={() => setView('formulas')} className={`px-4 py-2 ${view === 'formulas' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400'}`}>
          Formulas
        </button>
        <button onClick={() => setView('effectFamilyMap')} className={`px-4 py-2 ${view === 'effectFamilyMap' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400'}`}>
          Effect Map
        </button>
        <button onClick={() => setView('alchemySettings')} className={`px-4 py-2 ${view === 'alchemySettings' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400'}`}>
          Alchemy Settings
        </button>
        <button onClick={() => setView('gathering')} className={`px-4 py-2 ${view === 'gathering' ? 'border-b-2 border-cyan-500 text-cyan-400' : 'text-gray-400'}`}>
          Gathering
        </button>
        <button onClick={() => setView('toolTemplates')} className={`px-4 py-2 ${view === 'toolTemplates' ? 'border-b-2 border-purple-500 text-purple-400' : 'text-gray-400'}`}>
          Tool Templates
        </button>
        <button onClick={() => setView('facilities')} className={`px-4 py-2 ${view === 'facilities' ? 'border-b-2 border-purple-500 text-purple-400' : 'text-gray-400'}`}>
          Facilities
        </button>
        {gmMode && (
          <button
            onClick={() => setView('debug')}
            className={`px-4 py-2 ${view === 'debug' ? 'border-b-2 border-amber-500 text-amber-400' : 'text-gray-400'}`}
          >
            Debug
          </button>
        )}
      </div>

      {/* View Router */}
      {view === 'importExport' && (
        <ImportExportPanel
          state={campaignState}
          gmMode={gmMode}
          gmLockData={gmLockData}
          setGmMode={setGmMode}
          setGmLockData={setGmLockData}
          onImport={handleImport}
          onShowGMLockModal={() => setShowGMLockModal(true)}
        />
      )}

      {view === 'debug' && gmMode && <DebugPanel />}

      {view === 'foodTypes' && (
        <FoodTypesView
          foodTypes={foodTypes}
          saveFoodTypes={saveFoodTypes}
          onDelete={handleDelete}
        />
      )}

      {view === 'materialTypes' && (
        <MaterialTypesView
          materialTypes={materialTypes}
          saveMaterialTypes={saveMaterialTypes}
          renameMaterialType={renameMaterialType}
          onDelete={handleDelete}
        />
      )}

      {view === 'labs' && (
        <LabsView
          alchemyLabs={alchemyLabs}
          saveAlchemyLabs={saveAlchemyLabs}
          onDelete={handleDelete}
        />
      )}

      {view === 'kitchens' && (
        <KitchensView
          kitchens={kitchens}
          saveKitchens={saveKitchens}
          onDelete={handleDelete}
        />
      )}

      {view === 'skills' && (
        <SkillsView
          cookingSkills={cookingSkills}
          saveCookingSkills={saveCookingSkills}
          gmMode={gmMode}
          onDelete={handleDelete}
        />
      )}

      {view === 'projects' && (
        <ProjectsView
          crafts={crafts}
          onDelete={handleDelete}
        />
      )}

      {view === 'templates' && (
        <TemplatesView
          customTemplates={customTemplates}
          materialTypes={materialTypes}
          saveCustomTemplates={saveCustomTemplates}
          onDelete={handleDelete}
        />
      )}

      {view === 'reagents' && (
        <ReagentsView
          alchemyReagents={alchemyReagents}
          saveAlchemyReagents={saveAlchemyReagents}
          onDelete={handleDelete}
          initialPromotionSourceNames={initialPromotionSourceNames}
        />
      )}

      {view === 'formulas' && (
        <FormulasView
          alchemyReagents={alchemyReagents}
          alchemyFormulas={alchemyFormulas}
          saveAlchemyFormulas={saveAlchemyFormulas}
          onDelete={handleDelete}
        />
      )}

      {view === 'effectFamilyMap' && (
        <EffectFamilyMapView
          effectFamilyMap={effectFamilyMap}
          saveEffectFamilyMap={saveEffectFamilyMap}
        />
      )}

      {view === 'alchemySettings' && (
        <AlchemySettingsView
          alchemySettings={alchemySettings}
          saveAlchemySettings={saveAlchemySettings}
        />
      )}

      {view === 'gathering' && <GatheringManager />}

      {view === 'toolTemplates' && <ToolTemplatesView />}

      {view === 'facilities' && <FacilitiesView />}
    </div>
  );
}
