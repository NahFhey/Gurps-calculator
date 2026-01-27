import { memo } from 'react';

/**
 * QuickNavigationView - Footer navigation hint for the rules tab
 *
 * Simple informational component explaining how to navigate the rules.
 */
function QuickNavigationViewBase() {
  return (
    <div className="mt-6 p-4 bg-blue-900 bg-opacity-30 border border-blue-600 rounded">
      <h3 className="font-semibold text-blue-400 mb-2">Quick Navigation</h3>
      <div className="text-sm text-gray-300">
        Click any section above to expand and view detailed rules. Each section
        contains multiple subsections covering specific mechanics and workflows.
      </div>
    </div>
  );
}

export const QuickNavigationView = memo(QuickNavigationViewBase);
