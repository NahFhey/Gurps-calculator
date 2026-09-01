import { useState, memo } from 'react';
import { BookOpen } from 'lucide-react';
import { RULES_SECTIONS } from './rules/data/rulesContent';
import { RuleSectionView, QuickNavigationView } from './rules/views';
import type { RulesTabProps, ExpandedSections } from '../types/rules';

/**
 * RulesTab - Comprehensive rules reference for all game systems
 *
 * Displays expandable/collapsible documentation for each major system:
 * - Inventory: Materials, food, types, GM mode restrictions
 * - Cooking: Recipe creation, remaking, substitutions, kitchens
 * - Crafting: Project phases, work shifts, quality, templates
 * - Alchemy: Reagents, analysis, formulas, batches, concentration
 * - Manager: GM mode, workers, facilities, import/export
 * - Gathering: Fishing, foraging, species, tools, environments
 *
 * Decomposed from 820 lines to ~50 lines (94% reduction)
 * Content extracted to rules/data/rulesContent.ts (~730 lines)
 * View components in rules/views/
 */
function RulesTabBase({ initialSection = null }: RulesTabProps) {
  const [expandedSections, setExpandedSections] = useState<ExpandedSections>(
    initialSection ? { [initialSection]: true } : {}
  );

  /**
   * Toggles the expanded/collapsed state of a section
   */
  function toggleSection(sectionId: string) {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  }

  return (
    <div className="bg-surface-1 rounded-lg p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <BookOpen size={32} className="text-accent-400" />
        <h1 className="text-2xl font-bold">Game Rules & Systems</h1>
      </div>

      {/* Sections */}
      <div className="space-y-3">
        {RULES_SECTIONS.map(section => (
          <RuleSectionView
            key={section.id}
            section={section}
            isExpanded={!!expandedSections[section.id]}
            onToggle={() => toggleSection(section.id)}
          />
        ))}
      </div>

      {/* Quick Navigation */}
      <QuickNavigationView />
    </div>
  );
}

export const RulesTab = memo(RulesTabBase);
