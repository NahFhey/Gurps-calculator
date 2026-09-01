/**
 * Crafting Activity View
 *
 * Full crafting interface integrated into the Downtime panel.
 * Provides sub-navigation between all crafting subsystems:
 * - Projects: View in-progress and completed projects
 * - Workbench: Active project with setup/design/craft phases
 * - Designs: Saved design templates for quick-starting crafts
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { Hammer } from 'lucide-react';
import { useDowntimeContext } from '../DowntimeContext';
import { useCraftingData } from '../../../hooks/useCraftingData';
import { CraftingProjectList } from '../../crafting/CraftingProjectList';
import { CraftingWorkbench } from '../../crafting/CraftingWorkbench';
import { CraftingDesigns } from '../../crafting/CraftingDesigns';
import { SaveDesignModal } from '../../crafting/SaveDesignModal';
import type { Craft, CraftDesign } from '../../../types/campaign';
import { useCampaignStore } from '../../../state/campaignStore';

// ============================================================================
// TYPES
// ============================================================================

type CraftingSubView = 'projects' | 'workbench' | 'designs';

interface CraftingActivityProps {
  /** Current day key for task scheduling */
  currentDayKey: number;
  /** Current time slot for task scheduling */
  currentSlot: number;
}

// ============================================================================
// TAB CONFIGURATION
// ============================================================================

const TABS: { key: CraftingSubView; label: string; getBadge?: (ctx: { projectCount: number; designCount: number }) => string | null }[] = [
  { key: 'projects', label: 'Projects', getBadge: (ctx) => ctx.projectCount > 0 ? `${ctx.projectCount}` : null },
  { key: 'workbench', label: 'Workbench' },
  { key: 'designs', label: 'Designs', getBadge: (ctx) => ctx.designCount > 0 ? `${ctx.designCount}` : null },
];

// ============================================================================
// COMPONENT
// ============================================================================

