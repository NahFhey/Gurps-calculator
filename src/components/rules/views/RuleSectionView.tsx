import { memo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { RuleSectionViewProps } from '../../../types/rules';

/**
 * RuleSectionView - Expandable/collapsible documentation section
 *
 * Displays a section header with icon and toggle button.
 * When expanded, shows all subsections with their content.
 */
function RuleSectionViewBase({
  section,
  isExpanded,
  onToggle
}: RuleSectionViewProps) {
  return (
    <div className="bg-surface-2 rounded-lg">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-surface-3 rounded-lg transition-colors"
      >
        <span className="text-2xl">{section.icon}</span>
        <span className="flex-1 text-xl font-semibold">{section.title}</span>
        <span className="text-fg-muted">
          {isExpanded ? <ChevronDown size={24} /> : <ChevronRight size={24} />}
        </span>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-4">
          {section.subsections.map((subsection, idx) => (
            <div key={idx} className="bg-surface-1 rounded p-4">
              <h3 className="text-lg font-semibold text-accent-400 mb-3">
                {subsection.title}
              </h3>
              <div className="text-sm text-fg-secondary space-y-2 whitespace-pre-line">
                {subsection.content}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const RuleSectionView = memo(RuleSectionViewBase);
