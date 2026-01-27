import { useState } from 'react';
import { Shield, ShieldOff } from 'lucide-react';
import { refundMaterialsFromProject } from '../utils/helpers';
import { unlockGMData, mergeGM } from '../utils/exportImport';
import { useCampaignStore } from '../state/campaignStore';
import type { ManagerTabProps, GMLockData } from '../types/views';
import type { Id } from '../types/campaign';

// View components
import { FoodTypesView } from './manager/views/FoodTypesView';
import { SkillsView } from './manager/views/SkillsView';
import { ProjectsView } from './manager/views/ProjectsView';
import { AlchemySettingsView } from './manager/views/AlchemySettingsView';
import { WorkersView } from './manager/views/WorkersView';
import { LabsView } from './manager/views/LabsView';
import { KitchensView } from './manager/views/KitchensView';
import { MaterialTypesView } from './manager/views/MaterialTypesView';
import { EffectFamilyMapView } from './manager/views/EffectFamilyMapView';
import { TemplatesView } from './manager/views/TemplatesView';
import { ReagentsView } from './manager/views/ReagentsView';
import { FormulasView } from './manager/views/FormulasView';

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
  | 'workers'
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
  | 'debug';

// Delete confirmation state type
interface DeleteConfirmState {
  type: string;
  value: string;
  id?: Id;
  name?: string;
  templateType?: string;
}

export function ManagerTab({
  foodTypes, materialTypes, workers, crafts, craftDesigns, customTemplates, materials,
  effectFamilyMap, alchemySettings, alchemyReagents, alchemyFormulas, alchemyBatches, alchemyLabs, kitchens, cookingSkills,
  foods, recipes, gmMode, gmLockData, setGmMode, setGmLockData,
  saveMaterials, saveFoods, saveRecipes, saveFoodTypes, saveMaterialTypes, saveWorkers,
  saveCrafts, saveCraftDesigns, saveCustomTemplates, saveEffectFamilyMap,
  saveAlchemySettings, saveAlchemyReagents, saveAlchemyFormulas, saveAlchemyBatches, saveAlchemyLabs, saveKitchens, saveCookingSkills,
  renameMaterialType,
  // Gathering system props
  gatheringSpecies, gatheringTools, gatheringTables, gatheringEnvironments, gatheringBait, gatheringCategories, gatheringItems, currentDay,
  saveGatheringSpecies, saveGatheringTools, saveGatheringTables, saveGatheringEnvironments, saveGatheringBait, saveGatheringCategories, saveGatheringItems, saveCurrentDay
}: ManagerTabProps) {
  const [view, setView] = useState<ManagerView>('foodTypes');
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState | null>(null);
  const [showGMLockModal, setShowGMLockModal] = useState(false);
  const [gmLockError, setGmLockError] = useState<string | null>(null);
  const { state: campaignState, actions: campaignActions } = useCampaignStore();

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
              {campaignState.checkpoints.entries.length}/{campaignState.checkpoints.maxSize}
            </span>
          </div>
          {campaignState.checkpoints.entries.length === 0 ? (
            <div className="mt-3 text-sm text-gray-500">No checkpoints yet.</div>
          ) : (
            <div className="mt-3 space-y-2">
              {campaignState.checkpoints.entries.map((checkpoint) => (
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
                  } else if (deleteConfirm.type === 'worker') {
                    saveWorkers(workers.filter(w => w.id !== deleteConfirm.id));
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
        <button onClick={() => setView('workers')} className={`px-4 py-2 ${view === 'workers' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400'}`}>
          Workers
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

      {view === 'workers' && (
        <WorkersView
          workers={workers}
          saveWorkers={saveWorkers}
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

      {view === 'gathering' && (
        <GatheringManager
          species={gatheringSpecies || []}
          tools={gatheringTools || []}
          tables={gatheringTables || []}
          environments={gatheringEnvironments || []}
          bait={gatheringBait || []}
          categories={gatheringCategories || []}
          items={gatheringItems || []}
          currentDay={currentDay || 1}
          foodTypes={foodTypes || []}
          saveSpecies={saveGatheringSpecies}
          saveTools={saveGatheringTools}
          saveTables={saveGatheringTables}
          saveEnvironments={saveGatheringEnvironments}
          saveBait={saveGatheringBait}
          saveCategories={saveGatheringCategories}
          saveItems={saveGatheringItems}
          saveCurrentDay={saveCurrentDay}
        />
      )}
    </div>
  );
}