export function CraftingActivity({ currentDayKey, currentSlot }: CraftingActivityProps) {
  // Downtime context for time slot tracking
  const { state: downtimeState, dispatch: downtimeDispatch, craftingWorkshops } = useDowntimeContext();
  const { state: campaignState, actions: campaignActions } = useCampaignStore();

  // Crafting data hook for sub-views (with save callbacks)
  const {
    materials,
    materialTypes,
    crafts,
    craftDesigns,
    customTemplates,
    workers,
    saveMaterials,
    saveCrafts,
    saveCraftDesigns,
    addLogEntry,
    activeCraftCount,
    designCount,
    weather,
  } = useCraftingData();

  // Sub-view navigation
  const [activeTab, setActiveTab] = useState<CraftingSubView>('projects');
  const consumedIntentRef = useRef<typeof campaignState.ui.pendingIntent>(null);

  useEffect(() => {
    const intent = campaignState.ui.pendingIntent;
    if (intent?.kind !== 'craft' || consumedIntentRef.current === intent) return;

    consumedIntentRef.current = intent;
    setActiveTab('designs');
    campaignActions.clearPendingIntent();
  }, [campaignActions, campaignState.ui.pendingIntent]);

  // Workbench state
  const [currentCraft, setCurrentCraft] = useState<Craft | null>(null);
  const [saveDesignPrompt, setSaveDesignPrompt] = useState<Craft | null>(null);

  // Save design handler
  const handleSaveDesign = useCallback((name: string) => {
    if (!saveDesignPrompt) return;
    const design: CraftDesign = {
      id: crypto.randomUUID(),
      name,
      templateType: saveDesignPrompt.templateType,
      template: saveDesignPrompt.template,
      quality: saveDesignPrompt.currentQuality,
      mods: saveDesignPrompt.mods || [],
      selectedMaterials: saveDesignPrompt.selectedMaterials || [],
      consumedMaterials: saveDesignPrompt.consumedMaterials || [],
      designShifts: saveDesignPrompt.designShifts || saveDesignPrompt.shifts || [],
      savedDate: new Date().toISOString()
    };
    saveCraftDesigns([...(craftDesigns || []), design]);
    setSaveDesignPrompt(null);
  }, [saveDesignPrompt, craftDesigns, saveCraftDesigns]);

  // Badge context
  const badgeCtx = { projectCount: activeCraftCount, designCount };

  return (
    <div className="crafting-activity" data-testid="crafting-activity">
      {/* Save Design Modal */}
      {saveDesignPrompt && (
        <SaveDesignModal
          craft={saveDesignPrompt}
          onSave={handleSaveDesign}
          onSkip={() => setSaveDesignPrompt(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Hammer className="w-6 h-6 text-orange-400" />
        <h3 className="text-lg font-semibold text-fg-bright">Crafting</h3>
      </div>

      {/* Weather Effects Banner */}
      {weather.hasEffect && (
        <div className="mb-4 px-3 py-2 rounded bg-accent-900/30 border border-accent-700/50">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-accent-400">Weather Effect:</span>
            <span className="text-fg-secondary">{weather.effectDescription}</span>
            {weather.locationName && <span className="text-fg-faint text-xs">at {weather.locationName}</span>}
          </div>
        </div>
      )}

      {/* Sub-view Tab Bar */}
      <div className="flex gap-1 mb-4 border-b border-edge overflow-x-auto">
        {TABS.map((tab) => {
          const badge = tab.getBadge?.(badgeCtx);
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-2 text-sm whitespace-nowrap transition-colors ${
                activeTab === tab.key
                  ? 'border-b-2 border-orange-500 text-orange-400'
                  : 'text-fg-muted hover:text-fg-primary'
              }`}
            >
              {tab.label}
              {badge && <span className="ml-1 text-xs text-fg-faint">({badge})</span>}
            </button>
          );
        })}
      </div>

      {/* Sub-view Content */}
      {activeTab === 'projects' && (
        <CraftingProjectList
          crafts={crafts}
          materials={materials}
          materialTypes={materialTypes}
          customTemplates={customTemplates}
          workers={workers}
          saveCrafts={saveCrafts}
          onSelectProject={(craft) => {
            setCurrentCraft(craft);
            setActiveTab('workbench');
          }}
        />
      )}

      {activeTab === 'workbench' && (
        <CraftingWorkbench
          craft={currentCraft}
          materials={materials}
          materialTypes={materialTypes}
          customTemplates={customTemplates}
          workers={workers}
          crafts={crafts}
          craftDesigns={craftDesigns}
          saveMaterials={saveMaterials}
          saveCrafts={saveCrafts}
          saveCraftDesigns={saveCraftDesigns}
          addLogEntry={addLogEntry}
          weatherSkillBonus={weather.skillBonus}
          workshops={craftingWorkshops}
          onProjectCompleted={() => {
            setCurrentCraft(null);
            setActiveTab('projects');
          }}
          onProjectAbandoned={() => {
            setCurrentCraft(null);
            setActiveTab('projects');
          }}
          onDesignPhaseComplete={(craft) => {
            setSaveDesignPrompt(craft);
          }}
          onCraftUpdated={setCurrentCraft}
          downtimeState={downtimeState}
          downtimeDispatch={downtimeDispatch}
          currentDayKey={currentDayKey}
          currentSlot={currentSlot}
        />
      )}

      {activeTab === 'designs' && (
        <CraftingDesigns
          craftDesigns={craftDesigns}
          materials={materials}
          materialTypes={materialTypes}
          customTemplates={customTemplates}
          workers={workers}
          crafts={crafts}
          saveMaterials={saveMaterials}
          saveCrafts={saveCrafts}
          saveCraftDesigns={saveCraftDesigns}
          addLogEntry={addLogEntry}
          onStartFromDesign={(craft) => {
            setCurrentCraft(craft);
            setActiveTab('workbench');
          }}
        />
      )}
    </div>
  );
}
