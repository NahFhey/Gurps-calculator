/**
 * CraftingDesigns - Saved craft designs that skip the design phase.
 * Extracted from CraftingTab lines 994-1140.
 */

import { QUALITIES } from '../../constants';
import { craftingLog } from '../../utils/activityLogger';
import type {
  Craft,
  CraftDesign,
  Material,
  MaterialType,
  CustomTemplates,
} from '../../types/campaign';
import type { CraftingWorker } from '../../hooks/useCraftingData';
import { useCampaignStore } from '../../state/campaignStore';

interface CraftingDesignsProps {
  craftDesigns: CraftDesign[];
  materials: Material[];
  materialTypes: MaterialType[];
  customTemplates: CustomTemplates;
  workers: CraftingWorker[];
  crafts: Craft[];
  saveMaterials: (materials: Material[]) => void;
  saveCrafts: (crafts: Craft[]) => void;
  saveCraftDesigns: (designs: CraftDesign[]) => void;
  addLogEntry: (entry: any) => void;
  onStartFromDesign: (craft: Craft) => void;
}

export function CraftingDesigns({
  craftDesigns,
  materials,
  materialTypes,
  customTemplates,
  workers: _workers,
  crafts,
  saveMaterials,
  saveCrafts,
  saveCraftDesigns,
  addLogEntry,
  onStartFromDesign,
}: CraftingDesignsProps) {
  void _workers; void saveMaterials; // reserved/refund-compatible props
  const { actions } = useCampaignStore();
  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h2 className="text-xl font-bold mb-4 text-purple-400">Saved Craft Designs</h2>
      <p className="text-sm text-gray-400 mb-4">
        Start crafting immediately from a completed design, skipping the design phase.
      </p>
      <div className="space-y-4">
        {(craftDesigns || []).map(design => {
          const t = customTemplates[design.templateType]?.[design.template] || { weight: 0, hp: 0 };
          const q = QUALITIES[design.quality as keyof typeof QUALITIES] || { htBonus: 0 };

          let avgHT = 10, avgWeightMod = 0, avgHPMod = 0;
          if (design.selectedMaterials && design.selectedMaterials.length > 0) {
            const matTypes = design.selectedMaterials.map(sm => {
              const mat = materials.find(m => m.id === sm.selectedMaterialId || String(m.id) === sm.selectedMaterialId);
              if (!mat || !mat.type) return null;
              return materialTypes.find(mt => mt.name === mat.type);
            }).filter((mt): mt is MaterialType => mt !== null);
            if (matTypes.length > 0) {
              avgHT = Math.round(matTypes.reduce((sum, mt) => sum + mt.ht, 0) / matTypes.length);
              avgWeightMod = matTypes.reduce((sum, mt) => sum + (mt.weightMod || 0), 0) / matTypes.length;
              avgHPMod = matTypes.reduce((sum, mt) => sum + (mt.hpMod || 0), 0) / matTypes.length;
            }
          }

          const finalWeight = Math.round((t.weight || 0) * (1 + avgWeightMod / 100) * 10) / 10;
          const finalHP = Math.round((t.hp || 0) * (1 + avgHPMod / 100));

          const requiredMaterials = design.selectedMaterials || [];
          const canStart = requiredMaterials.every(req => {
            const mat = materials.find(m => m.id === req.selectedMaterialId || String(m.id) === req.selectedMaterialId);
            return mat && mat.quantity >= req.requiredAmount;
          });

          return (
            <div key={design.id} className="bg-purple-900 bg-opacity-20 border border-purple-600 rounded p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="font-semibold text-lg capitalize">{design.name}</h3>
                  <div className="text-sm text-gray-400">
                    {design.templateType} - {design.template} | Quality: {design.quality}
                  </div>
                  <div className="text-sm text-gray-400">
                    W: {finalWeight} lbs | HP: {finalHP} | HT: {avgHT + (q as any).htBonus}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (!canStart) {
                        alert('Insufficient materials to start this design');
                        return;
                      }

                      actions.consumeMaterials('party', requiredMaterials.map(required => {
                        const material = materials.find(entry =>
                          entry.id === required.selectedMaterialId || String(entry.id) === required.selectedMaterialId
                        );
                        return {
                          name: material?.name,
                          type: material?.type ?? required.requiredType,
                          quantity: required.requiredAmount,
                        };
                      }));

                      const today = new Date().toISOString().split('T')[0];
                      const newCraft: Craft = {
                        id: crypto.randomUUID(),
                        phase: 'craft',
                        templateType: design.templateType as Craft['templateType'],
                        template: design.template,
                        quality: design.quality,
                        currentQuality: design.quality,
                        mods: design.mods || [],
                        selectedMaterials: design.selectedMaterials || [],
                        consumedMaterials: (design.consumedMaterials || []).length > 0 ? design.consumedMaterials : design.selectedMaterials.map(sm => {
                          const mat = materials.find(m => m.id === sm.selectedMaterialId || String(m.id) === sm.selectedMaterialId);
                          return {
                            materialId: sm.selectedMaterialId as string,
                            amount: sm.requiredAmount,
                            name: mat?.name || 'unknown',
                            type: mat?.type || sm.requiredType
                          };
                        }),
                        designShifts: design.designShifts || [],
                        shifts: [],
                        startDate: today,
                        startDay: 1
                      };

                      saveCrafts([...crafts, newCraft]);
                      addLogEntry(craftingLog.projectStarted(design.name || design.template || 'Unknown'));
                      onStartFromDesign(newCraft);
                    }}
                    disabled={!canStart}
                    className={`px-4 py-2 rounded ${canStart ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 cursor-not-allowed'}`}
                  >
                    {canStart ? 'Start Craft' : 'Need Materials'}
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete design "${design.name}"?`)) {
                        saveCraftDesigns((craftDesigns || []).filter(d => d.id !== design.id));
                      }
                    }}
                    className="px-4 py-2 bg-red-600 rounded hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
              {requiredMaterials.length > 0 && (
                <div className="text-sm text-gray-400 mt-2">
                  <div className="font-semibold mb-1">Required Materials:</div>
                  <div className="space-y-1">
                    {requiredMaterials.map((req, idx) => {
                      const mat = materials.find(m => m.id === req.selectedMaterialId || String(m.id) === req.selectedMaterialId);
                      const hasEnough = mat && mat.quantity >= req.requiredAmount;
                      return (
                        <div key={idx} className={hasEnough ? 'text-green-400' : 'text-red-400'}>
                          {req.requiredType}: {req.requiredAmount} lbs {mat ? `(${mat.quantity} available)` : '(not found)'}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {(craftDesigns || []).length === 0 && (
          <div className="text-gray-500 italic">No saved designs. Complete a design phase to save one!</div>
        )}
      </div>
    </div>
  );
}
